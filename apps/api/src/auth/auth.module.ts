/**
 * GalataBaker API — Auth module.
 *
 * SIWW (Sign-In With Wallet) + JWT issue.
 *
 * Wiring:
 *   - AUTH_CONFIG token: env'den zod-validated config
 *   - JwtModule: HS256 signing, TTL config'den
 *   - ChallengeService: in-memory nonce store
 *   - AuthService: SIWW verify + User upsert + JWT
 *   - AuthController: GET /challenge, POST /verify
 *
 * Export'lar:
 *   - AuthService: başka modüller (örn. Telegram callback) SIWW
 *     doğrulaması yapabilsin
 *   - JwtAuthGuard: protected route'lar
 *   - AUTH_CONFIG: config gerekirse
 */
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { loadAuthConfig, AUTH_CONFIG, type AuthConfig } from './auth.config.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { ChallengeService } from './challenge.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const auth = loadAuthConfig(config.get<Record<string, string>>('auth') as never);
        return {
          secret: auth.JWT_SECRET,
          signOptions: { expiresIn: auth.JWT_TTL_SECONDS, algorithm: 'HS256' },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH_CONFIG,
      inject: [ConfigService],
      useFactory: (_config: ConfigService): AuthConfig => {
        // @nestjs/config zaten .env'i process.env'e yükledi (main.ts dotenv)
        // — biz sadece AuthConfig olarak zod-validate edip bind ediyoruz.
        return loadAuthConfig(process.env);
      },
    },
    ChallengeService,
    AuthService,
    JwtAuthGuard,
  ],
  exports: [AuthService, JwtAuthGuard, AUTH_CONFIG, JwtModule],
})
export class AuthModule {}
