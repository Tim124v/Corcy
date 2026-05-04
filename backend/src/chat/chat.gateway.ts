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
import { ConfigService } from '@nestjs/config';

const isDev = process.env.NODE_ENV !== 'production';

const corsOrigins = [
  ...(process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean),
  ...(process.env.FRONTEND_URL || '').split(',').map((s) => s.trim()).filter(Boolean),
  ...(isDev ? ['http://localhost:3000', 'http://127.0.0.1:3000'] : []),
].filter(Boolean);

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || corsOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error(`WS CORS blocked: ${origin}`));
      }
    },
    credentials: true,
  },
  transports: ['polling', 'websocket'],
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  // userId → Set<socketId>
  private userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Получаем токен из handshake
      const token =
        (client.handshake.auth as Record<string, string>)?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        // eslint-disable-next-line no-console
        console.warn('[WS] Disconnect: missing token');
        client.disconnect();
        return;
      }

      const payload = this.jwt.verify<{ sub: string }>(token, {
        secret: this.config.get<string>('JWT_SECRET', 'dev-secret-change-in-production'),
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
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[WS] Disconnect: token verify failed');
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

  /** Есть ли хотя бы одно активное WS-подключение у пользователя */
  isOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return !!sockets && sockets.size > 0;
  }

  // Отправить событие конкретному пользователю
  sendToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // Отправить событие в комнату
  sendToRoom(roomId: string, event: string, data: unknown) {
    this.server.to(`room:${roomId}`).emit(event, data);
  }

  // ── WebRTC signaling ──────────────────────────────────────────

  @SubscribeMessage('call:offer')
  handleCallOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { toUserId: string; offer: RTCSessionDescriptionInit },
  ) {
    const fromUserId = client.data?.userId as string | undefined;
    if (!fromUserId) return;

    this.server.to(`user:${data.toUserId}`).emit('call:incoming', {
      fromUserId,
      offer: data.offer,
    });
  }

  @SubscribeMessage('call:answer')
  handleCallAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { toUserId: string; answer: RTCSessionDescriptionInit },
  ) {
    const fromUserId = client.data?.userId as string | undefined;
    if (!fromUserId) return;

    this.server.to(`user:${data.toUserId}`).emit('call:answered', {
      fromUserId,
      answer: data.answer,
    });
  }

  @SubscribeMessage('call:ice-candidate')
  handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { toUserId: string; candidate: RTCIceCandidateInit },
  ) {
    const fromUserId = client.data?.userId as string | undefined;
    if (!fromUserId) return;

    this.server.to(`user:${data.toUserId}`).emit('call:ice-candidate', {
      fromUserId,
      candidate: data.candidate,
    });
  }

  @SubscribeMessage('call:reject')
  handleCallReject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { toUserId: string },
  ) {
    const fromUserId = client.data?.userId as string | undefined;
    if (!fromUserId) return;

    this.server.to(`user:${data.toUserId}`).emit('call:rejected', {
      fromUserId,
    });
  }

  @SubscribeMessage('call:end')
  handleCallEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { toUserId: string },
  ) {
    const fromUserId = client.data?.userId as string | undefined;
    if (!fromUserId) return;

    this.server.to(`user:${data.toUserId}`).emit('call:ended', {
      fromUserId,
    });
  }

  @SubscribeMessage('call:busy')
  handleCallBusy(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { toUserId: string },
  ) {
    const fromUserId = client.data?.userId as string | undefined;
    if (!fromUserId) return;

    this.server.to(`user:${data.toUserId}`).emit('call:busy', {
      fromUserId,
    });
  }
}

