/**
 * GalataBaker API — App module (root).
 *
 * 7 modül + Config + Schedule + Throttler + Auth.
 * Sıra önemli: terminal modüllerin hepsi import edilir, Auth @Global.
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { AuthModule } from './auth/auth.module.js';
import { BakersModule } from './bakers/bakers.module.js';
import { ThrottlerConfigModule } from './common/throttler.config.js';
import { DelegationsModule } from './delegations/delegations.module.js';
import { EmailModule } from './email/email.module.js';
import { HealthModule } from './health/health.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RewardsModule } from './rewards/rewards.module.js';
import { TelegramModule } from './telegram/telegram.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerConfigModule,
    PrismaModule,
    AuthModule, // @Global — JWT, AUTH_CONFIG, JwtAuthGuard
    BakersModule,
    DelegationsModule,
    RewardsModule,
    EmailModule,
    HealthModule,
    UsersModule,
    TelegramModule,
    NotificationsModule,
  ],
})
export class AppModule {}
