/**
 * GalataBaker API — HttpTelegramProvider.
 *
 * Telegram Bot API (https://core.telegram.org/bots/api) üzerinden
 * sendMessage çağrısı. Resend/HTTP provider pattern'i ile aynı:
 *   - 200 + ok=true → sent
 *   - 4xx/5xx → failed
 *   - Network throw → failed
 *
 * Rate limit: Telegram ~30 msg/s per bot. Step 8 hardening'de
 * per-bot token bucket eklenebilir.
 */

import { Logger } from '@nestjs/common';

import type { TelegramConfig } from '../notification.config.js';

import { TelegramProvider } from './telegram-provider.abstract.js';

interface TelegramApiResponse {
  ok: boolean;
  result?: { message_id: number };
  description?: string;
  error_code?: number;
}

export class HttpTelegramProvider extends TelegramProvider {
  readonly name = 'http';
  private readonly logger = new Logger(HttpTelegramProvider.name);

  constructor(private readonly config: TelegramConfig) {
    super();
  }

  async sendMessage(input: { chatId: string; text: string }) {
    const url = `${this.config.apiUrl}${this.config.botToken}/sendMessage`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: input.chatId,
          text: input.text,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      });
      const data = (await res.json()) as TelegramApiResponse;
      if (!res.ok || !data.ok) {
        const err = data.description ?? `HTTP ${res.status}`;
        this.logger.error(
          `[telegram:http] send failed chatId=…${input.chatId.slice(-4)} error=${err}`,
        );
        return { messageId: 0, status: 'failed' as const, error: err };
      }
      const id = data.result?.message_id ?? 0;
      this.logger.log(`[telegram:http] sent messageId=${id} chatId=…${input.chatId.slice(-4)}`);
      return { messageId: id, status: 'sent' as const };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[telegram:http] network throw chatId=…${input.chatId.slice(-4)} error=${message}`,
      );
      return { messageId: 0, status: 'failed' as const, error: message };
    }
  }

  async ping() {
    const url = `${this.config.apiUrl}${this.config.botToken}/getMe`;
    try {
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) {
        return { reachable: false, error: `HTTP ${res.status}` };
      }
      return { reachable: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { reachable: false, error: message };
    }
  }
}
