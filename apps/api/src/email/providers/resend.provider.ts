/**
 * GalataBaker API — Resend HTTP API provider.
 *
 * Production email provider. Resend: transactional email API, basit HTTP
 * POST → JSON response.
 *
 * Endpoint: POST {apiUrl} (default: https://api.resend.com/emails)
 * Auth:    Authorization: Bearer {apiKey}
 * Body:    { from, to, subject, html, text? }
 * Response 200: { id: string } — Resend message ID
 * Response 4xx/5xx: { message, name } — error details
 *
 * Test stratejisi:
 *   - Global fetch mock'lanır (vi.stubGlobal)
 *   - 200 path, 500 path, network throw path test edilir
 *   - API key BİR YERDE LOGLANMAZ (hata mesajlarında bile mask'li)
 *
 * Hata yönetimi:
 *   - Non-2xx response → status='failed', error message
 *   - Network throw → status='failed', error message
 *   - API key mask'lenir (ör: re_***1234)
 *
 * Rate limit: Resend default 2 req/s, 100/day free, business tier 100 req/s.
 * Adım 8'de BullMQ queue + rate limiter ekleyeceğiz.
 *
 * @see https://resend.com/docs/api-reference/emails/send-email
 */

import { randomUUID } from 'node:crypto';

import { Logger } from '@nestjs/common';

import type { EmailProviderHealth, EmailSendOptions, EmailSendResult } from '../email.types.js';

import { EmailProvider } from './email-provider.abstract.js';

export class ResendProvider extends EmailProvider {
  readonly name = 'resend' as const;
  private readonly logger = new Logger(ResendProvider.name);
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly fromAddress: string;
  private readonly fromName: string;

  constructor(config: { apiKey: string; apiUrl: string; fromAddress: string; fromName: string }) {
    super();
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl;
    this.fromAddress = config.fromAddress;
    this.fromName = config.fromName;
  }

  async send(options: EmailSendOptions): Promise<EmailSendResult> {
    const from = `"${this.fromName}" <${this.fromAddress}>`;
    const body = {
      from,
      to: [options.to], // Resend array alır
      subject: options.subject,
      html: options.html,
      ...(options.text ? { text: options.text } : {}),
    };

    const start = Date.now();
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        const message = `Resend API ${response.status}: ${errText.slice(0, 200)}`;
        this.logger.error(`[email/resend] send failed to=${options.to} error=${message}`);
        return {
          id: '',
          status: 'failed',
          provider: 'resend',
          error: message,
        };
      }

      const data = (await response.json()) as { id?: string };
      const id = data.id ?? `resend-${randomUUID()}`;
      this.logger.debug(
        `[email/resend] sent to=${options.to} id=${id} latencyMs=${Date.now() - start}`,
      );
      return { id, status: 'sent', provider: 'resend' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[email/resend] network throw to=${options.to} error=${message}`);
      return {
        id: '',
        status: 'failed',
        provider: 'resend',
        error: message,
      };
    }
  }

  async ping(): Promise<EmailProviderHealth> {
    // Resend'in hafif bir health endpoint'i yok — bizim /api/email/health
    // semantiğimiz "API key geçerli + ulaşılabilir". Tek yol: bir test
    // email göndermek (çok pahalı) veya Resend'in /domains API'sini
    // kullanmak. MVP için: bağlantı testi (HEAD request) yapıp 2xx/3xx
    // beklemek yeterli — 401 alırsak yine "reachable" sayıyoruz (auth
    // hatası network'ten değil, bizden).
    const start = Date.now();
    try {
      const response = await fetch(this.apiUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      // 401/403 = API erişilebilir ama key invalid (caller'ın sorunu)
      // 5xx = API erişilemez
      // 2xx = tamam
      const reachable = response.status < 500;
      return {
        provider: 'resend',
        reachable,
        lastCheck: new Date(),
        latencyMs: Date.now() - start,
        ...(reachable ? {} : { error: `Resend API ${response.status}` }),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        provider: 'resend',
        reachable: false,
        lastCheck: new Date(),
        error: message,
      };
    }
  }
}
