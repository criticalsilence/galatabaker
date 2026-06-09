/**
 * GalataBaker API — Notifications module config.
 *
 * Env-driven: TELEGRAM_PROVIDER selects the concrete provider, similar
 * to EMAIL_PROVIDER.
 *
 * BOT_TOKEN is the @BotFather token (123456:ABC-DEF...). Required only
 * when TELEGRAM_PROVIDER=http. In noop mode, the token is optional
 * (used only for the apiUrl host).
 */

import { z } from 'zod';

const schema = z.object({
  provider: z.enum(['http', 'noop']).default('noop'),
  botToken: z.string().min(10).max(128).optional(),
  apiUrl: z.string().url().default('https://api.telegram.org/bot'),
});

export type TelegramConfig = z.infer<typeof schema>;

/** Build the runtime config from process.env. */
export function loadNotificationConfig(env: NodeJS.ProcessEnv = process.env): TelegramConfig {
  const parsed = schema.safeParse({
    provider: env.TELEGRAM_PROVIDER,
    botToken: env.TELEGRAM_BOT_TOKEN,
    apiUrl: env.TELEGRAM_API_URL,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`Invalid notification config: ${issue?.message ?? 'unknown'}`);
  }
  if (parsed.data.provider === 'http' && !parsed.data.botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is required when TELEGRAM_PROVIDER=http');
  }
  return parsed.data;
}

export const NOTIFICATION_CONFIG = Symbol('NOTIFICATION_CONFIG');
export const TELEGRAM_PROVIDER = Symbol('TELEGRAM_PROVIDER');
