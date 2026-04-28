import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RoomsService } from './rooms.service.js';
import { RoomsController } from './rooms.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { ChatModule } from '../chat/chat.module.js';

@Module({
  imports: [PrismaModule, AuthModule, ChatModule],
  controllers: [RoomsController],
  providers: [RoomsService],
})
export class RoomsModule {}
