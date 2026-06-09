/**
 * GalataBaker API — Telegram provider interface.
 *
 * Mirrors the EmailProvider pattern (no behavior dependency between
 * concrete implementations). Three concrete providers:
 *   - HttpTelegramProvider  → real Telegram Bot API (production)
 *   - NoopTelegramProvider  → logs and returns success (dev/test)
 *
 * Step 8 hardening may add:
 *   - Bull/Redis-backed retry queue
 *   - Rate limit awareness (Telegram: 30 msg/s per bot)
 *   - Per-chat throttle
 */

import type { TelegramSender } from '../notification.types.js';

export abstract class TelegramProvider implements TelegramSender {
  abstract readonly name: string;
  abstract sendMessage(input: {
    chatId: string;
    text: string;
  }): Promise<{ messageId: number; status: 'sent' | 'failed'; error?: string }>;
  abstract ping(): Promise<{ reachable: boolean; error?: string }>;
}
