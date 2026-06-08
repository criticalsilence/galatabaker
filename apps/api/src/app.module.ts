import { Module } from '@nestjs/common';

import { HealthModule } from './health/health.module.js';

/**
 * Root AppModule.
 *
 * Şu an: sadece HealthModule (liveness probe).
 * Sonraki task'lerde: PrismaModule, BakersModule, UsersModule,
 * DelegationsModule, RewardsModule, NotificationsModule eklenecek.
 */
@Module({
  imports: [HealthModule],
})
export class AppModule {}
