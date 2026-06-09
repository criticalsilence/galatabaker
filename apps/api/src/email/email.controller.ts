/**
 * GalataBaker API — Email REST controller.
 *
 * Endpoints:
 *   POST /api/email/test   — manual smoke test, internal/admin (MVP'de auth'sız)
 *   GET  /api/email/health — provider erişilebilirlik
 *
 * Güvenlik:
 *   - /test MVP'de auth yok (internal) — Adım 8 hardening'de @Roles eklenecek
 *   - Validation zod — invalid email 400
 *   - Health response: provider adı + latency + error (varsa)
 *
 * apps/web'den consume: bu endpoint'leri dashboard'da "Test Email" butonu
 * ve "Status: Email OK" indicator'ı için kullanacağız.
 */

import { Body, Controller, Get, Post, UsePipes } from '@nestjs/common';

import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

import { sendTestSchema, type SendTestInput } from './dto/send-test.dto.js';
import { EmailService } from './email.service.js';
import type { EmailProviderHealth, EmailSendResult } from './email.types.js';

@Controller('email')
@UsePipes(new ZodValidationPipe())
export class EmailController {
  constructor(private readonly email: EmailService) {}

  /**
   * Test email gönder. Validation → EmailService.send() → result.
   * Provider failed → 200 + result.status='failed' (caller UI'da gösterir).
   * Provider throw → 500 (network error, beklenmeyen).
   */
  @Post('test')
  async sendTest(
    @Body(new ZodValidationPipe(sendTestSchema)) body: SendTestInput,
  ): Promise<EmailSendResult> {
    return this.email.send(body);
  }

  /**
   * Provider health. /api/email/health → 200 (reachable) veya 200 (unreachable
   * + error — yine de 200, çünkü endpoint çalışıyor, provider değil).
   * Monitoring sistemimiz reachable=false'i alert olarak yakalar.
   */
  @Get('health')
  async health(): Promise<EmailProviderHealth> {
    return this.email.ping();
  }
}
