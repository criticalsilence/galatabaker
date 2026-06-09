/**
 * GalataBaker API — Users module.
 *
 * Sorumluluk: User CRUD + verification + preferences + consent + delete.
 * Auth: @Global() değil ama UsersService başka modüller tarafından kullanılır.
 *
 * NotificationsModule import'u:
 *   - UsersService enqueue() çağırıyor (email_verify, telegram_link triggers)
 *   - Tek yön: UsersModule → NotificationsModule (no cycle)
 */
import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module.js';

import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
