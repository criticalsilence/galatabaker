/**
 * GalataBaker API — Delegations module.
 *
 * PrismaModule @Global() olduğu için ek import gerekmiyor.
 * UsersService'a doğrudan bağımlılık yok — user upsert burada yapılıyor
 * (servisleri loose-coupled tutmak için).
 */

import { Module } from '@nestjs/common';

import { DelegationsController } from './delegations.controller.js';
import { DelegationsService } from './delegations.service.js';

@Module({
  controllers: [DelegationsController],
  providers: [DelegationsService],
  exports: [DelegationsService],
})
export class DelegationsModule {}
