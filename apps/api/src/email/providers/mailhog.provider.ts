/**
 * GalataBaker API — MailHog SMTP provider.
 *
 * Local dev / test ortamı için: docker compose'da MailHog container'ı
 * SMTP'yi port 1025'te dinler, UI'ı port 8025'te.
 * Production'da bu provider KULLANILMAZ — Resend HTTP API tercih edilir
 * (daha iyi deliverability + metrics).
 *
 * Test stratejisi:
 *   - Constructor'a `deps.transporter` opsiyonel inject edilir
 *   - Test'lerde mock transporter kullanılır (real SMTP yok)
 *   - Production'da deps.transporter undefined → nodemailer.createTransport()
 *
 * Hata yönetimi:
 *   - sendMail throw → status='failed', error.message
 *   - sendMail success ama messageId yok → fallback olarak random uuid
 *
 * @see https://nodemailer.com/extras/smtp-server-testing
 */

import { randomUUID } from 'node:crypto';

import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

import type { EmailProviderHealth, EmailSendOptions, EmailSendResult } from '../email.types.js';

import { EmailProvider } from './email-provider.abstract.js';

export interface MailHogProviderDeps {
  transporter?: Transporter;
}

export class MailHogProvider extends EmailProvider {
  readonly name = 'mailhog' as const;
  private readonly logger = new Logger(MailHogProvider.name);
  private readonly transporter: Transporter;
  private readonly fromAddress: string;
  private readonly fromName: string;

  constructor(
    config: { host: string; port: number; secure: boolean; fromAddress: string; fromName: string },
    deps: MailHogProviderDeps = {},
  ) {
    super();
    this.fromAddress = config.fromAddress;
    this.fromName = config.fromName;
    this.transporter =
      deps.transporter ??
      nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        // MailHog auth gerektirmez, ama SMTP greeting/timeout'u kısa tut
        tls: { rejectUnauthorized: false },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
      });
  }

  async send(options: EmailSendOptions): Promise<EmailSendResult> {
    const from = this.formatFrom();
    const start = Date.now();
    try {
      const info = await this.transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        ...(options.text ? { text: options.text } : {}),
      });
      const id = info.messageId ?? `mailhog-${randomUUID()}`;
      this.logger.debug(
        `[email/mailhog] sent to=${options.to} id=${id} latencyMs=${Date.now() - start}`,
      );
      return { id, status: 'sent', provider: 'mailhog' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[email/mailhog] send failed to=${options.to} error=${message}`);
      return {
        id: '',
        status: 'failed',
        provider: 'mailhog',
        error: message,
      };
    }
  }

  async ping(): Promise<EmailProviderHealth> {
    const start = Date.now();
    try {
      await this.transporter.verify();
      return {
        provider: 'mailhog',
        reachable: true,
        lastCheck: new Date(),
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        provider: 'mailhog',
        reachable: false,
        lastCheck: new Date(),
        error: message,
      };
    }
  }

  private formatFrom(): string {
    // RFC 5322: "Name" <addr@host>
    return `"${this.fromName}" <${this.fromAddress}>`;
  }
}
