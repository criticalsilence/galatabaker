import { Module } from '@nestjs/common';

import { BakersModule } from './bakers/bakers.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';

/**
 * Root AppModule.
 *
 * Şu an: HealthModule (liveness) + PrismaModule (DB) + BakersModule
 * (Task 3) + UsersModule (Task 4). Sonraki: DelegationsModule,
 * RewardsModule, NotificationsModule (Task 5-8).
 */
@Module({
  imports: [PrismaModule, HealthModule, BakersModule, UsersModule],
})
export class AppModule {}
