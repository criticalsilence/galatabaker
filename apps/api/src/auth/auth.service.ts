/**
 * GalataBaker API — Auth service.
 *
 * SIWW (Sign-In With Wallet) doğrulama akışı:
 *   1. Client GET /api/auth/challenge → ChallengeService.create()
 *   2. Client message'ı cüzdanla imzalar (Temple/Kukai)
 *   3. Client POST /api/auth/verify { walletPkh, publicKey, signature, nonce, timestamp }
 *   4. Server:
 *      a. ChallengeService.consume(nonce) — replay koruması
 *      b. Timestamp skew kontrolü
 *      c. Canonical message'ı yeniden kur
 *      d. Tezos ed25519 signature verify (watermark ile)
 *      e. walletPkh ↔ publicKey derivation match
 *      f. User upsert (idempotent)
 *      g. JWT sign + return
 *
 * Tezos ed25519 signed message format (TZIP-XXX):
 *   magic: 0x01 0x09 "Tezos Signed Message:\n"  (24 bytes)
 *   message_length: 4 bytes big-endian
 *   message: UTF-8 bytes
 *   public_key: 32 bytes
 *
 * Public key → tz1 address:
 *   1. blake2b(publicKey, 20 bytes)
 *   2. prepend 0x00 0x01 0xa7 (tz1 prefix)
 *   3. base58check encode
 *
 * Not: apps/web shared packages/sdk'te Beacon SDK kullanıyor. apps/api
 * burada bağımsız implementasyon yaptı — çünkü Beacon SDK 4.x'in
 * gerekli fonksiyonları export edilmiyor. Üretimde packages/sdk'e
 * taşımak mantıklı olabilir (DRY).
 */
import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ed25519 } from '@noble/curves/ed25519.js';
import { blake2b } from '@noble/hashes/blake2.js';
import { utf8ToBytes, concatBytes } from '@noble/hashes/utils.js';
import bs58check from 'bs58check';

import { PrismaService } from '../prisma/prisma.service.js';

import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';
import type { JWTPayload, SIWWInput, SIWWResult } from './auth.types.js';
import { ChallengeService } from './challenge.service.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    private readonly challenges: ChallengeService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async verifyAndConnect(input: SIWWInput): Promise<SIWWResult> {
    // 1. Challenge tek kullanımlık kontrolü
    if (!this.challenges.consume(input.nonce)) {
      throw new UnauthorizedException('Invalid or expired nonce');
    }

    // 2. Timestamp skew kontrolü
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - input.timestamp) > this.config.SIWW_MAX_TIMESTAMP_SKEW) {
      throw new UnauthorizedException('Timestamp out of acceptable range');
    }

    // 3. Canonical message'ı yeniden kur
    const message = this.buildCanonicalMessage(input.nonce, input.timestamp);

    // 4. Signature verify
    let isValid = false;
    try {
      isValid = this.verifyTezosEd25519Signature(input.publicKey, input.signature, message);
    } catch (err) {
      this.logger.warn(`[auth] signature verify error: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid signature format');
    }

    if (!isValid) {
      this.logger.warn(`[auth] signature invalid pkh=${input.walletPkh}`);
      throw new UnauthorizedException('Signature verification failed');
    }

    // 5. walletPkh ↔ publicKey derivation match
    const derivedAddress = this.publicKeyToAddress(input.publicKey);
    if (derivedAddress !== input.walletPkh) {
      this.logger.warn(`[auth] pkh mismatch expected=${input.walletPkh} derived=${derivedAddress}`);
      throw new UnauthorizedException('Public key does not match wallet address');
    }

    // 6. User upsert (idempotent)
    await this.prisma.user.upsert({
      where: { walletPkh: input.walletPkh },
      create: { walletPkh: input.walletPkh },
      update: {},
    });

    // 7. JWT sign
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = { sub: input.walletPkh };
    const accessToken = await this.jwt.signAsync(payload);
    const decoded = this.jwt.decode<JWTPayload>(accessToken);

    this.logger.log(`[auth] SIWW success pkh=${input.walletPkh}`);

    return {
      accessToken,
      walletPkh: input.walletPkh,
      expiresAt: decoded?.exp ?? now + this.config.JWT_TTL_SECONDS,
    };
  }

  /**
   * Canonical message (client + server aynı format üretmeli).
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
   * Tezos ed25519 signature doğrulama (TZIP-XXX signed message format).
   *
   * @returns true if signature is valid for given public key and message
   * @throws if public key or signature format is invalid
   */
  verifyTezosEd25519Signature(
    publicKeyB58: string,
    signatureB58: string,
    message: string,
  ): boolean {
    if (!publicKeyB58.startsWith('edpk') || !signatureB58.startsWith('edsig')) {
      return false;
    }

    const publicKey = bs58check.decode(publicKeyB58);
    const signature = bs58check.decode(signatureB58);

    if (publicKey.length !== 32) {
      throw new Error(`Invalid public key length: ${publicKey.length}`);
    }
    if (signature.length !== 64) {
      throw new Error(`Invalid signature length: ${signature.length}`);
    }

    // Build signed payload: watermark + msgLen + msg + pubkey
    const watermark = concatBytes(
      new Uint8Array([0x01, 0x09]),
      utf8ToBytes('Tezos Signed Message:\n'),
    );
    const msgBytes = utf8ToBytes(message);
    const msgLen = new Uint8Array(4);
    new DataView(msgLen.buffer).setUint32(0, msgBytes.length, false);

    const signedPayload = concatBytes(watermark, msgLen, msgBytes, publicKey);

    return ed25519.verify(signature, signedPayload, publicKey);
  }

  /**
   * Public key (edpk) → Tezos address (tz1).
   *
   *   blake2b(publicKey, 20 bytes) → prepend 0x00 0x01 0xa7 → base58check
   */
  publicKeyToAddress(publicKeyB58: string): string {
    if (!publicKeyB58.startsWith('edpk')) {
      throw new UnauthorizedException('Only edpk (tz1) supported in MVP');
    }
    const publicKey = bs58check.decode(publicKeyB58);
    if (publicKey.length !== 32) {
      throw new UnauthorizedException('Invalid public key length');
    }

    // 1. Blake2b hash (20 bytes)
    const hash = blake2b(publicKey, { dkLen: 20 });

    // 2. Prepend tz1 prefix bytes
    const prefix = new Uint8Array([0x00, 0x01, 0xa7]);
    const addressBytes = concatBytes(prefix, hash);

    // 3. Base58check encode
    return bs58check.encode(addressBytes);
  }
}
