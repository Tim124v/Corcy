import { Module, forwardRef } from '@nestjs/common';
import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';
import { UploadService } from './upload.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { ChatModule } from '../chat/chat.module.js';
import { UsersModule } from '../users/users.module.js';
import { PushService } from '../auth/push.service.js';
import { ReactionsService } from './reactions.service.js';

@Module({
  imports: [AuthModule, ChatModule, forwardRef(() => UsersModule)],
  controllers: [MessagesController],
  providers: [MessagesService, UploadService, PushService, ReactionsService],
  exports: [UploadService, ReactionsService],
})
export class MessagesModule {}
