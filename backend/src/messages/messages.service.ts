import { Injectable, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async getThread(currentUserId: string, peerId: string) {
    if (!peerId) throw new BadRequestException('peerId is required');
    return this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: currentUserId, recipientId: peerId },
          { senderId: peerId, recipientId: currentUserId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
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
    return this.prisma.message.create({
      data: {
        senderId: currentUserId,
        recipientId: to,
        text: hasText ? text.trim() : '',
        attachmentUrl: attachment?.url ?? null,
        attachmentName: attachment?.name ?? null,
        attachmentType: attachment?.type ?? null,
      },
    });
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
