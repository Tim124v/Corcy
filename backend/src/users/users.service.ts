import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditLogService } from '../security/audit-log.service.js';
import { hashPassword, verifyPassword } from '../security/password.util.js';
import { Plan } from '@prisma/client';

export type MeResult = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  isVerified: boolean;
  isAdmin: boolean;
};

export type UpdateMeDto = {
  name?: string | null;
  avatarUrl?: string | null;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async getMe(userId: string): Promise<MeResult> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
        isVerified: true,
        isAdmin: true,
      },
    });
    if (!u) throw new BadRequestException('User not found');
    return u;
  }

  async updateMe(
    userId: string,
    dto: UpdateMeDto,
  ): Promise<Pick<MeResult, 'id' | 'email' | 'name' | 'avatarUrl'>> {
    if (dto.avatarUrl !== undefined && dto.avatarUrl !== null) {
      if (typeof dto.avatarUrl !== 'string') throw new BadRequestException('avatarUrl must be a string or null');
      if (dto.avatarUrl.startsWith('data:')) throw new BadRequestException('avatarUrl must be a URL, not a data URI');
      if (dto.avatarUrl.length > 2048) throw new BadRequestException('avatarUrl too long');
    }
    if (dto.name !== undefined && dto.name !== null) {
      if (dto.name.length > 50) throw new BadRequestException('name too long');
      dto.name = dto.name.trim();
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name != null ? dto.name : undefined,
        avatarUrl: dto.avatarUrl !== undefined ? dto.avatarUrl : undefined,
      },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new BadRequestException('User not found');

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Текущий пароль неверный');

    const passwordHash = await hashPassword(newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    await this.audit
      .log({
        userId,
        action: 'PASSWORD_CHANGED',
        severity: 'MEDIUM',
      })
      .catch(() => {});
  }

  async getSecurityLog(userId: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, action: true, ipAddress: true, severity: true, createdAt: true },
    });
    return { logs };
  }

  async getPlan(userId: string): Promise<{
    plan: string;
    planExpiresAt: Date | null;
    isActive: boolean;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, planExpiresAt: true },
    });
    if (!user) throw new BadRequestException('User not found');

    const isActive =
      user.plan === 'FREE' ||
      !user.planExpiresAt ||
      user.planExpiresAt > new Date();

    if (user.plan !== 'FREE' && user.planExpiresAt && user.planExpiresAt <= new Date()) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { plan: 'FREE', planExpiresAt: null },
      });
      return { plan: 'FREE', planExpiresAt: null, isActive: true };
    }

    return {
      plan: user.plan,
      planExpiresAt: user.planExpiresAt,
      isActive,
    };
  }

  async setPlan(
    userId: string,
    plan: 'FREE' | 'PRO' | 'TEAM',
    expiresAt?: Date,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        plan: plan as Plan,
        planExpiresAt: expiresAt ?? null,
      },
    });
  }

  async getPlanLimits(plan: string): Promise<{
    maxInvites: number;
    maxRooms: number;
    maxRoomMembers: number;
    unlimitedHistory: boolean;
    e2eRooms: boolean;
  }> {
    const limits = {
      FREE: {
        maxInvites: 3,
        maxRooms: 2,
        maxRoomMembers: 10,
        unlimitedHistory: false,
        e2eRooms: false,
      },
      PRO: {
        maxInvites: -1,
        maxRooms: 10,
        maxRoomMembers: 50,
        unlimitedHistory: true,
        e2eRooms: true,
      },
      TEAM: {
        maxInvites: -1,
        maxRooms: -1,
        maxRoomMembers: 200,
        unlimitedHistory: true,
        e2eRooms: true,
      },
    };
    return limits[plan as keyof typeof limits] ?? limits.FREE;
  }

  async updateE2EPublicKey(userId: string, publicKey: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { e2ePublicKey: publicKey, e2eKeyUploadedAt: new Date() },
    });
  }

  async getE2EPublicKey(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { e2ePublicKey: true },
    });
    return user?.e2ePublicKey ?? null;
  }
}

