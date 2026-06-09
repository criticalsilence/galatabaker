/**
 * GalataBaker API — @CurrentUser() param decorator.
 *
 * JwtAuthGuard aktifken JWT payload'ından walletPkh'yi extract eder.
 *
 * Kullanım:
 *   @UseGuards(JwtAuthGuard)
 *   @Get('me')
 *   getMe(@CurrentUser() walletPkh: string) { ... }
 *
 * Veya tüm payload:
 *   getMe(@CurrentUser(true) user: JWTPayload) { ... }
 */
import { ExecutionContext, createParamDecorator } from '@nestjs/common';

import type { JWTPayload } from '../auth.types.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | JWTPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: JWTPayload }>();
    return request.user;
  },
);
