import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword, verifyPassword } from '../security/password.util.js';
import { mapMessagesText, prepareMessageForApi, prepareMessageForStorage } from '../security/message-encryption.util.js';
import { ChatGateway } from '../chat/chat.gateway.js';
import { PlanGuardService } from '../common/plan-guard.service.js';
import { assertAllowedAttachmentUrl } from '../common/attachment-url.util.js';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
    private readonly planGuard: PlanGuardService,
  ) {}

  async cleanupExpired() {
    await this.prisma.room.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }

  async listRooms(userId: string) {
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
    await this.planGuard.checkRoomLimit(userId);

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
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { owner: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });
    if (!room) throw new NotFoundException('Комната не найдена');

    await this.planGuard.checkRoomMembersLimit(roomId, room.ownerId);

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

  async listMessages(userId: string, roomId: string, opts?: { before?: string; limit?: number }) {
    await this.ensureMember(userId, roomId);

    const limit = Math.min(opts?.limit ?? 50, 100);

    const messages = await this.prisma.roomMessage.findMany({
      where: {
        roomId,
        ...(opts?.before ? { id: { lt: opts.before } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        sender: { select: { id: true, email: true, name: true, avatarUrl: true } },
        replyTo: {
          select: { id: true, text: true, senderId: true, attachmentName: true },
        },
      },
    });

    messages.reverse();

    const hasMore = messages.length === limit;
    const nextCursor = hasMore ? messages[0]?.id : undefined;

    const decrypted = mapMessagesText(messages) as (RoomMessageWithSender & {
      replyTo?: { id: string; text: string; senderId: string; attachmentName: string | null } | null;
    })[];
    return {
      messages: decrypted.map((m) => ({
        id: m.id,
        text: m.text,
        senderId: m.senderId,
        systemEventType: m.systemEventType ?? undefined,
        attachmentUrl: m.attachmentUrl ?? undefined,
        attachmentName: m.attachmentName ?? undefined,
        attachmentType: m.attachmentType ?? undefined,
        createdAt: m.createdAt,
        sender: m.sender,
        replyTo: m.replyTo
          ? {
              ...m.replyTo,
              text: prepareMessageForApi(m.replyTo.text),
            }
          : undefined,
      })),
      hasMore,
      nextCursor,
    };
  }

  async sendMessage(
    userId: string,
    roomId: string,
    text: string,
    attachment?: { url?: string; name?: string; type?: string } | null,
    replyToId?: string,
  ) {
    await this.ensureMember(userId, roomId);

    let validatedReplyToId: string | null = null;
    if (replyToId) {
      const replyTarget = await this.prisma.roomMessage.findFirst({
        where: { id: replyToId, roomId },
        select: { id: true },
      });
      if (replyTarget) validatedReplyToId = replyTarget.id;
    }

    assertAllowedAttachmentUrl(attachment?.url);

    const hasAttachment = !!attachment?.url;
    const textTrim = text?.trim() ?? '';

    const MAX_TEXT_LENGTH = 4000;
    if (textTrim.length > MAX_TEXT_LENGTH) {
      throw new BadRequestException(`Сообщение не должно превышать ${MAX_TEXT_LENGTH} символов`);
    }

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
        replyToId: validatedReplyToId,
      },
      include: {
        sender: { select: { id: true, email: true, name: true, avatarUrl: true } },
        replyTo: {
          select: { id: true, text: true, senderId: true, attachmentName: true },
        },
      },
    });
    const out = {
      id: message.id,
      text: prepareMessageForApi(message.text),
      senderId: message.senderId,
      attachmentUrl: message.attachmentUrl ?? undefined,
      attachmentName: message.attachmentName ?? undefined,
      attachmentType: message.attachmentType ?? undefined,
      createdAt: message.createdAt,
      sender: message.sender,
      replyTo: message.replyTo
        ? {
            ...message.replyTo,
            text: prepareMessageForApi(message.replyTo.text),
          }
        : undefined,
    };

    // Эмитим событие всем участникам комнаты в реальном времени
    this.chatGateway.sendToRoom(roomId, 'newRoomMessage', {
      ...out,
      roomId,
    });

    return out;
  }

  async searchMessages(
    userId: string,
    roomId: string,
    query: string,
    opts?: { limit?: number },
  ) {
    await this.ensureMember(userId, roomId);

    const { isEncryptionEnabled } = await import('../security/encryption.util.js');
    if (isEncryptionEnabled()) {
      return { encrypted: true };
    }

    const q = query.trim();
    if (!q || q.length < 2) return { results: [] };

    const limit = Math.min(opts?.limit ?? 20, 50);

    const messages = await this.prisma.roomMessage.findMany({
      where: {
        roomId,
        text: { contains: q, mode: 'insensitive' },
        systemEventType: null,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { sender: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });

    return {
      results: messages.map((m) => ({
        messageId: m.id,
        text: prepareMessageForApi(m.text),
        createdAt: m.createdAt,
        sender: m.sender,
      })),
    };
  }

  async editMessage(
    userId: string,
    roomId: string,
    messageId: string,
    newText: string,
  ) {
    await this.ensureMember(userId, roomId);

    const message = await this.prisma.roomMessage.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true, roomId: true, createdAt: true },
    });

    if (!message) throw new NotFoundException('Сообщение не найдено');
    if (message.roomId !== roomId) throw new ForbiddenException('Сообщение не в этой комнате');
    if (message.senderId !== userId) {
      throw new ForbiddenException('Можно редактировать только свои сообщения');
    }

    const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
    if (Date.now() - message.createdAt.getTime() > EDIT_WINDOW_MS) {
      throw new ForbiddenException('Сообщение можно редактировать только в течение 24 часов');
    }

    const trimmed = newText.trim();
    if (!trimmed) throw new BadRequestException('Текст не может быть пустым');
    if (trimmed.length > 4000) throw new BadRequestException('Максимум 4000 символов');

    const editedAt = new Date();
    const updated = await this.prisma.roomMessage.update({
      where: { id: messageId },
      data: { text: prepareMessageForStorage(trimmed), editedAt },
      select: { id: true, text: true, editedAt: true },
    });

    const result = {
      id: updated.id,
      text: prepareMessageForApi(updated.text),
      editedAt: updated.editedAt!,
    };

    this.chatGateway.sendToRoom(roomId, 'roomMessageEdited', {
      roomId,
      messageId: result.id,
      text: result.text,
      editedAt: result.editedAt.toISOString(),
    });

    return { ok: true, message: result };
  }

  async listMembers(userId: string, roomId: string) {
    await this.ensureMember(userId, roomId);
    const members = await this.prisma.roomMember.findMany({
      where: { roomId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });
    return members.map((m) => ({
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      joinedAt: m.joinedAt,
    }));
  }
}
