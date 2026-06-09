/**
 * GalataBaker API — EmailService.
 *
 * EmailService ince bir facade:
 *   1. Caller'dan gelen input'u validate (email format, subject/html non-empty)
 *   2. PII'yi log'larda mask'le (email adresi kısmi)
 *   3. Provider'ı çağır (Noop / MailHog / Resend — env-driven seçilir)
 *   4. Result'ı passthrough — failed status service'te throw olmaz,
 *      notification modülü kendi retry/DLQ mantığını kurar (Adım 8)
 *
 * Neden ayrı bir service katmanı var?
 *   - Validation: provider'lar valid input bekler (Resend 400, SMTP reject)
 *   - Logging/metrics: her email loglanmalı (sentry/observability için)
 *   - PII policy: ham email asla loglanmaz, kısmi mask'lenir
 *   - Gelecek: Adım 8'de template engine + i18n + attachments bu katmanda
 *     eklenecek (provider değişmez)
 *
 * @see /api/email/test, /api/email/health
 */

import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

import { EMAIL_CONFIG, EMAIL_PROVIDER } from './email.tokens.js';
import type {
  EmailConfig,
  EmailProviderHealth,
  EmailSendOptions,
  EmailSendResult,
} from './email.types.js';
import { EmailProvider } from './providers/email-provider.abstract.js';

// zod schema — service katmanı provider'dan önce validate eder
const sendOptionsSchema = z.object({
  to: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Subject is required').max(998, 'Subject too long'),
  html: z.string().min(1, 'HTML body is required'),
  text: z.string().optional(),
});

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @Inject(EMAIL_CONFIG) private readonly config: EmailConfig,
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
  ) {}

  /**
   * Email gönder. Validate → log → provider.send() → result.
   *
   * Hata durumları:
   *   - Validation hatası → BadRequestException (caller sorumlu, no retry)
   *   - Provider failed → result.status='failed', throw yok (caller retry eder)
   *   - Provider throw → propagate (network error, unexpected — caller yakalar)
   */
  async send(options: EmailSendOptions): Promise<EmailSendResult> {
    // Validation
    const parseResult = sendOptionsSchema.safeParse(options);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      throw new BadRequestException(`Invalid email payload: ${firstIssue?.message ?? 'unknown'}`);
    }

    const validated = parseResult.data;
    const masked = this.maskEmail(validated.to);

    this.logger.log(
      `[email] send attempt to=${masked} subject="${validated.subject}" provider=${this.provider.name}`,
    );

    let result: EmailSendResult;
    try {
      result = await this.provider.send(validated);
    } catch (err) {
      // Network/transport hatası — provider throw etti
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[email] provider throw to=${masked} provider=${this.provider.name} error=${message}`,
      );
      throw err;
    }

    if (result.status === 'failed') {
      this.logger.error(
        `[email] send failed to=${masked} provider=${result.provider} error=${result.error ?? 'unknown'}`,
      );
    } else {
      this.logger.log(
        `[email] sent id=${result.id} provider=${result.provider} status=${result.status}`,
      );
    }

    return result;
  }

  /**
   * Provider erişilebilirlik kontrolü. /api/email/health için.
   * Provider implementasyonu kendi içinde implement eder (SMTP verify,
   * HTTP GET, vs.).
   */
  async ping(): Promise<EmailProviderHealth> {
    return this.provider.ping();
  }

  /**
   * Email adresini log-safe formata çevir.
   * Örnek: alice.smith@verylongdomain.com → al***@verylongdomain.com
   * Edge case: <2 char user → "**@domain"
   * Edge case: @ yok → "***"
   */
  private maskEmail(email: string): string {
    const at = email.indexOf('@');
    if (at < 1) return '***';
    const user = email.slice(0, at);
    const domain = email.slice(at + 1);
    if (user.length < 2) return `**@${domain}`;
    return `${user.slice(0, 2)}***@${domain}`;
  }
}
