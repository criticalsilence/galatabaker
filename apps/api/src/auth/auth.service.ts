/**
 * GalataBaker API — Auth service.
 *
 * SIWW (Sign-In With Wallet) doğrulama akışı:
 *   1. Client GET  /api/auth/challenge  → ChallengeService.create()
 *   2. Client message'ı cüzdanla imzalar (Temple / Kukai)
 *   3. Client POST /api/auth/verify    → { walletPkh, publicKey, signature, nonce, timestamp }
 *   4. Server:
 *      a. ChallengeService.consume(nonce)         — replay koruması (tek kullanımlık)
 *      b. Timestamp skew kontrolü (±5 dk)
 *      c. Canonical message'ı yeniden kur
 *      d. Tezos ed25519 signature verify           — TZIP-32 format
 *      e. walletPkh ↔ publicKey derivation match   — getPkhfromPk()
 *      f. User upsert (idempotent)
 *      g. JWT sign + return
 *
 * ── Tezos SIWW signed payload formatı (TZIP-32) ─────────────────────────
 *   Cüzdan şu payload'ın blake2b-256 hash'ini imzalar:
 *
 *     ┌─────────────────────────────────────────────────────────────┐
 *     │ 0x01  (1 byte — "generic signed message" magic)             │
 *     │ "Tezos Signed Message:\n"  (24 bytes — UTF-8)               │
 *     │ msgLen  (4 bytes — big-endian UTF-8 message length)         │
 *     │ message (N bytes — UTF-8 canonical message)                 │
 *     │ publicKey (32 bytes — ed25519 raw pubkey)                   │
 *     └─────────────────────────────────────────────────────────────┘
 *
 *   - Toplam 61 + N bytes
 *   - ed25519 imzası bu payload'ın **blake2b-256** hash'i üzerine atılır
 *     (Tezos custom — RFC 8032 SHA-512 değil)
 *   - @taquito/utils'ın `verifySignature()`'ı bu blake2b + prefix check +
 *     curve dispatch'i kendisi yapıyor; burada sadece payload'ı kuruyoruz.
 *
 * ── Public key → Tezos address (tz1, ed25519) ─────────────────────────
 *   Resmi Taquito `getPkhfromPk()` fonksiyonu:
 *     1. Public key base58 decode (prefix otomatik validate)
 *     2. blake2b(pubkey, 20)
 *     3. b58Encode(hash, PrefixV2.Ed25519PublicKeyHash)
 *        → 3-byte prefix: [0x06, 0xa1, 0x9f]
 *
 *   ──────────────────────────────────────────────────────────────────
 *   NOT (DRY): apps/web shared `packages/sdk`'te Beacon SDK kullanıyor.
 *   apps/api burada bağımsız implementasyon yaptı çünkü Beacon SDK 4.x
 *   `getPkhfromPk` / `verifySignature` fonksiyonlarını export etmiyor.
 *   Adım 8'de `@galatabaker/crypto-utils` paketi çıkarıp her iki tarafın
 *   da kullanması hedefleniyor.
 */
