/**
 * GalataBaker API — Users module.
 *
 * Tek modül, tek controller, tek service. UsersService @Global değil
 * — burada register edilir. (Başka modüller de lazım olursa export
 * ederiz — şu an DelegationsModule kendi içinde users kullanacak.)
 */

import { Module } from '@nestjs/common';

import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
