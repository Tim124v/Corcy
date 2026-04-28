import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim());

@WebSocketGateway({
  cors: { origin: corsOrigins, credentials: true },
  transports: ['websocket', 'polling'],
  namespace: '/',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  // userId → Set<socketId>
  private userSockets = new Map<string, Set<string>>();

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      // Получаем токен из handshake
      const token =
        (client.handshake.auth as Record<string, string>)?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect(); return;
      }

      const payload = this.jwt.verify<{ sub: string }>(token, {
        secret: process.env.JWT_SECRET,
      });

      client.data.userId = payload.sub;

      // Добавляем сокет в map
      if (!this.userSockets.has(payload.sub)) {
        this.userSockets.set(payload.sub, new Set());
      }
      this.userSockets.get(payload.sub)!.add(client.id);

      // Присоединяем к личной комнате пользователя
      await client.join(`user:${payload.sub}`);

      // eslint-disable-next-line no-console
      console.log(`[WS] Connected: ${payload.sub} (${client.id})`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId as string | undefined;
    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }
    }
  }

  // Присоединиться к комнате
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    await client.join(`room:${data.roomId}`);
  }

  // Покинуть комнату
  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    await client.leave(`room:${data.roomId}`);
  }

  // Отправить событие конкретному пользователю
  sendToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // Отправить событие в комнату
  sendToRoom(roomId: string, event: string, data: unknown) {
    this.server.to(`room:${roomId}`).emit(event, data);
  }
}

