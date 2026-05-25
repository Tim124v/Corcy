import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway.js';
import { AuthModule } from '../auth/auth.module.js';
import { PushService } from '../auth/push.service.js';

@Module({
  imports: [AuthModule],
  providers: [ChatGateway, PushService],
  exports: [ChatGateway],
})
export class ChatModule {}

