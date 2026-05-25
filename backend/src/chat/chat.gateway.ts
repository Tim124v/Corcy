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
import { PrismaService } from '../prisma/prisma.service.js';
import { PushService } from '../auth/push.service.js';

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
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  private async isRoomMember(userId: string, roomId: string): Promise<boolean> {
    const member = await this.prisma.roomMember.findFirst({
      where: { roomId, userId },
      select: { id: true },
    });
    return !!member;
  }

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
    const userId = client.data?.userId as string | undefined;
    if (!userId || !data?.roomId) return;

    const isMember = await this.isRoomMember(userId, data.roomId);
    if (!isMember) {
      client.emit('roomError', { roomId: data.roomId, error: 'Access denied' });
      return;
    }

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
  async handleCallOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { toUserId: string; offer: RTCSessionDescriptionInit },
  ) {
    const fromUserId = client.data?.userId as string | undefined;
    if (!fromUserId) return;

    const user = await this.prisma.user.findUnique({
      where: { id: fromUserId },
      select: { name: true, email: true },
    });
    const fromName = user?.name || user?.email?.split('@')[0] || fromUserId.slice(0, 8);

    this.server.to(`user:${data.toUserId}`).emit('call:incoming', {
      fromUserId,
      fromName,
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

  @SubscribeMessage('gcall:join')
  async handleGroupCallJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const userId = client.data?.userId as string | undefined;
    if (!userId || !data?.roomId) return;

    const isMember = await this.isRoomMember(userId, data.roomId);
    if (!isMember) return;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    const displayName = user?.name || user?.email?.split('@')[0] || 'Участник';

    const room = await this.prisma.room.findUnique({
      where: { id: data.roomId },
      select: { name: true },
    });

    this.server.to(`room:${data.roomId}`).emit('gcall:peer-joined', {
      userId,
      roomId: data.roomId,
      displayName,
      roomName: room?.name ?? 'Комната',
    });

    const members = await this.prisma.roomMember.findMany({
      where: { roomId: data.roomId },
      select: { userId: true },
    });

    const offlineMembers = members
      .map((m) => m.userId)
      .filter((memberId) => memberId !== userId && !this.isOnline(memberId));

    void Promise.allSettled(
      offlineMembers.map((memberId) =>
        this.push.sendToUser(memberId, {
          title: `📞 ${displayName} начал звонок`,
          body: 'Нажмите чтобы присоединиться к групповому звонку',
          url: `/group-call?roomId=${data.roomId}&video=false`,
        }),
      ),
    );
  }

  @SubscribeMessage('gcall:offer')
  handleGroupCallOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; toUserId: string; offer: RTCSessionDescriptionInit },
  ) {
    const fromUserId = client.data?.userId as string | undefined;
    if (!fromUserId || !data?.toUserId || !data?.offer || !data?.roomId) return;

    this.server.to(`user:${data.toUserId}`).emit('gcall:offer', {
      fromUserId,
      roomId: data.roomId,
      offer: data.offer,
    });
  }

  @SubscribeMessage('gcall:answer')
  handleGroupCallAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; toUserId: string; answer: RTCSessionDescriptionInit },
  ) {
    const fromUserId = client.data?.userId as string | undefined;
    if (!fromUserId || !data?.toUserId || !data?.answer || !data?.roomId) return;

    this.server.to(`user:${data.toUserId}`).emit('gcall:answer', {
      fromUserId,
      roomId: data.roomId,
      answer: data.answer,
    });
  }

  @SubscribeMessage('gcall:ice-candidate')
  handleGroupCallIce(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; toUserId: string; candidate: RTCIceCandidateInit },
  ) {
    const fromUserId = client.data?.userId as string | undefined;
    if (!fromUserId || !data?.toUserId || !data?.candidate || !data?.roomId) return;

    this.server.to(`user:${data.toUserId}`).emit('gcall:ice-candidate', {
      fromUserId,
      roomId: data.roomId,
      candidate: data.candidate,
    });
  }

  @SubscribeMessage('gcall:leave')
  handleGroupCallLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const userId = client.data?.userId as string | undefined;
    if (!userId || !data?.roomId) return;

    this.server.to(`room:${data.roomId}`).emit('gcall:peer-left', {
      userId,
      roomId: data.roomId,
    });
  }
}

