import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword, verifyPassword } from '../security/password.util.js';
import { mapMessagesText, prepareMessageForApi, prepareMessageForStorage } from '../security/message-encryption.util.js';

interface MembershipWithRoom {
  room: { id: string; name: string; ownerId: string; expiresAt: Date; owner: { id: string; email: string; name: string | null; avatarUrl: string | null } };
  joinedAt: Date;
  userId: string;
}
interface RoomMessageWithSender {
  id: string;
  text: string;
  senderId: string;
  systemEventType: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  createdAt: Date;
  sender: { id: string; email: string; name: string | null; avatarUrl: string | null };
}

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  private async cleanupExpired() {
    await this.prisma.room.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }

  async listRooms(userId: string) {
    await this.cleanupExpired();
    const memberships = await this.prisma.roomMember.findMany({
      where: { userId },
      include: {
        room: {
          include: { owner: { select: { id: true, email: true, name: true, avatarUrl: true } } },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
    return memberships.map((m: MembershipWithRoom) => ({
      id: m.room.id,
      name: m.room.name,
      owner: m.room.owner,
      joinedAt: m.joinedAt,
      expiresAt: m.room.expiresAt,
      isOwner: m.room.ownerId === userId,
    }));
  }

  async createRoom(userId: string, name: string, password: string) {
    const passwordHash = await hashPassword(password);
    const expiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const room = await this.prisma.room.create({
      data: {
        name: name.trim() || 'Комната',
        passwordHash,
        ownerId: userId,
        expiresAt,
        members: { create: { userId } },
      },
      include: { owner: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });
    return { id: room.id, name: room.name, owner: room.owner, expiresAt: room.expiresAt };
  }

  async joinRoom(userId: string, roomId: string, password: string) {
    await this.cleanupExpired();
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { owner: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });
    if (!room) throw new NotFoundException('Комната не найдена');
    const ok = await verifyPassword(password, room.passwordHash);
    if (!ok) throw new ForbiddenException('Неверный пароль комнаты');
    await this.prisma.roomMember.upsert({
      where: { roomId_userId: { roomId, userId } },
      create: { roomId, userId },
      update: {},
    });
    return { id: room.id, name: room.name, owner: room.owner, expiresAt: room.expiresAt };
  }

  async deleteRoom(userId: string, roomId: string) {
    await this.cleanupExpired();
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true, ownerId: true },
    });
    if (!room) throw new NotFoundException('Комната не найдена');
    if (room.ownerId !== userId) throw new ForbiddenException('Удалять комнату может только владелец');

    await this.prisma.room.delete({ where: { id: roomId } });
    return { ok: true };
  }

  /** Покинуть комнату (только для участников, не владельцев). */
  async leaveRoom(userId: string, roomId: string) {
    await this.cleanupExpired();
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true, ownerId: true },
    });
    if (!room) throw new NotFoundException('Комната не найдена');
    if (room.ownerId === userId) throw new ForbiddenException('Владелец не может покинуть комнату; удалите комнату');

    await this.prisma.roomMessage.create({
      data: {
        roomId,
        senderId: userId,
        text: '',
        systemEventType: 'user_left',
      },
    });

    const deleted = await this.prisma.roomMember.deleteMany({
      where: { roomId, userId },
    });
    if (deleted.count === 0) throw new NotFoundException('Вы не состоите в этой комнате');
    return { ok: true };
  }

  private async ensureMember(userId: string, roomId: string) {
    const member = await this.prisma.roomMember.findFirst({ where: { roomId, userId } });
    if (!member) throw new ForbiddenException('Нет доступа к комнате');
  }

  async listMessages(userId: string, roomId: string) {
    await this.cleanupExpired();
    await this.ensureMember(userId, roomId);
    const messages = await this.prisma.roomMessage.findMany({
      where: { roomId },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, email: true, name: true, avatarUrl: true } } },
      take: 200,
    });
    const decrypted = mapMessagesText(messages);
    return decrypted.map((m: RoomMessageWithSender) => ({
      id: m.id,
      text: m.text,
      senderId: m.senderId,
      systemEventType: m.systemEventType ?? undefined,
      attachmentUrl: m.attachmentUrl ?? undefined,
      attachmentName: m.attachmentName ?? undefined,
      attachmentType: m.attachmentType ?? undefined,
      createdAt: m.createdAt,
      sender: m.sender,
    }));
  }

  async sendMessage(
    userId: string,
    roomId: string,
    text: string,
    attachment?: { url?: string; name?: string; type?: string } | null,
  ) {
    await this.cleanupExpired();
    await this.ensureMember(userId, roomId);
    const hasAttachment = !!attachment?.url;
    const textTrim = text?.trim() ?? '';
    if (!textTrim && !hasAttachment) throw new BadRequestException('Текст или вложение обязательны');
    const storedText = textTrim ? prepareMessageForStorage(textTrim) : '';
    const message = await this.prisma.roomMessage.create({
      data: {
        roomId,
        senderId: userId,
        text: storedText,
        attachmentUrl: attachment?.url ?? null,
        attachmentName: attachment?.name ?? null,
        attachmentType: attachment?.type ?? null,
      },
      include: { sender: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });
    return {
      id: message.id,
      text: prepareMessageForApi(message.text),
      senderId: message.senderId,
      attachmentUrl: message.attachmentUrl ?? undefined,
      attachmentName: message.attachmentName ?? undefined,
      attachmentType: message.attachmentType ?? undefined,
      createdAt: message.createdAt,
      sender: message.sender,
    };
  }
}
