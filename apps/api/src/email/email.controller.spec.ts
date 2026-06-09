/**
 * GalataBaker API — EmailController unit tests.
 *
 * Service mock'lanır — gerçek EmailService (provider, validation, logging)
 * zaten email.service.spec.ts'te izole test ediliyor. Burada sadece HTTP
 * katmanı: route binding + DTO validation + service delegation.
 *
 * Test stratejisi: doğrudan controller instance + mock service çağrısı.
 * (E2E test'ler controller'ı HTTP üzerinden testnet edecek — Task 9.)
 */

import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmailController } from './email.controller.js';
import type { EmailService } from './email.service.js';
import type { EmailProviderHealth, EmailSendResult } from './email.types.js';

function makeMockService(): {
  send: ReturnType<typeof vi.fn>;
  ping: ReturnType<typeof vi.fn>;
} {
  return {
    send: vi.fn(),
    ping: vi.fn(),
  };
}

describe('EmailController', () => {
  let mockService: ReturnType<typeof makeMockService>;
  let controller: EmailController;

  beforeEach(() => {
    mockService = makeMockService();
    controller = new EmailController(mockService as unknown as EmailService);
  });

  describe('sendTest()', () => {
    it('delegates to service.send() and returns result', async () => {
      const result: EmailSendResult = {
        id: 'noop-1',
        status: 'sent',
        provider: 'noop',
      };
      mockService.send.mockResolvedValueOnce(result);

      const out = await controller.sendTest({
        to: 'a@b.com',
        subject: 's',
        html: '<p>x</p>',
      });

      expect(out).toEqual(result);
      expect(mockService.send).toHaveBeenCalledWith({
        to: 'a@b.com',
        subject: 's',
        html: '<p>x</p>',
      });
    });

    it('propagates BadRequestException when service throws (invalid email)', async () => {
      // Service validation'da throw eder; controller zaten DTO validate
      // ettiği için bu path normalde controller'da yakalanır. Test'in
      // amacı: service'in throw ettiği hata controller'da farklı bir
      // exception'a dönüşmesin.
      mockService.send.mockRejectedValueOnce(new BadRequestException('Invalid email payload'));

      await expect(
        controller.sendTest({ to: 'a@b.com', subject: 's', html: '<p>x</p>' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('health()', () => {
    it('delegates to service.ping() and returns health', async () => {
      const health: EmailProviderHealth = {
        provider: 'noop',
        reachable: true,
        lastCheck: new Date('2026-06-09T00:00:00Z'),
      };
      mockService.ping.mockResolvedValueOnce(health);

      const out = await controller.health();

      expect(out).toEqual(health);
      expect(mockService.ping).toHaveBeenCalledTimes(1);
    });

    it('returns unreachable response when provider is down', async () => {
      const health: EmailProviderHealth = {
        provider: 'resend',
        reachable: false,
        lastCheck: new Date('2026-06-09T00:00:00Z'),
        error: 'DNS resolution failed',
      };
      mockService.ping.mockResolvedValueOnce(health);

      const out = await controller.health();

      expect(out.reachable).toBe(false);
      expect(out.error).toBe('DNS resolution failed');
    });
  });
});
