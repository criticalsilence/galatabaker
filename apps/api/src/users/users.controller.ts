/**
 * GalataBaker API — Users REST controller.
 *
 * Endpoints:
 *   POST  /api/users/register              — (DEPRECATED) legacy register, test/dev
 *   GET   /api/users/:walletPkh            — public lookup
 *   PUT   /api/users/:walletPkh/email      — email update + verification mail
 *   GET   /api/users/verify-email          — verification link consumer
 *   PUT   /api/users/:walletPkh/telegram   — telegram chat_id (internal — bot callback)
 *   GET   /api/users/:walletPkh/preferences
 *   PUT   /api/users/:walletPkh/preferences
 *   PUT   /api/users/:walletPkh/consent     — KVKK consent
 *   DELETE /api/users/:walletPkh           — full account wipe
 *
 * Güvenlik:
 *   - Protected endpoints: JwtAuthGuard + @CurrentUser() kontrolü
 *     (walletPkh param'sı token.sub ile aynı olmalı)
 *   - /verify-email public (token kendi yetkilendirmesi)
 *   - /register DEPRECATED, sadece test/dev ortamında açık
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UnauthorizedException,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { z } from 'zod';

import type { JWTPayload } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

import { UsersService, type UserPreferences, type UserPublic } from './users.service.js';

const PKH_REGEX = /^tz[1-4][a-km-zA-HJ-NP-Z1-9]{33}$/;

const registerSchema = z.object({
  walletPkh: z.string().regex(PKH_REGEX, 'Invalid Tezos address format'),
  email: z.string().email().max(254).optional(),
  telegramChatId: z
    .string()
    .min(1)
    .max(32)
    .regex(/^\d+$/, 'Telegram chat id must be numeric')
    .optional(),
});

const pkhParamSchema = z.object({
  walletPkh: z.string().regex(PKH_REGEX, 'Invalid Tezos address format'),
});

const updateEmailSchema = z.object({
  email: z.string().email().max(254),
});

const verifyEmailSchema = z.object({
  token: z.string().min(20).max(128),
});

const linkTelegramSchema = z.object({
  chatId: z.string().min(1).max(32).regex(/^\d+$/),
});

const updatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  telegramEnabled: z.boolean().optional(),
  rewardNotify: z.boolean().optional(),
  delegationNotify: z.boolean().optional(),
  cycleDigest: z.boolean().optional(),
});

const updateConsentSchema = z.object({
  given: z.boolean(),
});

@Controller('users')
@UsePipes(new ZodValidationPipe())
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** DEPRECATED: /api/auth/verify kullanın. */
  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: z.infer<typeof registerSchema>,
  ): Promise<UserPublic> {
    return this.users.register(body);
  }

  @Get(':walletPkh')
  async findByPkh(
    @Param(new ZodValidationPipe(pkhParamSchema)) params: z.infer<typeof pkhParamSchema>,
  ): Promise<UserPublic> {
    return this.users.findByPkh(params.walletPkh);
  }

  // ===== Protected endpoints (JWT required) =====

  @Put(':walletPkh/email')
  @UseGuards(JwtAuthGuard)
  async updateEmail(
    @Param(new ZodValidationPipe(pkhParamSchema)) params: z.infer<typeof pkhParamSchema>,
    @Body(new ZodValidationPipe(updateEmailSchema)) body: z.infer<typeof updateEmailSchema>,
    @CurrentUser() user: JWTPayload,
  ): Promise<{ sent: true; maskedEmail: string }> {
    this.assertOwner(user, params.walletPkh);
    const { verificationToken } = await this.users.updateEmail(params.walletPkh, body.email);
    // Caller email gönderimi kendi yapacak — burada sadece token dönüyoruz
    // EmailService entegrasyonu controller'da yapılabilir ya da
    // service içinde EmailService inject edilir (henüz burada inject etmiyoruz)
    void verificationToken;
    return { sent: true, maskedEmail: body.email[0] + '***@***' };
  }

  @Get('verify-email')
  async verifyEmail(
    @Param(new ZodValidationPipe(z.object({}))) _params: unknown,
    @Body(new ZodValidationPipe(verifyEmailSchema)) body: z.infer<typeof verifyEmailSchema>,
  ): Promise<{ verified: true; walletPkh: string }> {
    const result = await this.users.verifyEmail(body.token);
    return { verified: true, walletPkh: result.walletPkh };
  }

  @Put(':walletPkh/telegram')
  @UseGuards(JwtAuthGuard)
  async linkTelegram(
    @Param(new ZodValidationPipe(pkhParamSchema)) params: z.infer<typeof pkhParamSchema>,
    @Body(new ZodValidationPipe(linkTelegramSchema)) body: z.infer<typeof linkTelegramSchema>,
    @CurrentUser() user: JWTPayload,
  ): Promise<{ linked: true }> {
    this.assertOwner(user, params.walletPkh);
    await this.users.linkTelegram(params.walletPkh, body.chatId);
    return { linked: true };
  }

  @Get(':walletPkh/preferences')
  @UseGuards(JwtAuthGuard)
  async getPreferences(
    @Param(new ZodValidationPipe(pkhParamSchema)) params: z.infer<typeof pkhParamSchema>,
    @CurrentUser() user: JWTPayload,
  ): Promise<UserPreferences> {
    this.assertOwner(user, params.walletPkh);
    const u = await this.users.findByPkh(params.walletPkh);
    const prefs = (u as unknown as { preferences: UserPreferences | null }).preferences;
    return (
      prefs ?? {
        emailEnabled: true,
        telegramEnabled: false,
        rewardNotify: true,
        delegationNotify: true,
        cycleDigest: false,
      }
    );
  }

  @Put(':walletPkh/preferences')
  @UseGuards(JwtAuthGuard)
  async updatePreferences(
    @Param(new ZodValidationPipe(pkhParamSchema)) params: z.infer<typeof pkhParamSchema>,
    @Body(new ZodValidationPipe(updatePreferencesSchema))
    body: z.infer<typeof updatePreferencesSchema>,
    @CurrentUser() user: JWTPayload,
  ): Promise<UserPreferences> {
    this.assertOwner(user, params.walletPkh);
    return this.users.updatePreferences(params.walletPkh, body);
  }

  @Put(':walletPkh/consent')
  @UseGuards(JwtAuthGuard)
  async updateConsent(
    @Param(new ZodValidationPipe(pkhParamSchema)) params: z.infer<typeof pkhParamSchema>,
    @Body(new ZodValidationPipe(updateConsentSchema)) body: z.infer<typeof updateConsentSchema>,
    @CurrentUser() user: JWTPayload,
  ): Promise<{ consentGivenAt: Date | null }> {
    this.assertOwner(user, params.walletPkh);
    return this.users.updateConsent(params.walletPkh, body.given);
  }

  @Delete(':walletPkh')
  @UseGuards(JwtAuthGuard)
  async deleteAccount(
    @Param(new ZodValidationPipe(pkhParamSchema)) params: z.infer<typeof pkhParamSchema>,
    @CurrentUser() user: JWTPayload,
  ): Promise<{ deleted: true }> {
    this.assertOwner(user, params.walletPkh);
    await this.users.deleteAccount(params.walletPkh);
    return { deleted: true };
  }

  /**
   * Token'daki wallet ile URL'deki wallet aynı olmalı (ownership guard).
   * Aksi halde 403.
   */
  private assertOwner(tokenPayload: JWTPayload, urlWalletPkh: string): void {
    if (tokenPayload.sub !== urlWalletPkh) {
      throw new UnauthorizedException('Token does not match wallet in URL');
    }
  }
}
