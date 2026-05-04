import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { MessagesModule } from '../messages/messages.module.js';
import { AuditLogService } from '../security/audit-log.service.js';
import { PushService } from '../auth/push.service.js';

@Module({
  imports: [AuthModule, forwardRef(() => MessagesModule)],
  controllers: [UsersController],
  providers: [UsersService, AuditLogService, PushService],
  exports: [UsersService, PushService],
})
export class UsersModule {}
