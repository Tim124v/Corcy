import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ChatGateway } from '../chat/chat.gateway.js';

const EMOJI_REGEX = /^\p{Emoji}$/u;

@Injectable()
export class ReactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
  ) {}

  async toggleReaction(
    userId: string,
    messageId: string,
    emoji: string,
  ): Promise<{ action: 'added' | 'removed'; emoji: string; messageId: string }> {
    const trimmedEmoji = emoji.trim();
    if (!trimmedEmoji || trimmedEmoji.length > 10) {
      throw new BadRequestException('Некорректный emoji');
    }
    if (!EMOJI_REGEX.test(trimmedEmoji)) {
      throw new BadRequestException('Допустимы только emoji');
    }

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true, recipientId: true },
    });
    if (!message) throw new NotFoundException('Сообщение не найдено');
    if (message.senderId !== userId && message.recipientId !== userId) {
      throw new ForbiddenException('Нет доступа к сообщению');
    }

    const existing = await this.prisma.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: { messageId, userId, emoji: trimmedEmoji },
      },
    });

    let action: 'added' | 'removed';

    if (existing) {
      await this.prisma.messageReaction.delete({ where: { id: existing.id } });
      action = 'removed';
    } else {
      const reactionCount = await this.prisma.messageReaction.count({
        where: { messageId },
      });
      if (reactionCount >= 20) {
        throw new BadRequestException('Достигнут лимит реакций на сообщение');
      }

      await this.prisma.messageReaction.create({
        data: { messageId, userId, emoji: trimmedEmoji },
      });
      action = 'added';
    }

    const peerId = message.senderId === userId ? message.recipientId : message.senderId;
    const event = {
      messageId,
      emoji: trimmedEmoji,
      userId,
      action,
    };
    this.chatGateway.sendToUser(userId, 'reactionUpdated', event);
    this.chatGateway.sendToUser(peerId, 'reactionUpdated', event);

    return { action, emoji: trimmedEmoji, messageId };
  }

  async getReactions(
    userId: string,
    messageId: string,
  ): Promise<{ emoji: string; count: number; userReacted: boolean }[]> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { senderId: true, recipientId: true },
    });
    if (!message) throw new NotFoundException('Сообщение не найдено');
    if (message.senderId !== userId && message.recipientId !== userId) {
      throw new ForbiddenException('Нет доступа');
    }

    const reactions = await this.prisma.messageReaction.findMany({
      where: { messageId },
      select: { emoji: true, userId: true },
    });

    const grouped = new Map<string, { count: number; userReacted: boolean }>();
    for (const r of reactions) {
      const existing = grouped.get(r.emoji) ?? { count: 0, userReacted: false };
      grouped.set(r.emoji, {
        count: existing.count + 1,
        userReacted: existing.userReacted || r.userId === userId,
      });
    }

    return Array.from(grouped.entries()).map(([emoji, data]) => ({
      emoji,
      count: data.count,
      userReacted: data.userReacted,
    }));
  }
}
