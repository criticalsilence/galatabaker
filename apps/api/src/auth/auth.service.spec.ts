/**
 * GalataBaker API — AuthService unit tests.
 *
 * Test stratejisi:
 *   - buildCanonicalMessage: format doğrulama
 *   - publicKeyToAddress: Taquito getPkhfromPk delegasyonu (curve + edge cases)
 *   - verifyTezosSignedMessage:
 *       • Happy path (gerçek ed25519 keypair üretip imzala → verify et)
 *       • Wrong signature → false
 *       • Wrong public key → false
 *       • Wrong message → false
 *       • Malformed signature/pk → throws
 *       • Non-edpk (sppk) → "Only edpk" hatası
 *   - verifyAndConnect: 6 case (happy, replay, skew, bad sig, pkh mismatch, idempotent)
 */

import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ed25519 } from '@noble/curves/ed25519.js';
import { blake2b } from '@noble/hashes/blake2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { b58Encode, getPkhfromPk, PrefixV2 } from '@taquito/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../prisma/prisma.service.js';

import { AUTH_CONFIG, type AuthConfig, loadAuthConfig } from './auth.config.js';
import { AuthService } from './auth.service.js';
import type { SIWWInput } from './auth.types.js';
import { ChallengeService } from './challenge.service.js';

// ── Test helpers ──────────────────────────────────────────────────────

interface KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  publicKeyB58: string;
  /** Lazily computed walletPkh via Taquito's canonical getPkhfromPk */
  walletPkh: string;
}

/**
 * Deterministic test keypair — sha256(known seed) → 32-byte ed25519 priv.
 * Public key MUST be encoded with the Tezos edpk prefix (PrefixV2.Ed25519PublicKey)
 * — bs58check.encode uses Bitcoin version byte and produces wrong prefix.
 */
function makeKeyPair(seed: string): KeyPair {
  const privateKey = sha256(utf8ToBytes(seed));
  const publicKey = ed25519.getPublicKey(privateKey);
  const publicKeyB58 = b58Encode(publicKey, PrefixV2.Ed25519PublicKey);
  // Derive tz1 via Taquito's canonical getPkhfromPk (same path as production)
  const walletPkh = getPkhfromPk(publicKeyB58);
  return { privateKey, publicKey, publicKeyB58, walletPkh };
}

/** Build a TZIP-32 SIWW signed message + signature */
function signTezosMessage(
  kp: KeyPair,
  message: string,
): { signatureB58: string; payload: Uint8Array; hash: Uint8Array } {
  const watermark = concatBytes(new Uint8Array([0x01]), utf8ToBytes('Tezos Signed Message:\n'));
  const msgBytes = utf8ToBytes(message);
  const msgLen = new Uint8Array(4);
  new DataView(msgLen.buffer).setUint32(0, msgBytes.length, false);
  const payload = concatBytes(watermark, msgLen, msgBytes, kp.publicKey);
  const hash = blake2b(payload, { dkLen: 32 });
  const sig = ed25519.sign(hash, kp.privateKey);
  return {
    signatureB58: b58Encode(sig, PrefixV2.Ed25519Signature),
    payload,
    hash,
  };
}

// ── Test fixtures ──────────────────────────────────────────────────────

const TEST_CONFIG: AuthConfig = loadAuthConfig({
  SIWW_DOMAIN: 'test.galatabaker.local',
  // NOT-A-SECRET — unit test fixture, explicitly named to avoid gitleaks false positive
  JWT_SECRET: 'unit-test-jwt-secret-not-real-just-for-zod-validation',
  JWT_TTL_SECONDS: '600',
  SIWW_CHALLENGE_TTL_SECONDS: '300',
  SIWW_MAX_TIMESTAMP_SKEW: '300',
  TELEGRAM_BOT_SECRET: 'unit-test-telegram-secret-not-real-zod-only',
});

// ── Mock factories ────────────────────────────────────────────────────

function makeMockPrisma(): {
  user: { upsert: ReturnType<typeof vi.fn> };
} {
  return {
    user: { upsert: vi.fn().mockResolvedValue({}) },
  };
}

function makeMockChallenges(consumeReturns = true): {
  create: ReturnType<typeof vi.fn>;
  consume: ReturnType<typeof vi.fn>;
} {
  return {
    create: vi.fn().mockReturnValue({
      nonce: 'test-nonce-12345678',
      message: 'mocked message',
      expiresAt: 9999999999,
    }),
    consume: vi.fn().mockReturnValue(consumeReturns),
  };
}

interface BuiltService {
  service: AuthService;
  prisma: ReturnType<typeof makeMockPrisma>;
  challenges: ReturnType<typeof makeMockChallenges>;
}

