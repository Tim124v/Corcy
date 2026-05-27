import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { randomBytes } from 'crypto';
import { createTransport } from 'nodemailer';
import { AuditLogService } from '../security/audit-log.service.js';
import { InviteTokenUtil } from '../invites/invite-security.util.js';
import type { CreateInviteDto } from '../auth/auth.schemas.js';
import { inviteEmailHtml, inviteEmailText } from '../auth/email-templates.js';
import { PlanGuardService } from '../common/plan-guard.service.js';

const MAX_ACTIVE_INVITES = 10;

@Injectable()
export class ConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planGuard: PlanGuardService,
    private readonly audit: AuditLogService,
  ) {}

  async listMy(userId: string, opts?: { cursor?: string; limit?: number }) {
    const take = Math.min(opts?.limit ?? 50, 100);

    const connections = await this.prisma.connection.findMany({
      where: {
        OR: [{ userIdA: userId }, { userIdB: userId }],
      },
      include: {
        userA: { select: { id: true, email: true, name: true, avatarUrl: true } },
        userB: { select: { id: true, email: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });

    const hasMore = connections.length > take;
    if (hasMore) connections.pop();

    const nextCursor = hasMore ? connections[connections.length - 1]?.id : undefined;

    const items = connections.map((c: (typeof connections)[number]) => ({
      id: c.id,
      user: c.userIdA === userId ? c.userB : c.userA,
    }));

    return { items, hasMore, nextCursor: nextCursor ?? null };
  }

  async removeConnection(userId: string, connectionId: string) {
    const connection = await this.prisma.connection.findUnique({
      where: { id: connectionId },
      select: { id: true, userIdA: true, userIdB: true },
    });
    if (!connection) throw new NotFoundException('Контакт не найден');
    if (connection.userIdA !== userId && connection.userIdB !== userId) {
      throw new ForbiddenException('Нет доступа');
    }
    const uid1 = connection.userIdA;
    const uid2 = connection.userIdB;
    await this.prisma.$transaction([
      this.prisma.connection.delete({ where: { id: connectionId } }),
      this.prisma.connectionRequest.deleteMany({
        where: {
          OR: [
            { fromUserId: uid1, toUserId: uid2 },
            { fromUserId: uid2, toUserId: uid1 },
          ],
        },
      }),
    ]);
    return { ok: true };
  }

  /** Отправить заявку в контакты по ID пользователя. Контакт появится только после принятия заявки. */
  async requestByUserId(fromUserId: string, toUserId: string) {
    await this.planGuard.checkContactsLimit(fromUserId);

    const toId = String(toUserId || '').trim();
    if (!toId) throw new NotFoundException('Введите ID пользователя');
    if (toId === fromUserId) throw new ForbiddenException('Нельзя отправить заявку себе');

    const toUser = await this.prisma.user.findUnique({
      where: { id: toId },
      select: { id: true },
    });
    if (!toUser) throw new NotFoundException('Пользователь не найден');

    const [uid1, uid2] = fromUserId < toId ? [fromUserId, toId] : [toId, fromUserId];
    const existingConnection = await this.prisma.connection.findFirst({
      where: { userIdA: uid1, userIdB: uid2 },
    });
    if (existingConnection) throw new ForbiddenException('Уже в контактах');

    const existingRequest = await this.prisma.connectionRequest.findFirst({
      where: { fromUserId, toUserId: toId },
      select: { status: true },
    });
    if (existingRequest && existingRequest.status === 'pending') {
      throw new ForbiddenException('Заявка уже отправлена');
    }
    const reverseRequest = await this.prisma.connectionRequest.findFirst({
      where: { fromUserId: toId, toUserId: fromUserId },
      select: { status: true },
    });
    if (reverseRequest?.status === 'pending') throw new ForbiddenException('У этого пользователя уже есть ожидающая заявка к вам. Примите её в разделе «Запросы в контакты».');

    await this.prisma.connectionRequest.upsert({
      where: { fromUserId_toUserId: { fromUserId, toUserId: toId } },
      create: { fromUserId, toUserId: toId, status: 'pending' },
      update: { status: 'pending' },
    });
    return { ok: true as const, message: 'sent' as const };
  }

  async listIncomingRequests(userId: string) {
    const list = await this.prisma.connectionRequest.findMany({
      where: { toUserId: userId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
      include: { fromUser: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });
    return list.map((r: (typeof list)[number]) => ({
      id: r.id,
      fromUser: r.fromUser,
      createdAt: r.createdAt,
    }));
  }

  async acceptRequest(userId: string, requestId: string) {
    const req = await this.prisma.connectionRequest.findUnique({
      where: { id: requestId },
      include: { fromUser: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });
    if (!req) throw new NotFoundException('Заявка не найдена');
    if (req.toUserId !== userId) throw new ForbiddenException('Нет доступа');
    if (req.status !== 'pending') throw new ForbiddenException('Заявка уже обработана');

    // Проверяем лимиты контактов для обеих сторон перед созданием Connection
    await Promise.all([
      this.planGuard.checkContactsLimit(req.fromUserId),
      this.planGuard.checkContactsLimit(req.toUserId),
    ]);

    const [uid1, uid2] = req.fromUserId < req.toUserId ? [req.fromUserId, req.toUserId] : [req.toUserId, req.fromUserId];
    await this.prisma.$transaction([
      this.prisma.connection.upsert({
        where: { userIdA_userIdB: { userIdA: uid1, userIdB: uid2 } },
        create: { userIdA: uid1, userIdB: uid2 },
        update: {},
      }),
      this.prisma.connectionRequest.update({
        where: { id: requestId },
        data: { status: 'accepted' },
      }),
    ]);
    const conn = await this.prisma.connection.findFirst({
      where: { userIdA: uid1, userIdB: uid2 },
      select: { id: true },
    });
    return { ok: true as const, connection: { id: conn!.id, user: req.fromUser } };
  }

  async rejectRequest(userId: string, requestId: string) {
    const req = await this.prisma.connectionRequest.findUnique({
      where: { id: requestId },
      select: { toUserId: true, status: true },
    });
    if (!req) throw new NotFoundException('Заявка не найдена');
    if (req.toUserId !== userId) throw new ForbiddenException('Нет доступа');
    if (req.status !== 'pending') throw new ForbiddenException('Заявка уже обработана');

    await this.prisma.connectionRequest.update({
      where: { id: requestId },
      data: { status: 'rejected' },
    });
    return { ok: true as const };
  }

  private async assertUnderActiveInviteLimit(userId: string): Promise<void> {
    const activeCount = await this.prisma.invite.count({
      where: {
        fromUserId: userId,
        isActive: true,
        expiresAt: { gt: new Date() },
        usedAt: null,
      },
    });
    if (activeCount >= MAX_ACTIVE_INVITES) {
      throw new BadRequestException(
        `Максимум ${MAX_ACTIVE_INVITES} активных приглашений. Отзовите старые перед созданием новых.`,
      );
    }
  }

  private defaultInviteExpiresHours(opts?: CreateInviteDto): number {
    return opts?.expiresHours ?? (Number(process.env.INVITE_TOKEN_EXPIRES_HOURS) || 30 * 24);
  }

  private async createInviteRecord(
    fromUserId: string,
    opts?: CreateInviteDto & { toEmail?: string | null },
  ): Promise<{ inviteId: string; rawToken: string }> {
    const rawToken = InviteTokenUtil.generate();
    const tokenHash = InviteTokenUtil.hash(rawToken);
    const placeholderToken = randomBytes(32).toString('hex');
    const hours = this.defaultInviteExpiresHours(opts);
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    const invite = await this.prisma.invite.create({
      data: {
        fromUserId,
        token: placeholderToken,
        tokenHash,
        expiresAt,
        toEmail: opts?.toEmail ?? null,
        maxUses: opts?.maxUses ?? null,
        usedCount: 0,
        isActive: true,
      },
      select: { id: true },
    });

    return { inviteId: invite.id, rawToken };
  }

  /** Создать приглашение по ссылке (без email). Кто перейдёт по ссылке — зарегистрируется/войдёт и попадёт в контакты. */
  async createInviteLink(userId: string, opts?: CreateInviteDto) {
    const me = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!me) throw new ForbiddenException();

    await this.planGuard.checkInviteLimit(userId);

    await this.assertUnderActiveInviteLimit(userId);

    const { inviteId, rawToken } = await this.createInviteRecord(userId, { ...opts, toEmail: null });

    await this.audit.log({
      userId,
      action: 'INVITE_CREATED',
      severity: 'LOW',
      metadata: { inviteId },
    });

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const link = `${baseUrl}/invite/${rawToken}`;
    return { ok: true as const, link, token: rawToken };
  }

  async invite(userId: string, toNorm: string, opts?: CreateInviteDto) {
    const me = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!me) throw new ForbiddenException();
    if (me.email === toNorm) return { ok: false, error: 'Нельзя пригласить самого себя' };
    const existing = await this.prisma.user.findUnique({ where: { email: toNorm } });
    if (existing) {
      const already = await this.prisma.connection.findFirst({
        where: {
          OR: [
            { userIdA: userId, userIdB: existing.id },
            { userIdA: existing.id, userIdB: userId },
          ],
        },
      });
      if (already) return { ok: false, error: 'Уже в контактах' };
    }

    await this.planGuard.checkInviteLimit(userId);

    await this.assertUnderActiveInviteLimit(userId);

    const { inviteId, rawToken } = await this.createInviteRecord(userId, { ...opts, toEmail: toNorm });

    await this.audit.log({
      userId,
      action: 'INVITE_CREATED',
      severity: 'LOW',
      metadata: { inviteId },
    });

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const link = `${baseUrl}/invite/${rawToken}`;

    const result = { ok: true as const, link, token: rawToken };

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || smtpUser;

    if (smtpHost && smtpPort && smtpUser && smtpPass && smtpFrom) {
      try {
        const transporter = createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
        });

        // Отправку письма делаем в фоне, чтобы не блокировать ответ API
        void transporter
          .sendMail({
            from: smtpFrom,
            to: toNorm,
            subject: 'Вас приглашают в Corsy',
            text: inviteEmailText(link, me.name || me.email),
            html: inviteEmailHtml(link, me.name || me.email),
          })
          .catch((err: unknown) => {
            // eslint-disable-next-line no-console
            console.warn('Не удалось отправить email приглашение:', (err as Error).message);
          });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Не удалось подготовить email приглашение:', (err as Error).message);
      }
    }

    return result;
  }

  async listInvites(userId: string) {
    const invites = await this.prisma.invite.findMany({
      where: { fromUserId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        toEmail: true,
        createdAt: true,
        expiresAt: true,
        usedAt: true,
        usedById: true,
        isActive: true,
        usedCount: true,
        maxUses: true,
      },
    });
    return invites.map((inv: (typeof invites)[number]) => {
      const legacyLink: string | null = null;
      let status: 'active' | 'used' | 'expired' | 'revoked';
      if (!inv.isActive && !inv.usedAt) status = 'revoked';
      else if (inv.usedAt) status = 'used';
      else if (inv.expiresAt < new Date()) status = 'expired';
      else status = 'active';
      return {
        id: inv.id,
        toEmail: inv.toEmail ?? null,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt,
        usedAt: inv.usedAt,
        usedById: inv.usedById,
        status,
        link: legacyLink,
      };
    });
  }

  async clearInvitesHistory(userId: string) {
    const result = await this.prisma.invite.deleteMany({ where: { fromUserId: userId } });
    await this.audit.log({
      userId,
      action: 'INVITES_HISTORY_CLEARED',
      severity: 'LOW',
      metadata: { deletedCount: result.count },
    });
    return { ok: true as const, deleted: result.count };
  }

  async revokeInvite(userId: string, inviteId: string) {
    const invite = await this.prisma.invite.findFirst({
      where: { id: inviteId, fromUserId: userId },
      select: { id: true, usedAt: true, isActive: true },
    });
    if (!invite) throw new ForbiddenException('Нет прав для отзыва этого приглашения');
    if (invite.usedAt) throw new ForbiddenException('Инвайт уже использован');
    if (!invite.isActive) return { ok: true as const };
    await this.prisma.invite.update({
      where: { id: inviteId },
      data: { isActive: false },
    });
    await this.audit.log({
      userId,
      action: 'INVITE_REVOKED',
      severity: 'LOW',
      metadata: { inviteId },
    });
    return { ok: true as const };
  }

  async getInviteInfo(rawToken: string) {
    const h = InviteTokenUtil.hash(rawToken);

    const invite = await this.prisma.invite.findFirst({
      where: {
        AND: [{ tokenHash: h }, { isActive: true }],
      },
      include: {
        fromUser: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            createdAt: true,
          },
        },
      },
    });

    if (!invite) {
      throw new NotFoundException('Приглашение не найдено или уже недействительно');
    }

    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('Срок действия приглашения истёк');
    }

    const maxU = invite.maxUses ?? 1;
    if (invite.usedCount >= maxU) {
      throw new BadRequestException('Приглашение уже использовано');
    }

    return {
      ok: true,
      invite: {
        id: invite.id,
        expiresAt: invite.expiresAt,
        fromUser: {
          name: invite.fromUser.name,
          email: invite.fromUser.email,
          avatarUrl: invite.fromUser.avatarUrl,
          memberSince: invite.fromUser.createdAt,
        },
      },
    };
  }

  async acceptInvite(rawToken: string, userId: string) {
    const h = InviteTokenUtil.hash(rawToken);
    const invite = await this.prisma.invite.findFirst({
      where: {
        AND: [{ tokenHash: h }, { isActive: true }],
      },
      include: { fromUser: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });

    if (!invite) {
      await this.audit.log({
        userId,
        action: 'INVITE_INVALID_TOKEN',
        severity: 'MEDIUM',
      });
      throw new NotFoundException('Приглашение не найдено');
    }

    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('Приглашение недействительно или истекло');
    }

    const maxU = invite.maxUses ?? 1;
    if (invite.usedCount >= maxU) {
      throw new BadRequestException('Лимит использований исчерпан');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException();
    if (invite.fromUserId === userId) {
      throw new BadRequestException('Нельзя использовать собственное приглашение');
    }

    const nextUsed = invite.usedCount + 1;

    const idA = invite.fromUserId;
    const idB = userId;
    const [uid1, uid2] = idA < idB ? [idA, idB] : [idB, idA];

    // Не создавать связь если пригласивший — admin
    const inviter = await this.prisma.user.findUnique({
      where: { id: invite.fromUserId },
      select: { isAdmin: true },
    });

    if (!inviter?.isAdmin) {
      await this.prisma.$transaction([
        this.prisma.invite.update({
          where: { id: invite.id },
          data: {
            usedCount: { increment: 1 },
            usedAt: invite.usedAt ?? new Date(),
            usedById: userId,
            isActive: nextUsed < maxU,
          },
        }),
        this.prisma.connection.upsert({
          where: { userIdA_userIdB: { userIdA: uid1, userIdB: uid2 } },
          create: { userIdA: uid1, userIdB: uid2 },
          update: {},
        }),
      ]);
    } else {
      await this.prisma.invite.update({
        where: { id: invite.id },
        data: {
          usedCount: { increment: 1 },
          usedAt: invite.usedAt ?? new Date(),
          usedById: userId,
          isActive: nextUsed < maxU,
        },
      });
    }

    await this.audit.log({
      userId,
      action: 'INVITE_USED',
      severity: 'LOW',
      metadata: { inviteId: invite.id },
    });

    return {
      ok: true,
      contact: {
        id: invite.fromUser.id,
        email: invite.fromUser.email,
        name: invite.fromUser.name,
        avatarUrl: invite.fromUser.avatarUrl,
      },
    };
  }
}
