import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';
import { UploadService } from './upload.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { ChatModule } from '../chat/chat.module.js';

@Module({
  imports: [AuthModule, ChatModule],
  controllers: [MessagesController],
  providers: [MessagesService, UploadService],
  exports: [UploadService],
})
export class MessagesModule {}
