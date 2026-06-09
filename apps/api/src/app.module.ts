import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { BakersModule } from './bakers/bakers.module.js';
import { DelegationsModule } from './delegations/delegations.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RewardsModule } from './rewards/rewards.module.js';
import { UsersModule } from './users/users.module.js';

/**
 * Root AppModule.
 *
 * Şu an: HealthModule (liveness) + PrismaModule (DB) + ScheduleModule
 * (cron) + BakersModule + UsersModule + DelegationsModule + RewardsModule.
 * Sonraki: NotificationsModule (Task 8).
 *
 * ScheduleModule.forRoot() global cron altyapısını kurar.
 * İçerideki modüller (RewardsScheduler) cron decorator'larını
 * instance oluşturulduktan sonra register eder.
 */
@Module({
  imports: [
    PrismaModule,
    HealthModule,
    ScheduleModule.forRoot(),
    BakersModule,
    UsersModule,
    DelegationsModule,
    RewardsModule,
  ],
})
export class AppModule {}