async function buildService(opts?: { challengeConsume?: boolean }): Promise<BuiltService> {
  const prisma = makeMockPrisma();
  const challenges = makeMockChallenges(opts?.challengeConsume ?? true);

  const moduleRef = await Test.createTestingModule({
    imports: [
      JwtModule.register({
        secret: TEST_CONFIG.JWT_SECRET,
        signOptions: { expiresIn: TEST_CONFIG.JWT_TTL_SECONDS },
      }),
    ],
    providers: [
      { provide: AUTH_CONFIG, useValue: TEST_CONFIG },
      { provide: PrismaService, useValue: prisma },
      { provide: ChallengeService, useValue: challenges },
      AuthService,
    ],
  }).compile();

  return {
    service: moduleRef.get(AuthService),
    prisma,
    challenges,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('AuthService', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  describe('buildCanonicalMessage()', () => {
    it('formats message with domain, nonce, timestamp (newline-separated)', async () => {
      const { service } = await buildService();
      const msg = service.buildCanonicalMessage('abc123', 1700000000);
      expect(msg).toBe(
        [
          'GalataBaker SIWW',
          `domain: ${TEST_CONFIG.SIWW_DOMAIN}`,
          'nonce: abc123',
          'timestamp: 1700000000',
        ].join('\n'),
      );
    });

    it('uses domain from injected config', async () => {
      const { service } = await buildService();
      const msg = service.buildCanonicalMessage('n', 1);
      expect(msg).toContain('domain: test.galatabaker.local');
    });
  });

  describe('publicKeyToAddress()', () => {
    it('derives correct tz1 address for a known ed25519 public key', async () => {
      const { service } = await buildService();
      const kp = makeKeyPair('test-vector-1');
      expect(service.publicKeyToAddress(kp.publicKeyB58)).toBe(kp.walletPkh);
      expect(kp.walletPkh.startsWith('tz1')).toBe(true);
    });

    it('throws UnauthorizedException for non-edpk public keys', async () => {
      const { service } = await buildService();
      // sppk = secp256k1 (not supported in MVP)
      const sppkLike = 'sppk7c7hkPj47yjYFEHX85q46sFJGw6RBrqoVSHwAJAT4e14KJwzoey';
      expect(() => service.publicKeyToAddress(sppkLike)).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for malformed base58', async () => {
      const { service } = await buildService();
      expect(() => service.publicKeyToAddress('not-valid-base58!!!')).toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException for empty input', async () => {
      const { service } = await buildService();
      expect(() => service.publicKeyToAddress('')).toThrow(UnauthorizedException);
    });
  });

  describe('verifyTezosSignedMessage()', () => {
    it('verifies a valid TZIP-32 signature (happy path)', async () => {
      const { service } = await buildService();
      const kp = makeKeyPair('happy-path');
      const message = 'GalataBaker SIWW\ndomain: x\nnonce: y\ntimestamp: 1';
      const { signatureB58 } = signTezosMessage(kp, message);
      expect(service.verifyTezosSignedMessage(kp.publicKeyB58, signatureB58, message)).toBe(true);
    });

    it('returns false when message is tampered', async () => {
      const { service } = await buildService();
      const kp = makeKeyPair('tamper-test');
      const message = 'original message';
      const { signatureB58 } = signTezosMessage(kp, message);
      expect(
        service.verifyTezosSignedMessage(kp.publicKeyB58, signatureB58, 'tampered message'),
      ).toBe(false);
    });

    it('returns false when public key is wrong', async () => {
      const { service } = await buildService();
      const kp1 = makeKeyPair('signer-1');
      const kp2 = makeKeyPair('attacker-2');
      const message = 'a message';
      const { signatureB58 } = signTezosMessage(kp1, message);
      expect(service.verifyTezosSignedMessage(kp2.publicKeyB58, signatureB58, message)).toBe(false);
    });

    it('returns false when signature is corrupted', async () => {
      const { service } = await buildService();
      const kp = makeKeyPair('corrupt-sig');
      const message = 'msg';
      const { signatureB58 } = signTezosMessage(kp, message);
      // Flip first char (still valid base58 chars, just wrong checksum → Taquito throws)
      const corrupted = (signatureB58[0] === 'e' ? 'f' : 'e') + signatureB58.slice(1);
      expect(service.verifyTezosSignedMessage(kp.publicKeyB58, corrupted, message)).toBe(false);
    });

    it('throws on invalid public key base58', async () => {
      const { service } = await buildService();
      expect(() => service.verifyTezosSignedMessage('not-base58', 'edsigabc', 'msg')).toThrow();
    });

    it('throws on non-edpk public key (sppk) with clear message', async () => {
      const { service } = await buildService();
      const sppk = 'sppk7c7hkPj47yjYFEHX85q46sFJGw6RBrqoVSHwAJAT4e14KJwzoey';
      expect(() => service.verifyTezosSignedMessage(sppk, 'edsigabc', 'msg')).toThrow(/Only edpk/);
    });
  });

  describe('verifyAndConnect()', () => {
    it('happy path: returns JWT, upserts user, consumes nonce', async () => {
      const { service, prisma, challenges } = await buildService();
      const kp = makeKeyPair('connect-happy');
      const nonce = 'happy-nonce';
      const ts = Math.floor(Date.now() / 1000);
      const message = service.buildCanonicalMessage(nonce, ts);
      const { signatureB58 } = signTezosMessage(kp, message);

      const result = await service.verifyAndConnect({
        walletPkh: kp.walletPkh,
        publicKey: kp.publicKeyB58,
        signature: signatureB58,
        nonce,
        timestamp: ts,
      } satisfies SIWWInput);

      expect(result.accessToken).toBeTruthy();
      expect(result.walletPkh).toBe(kp.walletPkh);
      expect(typeof result.expiresAt).toBe('number');
      expect(challenges.consume).toHaveBeenCalledWith(nonce);
      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { walletPkh: kp.walletPkh },
        create: { walletPkh: kp.walletPkh },
        update: {},
      });
    });

    it('throws UnauthorizedException when nonce is invalid (replay)', async () => {
      const { service } = await buildService({ challengeConsume: false });
      const kp = makeKeyPair('replay');
      await expect(
        service.verifyAndConnect({
          walletPkh: kp.walletPkh,
          publicKey: kp.publicKeyB58,
          signature: 'edsigfake',
          nonce: 'consumed',
          timestamp: Math.floor(Date.now() / 1000),
        }),
      ).rejects.toThrow(/Invalid or expired nonce/);
    });

    it('throws UnauthorizedException when timestamp skew too large', async () => {
      const { service } = await buildService();
      const kp = makeKeyPair('skew');
      const oldTs = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      await expect(
        service.verifyAndConnect({
          walletPkh: kp.walletPkh,
          publicKey: kp.publicKeyB58,
          signature: 'edsigfake',
          nonce: 'skew-nonce',
          timestamp: oldTs,
        }),
      ).rejects.toThrow(/Timestamp out of acceptable range/);
    });

    it('throws UnauthorizedException when signature is invalid', async () => {
      const { service } = await buildService();
      const kp = makeKeyPair('bad-sig');
      const ts = Math.floor(Date.now() / 1000);
      const nonce = 'bad-sig-nonce';
      const message = service.buildCanonicalMessage(nonce, ts);
      // Sign with WRONG key — attacker signs, server expects signer
      const attacker = makeKeyPair('attacker');
      const { signatureB58 } = signTezosMessage(attacker, message);

      await expect(
        service.verifyAndConnect({
          walletPkh: kp.walletPkh,
          publicKey: kp.publicKeyB58,
          signature: signatureB58,
          nonce,
          timestamp: ts,
        }),
      ).rejects.toThrow();
    });

    it('throws UnauthorizedException when walletPkh does not match derived address', async () => {
      const { service } = await buildService();
      const kp = makeKeyPair('mismatch');
      const ts = Math.floor(Date.now() / 1000);
      const nonce = 'mismatch-nonce';
      const message = service.buildCanonicalMessage(nonce, ts);
      const { signatureB58 } = signTezosMessage(kp, message);

      // Lie about walletPkh — different from kp.walletPkh
      const fakePkh = 'tz1gvF4cD2dDtqitL3ZTraggSR1Mju2BKFEM';
      await expect(
        service.verifyAndConnect({
          walletPkh: fakePkh,
          publicKey: kp.publicKeyB58,
          signature: signatureB58,
          nonce,
          timestamp: ts,
        }),
      ).rejects.toThrow(/Public key does not match wallet address/);
    });

    it('idempotent: re-connecting same wallet reuses existing user row', async () => {
      const { service, prisma } = await buildService();
      const kp = makeKeyPair('idempotent');
      const ts = Math.floor(Date.now() / 1000);
      const nonce = 'idem-nonce';
      const message = service.buildCanonicalMessage(nonce, ts);
      const { signatureB58 } = signTezosMessage(kp, message);

      await service.verifyAndConnect({
        walletPkh: kp.walletPkh,
        publicKey: kp.publicKeyB58,
        signature: signatureB58,
        nonce,
        timestamp: ts,
      });

      // upsert should be called with empty `update` (idempotent — no fields changed)
      expect(prisma.user.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {} }));
    });
  });
});
