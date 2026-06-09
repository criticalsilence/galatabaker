import { Module } from '@nestjs/common';

import { BakersModule } from './bakers/bakers.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

/**
 * Root AppModule.
 *
 * Şu an: HealthModule (liveness) + PrismaModule (DB) + BakersModule
 * (Task 3). Sonraki: UsersModule, DelegationsModule, RewardsModule,
 * NotificationsModule (Task 4-8).
 */
@Module({
  imports: [PrismaModule, HealthModule, BakersModule],
})
export class AppModule {}
