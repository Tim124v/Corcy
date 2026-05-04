import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { setRefreshCookie } from './cookie.util.js';
import { TempToken } from './temp-token.util.js';
import { createTransport } from 'nodemailer';
import { randomInt } from 'crypto';
import { hashPassword, verifyPassword } from '../security/password.util.js';
import { TokenRefreshService } from '../security/token-refresh.service.js';
import { AuditLogService } from '../security/audit-log.service.js';
import { checkRateLimit, clearRateLimit, incrementRateLimit } from './rate-limit.util.js';
import {
  verificationEmailHtml,
  verificationEmailText,
  welcomeEmailHtml,
  welcomeEmailText,
} from './email-templates.js';

const VERIFICATION_CODE_EXPIRY_MINUTES = 10;

function generateSixDigitCode(): string {
  return String(randomInt(100000, 1000000));
}

function sendMail(opts: { to: string; subject: string; text: string; html?: string }): Promise<void> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || smtpUser;
  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(`[DEV] Email to ${opts.to}: ${opts.subject}\n${opts.text}`);
    }
    return Promise.resolve();
  }
  const transporter = createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });
  return transporter
    .sendMail({
      from: smtpFrom,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      ...(opts.html ? { html: opts.html } : {}),
    })
    .then(() => {})
    .catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.warn('Failed to send email:', (err as Error).message);
    });
}

function sendVerificationEmail(to: string, code: string): Promise<void> {
  return sendMail({
    to,
    subject: 'Connexy — подтверждение email',
    text: verificationEmailText(code),
    html: verificationEmailHtml(code),
  });
}

