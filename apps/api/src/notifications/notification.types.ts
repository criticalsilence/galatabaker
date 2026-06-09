/**
 * GalataBaker API — Notifications module types.
 *
 * Notifications are persisted in the `Notification` table and dispatched
 * via the available channels (email, telegram). User preferences control
 * which channels and which notification types are enabled.
 *
 * Trigger points:
 *   - register_confirmation  → first SIWW verify
 *   - email_verify           → email updated (token in body)
 *   - telegram_link          → chat_id linked (confirmation)
 *   - rewards_credited       → indexer / scheduler found a new reward
 *   - delegation_matched     → delegation operation confirmed
 *
 * Channels:
 *   - EMAIL     → EmailService (Noop / MailHog / Resend)
 *   - TELEGRAM  → TelegramProvider (Telegram Bot API, noop in dev)
 *
 * Delivery semantics:
 *   - Each (user, type, channel) combination produces one DB row.
 *   - Row lifecycle: pending → sent | failed
 *   - Dispatcher failures do NOT throw to caller — they update the row.
 *     Retry is handled in-memory for MVP; Step 8 hardening will swap in
 *     Bull/Redis.
 *
 * User preferences (User.preferences JSON):
 *   emailEnabled     → channel EMAIL master switch
 *   telegramEnabled  → channel TELEGRAM master switch
 *   rewardNotify     → enables rewards_credited
 *   delegationNotify → enables delegation_matched
 *   cycleDigest      → reserved for Step 6 indexer cycle summary
 */

import { z } from 'zod';

export const NOTIFICATION_KINDS = [
  'register_confirmation',
  'email_verify',
  'telegram_link',
  'rewards_credited',
  'delegation_matched',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_CHANNELS = ['EMAIL', 'TELEGRAM'] as const;
export type NotificationChannelType = (typeof NOTIFICATION_CHANNELS)[number];

/** Input to NotificationService.enqueue — caller knows the kind + vars. */
export const enqueueInputSchema = z.object({
  walletPkh: z.string().regex(/^tz[1-4][a-km-zA-HJ-NP-Z1-9]{33}$/),
  kind: z.enum(NOTIFICATION_KINDS),
  /** Per-kind payload — interpolated into the template. */
  vars: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  /**
   * Optional channel allowlist. If omitted, both EMAIL and TELEGRAM are
   * attempted (subject to user preferences). Explicit `[]` disables all.
   */
  channels: z.array(z.enum(NOTIFICATION_CHANNELS)).optional(),
});
export type EnqueueInput = z.infer<typeof enqueueInputSchema>;

/** DB row shape, narrowed for API responses. */
export interface NotificationPublic {
  id: string;
  channel: NotificationChannelType;
  subject: string;
  body: string;
  sent: boolean;
  sentAt: Date | null;
  error: string | null;
  readAt: Date | null;
  createdAt: Date;
}

/** Channel-specific sender interface — same shape for email and telegram. */
export interface ChannelSender {
  /** Stable provider name for logging. */
  readonly name: string;
  /** Provider health check. */
  ping(): Promise<{ reachable: boolean; error?: string }>;
}

/** Email sender contract — narrows EmailService.send to what we need. */
export interface EmailSender extends ChannelSender {
  send(input: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ id: string; status: 'sent' | 'failed'; error?: string }>;
}

/** Telegram sender contract. */
export interface TelegramSender extends ChannelSender {
  sendMessage(input: {
    chatId: string;
    text: string;
  }): Promise<{ messageId: number; status: 'sent' | 'failed'; error?: string }>;
}
