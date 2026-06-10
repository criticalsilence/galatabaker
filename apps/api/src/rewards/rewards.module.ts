/**
 * GalataBaker API — Rewards module.
 *
 * PrismaModule @Global() olduğu için ek import gerekmiyor.
 *
 * Not: Reward scheduler Step 6'da apps/indexer'a taşındı — bu
 * module sadece HTTP controller + service içerir.
 */

import { Module } from '@nestjs/common';

import { RewardsController } from './rewards.controller.js';
import { RewardsService } from './rewards.service.js';

@Module({
  controllers: [RewardsController],
  providers: [RewardsService],
  exports: [RewardsService],
})
export class RewardsModule {}