export type AuthClientMeta = { ipAddress?: string; userAgent?: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenRefreshService,
    private readonly audit: AuditLogService,
  ) {}

  async register(
    email: string,
    password: string,
    inviteToken: string,
    opts?: { name?: string },
  ) {
    const emailNorm = email.toLowerCase().trim();

    // ─── Проверка инвайта ──────────────────────────────────────────────────
    // Специальный bootstrap токен для первого пользователя
    const adminSecret = process.env.ADMIN_SETUP_SECRET;
    const bootstrapToken = process.env.BOOTSTRAP_INVITE_TOKEN;
    const isAdmin = !!(adminSecret && adminSecret.length > 0 && inviteToken === adminSecret);
    const isBootstrap = !!(bootstrapToken && bootstrapToken.length > 0 && inviteToken === bootstrapToken);
    const skipInviteCheck = isAdmin || isBootstrap;

    let invite: {
      id: string;
      fromUserId: string;
      expiresAt: Date;
      usedCount: number;
      maxUses: number | null;
      isActive: boolean;
    } | null = null;

    if (!skipInviteCheck) {
      const { InviteTokenUtil } = await import('../invites/invite-security.util.js');
      const tokenHash = InviteTokenUtil.hash(inviteToken);

      invite = await this.prisma.invite.findFirst({
        where: {
          AND: [{ OR: [{ tokenHash }, { token: inviteToken }] }, { isActive: true }],
        },
        select: {
          id: true,
          fromUserId: true,
          expiresAt: true,
          usedCount: true,
          maxUses: true,
          isActive: true,
        },
      });

      if (!invite) {
        await this.audit.log({
          action: 'REGISTER_INVALID_INVITE',
          ipAddress: undefined,
          severity: 'MEDIUM',
          metadata: { email: emailNorm },
        });
        return { ok: false, error: 'Приглашение недействительно или не существует' };
      }

      if (invite.expiresAt < new Date()) {
        return { ok: false, error: 'Срок действия приглашения истёк' };
      }

      const maxU = invite.maxUses ?? 1;
      if (invite.usedCount >= maxU) {
        return { ok: false, error: 'Приглашение уже использовано' };
      }
    }

    // ─── Проверка email ────────────────────────────────────────────────────
    const existingByEmail = await this.prisma.user.findUnique({
      where: { email: emailNorm },
    });
    if (existingByEmail) {
      return { ok: false, error: 'Email already registered' };
    }

    // ─── Создание пользователя ────────────────────────────────────────────
    const passwordHash = await hashPassword(password);
    const user = await this.prisma.user.create({
      data: {
        email: emailNorm,
        name: opts?.name?.trim() || null,
        passwordHash,
        isVerified: false,
        isAdmin: isAdmin || false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
      },
    });

    // ─── Помечаем инвайт использованным ──────────────────────────────────
    if (invite) {
      const maxU = invite.maxUses ?? 1;
      await this.prisma.invite.update({
        where: { id: invite.id },
        data: {
          usedCount: { increment: 1 },
          usedAt: new Date(),
          usedById: user.id,
          isActive: maxU > invite.usedCount + 1,
        },
      });

      const fromUserId = invite.fromUserId;
      const [uid1, uid2] = fromUserId < user.id ? [fromUserId, user.id] : [user.id, fromUserId];

      await this.prisma.connection
        .upsert({
          where: { userIdA_userIdB: { userIdA: uid1, userIdB: uid2 } },
          create: { userIdA: uid1, userIdB: uid2 },
          update: {},
        })
        .catch(() => {});

      await this.audit.log({
        userId: user.id,
        action: 'REGISTER_VIA_INVITE',
        severity: 'LOW',
        metadata: { inviteId: invite.id, fromUserId },
      });
    } else {
      await this.audit.log({
        userId: user.id,
        action: isAdmin ? 'REGISTER_ADMIN' : 'REGISTER_BOOTSTRAP',
        severity: 'MEDIUM',
      });
    }

    // ─── Email верификация ────────────────────────────────────────────────
    const code = generateSixDigitCode();
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.emailVerification.create({
      data: { userId: user.id, code, expiresAt },
    });

    void sendVerificationEmail(emailNorm, code);

    return {
      ok: true,
      needVerification: true,
      email: user.email,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  async issueFullTokens(
    userId: string,
    meta: AuthClientMeta | undefined,
    res: Response,
  ): Promise<{
    ok: true;
    user: { id: string; email: string; name: string | null; avatarUrl: string | null; isAdmin: boolean };
    accessToken: string;
  }> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, avatarUrl: true, isAdmin: true },
    });
    if (!u) throw new Error('User not found after auth');
    const pair = await this.tokens.issuePair(u.id, u.email, {
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });
    setRefreshCookie(res, pair.refreshToken);
    return {
      ok: true,
      user: { id: u.id, email: u.email, name: u.name, avatarUrl: u.avatarUrl, isAdmin: u.isAdmin },
      accessToken: pair.accessToken,
    };
  }

  async verifyEmail(email: string, code: string, meta: AuthClientMeta | undefined, res: Response) {
    const emailNorm = email.toLowerCase().trim();
    const codeSanitized = String(code).replace(/\D/g, '').slice(0, 6);
    if (codeSanitized.length !== 6) {
      return { ok: false, error: 'Invalid verification code' };
    }

    const WINDOW_MS = 10 * 60 * 1000; // 10 минут
    const MAX_ATTEMPTS = 5;
    const rlKey = `verify:${emailNorm}`;

    const rl = await checkRateLimit(this.prisma, {
      key: rlKey,
      maxAttempts: MAX_ATTEMPTS,
      windowMs: WINDOW_MS,
    });

    if (!rl.allowed) {
      return { ok: false, error: 'Too many attempts. Try again in 10 minutes.' };
    }

    const user = await this.prisma.user.findUnique({ where: { email: emailNorm } });
    if (!user) {
      // Инкрементируем даже для несуществующих email (защита от enumeration)
      await incrementRateLimit(this.prisma, { key: rlKey, windowMs: WINDOW_MS });
      return { ok: false, error: 'Invalid verification code' };
    }

    const verification = await this.prisma.emailVerification.findFirst({
      where: { userId: user.id, code: codeSanitized },
      orderBy: { createdAt: 'desc' },
    });
    if (!verification) {
      await incrementRateLimit(this.prisma, { key: rlKey, windowMs: WINDOW_MS });
      return { ok: false, error: 'Invalid verification code' };
    }
    if (verification.expiresAt < new Date()) {
      await incrementRateLimit(this.prisma, { key: rlKey, windowMs: WINDOW_MS });
      return { ok: false, error: 'Code expired' };
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      }),
      this.prisma.emailVerification.delete({ where: { id: verification.id } }),
    ]);
    await clearRateLimit(this.prisma, rlKey);

    // После успешной верификации — отправить welcome
    void sendMail({
      to: user.email,
      subject: 'Добро пожаловать в Connexy!',
      text: welcomeEmailText(user.name || user.email.split('@')[0]),
      html: welcomeEmailHtml(user.name || user.email.split('@')[0]),
    }).catch(() => {}); // fire-and-forget, не блокируем ответ

    const out = await this.issueFullTokens(user.id, meta, res);
    await this.audit.log({
      userId: user.id,
      action: 'EMAIL_VERIFIED',
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      severity: 'LOW',
    });
    return out;
  }

  async resendVerification(email: string) {
    const emailNorm = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email: emailNorm } });

    if (!user) return { ok: true };
    if (user.isVerified) return { ok: true };

    const code = generateSixDigitCode();
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.$transaction([
      this.prisma.emailVerification.deleteMany({ where: { userId: user.id } }),
      this.prisma.emailVerification.create({ data: { userId: user.id, code, expiresAt } }),
    ]);

    void sendVerificationEmail(emailNorm, code);
    return { ok: true };
  }

  async login(email: string, password: string, meta: AuthClientMeta | undefined, res: Response) {
    const emailNorm = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email: emailNorm },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        passwordHash: true,
        isVerified: true,
        totpEnabled: true,
      },
    });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      await this.audit
        .log({
          action: 'LOGIN_FAILED',
          severity: 'MEDIUM',
          metadata: { email: emailNorm },
        })
        .catch(() => {});
      return { ok: false, error: 'Invalid email or password' };
    }
    if (!user.isVerified)
      return { ok: false, error: 'Please verify your email first. Check the code we sent you.' };

    if (user.totpEnabled) {
      const tempToken = TempToken.sign(user.id);
      await this.audit.log({
        userId: user.id,
        action: 'LOGIN_2FA_REQUIRED',
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
        severity: 'LOW',
      });
      return { ok: true, requiresTwoFactor: true, tempToken };
    }

    const out = await this.issueFullTokens(user.id, meta, res);
    await this.audit.log({
      userId: user.id,
      action: 'USER_LOGIN',
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      severity: 'LOW',
    });
    return out;
  }
}