import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { concatBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { b58DecodeAndCheckPrefix, getPkhfromPk, PrefixV2, verifySignature } from '@taquito/utils';

import { NotificationService } from '../notifications/notification.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';
import type { JWTPayload, SIWWInput, SIWWResult } from './auth.types.js';
import { ChallengeService } from './challenge.service.js';

/**
 * Tezos SIWW watermark (TZIP-32 "generic signed message"):
 *   0x01 magic + "Tezos Signed Message:\n" string. Toplam 25 bytes.
 *
 * Toplam signed payload: watermark(25) + msgLen(4) + msg(N) + pubkey(32)
 *                       = 61 + N bytes
 */
const TEZOS_WATERMARK: Uint8Array = concatBytes(
  new Uint8Array([0x01]),
  utf8ToBytes('Tezos Signed Message:\n'),
);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    private readonly challenges: ChallengeService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly notifications: NotificationService,
  ) {}

  /**
   * Full SIWW verify pipeline. Bütün adımlar sırayla:
   *   nonce consume → timestamp skew → signature → pkh derivation → upsert → JWT
   */
  async verifyAndConnect(input: SIWWInput): Promise<SIWWResult> {
    // 1. Challenge tek-kullanımlık kontrolü (replay protection)
    if (!this.challenges.consume(input.nonce)) {
      throw new UnauthorizedException('Invalid or expired nonce');
    }

    // 2. Timestamp skew kontrolü
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - input.timestamp) > this.config.SIWW_MAX_TIMESTAMP_SKEW) {
      throw new UnauthorizedException('Timestamp out of acceptable range');
    }

    // 3. Canonical message'ı yeniden kur (client ile aynı format)
    const message = this.buildCanonicalMessage(input.nonce, input.timestamp);

    // 4. Tezos ed25519 signature verify (TZIP-32 format, blake2b-256 + ed25519)
    let isValid = false;
    try {
      isValid = this.verifyTezosSignedMessage(input.publicKey, input.signature, message);
    } catch (err) {
      this.logger.warn(`[auth] signature verify error: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid signature format');
    }

    if (!isValid) {
      this.logger.warn(`[auth] signature invalid pkh=${input.walletPkh}`);
      throw new UnauthorizedException('Signature verification failed');
    }

    // 5. walletPkh ↔ publicKey derivation match
    //    (client'ın iddia ettiği adres, public key'den türetilenle aynı mı?)
    const derivedAddress = this.publicKeyToAddress(input.publicKey);
    if (derivedAddress !== input.walletPkh) {
      this.logger.warn(`[auth] pkh mismatch expected=${input.walletPkh} derived=${derivedAddress}`);
      throw new UnauthorizedException('Public key does not match wallet address');
    }

    // 6. User upsert (idempotent — ilk bağlanışta oluştur).
    //    upsert yerine findUnique + create yapıyoruz ki "ilk bağlanış"
    //    olayını yakalayıp register_confirmation notification'ı tetikleyelim.
    let isFirstTime = false;
    const existing = await this.prisma.user.findUnique({
      where: { walletPkh: input.walletPkh },
    });
    if (!existing) {
      await this.prisma.user.create({ data: { walletPkh: input.walletPkh } });
      isFirstTime = true;
    }

    // 7. JWT sign
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = { sub: input.walletPkh };
    const accessToken = await this.jwt.signAsync(payload);
    const decoded = this.jwt.decode<JWTPayload>(accessToken);

    this.logger.log(`[auth] SIWW success pkh=${input.walletPkh} firstTime=${isFirstTime}`);

    // 8. Trigger: register_confirmation on first-time users (fire-and-forget).
    //    NotificationService handles its own errors — we don't await failure.
    if (isFirstTime) {
      void this.notifications
        .enqueue({
          walletPkh: input.walletPkh,
          kind: 'register_confirmation',
          vars: { walletPkh: input.walletPkh },
        })
        .catch((err) =>
          this.logger.warn(
            `[auth] register_notification enqueue failed: ${(err as Error).message}`,
          ),
        );
    }

    return {
      accessToken,
      walletPkh: input.walletPkh,
      expiresAt: decoded?.exp ?? now + this.config.JWT_TTL_SECONDS,
    };
  }

  /**
   * Canonical SIWW message (client + server aynı format üretmeli).
   *
   * Format:
   *   GalataBaker SIWW
   *   domain: <SIWW_DOMAIN>
   *   nonce: <base64url nonce>
   *   timestamp: <unix seconds>
   *
   * Public — ChallengeService ve test helper'lar kullanır.
   */
  buildCanonicalMessage(nonce: string, timestamp: number): string {
    return [
      'GalataBaker SIWW',
      `domain: ${this.config.SIWW_DOMAIN}`,
      `nonce: ${nonce}`,
      `timestamp: ${timestamp}`,
    ].join('\n');
  }

  /**
   * Tezos SIWW imza doğrulama (TZIP-32).
   *
   * @taquito/utils verifySignature(message, pk, sig, watermark):
   *   - `pk` ve `sig`'i base58 decode eder (prefix check)
   *   - mergebuf(watermark, message) çağırır
   *   - blake2b(merged, 32) hash'ler
   *   - curve dispatch (ed25519 için ed25519.verify)
   *
   * Burada `message` parametresi payload'ın watermark-sonrası kısmı:
   *   [msgLen] [msg] [pubkey]
   *
   * @returns true if signature is valid for given public key and message
   * @throws if public key or signature format is invalid (prefix/length/checksum)
   */
  verifyTezosSignedMessage(publicKeyB58: string, signatureB58: string, message: string): boolean {
    // MVP'de sadece edpk/tz1 destekliyoruz — prefix check'i en başta yap ki
    // Taquito'nun b58DecodeAndCheckPrefix'i generic "PREFIX_NOT_ALLOWED"
    // hatası fır-latmasın, bizim net mesajımız dönsün.
    if (!publicKeyB58.startsWith(PrefixV2.Ed25519PublicKey)) {
      throw new Error('Only edpk (tz1) public keys supported in MVP');
    }

    // Public key → raw 32 bytes (suffix olarak payload'a eklemek için)
    // Taquito verifySignature kendi içinde tekrar decode edecek, fakat
    // payload'ın suffix'inde raw pubkey lazım.
    const [publicKey] = b58DecodeAndCheckPrefix(publicKeyB58, [PrefixV2.Ed25519PublicKey]);
    if (publicKey.length !== 32) {
      throw new Error(`Invalid public key length: ${publicKey.length}`);
    }

    // Message → UTF-8 bytes + 4-byte big-endian length prefix
    const msgBytes = utf8ToBytes(message);
    const msgLen = new Uint8Array(4);
    new DataView(msgLen.buffer).setUint32(0, msgBytes.length, false);

    // Watermark-sonrası payload: msgLen || msg || pubkey
    // Taquito watermark'ı prepend edip blake2b-256 hash'leyecek.
    const messagePart = concatBytes(msgLen, msgBytes, publicKey);

    try {
      return verifySignature(messagePart, publicKeyB58, signatureB58, TEZOS_WATERMARK);
    } catch {
      // Corrupted signature / invalid checksum / wrong curve — auth fails silently
      // (caller will translate false → 401 "Signature verification failed")
      return false;
    }
  }

  /**
   * Public key (edpk) → Tezos address (tz1).
   *
   * Resmi Taquito `getPkhfromPk()` kullanır — tüm 4 curve'ü (ed25519,
   * secp256k1, p256, bls12-381) doğru tanır. Prefix'ler:
   *   tz1 (ed25519)      [0x06, 0xa1, 0x9f]  ← 3 byte
   *   tz2 (secp256k1)    [0x06, 0xa1, 0xa1]
   *   tz3 (p256)         [0x06, 0xa1, 0xa4]
   *   tz4 (bls12-381)    [0x06, 0xa1, 0xa6]
   *
   * NOT: MVP'de sadece edpk/tz1 kabul ediyoruz — Taquito getPkhfromPk
   * tüm curve'leri doğru derive eder, fakat publicKeyToAddress'ı
   * `verifyTezosSignedMessage` ile aynı kısıtta tutuyoruz (tutarlılık).
   *
   * @throws UnauthorizedException if public key is not edpk (tz1) format
   */
  publicKeyToAddress(publicKeyB58: string): string {
    if (!publicKeyB58.startsWith(PrefixV2.Ed25519PublicKey)) {
      throw new UnauthorizedException('Only edpk (tz1) public keys supported in MVP');
    }
    try {
      return getPkhfromPk(publicKeyB58);
    } catch (err) {
      throw new UnauthorizedException(`Invalid public key: ${(err as Error).message}`);
    }
  }
}
