import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { randomBytes } from 'crypto';
import { createTransport } from 'nodemailer';

@Injectable()
export class ConnectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMy(userId: string) {
    const connections = await this.prisma.connection.findMany({
      where: { OR: [{ userIdA: userId }, { userIdB: userId }] },
      include: {
        userA: { select: { id: true, email: true, name: true, avatarUrl: true } },
        userB: { select: { id: true, email: true, name: true, avatarUrl: true } },
      },
    });
    return connections.map((c: (typeof connections)[number]) => ({
      id: c.id,
      user: c.userIdA === userId ? c.userB : c.userA,
    }));
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
    return list.map((r) => ({
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

  /** Создать приглашение по ссылке (без email). Кто перейдёт по ссылке — зарегистрируется/войдёт и попадёт в контакты. */
  async createInviteLink(userId: string) {
    const me = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!me) throw new ForbiddenException();
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.prisma.invite.create({
      data: {
        fromUserId: userId,
        token,
        expiresAt,
        toEmail: null as unknown as string, // schema: toEmail String?; cast for older Prisma client on CI/Render
      },
    });
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const link = `${baseUrl}/invite/${token}`;
    return { ok: true as const, link, token };
  }

  async invite(userId: string, toEmail: string) {
    const toNorm = toEmail.toLowerCase().trim();
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
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.prisma.invite.create({
      data: { fromUserId: userId, toEmail: toNorm, token, expiresAt },
    });
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const link = `${baseUrl}/invite/${token}`;

    // Явно возвращаем и токен, и ссылку для отображения в UI
    const result = { ok: true as const, link, token };

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
            subject: 'Приглашение в чат',
            text: `Вас пригласили в чат. Перейдите по ссылке для регистрации/входа: ${link}`,
            html: `<p>Вас пригласили в чат.</p><p><a href="${link}">Открыть приглашение</a></p>`,
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
        token: true,
        toEmail: true,
        createdAt: true,
        expiresAt: true,
        usedAt: true,
        usedById: true,
      },
    });
    return invites.map((inv: (typeof invites)[number]) => ({
      id: inv.id,
      token: inv.token,
      toEmail: inv.toEmail ?? null,
      createdAt: inv.createdAt,
      expiresAt: inv.expiresAt,
      usedAt: inv.usedAt,
      usedById: inv.usedById,
      status: inv.usedAt ? 'used' : inv.expiresAt < new Date() ? 'expired' : 'active',
      link: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite/${inv.token}`,
    }));
  }

  async revokeInvite(userId: string, inviteId: string) {
    const invite = await this.prisma.invite.findFirst({
      where: { id: inviteId, fromUserId: userId },
      select: { id: true, usedAt: true },
    });
    if (!invite) throw new ForbiddenException('Инвайт не найден');
    if (invite.usedAt) throw new ForbiddenException('Инвайт уже использован');
    await this.prisma.invite.delete({ where: { id: inviteId } });
    return { ok: true };
  }

  async acceptInvite(token: string, userId: string) {
    const invite = await this.prisma.invite.findFirst({
      where: { token, usedAt: null },
      include: { fromUser: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });
    if (!invite || invite.expiresAt < new Date()) throw new NotFoundException('Ссылка недействительна или истекла');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException();
    if (invite.fromUserId === userId) throw new ForbiddenException('Нельзя принять своё же приглашение');
    const idA = invite.fromUserId;
    const idB = userId;
    const [uid1, uid2] = idA < idB ? [idA, idB] : [idB, idA];
    await this.prisma.$transaction([
      this.prisma.invite.update({
        where: { id: invite.id },
        data: { usedAt: new Date(), usedById: userId },
      }),
      this.prisma.connection.upsert({
        where: { userIdA_userIdB: { userIdA: uid1, userIdB: uid2 } },
        create: { userIdA: uid1, userIdB: uid2 },
        update: {},
      }),
    ]);
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
