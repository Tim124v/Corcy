import { Injectable, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { mapMessagesText, prepareMessageForApi, prepareMessageForStorage } from '../security/message-encryption.util.js';
import { ChatGateway } from '../chat/chat.gateway.js';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
  ) {}

  async getThread(
    currentUserId: string,
    peerId: string,
    opts?: { before?: string; limit?: number },
  ) {
    if (!peerId) throw new BadRequestException('peerId is required');

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
    });

    rows.reverse();

    const hasMore = rows.length === limit;
    const nextCursor = hasMore ? rows[0]?.id : undefined;

    return {
      messages: mapMessagesText(rows),
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
  ) {
    const hasText = text.trim().length > 0;
    const hasAttachment = !!attachment?.url;
    if (!hasText && !hasAttachment) throw new BadRequestException('Text or attachment required');
    if (currentUserId === to) throw new ForbiddenException('Cannot message yourself');
    const recipient = await this.prisma.user.findUnique({ where: { id: to } });
    if (!recipient) throw new BadRequestException('Recipient not found');
    const row = await this.prisma.message.create({
      data: {
        senderId: currentUserId,
        recipientId: to,
        text: hasText ? prepareMessageForStorage(text.trim()) : '',
        attachmentUrl: attachment?.url ?? null,
        attachmentName: attachment?.name ?? null,
        attachmentType: attachment?.type ?? null,
      },
    });

    // Эмитим событие получателю в реальном времени
    const messageForClient = { ...row, text: prepareMessageForApi(row.text) };
    this.chatGateway.sendToUser(to, 'newDirectMessage', {
      ...messageForClient,
      text: text.trim(),
    });

    return messageForClient;
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
