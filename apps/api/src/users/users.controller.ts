/**
 * GalataBaker API — Users REST controller.
 *
 * Endpoints:
 *   POST /api/users/register   — wallet bağlayınca user kaydı (idempotent)
 *   GET  /api/users/:walletPkh — user lookup (PII masked)
 *
 * Güvenlik:
 *   - PKH format zod ile validate
 *   - Email zod .email() ile validate
 *   - Response'ta PII service katmanında mask'lenir (burada ekstra iş yok)
 *   - 200 her zaman (idempotent upsert — created/updated fark etmez)
 */

import { Body, Controller, Get, Param, Post, UsePipes } from '@nestjs/common';
import { z } from 'zod';

import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

import { UsersService, type UserPublic } from './users.service.js';

// PKH regex: bakers controller ile aynı — ortak bir common/ dosyasına
// taşımak da mümkün ama şu an sadece 2 yerde kullanılıyor, YAGNI.
const PKH_REGEX = /^tz[1-4][a-km-zA-HJ-NP-Z1-9]{33}$/;

const registerSchema = z.object({
  walletPkh: z.string().regex(PKH_REGEX, 'Invalid Tezos address format'),
  email: z.string().email().max(254).optional(), // RFC 5321 max
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

@Controller('users')
@UsePipes(new ZodValidationPipe())
export class UsersController {
  constructor(private readonly users: UsersService) {}

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
}
