import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditLogService } from '../security/audit-log.service.js';
import { ReqUser } from '../auth/req-user.decorator.js';
import type { Plan, Prisma } from '@prisma/client';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  @Get('stats')
  async getStats() {
    const [
      totalUsers,
      verifiedUsers,
      activeRooms,
      totalMessages,
      totalConnections,
      planCounts,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isVerified: true } }),
      this.prisma.room.count({ where: { expiresAt: { gt: new Date() } } }),
      this.prisma.message.count(),
      this.prisma.connection.count(),
      this.prisma.user.groupBy({
        by: ['plan'],
        _count: { plan: true },
      }),
    ]);

    return {
      users: { total: totalUsers, verified: verifiedUsers },
      rooms: { active: activeRooms },
      messages: { total: totalMessages },
      connections: { total: totalConnections },
      plans: planCounts.map((p) => ({ plan: p.plan, count: p._count.plan })),
    };
  }

  @Get('users')
  async getUsers(
    @Query('q') q?: string,
    @Query('plan') plan?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const take = Math.min(parseInt(limit ?? '20', 10) || 20, 100);
    const where: Prisma.UserWhereInput = {};
    if (q?.trim()) {
      where.OR = [
        { email: { contains: q.trim(), mode: 'insensitive' } },
        { name: { contains: q.trim(), mode: 'insensitive' } },
      ];
    }
    if (plan && ['FREE', 'PRO', 'TEAM'].includes(plan)) {
      where.plan = plan as Plan;
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        isVerified: true,
        isAdmin: true,
        createdAt: true,
        _count: { select: { connectionsA: true, sentMessages: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = users.length > take;
    if (hasMore) users.pop();

    return {
      users,
      hasMore,
      nextCursor: hasMore ? (users[users.length - 1]?.id ?? null) : null,
    };
  }

  @Patch('users/:id/plan')
  async updateUserPlan(
    @Param('id') id: string,
    @Body() body: { plan?: string; planExpiresAt?: string | null },
    @ReqUser() admin: { id: string },
  ) {
    const validPlans = ['FREE', 'PRO', 'TEAM'];
    if (!body.plan || !validPlans.includes(body.plan)) {
      return { ok: false, error: 'Допустимые планы: FREE, PRO, TEAM' };
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) return { ok: false, error: 'Пользователь не найден' };

    await this.prisma.user.update({
      where: { id },
      data: {
        plan: body.plan as Plan,
        planExpiresAt: body.planExpiresAt ? new Date(body.planExpiresAt) : null,
      },
    });

    await this.audit.log({
      userId: admin.id,
      action: 'ADMIN_PLAN_CHANGED',
      severity: 'MEDIUM',
      metadata: { targetUserId: id, newPlan: body.plan },
    });

    return { ok: true };
  }

  @Get('audit-log')
  async getAuditLog(
    @Query('userId') userId?: string,
    @Query('severity') severity?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const take = Math.min(parseInt(limit ?? '50', 10) || 50, 200);
    const where: Prisma.AuditLogWhereInput = {};
    if (userId?.trim()) where.userId = userId.trim();
    if (severity && ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(severity)) {
      where.severity = severity;
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = logs.length > take;
    if (hasMore) logs.pop();

    return {
      logs,
      hasMore,
      nextCursor: hasMore ? (logs[logs.length - 1]?.id ?? null) : null,
    };
  }
}
