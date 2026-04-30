import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditLogService } from './audit-log.service.js';

@Injectable()
export class TokenRefreshService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditLogService,
  ) {}

  private accessExpires(): string {
    return process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '15m';
  }

  private refreshDays(): number {
    const d = Number(process.env.JWT_REFRESH_EXPIRES_DAYS);
    return Number.isFinite(d) && d > 0 ? d : 7;
  }

  async issuePair(
    userId: string,
    email: string,
    opts?: { ipAddress?: string; userAgent?: string },
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });
    const accessToken = this.jwt.sign(
      { sub: userId, email, isAdmin: user?.isAdmin ?? false },
      { expiresIn: this.accessExpires() },
    );
    const rawRefresh = randomBytes(64).toString('hex');
    const tokenHash = createHash('sha256').update(rawRefresh).digest('hex');
    const expiresAt = new Date(Date.now() + this.refreshDays() * 24 * 60 * 60 * 1000);

    // Чистим только истёкшие токены этого пользователя (не все!)
    await this.prisma.refreshToken.deleteMany({
      where: {
        userId,
        expiresAt: { lt: new Date() },
      },
    });

    // Ограничиваем: максимум 10 активных устройств на пользователя
    const activeTokens = await this.prisma.refreshToken.findMany({
      where: { userId },
      orderBy: { expiresAt: 'asc' },
      select: { tokenHash: true },
    });

    if (activeTokens.length >= 10) {
      // Удаляем самый старый токен
      await this.prisma.refreshToken.delete({
        where: { tokenHash: activeTokens[0]!.tokenHash },
      });
    }

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        ipAddress: opts?.ipAddress ?? null,
        userAgent: opts?.userAgent ?? null,
      },
    });

    return { accessToken, refreshToken: rawRefresh };
  }

  async rotate(rawRefresh: string, opts?: { ipAddress?: string; userAgent?: string }): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = createHash('sha256').update(rawRefresh).digest('hex');
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.expiresAt < new Date()) {
      if (stored) {
        await this.prisma.refreshToken.deleteMany({ where: { userId: stored.userId } });
        await this.audit.log({
          userId: stored.userId,
          action: 'REFRESH_TOKEN_REUSE_OR_INVALID',
          ipAddress: opts?.ipAddress,
          userAgent: opts?.userAgent,
          severity: 'HIGH',
        });
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
      select: { id: true, email: true },
    });
    if (!user) throw new UnauthorizedException('Invalid or expired refresh token');

    await this.prisma.refreshToken.delete({ where: { tokenHash } });
    return this.issuePair(user.id, user.email, opts);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }
}
