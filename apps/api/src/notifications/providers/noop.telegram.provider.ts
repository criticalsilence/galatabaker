/**
 * GalataBaker API — NoopTelegramProvider.
 *
 * Dev/test ortamı için — gerçek Telegram API'ye hiçbir şey göndermez.
 * Log'a "would send" yazar ve başarılı döner.
 *
 * Kullanım: EMAIL_PROVIDER=noop gibi, Telegram tarafında
 * TELEGRAM_PROVIDER=noop seçilir.
 */

import { Logger } from '@nestjs/common';

import { TelegramProvider } from './telegram-provider.abstract.js';

export class NoopTelegramProvider extends TelegramProvider {
  readonly name = 'noop';
  private readonly logger = new Logger(NoopTelegramProvider.name);

  async sendMessage(input: { chatId: string; text: string }) {
    const masked = input.chatId.length > 4 ? `…${input.chatId.slice(-4)}` : '…';
    this.logger.log(`[telegram:noop] would send to chatId=${masked} textLen=${input.text.length}`);
    return { messageId: Date.now(), status: 'sent' as const };
  }

  async ping() {
    return { reachable: true };
  }
}
