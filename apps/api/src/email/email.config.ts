/**
 * GalataBaker API — Email config schema (zod).
 *
 * EmailModule factory bu schema ile env'i validate eder, sonra EmailConfig
 * shape'ine map'ler. Invalid config (örn. provider='resend' ama
 * RESEND_API_KEY boş) → module load hatası (app boot etmez).
 *
 * Env değişkenleri (apps/api/.env):
 *   EMAIL_PROVIDER         noop | mailhog | resend  (default: noop)
 *   EMAIL_FROM_ADDRESS     noreply@galatabaker.io
 *   EMAIL_FROM_NAME        GalataBaker
 *   EMAIL_SMTP_HOST        localhost (provider=mailhog)
 *   EMAIL_SMTP_PORT        1025
 *   EMAIL_SMTP_SECURE      false
 *   RESEND_API_KEY         re_*** (provider=resend)
 *   RESEND_API_URL         https://api.resend.com/emails
 */

import { z } from 'zod';

import type { EmailConfig, EmailProviderName } from './email.types.js';

const providerSchema = z.enum(['noop', 'mailhog', 'resend']);

export const emailConfigSchema = z
  .object({
    EMAIL_PROVIDER: providerSchema.default('noop'),
    EMAIL_FROM_ADDRESS: z.string().email('EMAIL_FROM_ADDRESS must be a valid email'),
    EMAIL_FROM_NAME: z.string().min(1).max(120),
    EMAIL_SMTP_HOST: z.string().optional(),
    EMAIL_SMTP_PORT: z.coerce.number().int().positive().optional(),
    EMAIL_SMTP_SECURE: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .transform((v) => v === true || v === 'true')
      .optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    RESEND_API_URL: z.string().url().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.EMAIL_PROVIDER === 'mailhog' && !data.EMAIL_SMTP_HOST) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['EMAIL_SMTP_HOST'],
        message: 'EMAIL_SMTP_HOST is required when EMAIL_PROVIDER=mailhog',
      });
    }
    if (data.EMAIL_PROVIDER === 'resend' && !data.RESEND_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RESEND_API_KEY'],
        message: 'RESEND_API_KEY is required when EMAIL_PROVIDER=resend',
      });
    }
  });

export type EmailEnv = z.infer<typeof emailConfigSchema>;

/**
 * Validated env'den EmailConfig'e map.
 * Sağlayıcıya göre sadece gereken alt-objeler (smtp, resend) eklenir.
 */
export function buildEmailConfig(env: EmailEnv): EmailConfig {
  const cfg: EmailConfig = {
    provider: env.EMAIL_PROVIDER as EmailProviderName,
    fromAddress: env.EMAIL_FROM_ADDRESS,
    fromName: env.EMAIL_FROM_NAME,
  };
  if (env.EMAIL_PROVIDER === 'mailhog') {
    cfg.smtp = {
      host: env.EMAIL_SMTP_HOST!,
      port: env.EMAIL_SMTP_PORT ?? 1025,
      secure: env.EMAIL_SMTP_SECURE ?? false,
    };
  } else if (env.EMAIL_PROVIDER === 'resend') {
    cfg.resend = {
      apiKey: env.RESEND_API_KEY!,
      apiUrl: env.RESEND_API_URL ?? 'https://api.resend.com/emails',
    };
  }
  return cfg;
}
