/**
 * GalataBaker API — Users module.
 *
 * Sorumluluk: User CRUD + verification + preferences + consent + delete.
 * Auth: @Global() değil ama UsersService başka modüller tarafından kullanılır.
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
