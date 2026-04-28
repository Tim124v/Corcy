import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { ConnectionsModule } from '../connections/connections.module.js';
import { MessagesModule } from '../messages/messages.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { WaitlistModule } from '../waitlist/waitlist.module.js';
import { ChatModule } from '../chat/chat.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 60_000, limit: 100 },
      { name: 'long', ttl: 3_600_000, limit: 1000 },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    ConnectionsModule,
    MessagesModule,
    RoomsModule,
    WaitlistModule,
    ChatModule,
  ],
  providers: [
    Reflector,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
