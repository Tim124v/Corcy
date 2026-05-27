import { Injectable, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { mapMessagesText, prepareMessageForApi, prepareMessageForStorage } from '../security/message-encryption.util.js';
import { ChatGateway } from '../chat/chat.gateway.js';
import { PushService } from '../auth/push.service.js';
import { assertAllowedAttachmentUrl } from '../common/attachment-url.util.js';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
    private readonly push: PushService,
  ) {}

  async getThread(
    currentUserId: string,
    peerId: string,
    opts?: { before?: string; limit?: number },
  ) {
    if (!peerId) throw new BadRequestException('peerId is required');

    const [uid1, uid2] = currentUserId < peerId
      ? [currentUserId, peerId]
      : [peerId, currentUserId];
    const connection = await this.prisma.connection.findFirst({
      where: { userIdA: uid1, userIdB: uid2 },
      select: { id: true },
    });
    if (!connection) {
      throw new ForbiddenException('Нет доступа к переписке');
    }

    const limit = Math.min(opts?.limit ?? 50, 100);
    const where = {
      OR: [
        { senderId: currentUserId, recipientId: peerId },
        { senderId: peerId, recipientId: currentUserId },
      ],
      ...(opts?.before ? { id: { lt: opts.before } } : {}),
    };

    const rows = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        replyTo: {
          select: { id: true, text: true, senderId: true, attachmentName: true },
        },
      },
    });

    rows.reverse();

    const hasMore = rows.length === limit;
    const nextCursor = hasMore ? rows[0]?.id : undefined;

    return {
      messages: rows.map((row) => {
        const mapped = mapMessagesText([row])[0];
        return {
          ...mapped,
          replyTo: row.replyTo
            ? {
                ...row.replyTo,
                text: prepareMessageForApi(row.replyTo.text),
              }
            : null,
        };
      }),
      hasMore,
      nextCursor,
    };
  }

  async markAsRead(currentUserId: string, messageId: string): Promise<{ ok: boolean }> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, recipientId: true, senderId: true, readAt: true },
    });

    if (!message) throw new NotFoundException('Message not found');
    if (message.recipientId !== currentUserId) throw new ForbiddenException('Not your message');
    if (message.readAt) return { ok: true };

    const readAt = new Date();
    await this.prisma.message.update({
      where: { id: messageId },
      data: { readAt },
    });

    this.chatGateway.sendToUser(message.senderId, 'messageRead', {
      messageId,
      readAt: readAt.toISOString(),
    });

    return { ok: true };
  }

  async send(
    currentUserId: string,
    to: string,
    text: string,
    attachment?: { url?: string; name?: string; type?: string },
    replyToId?: string,
  ) {
    const hasText = text.trim().length > 0;
    const hasAttachment = !!attachment?.url;
    if (!hasText && !hasAttachment) throw new BadRequestException('Text or attachment required');

    const MAX_TEXT_LENGTH = 4000;
    if (text.trim().length > MAX_TEXT_LENGTH) {
      throw new BadRequestException(`Сообщение не должно превышать ${MAX_TEXT_LENGTH} символов`);
    }

    if (currentUserId === to) throw new ForbiddenException('Cannot message yourself');
    const recipient = await this.prisma.user.findUnique({ where: { id: to } });
    if (!recipient) throw new BadRequestException('Recipient not found');

    const [uid1, uid2] = currentUserId < to ? [currentUserId, to] : [to, currentUserId];
    const connection = await this.prisma.connection.findFirst({
      where: { userIdA: uid1, userIdB: uid2 },
      select: { id: true },
    });
    if (!connection) {
      throw new ForbiddenException('Вы можете писать только своим контактам');
    }

    assertAllowedAttachmentUrl(attachment?.url);

    let validatedReplyToId: string | null = null;
    if (replyToId) {
      const replyTarget = await this.prisma.message.findFirst({
        where: {
          id: replyToId,
          OR: [
            { senderId: currentUserId, recipientId: to },
            { senderId: to, recipientId: currentUserId },
          ],
        },
        select: { id: true },
      });
      if (replyTarget) validatedReplyToId = replyTarget.id;
    }

    const row = await this.prisma.message.create({
      data: {
        senderId: currentUserId,
        recipientId: to,
        text: hasText ? prepareMessageForStorage(text.trim()) : '',
        attachmentUrl: attachment?.url ?? null,
        attachmentName: attachment?.name ?? null,
        attachmentType: attachment?.type ?? null,
        replyToId: validatedReplyToId,
      },
      include: {
        replyTo: {
          select: { id: true, text: true, senderId: true, attachmentName: true },
        },
      },
    });

    const messageForClient = {
      ...row,
      text: prepareMessageForApi(row.text),
      replyTo: row.replyTo
        ? {
            ...row.replyTo,
            text: prepareMessageForApi(row.replyTo.text),
          }
        : null,
    };
    this.chatGateway.sendToUser(to, 'newDirectMessage', {
      ...messageForClient,
      text: text.trim(),
    });

    if (!this.chatGateway.isOnline(to)) {
      const senderName = await this.prisma.user.findUnique({
        where: { id: currentUserId },
        select: { name: true, email: true },
      });
      const name = senderName?.name || senderName?.email?.split('@')[0] || 'Corsy';
      const bodyText = hasText ? text.trim() : attachment?.name?.trim() || 'Corsy';

      void this.push
        .sendToUser(to, {
          title: name,
          body: bodyText.slice(0, 100),
          url: '/dashboard',
        })
        .catch(() => {});
    }

    return messageForClient;
  }

  async search(
    currentUserId: string,
    query: string,
    opts?: { limit?: number },
  ): Promise<
    | { encrypted: true }
    | {
        results: {
          messageId: string;
          peerId: string;
          peerName: string | null;
          peerEmail: string;
          text: string;
          createdAt: Date;
        }[];
      }
  > {
    const { isEncryptionEnabled } = await import('../security/encryption.util.js');
    if (isEncryptionEnabled()) {
      return { encrypted: true };
    }

    const q = query.trim();
    if (!q || q.length < 2) return { results: [] };

    const limit = Math.min(opts?.limit ?? 20, 50);

    const messages = await this.prisma.message.findMany({
      where: {
        OR: [{ senderId: currentUserId }, { recipientId: currentUserId }],
        text: {
          contains: q,
          mode: 'insensitive',
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        text: true,
        createdAt: true,
        senderId: true,
        recipientId: true,
        sender: { select: { id: true, name: true, email: true } },
        recipient: { select: { id: true, name: true, email: true } },
      },
    });

    const results = messages.map((m) => {
      const peerId = m.senderId === currentUserId ? m.recipientId : m.senderId;
      const peer = m.senderId === currentUserId ? m.recipient : m.sender;
      return {
        messageId: m.id,
        peerId,
        peerName: peer.name,
        peerEmail: peer.email,
        text: prepareMessageForApi(m.text),
        createdAt: m.createdAt,
      };
    });

    return { results };
  }

  async edit(
    currentUserId: string,
    messageId: string,
    newText: string,
  ): Promise<{ ok: boolean; message?: { id: string; text: string; editedAt: Date } }> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true, createdAt: true, recipientId: true },
    });

    if (!message) throw new NotFoundException('Сообщение не найдено');
    if (message.senderId !== currentUserId) {
      throw new ForbiddenException('Можно редактировать только свои сообщения');
    }

    const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
    if (Date.now() - message.createdAt.getTime() > EDIT_WINDOW_MS) {
      throw new ForbiddenException('Сообщение можно редактировать только в течение 24 часов');
    }

    const trimmed = newText.trim();
    if (!trimmed) throw new BadRequestException('Текст сообщения не может быть пустым');
    if (trimmed.length > 4000) {
      throw new BadRequestException('Сообщение не должно превышать 4000 символов');
    }

    const editedAt = new Date();
    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        text: prepareMessageForStorage(trimmed),
        editedAt,
      },
      select: { id: true, text: true, editedAt: true, recipientId: true },
    });

    const result = {
      id: updated.id,
      text: prepareMessageForApi(updated.text),
      editedAt: updated.editedAt!,
    };

    this.chatGateway.sendToUser(message.recipientId, 'messageEdited', {
      messageId: result.id,
      text: result.text,
      editedAt: result.editedAt.toISOString(),
    });

    return { ok: true, message: result };
  }

  async remove(currentUserId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true, recipientId: true },
    });

    if (!message) throw new NotFoundException('Сообщение не найдено');
    if (message.senderId !== currentUserId && message.recipientId !== currentUserId) {
      throw new ForbiddenException('Нет доступа к удалению сообщения');
    }

    await this.prisma.message.delete({ where: { id: messageId } });
    return { ok: true };
  }
}
