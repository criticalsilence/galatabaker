import { Module } from '@nestjs/common';

import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

/**
 * Root AppModule.
 *
 * Şu an: HealthModule (liveness) + PrismaModule (DB bağlantısı).
 * Sonraki task'lerde: BakersModule, UsersModule, DelegationsModule,
 * RewardsModule, NotificationsModule eklenecek.
 */
@Module({
  imports: [PrismaModule, HealthModule],
})
export class AppModule {}
