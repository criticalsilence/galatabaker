/**
 * GalataBaker API — JWT auth guard.
 *
 * Authorization: Bearer <token> header'dan JWT'yi alır, doğrular,
 * request.user'a payload'ı set eder.
 *
 * Kullanım:
 *   @UseGuards(JwtAuthGuard)
 *   @Get('protected')
 *   protected(@CurrentUser() walletPkh: string) { ... }
 *
 * Public endpoint'ler için guard KULLANILMAZ.
 *
 * Hata durumları:
 *   - Header yok / 'Bearer ' prefix yok → 401
 *   - Token invalid / expired → 401
 *   - Payload'da sub yok → 401
 */
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type { JWTPayload } from '../auth.types.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: JWTPayload;
    }>();

    const authHeader = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Empty bearer token');
    }

    let payload: JWTPayload;
    try {
      payload = this.jwt.verify<JWTPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Token payload missing sub claim');
    }

    request.user = payload;
    return true;
  }
}
