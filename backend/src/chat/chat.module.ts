import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class ChatModule {}

