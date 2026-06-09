/**
 * GalataBaker API — Rewards module.
 *
 * PrismaModule @Global() olduğu için ek import gerekmiyor.
 */

import { Module } from '@nestjs/common';

import { RewardsController } from './rewards.controller.js';
import { RewardsScheduler } from './rewards.scheduler.js';
import { RewardsService } from './rewards.service.js';

@Module({
  controllers: [RewardsController],
  providers: [RewardsService, RewardsScheduler],
  exports: [RewardsService],
})
export class RewardsModule {}
