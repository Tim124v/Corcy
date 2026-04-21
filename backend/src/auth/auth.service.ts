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

const VERIFICATION_CODE_EXPIRY_MINUTES = 10;

function generateSixDigitCode(): string {
  return String(randomInt(100000, 1000000));
}

function sendVerificationEmail(to: string, code: string): Promise<void> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || smtpUser;
  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(`[DEV] Email verification code for ${to}: ${code}`);
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
      to,
      subject: 'Verify your account',
      text: `Your verification code is: ${code}\nThis code expires in 10 minutes.`,
      html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 10 minutes.</p>`,
    })
    .then(() => {})
    .catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.warn('Failed to send verification email:', (err as Error).message);
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
    opts?: { username?: string; name?: string },
  ) {
    const emailNorm = email.toLowerCase().trim();
    const usernameNorm = opts?.username?.trim() || null;

    const existingByEmail = await this.prisma.user.findUnique({ where: { email: emailNorm } });
    if (existingByEmail) return { ok: false, error: 'Email already registered' };

    if (usernameNorm) {
      const existingByUsername = await this.prisma.user.findFirst({
        where: { username: { equals: usernameNorm, mode: 'insensitive' } },
      });
      if (existingByUsername) return { ok: false, error: 'Username already taken' };
    }

    const passwordHash = await hashPassword(password);
    const user = await this.prisma.user.create({
      data: {
        email: emailNorm,
        username: usernameNorm,
        name: opts?.name?.trim() || null,
        passwordHash,
        isVerified: false,
      },
      select: { id: true, email: true, name: true, avatarUrl: true, username: true },
    });

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
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, username: user.username },
    };
  }

  async issueFullTokens(
    userId: string,
    meta: AuthClientMeta | undefined,
    res: Response,
  ): Promise<{
    ok: true;
    user: { id: string; email: string; name: string | null; avatarUrl: string | null };
    accessToken: string;
  }> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });
    if (!u) throw new Error('User not found after auth');
    const pair = await this.tokens.issuePair(u.id, u.email, {
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });
    setRefreshCookie(res, pair.refreshToken);
    return {
      ok: true,
      user: { id: u.id, email: u.email, name: u.name, avatarUrl: u.avatarUrl },
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
    if (!user || !(await verifyPassword(password, user.passwordHash)))
      return { ok: false, error: 'Invalid email or password' };
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
