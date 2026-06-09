/**
 * GalataBaker API — NotificationsModule.
 *
 * Wires:
 *   - NotificationService (main facade)
 *   - TelegramProvider (http | noop, env-driven)
 *   - EmailSender (passthrough adapter over EmailService)
 *   - NotificationsController (read API)
 *
 * Imports:
 *   - PrismaModule (Notification row writes)
 *   - EmailModule  (for EmailService — adapted to EmailSender)
 *   - AuthModule   (for JwtAuthGuard on protected read endpoints)
 */

import { Module, Provider, forwardRef } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { EmailModule } from '../email/email.module.js';
import { EmailService } from '../email/email.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

import { loadNotificationConfig, NOTIFICATION_CONFIG } from './notification.config.js';
import {
  EMAIL_SENDER_TOKEN,
  NotificationService,
  TELEGRAM_PROVIDER_TOKEN,
} from './notification.service.js';
import { NotificationsController } from './notifications.controller.js';
import { HttpTelegramProvider } from './providers/http.telegram.provider.js';
import { NoopTelegramProvider } from './providers/noop.telegram.provider.js';
import type { TelegramProvider } from './providers/telegram-provider.abstract.js';

// Adapter: EmailService → EmailSender. Method shape already matches.
class EmailServiceAdapter {
  constructor(private readonly svc: EmailService) {}
  get name(): string {
    return 'email';
  }
  async send(input: { to: string; subject: string; html: string; text?: string }) {
    return this.svc.send(input);
  }
  async ping() {
    const h = await this.svc.ping();
    return { reachable: h.reachable, error: h.error };
  }
}

const telegramProviderFactory: Provider = {
  provide: TELEGRAM_PROVIDER_TOKEN,
  useFactory: (cfg: ReturnType<typeof loadNotificationConfig>): TelegramProvider => {
    return cfg.provider === 'http' ? new HttpTelegramProvider(cfg) : new NoopTelegramProvider();
  },
  inject: [NOTIFICATION_CONFIG],
};

const emailSenderFactory: Provider = {
  provide: EMAIL_SENDER_TOKEN,
  useFactory: (svc: EmailService) => new EmailServiceAdapter(svc),
  inject: [EmailService],
};

@Module({
  imports: [PrismaModule, EmailModule, forwardRef(() => AuthModule)],
  controllers: [NotificationsController],
  providers: [
    { provide: NOTIFICATION_CONFIG, useFactory: loadNotificationConfig },
    telegramProviderFactory,
    emailSenderFactory,
    NotificationService,
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}
