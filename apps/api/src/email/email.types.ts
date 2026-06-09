/**
 * GalataBaker API — Email type definitions.
 *
 * Tüm provider'lar (Resend, MailHog, Noop) aynı input/output shape kullanır.
 * Bu sayede EmailService provider-agnostic kalır.
 *
 * EmailSendOptions: caller'ın doldurduğu input
 * EmailSendResult: provider'ın döndüğü uniform output
 * EmailProviderHealth: ping() çıktısı
 */

export type EmailProviderName = 'resend' | 'mailhog' | 'noop';

export type EmailSendStatus = 'sent' | 'queued' | 'failed';

export interface EmailSendOptions {
  to: string; // tek alıcı (MVP — toplu gönderim Adım 8)
  subject: string;
  html: string;
  text?: string; // plain-text fallback (provider destekliyorsa)
}

export interface EmailSendResult {
  id: string; // provider'ın verdiği message id (Resend id, SMTP message-id, uuid)
  status: EmailSendStatus;
  provider: EmailProviderName;
  error?: string; // sadece status='failed' ise
}

export interface EmailProviderHealth {
  provider: EmailProviderName;
  reachable: boolean;
  lastCheck: Date;
  latencyMs?: number;
  error?: string;
}

/**
 * MailHog / SMTP provider config.
 * Env'den okunur (EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, ...).
 */
export interface MailHogConfig {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean; // true: TLS (port 465), false: plain (port 1025/2525)
  fromAddress: string;
  fromName: string;
}

/**
 * Resend HTTP API config.
 * Env'den okunur (RESEND_API_KEY, ...).
 */
export interface ResendConfig {
  apiKey: string;
  apiUrl: string; // default: https://api.resend.com/emails
  fromAddress: string;
  fromName: string;
}

/**
 * Validated, env-derived email config (EmailService + tüm provider'lar
 * tarafından tüketilir). EmailModule factory tarafından zod ile validate
 * edilir, sonra bu shape'e indirgenir.
 */
export interface EmailConfig {
  provider: EmailProviderName;
  fromAddress: string;
  fromName: string;
  // SMTP (MailHog) — provider='mailhog' ise required
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
  };
  // HTTP (Resend) — provider='resend' ise required
  resend?: {
    apiKey: string;
    apiUrl: string;
  };
}
