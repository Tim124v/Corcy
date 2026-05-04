import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getLimits, isUnlimited } from './plan-limits.js';

@Injectable()
export class PlanGuardService {
  constructor(private readonly prisma: PrismaService) {}

  private async getUserPlan(userId: string): Promise<{ plan: string; planExpiresAt: Date | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, planExpiresAt: true },
    });

    if (!user) return { plan: 'FREE', planExpiresAt: null };

    if (user.plan !== 'FREE' && user.planExpiresAt && user.planExpiresAt <= new Date()) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { plan: 'FREE', planExpiresAt: null },
      });
      return { plan: 'FREE', planExpiresAt: null };
    }

    return { plan: user.plan, planExpiresAt: user.planExpiresAt ?? null };
  }

  async checkInviteLimit(userId: string): Promise<void> {
    const { plan } = await this.getUserPlan(userId);
    const limits = getLimits(plan);

    if (isUnlimited(limits.maxInvitesPerMonth)) return;

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const count = await this.prisma.invite.count({
      where: {
        fromUserId: userId,
        createdAt: { gte: since },
      },
    });

    if (count >= limits.maxInvitesPerMonth) {
      throw new ForbiddenException(
        `Достигнут лимит приглашений для плана ${plan}: ${limits.maxInvitesPerMonth} в месяц. ` +
          `Перейдите на Pro для безлимитных приглашений.`,
      );
    }
  }

  async checkRoomLimit(userId: string): Promise<void> {
    const { plan } = await this.getUserPlan(userId);
    const limits = getLimits(plan);

    if (isUnlimited(limits.maxRooms)) return;

    const count = await this.prisma.room.count({
      where: { ownerId: userId },
    });

    if (count >= limits.maxRooms) {
      const nextPlan = plan === 'FREE' ? 'Pro' : 'Team';
      throw new ForbiddenException(
        `Достигнут лимит комнат для плана ${plan}: ${limits.maxRooms}. ` +
          `Перейдите на ${nextPlan} для создания большего количества комнат.`,
      );
    }
  }

  async checkRoomMembersLimit(roomId: string, ownerId: string): Promise<void> {
    const { plan } = await this.getUserPlan(ownerId);
    const limits = getLimits(plan);

    const count = await this.prisma.roomMember.count({
      where: { roomId },
    });

    if (count >= limits.maxRoomMembers) {
      throw new ForbiddenException(
        `Достигнут лимит участников комнаты для плана ${plan}: ${limits.maxRoomMembers}. ` +
          `Перейдите на более высокий план для увеличения лимита.`,
      );
    }
  }

  async checkContactsLimit(userId: string): Promise<void> {
    const { plan } = await this.getUserPlan(userId);
    const limits = getLimits(plan);

    if (isUnlimited(limits.maxContacts)) return;

    const count = await this.prisma.connection.count({
      where: {
        OR: [{ userIdA: userId }, { userIdB: userId }],
      },
    });

    if (count >= limits.maxContacts) {
      throw new ForbiddenException(
        `Достигнут лимит контактов для плана ${plan}: ${limits.maxContacts}. ` +
          `Перейдите на Pro для безлимитных контактов.`,
      );
    }
  }

  async getUserLimits(userId: string) {
    const { plan, planExpiresAt } = await this.getUserPlan(userId);
    const limits = getLimits(plan);

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [invitesUsed, roomsOwned, contactsCount] = await Promise.all([
      this.prisma.invite.count({
        where: { fromUserId: userId, createdAt: { gte: since } },
      }),
      this.prisma.room.count({
        where: { ownerId: userId },
      }),
      this.prisma.connection.count({
        where: { OR: [{ userIdA: userId }, { userIdB: userId }] },
      }),
    ]);

    return {
      plan,
      planExpiresAt,
      limits,
      usage: {
        invitesThisMonth: invitesUsed,
        rooms: roomsOwned,
        contacts: contactsCount,
      },
    };
  }
}

