/**
 * GalataBaker API — NotificationService.
 *
 * Single entry point for all notifications. Caller calls `enqueue()`,
 * service handles:
 *   1. User lookup
 *   2. User preference filter (channel master + per-kind)
 *   3. Notification row persistence (status=pending)
 *   4. Template render
 *   5. Channel dispatch (email + telegram)
 *   6. Row update (status=sent | failed)
 *
 * Delivery semantics:
 *   - Dispatcher failures do NOT throw to caller. They mark the row
 *     failed and log. Step 8 hardening will add Bull/Redis retry.
 *   - One DB row per (user, kind, channel) pair. If a kind is dispatched
 *     via both channels, you get 2 rows.
 *   - User prefs check happens BEFORE row insert: if all channels are
 *     disabled for a kind, no row is written (no noise).
 *
 * Read API (for /api/notifications):
 *   - listByUser() — paginated, optional unread-only filter
 *   - unreadCount() — count of !read rows
 *   - markRead()   — set readAt
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

import { NOTIFICATION_CONFIG, type TelegramConfig } from './notification.config.js';
import {
  enqueueInputSchema,
  type EmailSender,
  type EnqueueInput,
  type NotificationChannelType,
  type NotificationPublic,
} from './notification.types.js';
import type { TelegramProvider } from './providers/telegram-provider.abstract.js';
import { render } from './template.js';
import { TEMPLATES } from './templates.js';

export const TELEGRAM_PROVIDER_TOKEN = Symbol('TELEGRAM_PROVIDER');
export const EMAIL_SENDER_TOKEN = Symbol('EMAIL_SENDER');

interface UserPreferences {
  emailEnabled?: boolean;
  telegramEnabled?: boolean;
  rewardNotify?: boolean;
  delegationNotify?: boolean;
  cycleDigest?: boolean;
}

const DEFAULT_PREFS: Required<UserPreferences> = {
  emailEnabled: true,
  telegramEnabled: false,
  rewardNotify: true,
  delegationNotify: true,
  cycleDigest: false,
};

export function userPrefs(raw: unknown): UserPreferences {
  if (raw && typeof raw === 'object') return { ...DEFAULT_PREFS, ...(raw as UserPreferences) };
  return DEFAULT_PREFS;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_CONFIG) _config: TelegramConfig,
    @Inject(TELEGRAM_PROVIDER_TOKEN) private readonly telegram: TelegramProvider,
    @Inject(EMAIL_SENDER_TOKEN) private readonly email: EmailSender,
  ) {}

  // ─── Public: dispatch ─────────────────────────────────────────────

  /**
   * Enqueue a notification. Always returns void — dispatch errors are
   * captured on the row, not thrown.
   *
   * Returns the list of inserted notification IDs (for testing).
   */
  async enqueue(input: EnqueueInput): Promise<string[]> {
    const parsed = enqueueInputSchema.safeParse(input);
    if (!parsed.success) {
      this.logger.warn(
        `[notify] enqueue rejected (invalid input) kind=${input.kind} pkh=${input.walletPkh.slice(0, 8)}…`,
      );
      return [];
    }
    const { walletPkh, kind, vars, channels } = parsed.data;

    const user = await this.prisma.user.findUnique({ where: { walletPkh } });
    if (!user) {
      this.logger.warn(
        `[notify] enqueue: user not found kind=${kind} pkh=${walletPkh.slice(0, 8)}…`,
      );
      return [];
    }

    const prefs = userPrefs(user.preferences);
    const allowedChannels = this.allowedChannels(kind, prefs, channels);

    if (allowedChannels.length === 0) {
      this.logger.log(
        `[notify] skipped (prefs) kind=${kind} pkh=${walletPkh.slice(0, 8)}… emailEnabled=${prefs.emailEnabled} telegramEnabled=${prefs.telegramEnabled}`,
      );
      return [];
    }

    const ids: string[] = [];
    for (const channel of allowedChannels) {
      const id = await this.dispatchOne(
        user.id,
        walletPkh,
        kind,
        channel,
        vars,
        user.email,
        user.telegramChatId,
      );
      ids.push(id);
    }
    return ids;
  }

  // ─── Public: read API ─────────────────────────────────────────────

  async listByUser(
    walletPkh: string,
    opts: { limit?: number; offset?: number; unreadOnly?: boolean } = {},
  ): Promise<{ data: NotificationPublic[]; total: number; unreadCount: number }> {
    const user = await this.prisma.user.findUnique({ where: { walletPkh } });
    if (!user) return { data: [], total: 0, unreadCount: 0 };

    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const offset = Math.max(opts.offset ?? 0, 0);
    const where = {
      userId: user.id,
      ...(opts.unreadOnly ? { readAt: null } : {}),
    };

    const [rows, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);

    return { data: rows.map(toPublic), total, unreadCount: unread };
  }

  async markRead(walletPkh: string, id: string): Promise<{ marked: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { walletPkh } });
    if (!user) return { marked: false };
    const result = await this.prisma.notification.updateMany({
      where: { id, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { marked: result.count > 0 };
  }

  // ─── Internal ─────────────────────────────────────────────────────

  private allowedChannels(
    kind: EnqueueInput['kind'],
    prefs: UserPreferences,
    explicit?: NotificationChannelType[],
  ): NotificationChannelType[] {
    const all: NotificationChannelType[] = explicit ?? ['EMAIL', 'TELEGRAM'];
    return all.filter((ch) => {
      if (ch === 'EMAIL' && !prefs.emailEnabled) return false;
      if (ch === 'TELEGRAM' && !prefs.telegramEnabled) return false;
      // Per-kind filter
      if (kind === 'rewards_credited' && !prefs.rewardNotify) return false;
      if (kind === 'delegation_matched' && !prefs.delegationNotify) return false;
      // email_verify / telegram_link are channel-specific, others don't need kind filter
      return true;
    });
  }

  private async dispatchOne(
    userId: string,
    walletPkh: string,
    kind: EnqueueInput['kind'],
    channel: NotificationChannelType,
    vars: EnqueueInput['vars'],
    email: string | null,
    telegramChatId: string | null,
  ): Promise<string> {
    const tmpl = TEMPLATES[kind];
    const channelTmpl = tmpl[channel.toLowerCase() as 'email' | 'telegram'];

    // Persist as pending first (audit trail)
    const row = await this.prisma.notification.create({
      data: {
        userId,
        channel,
        subject: channelTmpl.subject ?? '',
        body: '', // filled after render
        sent: false,
      },
    });

    try {
      const subject = channelTmpl.subject ? render(channelTmpl.subject, vars) : '';
      const body = channelTmpl.body ? render(channelTmpl.body, vars) : '';

      if (channel === 'EMAIL') {
        if (!email) {
          await this.markFailed(row.id, 'No email on user');
          return row.id;
        }
        const result = await this.email.send({ to: email, subject, html: body });
        if (result.status === 'failed') {
          await this.markFailed(row.id, result.error ?? 'unknown email error');
        } else {
          await this.markSent(row.id, body);
        }
      } else {
        // TELEGRAM
        if (!telegramChatId) {
          await this.markFailed(row.id, 'No telegramChatId on user');
          return row.id;
        }
        const result = await this.telegram.sendMessage({ chatId: telegramChatId, text: body });
        if (result.status === 'failed') {
          await this.markFailed(row.id, result.error ?? 'unknown telegram error');
        } else {
          await this.markSent(row.id, body);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[notify] dispatch throw kind=${kind} channel=${channel} pkh=${walletPkh.slice(0, 8)}… error=${msg}`,
      );
      await this.markFailed(row.id, msg);
    }

    return row.id;
  }

  private async markSent(id: string, body: string) {
    await this.prisma.notification.update({
      where: { id },
      data: { sent: true, sentAt: new Date(), error: null, body },
    });
  }

  private async markFailed(id: string, error: string) {
    await this.prisma.notification.update({
      where: { id },
      data: { sent: false, error: error.slice(0, 500) },
    });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

function toPublic(n: {
  id: string;
  channel: string;
  subject: string;
  body: string;
  sent: boolean;
  sentAt: Date | null;
  error: string | null;
  readAt: Date | null;
  createdAt: Date;
}): NotificationPublic {
  return {
    id: n.id,
    channel: n.channel as NotificationChannelType,
    subject: n.subject,
    body: n.body,
    sent: n.sent,
    sentAt: n.sentAt,
    error: n.error,
    readAt: n.readAt,
    createdAt: n.createdAt,
  };
}
