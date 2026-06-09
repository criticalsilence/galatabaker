/**
 * GalataBaker API — Email DI tokens.
 *
 * EMAIL_PROVIDER: runtime'da env-driven seçilen concrete provider
 * (NoopProvider / MailHogProvider / ResendProvider) — useFactory ile
 * EmailModule içinde resolve edilir.
 *
 * EMAIL_CONFIG: validated email config object (zod-validated env subset)
 * — provider'lar construct sırasında bu token'ı inject eder.
 */

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

export const EMAIL_CONFIG = Symbol('EMAIL_CONFIG');
