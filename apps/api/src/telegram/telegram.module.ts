/**
 * GalataBaker API — Telegram bridge module.
 *
 * Akış:
 *   1. Frontend: "Telegram bağla" tıklar → POST /api/telegram/init
 *   2. Backend: HMAC-signed token üretir, deep link döner:
 *      https://t.me/<bot>?start=<token>
 *   3. Kullanıcı bot'a /start <token> yazar
 *   4. Bot: callback'le backend'e POST atar:
 *      POST /api/telegram/callback { token, chatId, userId, timestamp, signature }
 *   5. Backend: HMAC verify → token consume → User.telegramChatId set
 *
 * Güvenlik:
 *   - HMAC SHA-256: shared secret (TELEGRAM_BOT_SECRET) ile imza
 *   - Timestamp skew kontrolü (5 dk)
 *   - Token tek kullanımlık
 *   - Public key check: bot ile aynı secret paylaşılır
 *
 * MVP: webhook YOK, sadece manual callback (bot kendisi atar).
 * Production: webhook + IP whitelist (Telegram server IPs).
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  Module,
  Post,
  UnauthorizedException,
  UsePipes,
} from '@nestjs/common';
import { z } from 'zod';

import { AUTH_CONFIG, type AuthConfig } from '../auth/auth.config.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersModule } from '../users/users.module.js';
import { UsersService } from '../users/users.service.js';

// ===== Init DTO =====

const initSchema = z.object({
  walletPkh: z.string().regex(/^tz[1-4][a-km-zA-HJ-NP-Z1-9]{33}$/),
});

export type InitTelegramInput = z.infer<typeof initSchema>;

// ===== Callback DTO =====

const callbackSchema = z.object({
  token: z.string().min(20).max(64),
  chatId: z.string().min(1).max(32).regex(/^\d+$/),
  userId: z.string().min(1).max(64),
  timestamp: z.number().int().positive(),
  signature: z.string().min(32).max(128),
});

export type TelegramCallbackInput = z.infer<typeof callbackSchema>;

// ===== Service =====

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly pendingTokens = new Map<string, { walletPkh: string; expiresAt: number }>();

  constructor(
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Init: HMAC-signed token üret + deep link döner.
   * Bot adı env'den veya hardcoded MVP.
   */
  init(input: InitTelegramInput): { deepLink: string; token: string; expiresAt: number } {
    const token = randomBytes(24).toString('base64url');
    const now = Date.now();
    const expiresAt = now + 5 * 60 * 1000; // 5 minutes

    this.pendingTokens.set(token, { walletPkh: input.walletPkh, expiresAt });

    const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? 'GalataBakerBot';
    const deepLink = `https://t.me/${botUsername}?start=${token}`;

    this.logger.log(`[telegram] init token issued for pkh=${input.walletPkh.slice(0, 8)}…`);
    return { deepLink, token, expiresAt };
  }

  /**
   * Callback: bot → backend.
   *   - HMAC verify (replay koruması + authenticity)
   *   - Token consume (tek kullanımlık)
   *   - User.telegramChatId set
   */
  async handleCallback(input: TelegramCallbackInput): Promise<{ linked: true }> {
    // 1. Timestamp skew kontrolü
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - input.timestamp) > 300) {
      throw new UnauthorizedException('Timestamp out of acceptable range');
    }

    // 2. HMAC signature verify
    const expectedSignature = this.computeHmac(
      `${input.token}.${input.chatId}.${input.userId}.${input.timestamp}`,
    );
    if (!this.safeEqual(expectedSignature, input.signature)) {
      this.logger.warn(`[telegram] invalid HMAC signature token=${input.token.slice(0, 8)}…`);
      throw new UnauthorizedException('Invalid signature');
    }

    // 3. Token consume
    const stored = this.pendingTokens.get(input.token);
    if (!stored) throw new UnauthorizedException('Invalid or already-used token');
    this.pendingTokens.delete(input.token);
    if (Date.now() > stored.expiresAt) {
      throw new UnauthorizedException('Token expired');
    }

    // 4. Link telegram
    await this.users.linkTelegram(stored.walletPkh, input.chatId);

    this.logger.log(
      `[telegram] linked pkh=${stored.walletPkh.slice(0, 8)}… chatId=${input.chatId.slice(0, 4)}…`,
    );

    return { linked: true };
  }

  /**
   * HMAC SHA-256 — shared secret ile mesaj imzala.
   * Bot tarafı da aynı secret + aynı format ile imzalar.
   */
  computeHmac(message: string): string {
    return createHmac('sha256', this.config.TELEGRAM_BOT_SECRET)
      .update(message)
      .digest('base64url');
  }

  /** Constant-time comparison (timing attack koruması). */
  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}

// ===== Controller =====

@Controller('telegram')
@UsePipes(new ZodValidationPipe())
export class TelegramController {
  constructor(private readonly telegram: TelegramService) {}

  @Post('init')
  @HttpCode(HttpStatus.OK)
  init(@Body(new ZodValidationPipe(initSchema)) body: InitTelegramInput) {
    return this.telegram.init(body);
  }

  @Post('callback')
  @HttpCode(HttpStatus.OK)
  callback(@Body(new ZodValidationPipe(callbackSchema)) body: TelegramCallbackInput) {
    return this.telegram.handleCallback(body);
  }
}

// ===== Module =====

@Module({
  imports: [UsersModule],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
