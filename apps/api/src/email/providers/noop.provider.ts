/**
 * GalataBaker API — Noop email provider.
 *
 * Hiçbir yere göndermez, sadece log atar. Test/CI default'u:
 *   - Network bağımlılığı yok (MailHog SMTP veya Resend HTTP yok)
 *   - Side effect yok (gerçek mailbox'a mail düşmeyecek)
 *   - Tüm email.send() çağrıları başarı döner
 *
 * Mantık: caller EmailService.send() → NoopProvider.send() →
 * { id: uuid, status: 'sent', provider: 'noop' }.
 *
 * Production'da asla kullanılmaz (EMAIL_PROVIDER env'i 'resend' veya
 * 'mailhog' olmalı); yanlışlıkla prod'da noop seçilirse monitoring
 * provider='noop' log'undan yakalanabilir.
 *
 * @see /api/email/health endpoint
 */

import { randomUUID } from 'node:crypto';

import { Logger } from '@nestjs/common';

import type { EmailProviderHealth, EmailSendOptions, EmailSendResult } from '../email.types.js';

import { EmailProvider } from './email-provider.abstract.js';

export class NoopProvider extends EmailProvider {
  readonly name = 'noop' as const;
  private readonly logger = new Logger(NoopProvider.name);

  async send(options: EmailSendOptions): Promise<EmailSendResult> {
    const id = `noop-${randomUUID()}`;
    this.logger.debug(
      `[email/noop] would send to=${options.to} subject="${options.subject}" id=${id}`,
    );
    return {
      id,
      status: 'sent',
      provider: 'noop',
    };
  }

  async ping(): Promise<EmailProviderHealth> {
    return {
      provider: 'noop',
      reachable: true, // noop her zaman "reachable" — test ortamı için yeterli
      lastCheck: new Date(),
    };
  }
}
