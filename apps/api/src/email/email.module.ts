/**
 * GalataBaker API — Email module.
 *
 * Env-driven provider selection: EMAIL_PROVIDER değerine göre
 * EMAIL_PROVIDER token'ına concrete provider bind edilir.
 *
 *   EMAIL_PROVIDER=noop     → NoopProvider
 *   EMAIL_PROVIDER=mailhog  → MailHogProvider (SMTP)
 *   EMAIL_PROVIDER=resend   → ResendProvider  (HTTP)
 *
 * Config validation: buildEmailConfig() zod ile env'i validate eder.
 *   provider=mailhog + EMAIL_SMTP_HOST yok → module init throw
 *   provider=resend  + RESEND_API_KEY yok  → module init throw
 *
 * Test stratejisi:
 *   - .env.test'te EMAIL_PROVIDER=noop → NoopProvider resolve olur
 *   - .env'de    EMAIL_PROVIDER=mailhog → MailHogProvider resolve olur
 *   - Integration test (Task 9): provider switching logic ayrıca test edilir
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { buildEmailConfig, emailConfigSchema } from './email.config.js';
import { EmailController } from './email.controller.js';
import { EmailService } from './email.service.js';
import { EMAIL_CONFIG, EMAIL_PROVIDER } from './email.tokens.js';
import { MailHogProvider } from './providers/mailhog.provider.js';
import { NoopProvider } from './providers/noop.provider.js';
import { ResendProvider } from './providers/resend.provider.js';

@Module({
  imports: [ConfigModule],
  controllers: [EmailController],
  providers: [
    // EmailConfig: zod-validated env → EmailConfig
    {
      provide: EMAIL_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // ConfigService iç tüm env'i düz objede verir
        const env = emailConfigSchema.parse({
          EMAIL_PROVIDER: config.get<string>('EMAIL_PROVIDER', 'noop'),
          EMAIL_FROM_ADDRESS: config.get<string>('EMAIL_FROM_ADDRESS'),
          EMAIL_FROM_NAME: config.get<string>('EMAIL_FROM_NAME'),
          EMAIL_SMTP_HOST: config.get<string>('EMAIL_SMTP_HOST'),
          EMAIL_SMTP_PORT: config.get<number>('EMAIL_SMTP_PORT'),
          EMAIL_SMTP_SECURE: config.get<string>('EMAIL_SMTP_SECURE'),
          RESEND_API_KEY: config.get<string>('RESEND_API_KEY'),
          RESEND_API_URL: config.get<string>('RESEND_API_URL'),
        });
        return buildEmailConfig(env);
      },
    },
    // EmailProvider: env-driven seçim
    {
      provide: EMAIL_PROVIDER,
      inject: [EMAIL_CONFIG],
      useFactory: (emailCfg: ReturnType<typeof buildEmailConfig>) => {
        switch (emailCfg.provider) {
          case 'mailhog':
            return new MailHogProvider({
              host: emailCfg.smtp!.host,
              port: emailCfg.smtp!.port,
              secure: emailCfg.smtp!.secure,
              fromAddress: emailCfg.fromAddress,
              fromName: emailCfg.fromName,
            });
          case 'resend':
            return new ResendProvider({
              apiKey: emailCfg.resend!.apiKey,
              apiUrl: emailCfg.resend!.apiUrl,
              fromAddress: emailCfg.fromAddress,
              fromName: emailCfg.fromName,
            });
          case 'noop':
          default:
            return new NoopProvider();
        }
      },
    },
    EmailService,
  ],
  exports: [EmailService, EMAIL_PROVIDER, EMAIL_CONFIG],
})
export class EmailModule {}
