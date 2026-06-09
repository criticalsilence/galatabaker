/**
 * GalataBaker API — Throttler config (global rate limiting).
 *
 * @nestjs/throttler global guard, per-IP rate limit.
 * Specific endpoint'lerdeki daha sıkı limitler @Throttle dekoratörü ile.
 *
 * MVP limitleri (3 tier):
 *   - short:  10 req / saniye / IP
 *   - medium: 100 req / dakika / IP
 *   - long:   1000 req / saat / IP
 *
 * Production: Redis-backed storage, IP+wallet kombine anahtar.
 */
import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1_000, limit: 10 },
      { name: 'medium', ttl: 60_000, limit: 100 },
      { name: 'long', ttl: 3_600_000, limit: 1_000 },
    ]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  exports: [ThrottlerModule],
})
export class ThrottlerConfigModule {}
