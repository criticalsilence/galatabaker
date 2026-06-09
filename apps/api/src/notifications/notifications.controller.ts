/**
 * GalataBaker API — Notifications REST controller.
 *
 * Endpoints:
 *   GET   /api/notifications/:walletPkh                  — paginated list (owner)
 *   GET   /api/notifications/:walletPkh/unread-count      — count of !read (owner)
 *   POST  /api/notifications/:walletPkh/:id/read          — mark one as read (owner)
 *
 * Güvenlik:
 *   - JwtAuthGuard + ownership guard (token.sub === urlPkh)
 *   - read endpoint also checks the notification belongs to the user
 */

import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { z } from 'zod';

import type { JWTPayload } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

import { NotificationService } from './notification.service.js';

const PKH_REGEX = /^tz[1-4][a-km-zA-HJ-NP-Z1-9]{33}$/;

const pkhParamSchema = z.object({
  walletPkh: z.string().regex(PKH_REGEX, 'Invalid Tezos address format'),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  unreadOnly: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
});

const idParamSchema = z.object({
  walletPkh: z.string().regex(PKH_REGEX, 'Invalid Tezos address format'),
  id: z.string().min(1).max(64),
});

@Controller('notifications')
@UsePipes(new ZodValidationPipe())
export class NotificationsController {
  constructor(private readonly notify: NotificationService) {}

  @Get(':walletPkh')
  @UseGuards(JwtAuthGuard)
  async list(
    @Param(new ZodValidationPipe(pkhParamSchema)) params: z.infer<typeof pkhParamSchema>,
    // Query schema has defaults → input != output type; the pipe only checks
    // the output shape at runtime, so a structural cast keeps typecheck green.
    @Query(new ZodValidationPipe<z.infer<typeof listQuerySchema>>(listQuerySchema as never))
    q: z.infer<typeof listQuerySchema>,
    @CurrentUser() user: JWTPayload,
  ) {
    this.assertOwner(user, params.walletPkh);
    return this.notify.listByUser(params.walletPkh, q);
  }

  @Get(':walletPkh/unread-count')
  @UseGuards(JwtAuthGuard)
  async unreadCount(
    @Param(new ZodValidationPipe(pkhParamSchema)) params: z.infer<typeof pkhParamSchema>,
    @CurrentUser() user: JWTPayload,
  ) {
    this.assertOwner(user, params.walletPkh);
    const r = await this.notify.listByUser(params.walletPkh, { limit: 1, offset: 0 });
    return { walletPkh: params.walletPkh, unreadCount: r.unreadCount };
  }

  @Post(':walletPkh/:id/read')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async markRead(
    @Param(new ZodValidationPipe(idParamSchema)) params: z.infer<typeof idParamSchema>,
    @CurrentUser() user: JWTPayload,
  ) {
    this.assertOwner(user, params.walletPkh);
    return this.notify.markRead(params.walletPkh, params.id);
  }

  private assertOwner(tokenPayload: JWTPayload, urlWalletPkh: string): void {
    if (tokenPayload.sub !== urlWalletPkh) {
      throw new UnauthorizedException('Token does not match wallet in URL');
    }
  }
}
