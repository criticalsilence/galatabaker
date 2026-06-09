/**
 * GalataBaker API — Auth env config (zod).
 *
 * Auth-specific env değişkenleri:
 *   - SIWW_DOMAIN: canonical message'da görünen domain
 *   - JWT_SECRET: HS256 signing key (≥16 bytes recommended)
 *   - JWT_TTL_SECONDS: token ömrü (default 7 days)
 *   - SIWW_CHALLENGE_TTL_SECONDS: challenge yaşam süresi (default 5 min)
 *   - SIWW_MAX_TIMESTAMP_SKEW: replay attack penceresi (default 5 min)
 *   - TELEGRAM_BOT_SECRET: HMAC shared secret for bot callbacks
 *
 * Production: güçlü random secret (openssl rand -base64 32).
 * Test/CI: process.env fallback'leri yeterli.
 */
import { z } from 'zod';

export const authConfigSchema = z.object({
  SIWW_DOMAIN: z.string().default('galatabaker.local'),
  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET must be at least 16 chars (use openssl rand -base64 32 in prod)')
    .default('dev-jwt-secret-change-in-production-32-chars-min'),
  JWT_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(7 * 24 * 60 * 60), // 7 days
  SIWW_CHALLENGE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(5 * 60), // 5 min
  SIWW_MAX_TIMESTAMP_SKEW: z.coerce
    .number()
    .int()
    .positive()
    .default(5 * 60), // 5 min
  TELEGRAM_BOT_SECRET: z
    .string()
    .min(16)
    .default('dev-telegram-bot-secret-change-in-prod-32-chars'),
});

export type AuthConfig = z.infer<typeof authConfigSchema>;

/** Config factory — NestJS module useFactory. */
export function loadAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  return authConfigSchema.parse(env);
}

/** DI token — AuthModule içinde bind edilir. */
export const AUTH_CONFIG = Symbol('AUTH_CONFIG');
