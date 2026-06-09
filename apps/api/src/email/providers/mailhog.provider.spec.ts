/**
 * GalataBaker API — MailHogProvider unit tests.
 *
 * Real SMTP yok (CI'da), transporter mock'lanır. Provider'ın send() +
 * ping() davranışı doğrulanır.
 *
 * Kritik test'ler:
 *   - send(): transporter.sendMail doğru parametrelerle çağrılır
 *   - send(): messageId döner (info.messageId path)
 *   - send(): messageId yoksa fallback uuid
 *   - send(): transporter throw → status='failed', error propagate
 *   - send(): text opsiyonel alan (sağlanırsa email'e eklenir)
 *   - ping(): verify() success → reachable=true + latencyMs
 *   - ping(): verify() throw → reachable=false + error
 *
 * from format: "GalataBaker" <noreply@galatabaker.io> — RFC 5322
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MailHogProvider } from './mailhog.provider.js';

const testConfig = {
  host: 'localhost',
  port: 1025,
  secure: false,
  fromAddress: 'noreply@galatabaker.io',
  fromName: 'GalataBaker',
};

function makeMockTransporter(): {
  sendMail: ReturnType<typeof vi.fn>;
  verify: ReturnType<typeof vi.fn>;
} {
  return {
    sendMail: vi.fn(),
    verify: vi.fn(),
  };
}

describe('MailHogProvider', () => {
  let mockTransport: ReturnType<typeof makeMockTransporter>;
  let provider: MailHogProvider;

  beforeEach(() => {
    mockTransport = makeMockTransporter();
    provider = new MailHogProvider(testConfig, { transporter: mockTransport as never });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('name', () => {
    it('is mailhog', () => {
      expect(provider.name).toBe('mailhog');
    });
  });

  describe('send()', () => {
    const opts = {
      to: 'user@example.com',
      subject: 'Hi',
      html: '<p>x</p>',
    };

    it('passes formatted from + to + subject + html to transporter', async () => {
      mockTransport.sendMail.mockResolvedValueOnce({ messageId: '<abc@host>' });

      await provider.send(opts);

      expect(mockTransport.sendMail).toHaveBeenCalledTimes(1);
      const [arg] = mockTransport.sendMail.mock.calls[0]!;
      expect(arg.from).toBe('"GalataBaker" <noreply@galatabaker.io>');
      expect(arg.to).toBe(opts.to);
      expect(arg.subject).toBe(opts.subject);
      expect(arg.html).toBe(opts.html);
    });

    it('returns provider=sent and the messageId from info', async () => {
      mockTransport.sendMail.mockResolvedValueOnce({ messageId: '<abc@mailhog>' });

      const result = await provider.send(opts);

      expect(result).toEqual({
        id: '<abc@mailhog>',
        status: 'sent',
        provider: 'mailhog',
      });
    });

    it('falls back to a generated id when messageId is missing', async () => {
      mockTransport.sendMail.mockResolvedValueOnce({});

      const result = await provider.send(opts);

      expect(result.status).toBe('sent');
      expect(result.id).toMatch(/^mailhog-/);
    });

    it('returns failed result when transporter throws', async () => {
      mockTransport.sendMail.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await provider.send(opts);

      expect(result.status).toBe('failed');
      expect(result.provider).toBe('mailhog');
      expect(result.error).toBe('ECONNREFUSED');
      expect(result.id).toBe('');
    });

    it('includes text field when provided', async () => {
      mockTransport.sendMail.mockResolvedValueOnce({ messageId: '<x>' });

      await provider.send({ ...opts, text: 'plain text body' });

      const [arg] = mockTransport.sendMail.mock.calls[0]!;
      expect(arg.text).toBe('plain text body');
    });

    it('omits text field when not provided', async () => {
      mockTransport.sendMail.mockResolvedValueOnce({ messageId: '<x>' });

      await provider.send(opts);

      const [arg] = mockTransport.sendMail.mock.calls[0]!;
      expect(arg).not.toHaveProperty('text');
    });
  });

  describe('ping()', () => {
    it('returns reachable=true with latency when verify() resolves', async () => {
      mockTransport.verify.mockResolvedValueOnce(true);

      const result = await provider.ping();

      expect(result.provider).toBe('mailhog');
      expect(result.reachable).toBe(true);
      expect(typeof result.latencyMs).toBe('number');
      expect(result.lastCheck).toBeInstanceOf(Date);
    });

    it('returns reachable=false with error when verify() rejects', async () => {
      mockTransport.verify.mockRejectedValueOnce(new Error('ETIMEDOUT'));

      const result = await provider.ping();

      expect(result.reachable).toBe(false);
      expect(result.error).toBe('ETIMEDOUT');
      expect(result.latencyMs).toBeUndefined();
    });
  });
});
