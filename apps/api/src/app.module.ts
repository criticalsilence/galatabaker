import { Module } from '@nestjs/common';

import { BakersModule } from './bakers/bakers.module.js';
import { DelegationsModule } from './delegations/delegations.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';

/**
 * Root AppModule.
 *
 * Şu an: HealthModule (liveness) + PrismaModule (DB) + BakersModule
 * + UsersModule + DelegationsModule. Sonraki: RewardsModule,
 * NotificationsModule (Task 6-8).
 */
@Module({
  imports: [PrismaModule, HealthModule, BakersModule, UsersModule, DelegationsModule],
})
export class AppModule {}
