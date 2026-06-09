/**
 * GalataBaker API — Bakers module.
 *
 * Tek modül, tek controller, tek service. BakersService @Global
 * değil — sadece burada register. (Yazma işlemleri Adım 6'da
 * ayrı bir admin module'de olacak.)
 */

import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';

import { BakersController } from './bakers.controller.js';
import { BakersService } from './bakers.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [BakersController],
  providers: [BakersService],
  exports: [BakersService],
})
export class BakersModule {}
