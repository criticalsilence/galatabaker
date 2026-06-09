import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { BakersModule } from './bakers/bakers.module.js';
import { DelegationsModule } from './delegations/delegations.module.js';
import { EmailModule } from './email/email.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RewardsModule } from './rewards/rewards.module.js';
import { UsersModule } from './users/users.module.js';

/**
 * Root AppModule.
 *
 * Şu an:
 *   - ConfigModule.forRoot() — env loader (.env → process.env)
 *   - HealthModule — liveness
 *   - PrismaModule — DB
 *   - ScheduleModule — cron (RewardsScheduler)
 *   - BakersModule, UsersModule, DelegationsModule, RewardsModule — REST API
 *   - EmailModule — provider facade (Noop / MailHog / Resend)
 * Sonraki: NotificationsModule (Task 8).
 *
 * ConfigModule.forRoot() isGlobal: true yapıyoruz — alt modüller (Email)
 * ConfigService'i import etmeden inject edebiliyor.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    ScheduleModule.forRoot(),
    BakersModule,
    UsersModule,
    DelegationsModule,
    RewardsModule,
    EmailModule,
  ],
})
export class AppModule {}
