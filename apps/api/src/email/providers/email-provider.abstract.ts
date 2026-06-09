/**
 * GalataBaker API — EmailProvider abstract base.
 *
 * NestJS DI ile beraber çalışır (useFactory, useClass, useValue).
 * Subclass'lar:
 *   - NoopProvider   (test default, hiçbir yere göndermez)
 *   - MailHogProvider (nodemailer SMTP — local dev)
 *   - ResendProvider  (Resend HTTP API — prod)
 *
 * Her provider:
 *   - readonly name: provider kimliği (telemetry + logs)
 *   - send(): gerçek gönderim (sync veya async queue)
 *   - ping(): provider erişilebilirlik kontrolü (health endpoint için)
 *
 * MVP'de provider'lar synchronous send kullanıyor (Resend zaten HTTP
 * promise, MailHog SMTP hızlı). Adım 8'de BullMQ + Redis queue eklenirse
 * send() her zaman queued döner ve background worker job'u işler.
 */

import type {
  EmailProviderHealth,
  EmailProviderName,
  EmailSendOptions,
  EmailSendResult,
} from '../email.types.js';

export abstract class EmailProvider {
  abstract readonly name: EmailProviderName;

  abstract send(options: EmailSendOptions): Promise<EmailSendResult>;

  abstract ping(): Promise<EmailProviderHealth>;
}
