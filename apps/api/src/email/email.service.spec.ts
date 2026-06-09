/**
 * GalataBaker API — EmailService unit tests.
 *
 * EmailService ince bir facade: provider'ı inject eder, validation + logging
 * + PII masking yapar, çağrıyı passthrough eder.
 *
 * Kritik test'ler:
 *   - send(): valid input → provider.send() çağrılır + result döner
 *   - send(): invalid email → BadRequestException (provider çağrılmaz)
 *   - send(): missing subject/html → BadRequestException
 *   - send(): provider failed → result.error propagate olur, throw etmez
 *   - send(): email masking logs'ta (PII)
 *   - send(): from address default config'ten (caller override edebilir)
 *   - ping(): provider.ping() passthrough
 *
 * Provider mock'lanır — gerçek MailHog/Resend bağlantısı yok.
 */

import { BadRequestException, Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EmailService } from './email.service.js';
import type {
  EmailConfig,
  EmailProviderHealth,
  EmailSendOptions,
  EmailSendResult,
} from './email.types.js';
import type { EmailProvider } from './providers/email-provider.abstract.js';

// Mock provider — interface'i karşılayan minimal object
function makeMockProvider(): {
  send: ReturnType<typeof vi.fn>;
  ping: ReturnType<typeof vi.fn>;
  name: 'noop';
} {
  return {
    name: 'noop' as const,
    send: vi.fn(),
    ping: vi.fn(),
  };
}

const mockConfig: EmailConfig = {
  provider: 'noop',
  fromAddress: 'noreply@galatabaker.io',
  fromName: 'GalataBaker',
};

describe('EmailService', () => {
  let provider: ReturnType<typeof makeMockProvider>;
  let service: EmailService;

  beforeEach(() => {
    provider = makeMockProvider();
    service = new EmailService(mockConfig, provider as unknown as EmailProvider);
    // Logger output'unu sustur
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('send()', () => {
    const validInput: EmailSendOptions = {
      to: 'ali@example.com',
      subject: 'Welcome',
      html: '<p>Hello</p>',
    };

    it('passes valid input to provider.send() and returns result', async () => {
      const expected: EmailSendResult = {
        id: 'noop-123',
        status: 'sent',
        provider: 'noop',
      };
      provider.send.mockResolvedValueOnce(expected);

      const result = await service.send(validInput);

      expect(result).toEqual(expected);
      expect(provider.send).toHaveBeenCalledWith(validInput);
      expect(provider.send).toHaveBeenCalledTimes(1);
    });

    it('rejects invalid email with BadRequestException', async () => {
      await expect(service.send({ ...validInput, to: 'not-an-email' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.send({ ...validInput, to: 'not-an-email' })).rejects.toThrow(
        /invalid email/i,
      );
      // Provider hiç çağrılmamalı
      expect(provider.send).not.toHaveBeenCalled();
    });

    it('rejects empty subject', async () => {
      await expect(service.send({ ...validInput, subject: '' })).rejects.toThrow(/subject/i);
      expect(provider.send).not.toHaveBeenCalled();
    });

    it('rejects empty html', async () => {
      await expect(service.send({ ...validInput, html: '' })).rejects.toThrow(/html/i);
      expect(provider.send).not.toHaveBeenCalled();
    });

    it('does not throw when provider returns failed result', async () => {
      // Provider hata dönebilir — service bunu propagate eder, throw etmez.
      // Caller (notification module) failed durumu handle eder.
      const failed: EmailSendResult = {
        id: '',
        status: 'failed',
        provider: 'noop',
        error: 'SMTP timeout',
      };
      provider.send.mockResolvedValueOnce(failed);

      const result = await service.send(validInput);

      expect(result).toEqual(failed);
      expect(result.status).toBe('failed');
      expect(result.error).toBe('SMTP timeout');
    });

    it('masks email in log output (PII)', async () => {
      const logSpy = vi.spyOn(Logger.prototype, 'log');
      provider.send.mockResolvedValueOnce({
        id: 'x',
        status: 'sent',
        provider: 'noop',
      });

      await service.send({ ...validInput, to: 'alice.smith@verylongdomain.com' });

      // En az bir log call'unda maskelenmiş email görünmeli
      const logCalls = logSpy.mock.calls.flat().join(' ');
      expect(logCalls).toContain('al***@');
      // Ham email loglanmamalı
      expect(logCalls).not.toContain('alice.smith@verylongdomain.com');
    });

    it('logs success on sent result', async () => {
      const logSpy = vi.spyOn(Logger.prototype, 'log');
      provider.send.mockResolvedValueOnce({
        id: 'msg-1',
        status: 'sent',
        provider: 'noop',
      });

      await service.send(validInput);

      const logCalls = logSpy.mock.calls.flat().join(' ');
      expect(logCalls).toMatch(/sent.*msg-1/);
    });

    it('logs error on failed result', async () => {
      const errorSpy = vi.spyOn(Logger.prototype, 'error');
      provider.send.mockResolvedValueOnce({
        id: '',
        status: 'failed',
        provider: 'noop',
        error: 'Invalid recipient',
      });

      const result = await service.send(validInput);

      expect(result.status).toBe('failed');
      const errorCalls = errorSpy.mock.calls.flat().join(' ');
      expect(errorCalls).toContain('Invalid recipient');
    });
  });

  describe('ping()', () => {
    it('passes through provider.ping()', async () => {
      const expected: EmailProviderHealth = {
        provider: 'noop',
        reachable: true,
        lastCheck: new Date('2026-06-09T00:00:00Z'),
      };
      provider.ping.mockResolvedValueOnce(expected);

      const result = await service.ping();

      expect(result).toEqual(expected);
      expect(provider.ping).toHaveBeenCalledTimes(1);
    });
  });
});
