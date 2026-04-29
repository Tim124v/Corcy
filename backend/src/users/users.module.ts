import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { MessagesModule } from '../messages/messages.module.js';
import { AuditLogService } from '../security/audit-log.service.js';

@Module({
  imports: [AuthModule, MessagesModule],
  controllers: [UsersController],
  providers: [UsersService, AuditLogService],
  exports: [UsersService],
})
export class UsersModule {}
