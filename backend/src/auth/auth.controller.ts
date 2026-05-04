import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  HttpCode,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { createHash } from 'crypto';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { ReqUser } from './req-user.decorator.js';
import { TokenRefreshService } from '../security/token-refresh.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditLogService } from '../security/audit-log.service.js';
import { TwoFactorService } from '../security/two-factor.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  RegisterSchema,
  RegisterDto,
  LoginSchema,
  LoginDto,
  TwoFactorChallengeSchema,
  TwoFactorChallengeDto,
  TwoFactorActivateSchema,
  TwoFactorActivateDto,
  VerifyEmailSchema,
  VerifyEmailDto,
  ResendVerificationSchema,
  ResendVerificationDto,
} from './auth.schemas.js';
import { clearRefreshCookie, REFRESH_COOKIE_NAME, setRefreshCookie } from './cookie.util.js';
import { TempToken, type TempTokenPayload } from './temp-token.util.js';

function clientMeta(req: Request): { ipAddress?: string; userAgent?: string } {
  const ip = req.ip || req.socket?.remoteAddress || undefined;
  const ua = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined;
  return { ipAddress: ip, userAgent: ua };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenRefreshService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  @Post('register')
  async register(@Body(new ZodValidationPipe(RegisterSchema)) body: RegisterDto) {
    return this.auth.register(body.email, body.password, body.inviteToken, { name: body.name });
  }

  // GET /auth/check-invite?token=XXX
  // Публичный — проверяет что инвайт существует и валиден
  // Используется страницей регистрации для предзаполнения
  @Get('check-invite')
  async checkInvite(@Query('token') token: string) {
    if (!token) {
      return { ok: false, error: 'Token required' };
    }

    const bootstrapToken = process.env.BOOTSTRAP_INVITE_TOKEN;
    if (bootstrapToken && bootstrapToken.length > 0 && token === bootstrapToken) {
      return { ok: true, isBootstrap: true };
    }

    const { InviteTokenUtil } = await import('../invites/invite-security.util.js');
    const tokenHash = InviteTokenUtil.hash(token);

    const invite = await this.prisma.invite.findFirst({
      where: {
        AND: [{ OR: [{ tokenHash }, { token }] }, { isActive: true }],
      },
      include: {
        fromUser: {
          select: { name: true, email: true, avatarUrl: true },
        },
      },
    });

    if (!invite || invite.expiresAt < new Date()) {
      return { ok: false, error: 'Приглашение недействительно или истекло' };
    }

    const maxU = invite.maxUses ?? 1;
    if (invite.usedCount >= maxU) {
      return { ok: false, error: 'Приглашение уже использовано' };
    }

    return {
      ok: true,
      fromUser: {
        name: invite.fromUser.name,
        email: invite.fromUser.email,
        avatarUrl: invite.fromUser.avatarUrl,
      },
    };
  }

  @Post('verify-email')
  async verifyEmail(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body(new ZodValidationPipe(VerifyEmailSchema)) body: VerifyEmailDto,
  ) {
    return this.auth.verifyEmail(body.email, body.code, clientMeta(req), res);
  }

  @Post('resend-verification')
  async resendVerification(@Body(new ZodValidationPipe(ResendVerificationSchema)) body: ResendVerificationDto) {
    return this.auth.resendVerification(body.email);
  }

  @Post('login')
  async login(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body(new ZodValidationPipe(LoginSchema)) body: LoginDto,
  ) {
    return this.auth.login(body.email, body.password, clientMeta(req), res);
  }

  @Post('2fa/challenge')
  @HttpCode(200)
  async twoFactorChallenge(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body(new ZodValidationPipe(TwoFactorChallengeSchema)) body: TwoFactorChallengeDto,
  ) {
    let payload: TempTokenPayload;
    try {
      payload = TempToken.verify(body.tempToken);
    } catch {
      throw new UnauthorizedException('Временный токен недействителен или истёк');
    }
    const valid = await this.twoFactor.verifyTotp(payload.sub, body.totpCode);
    if (!valid) {
      await this.audit.log({
        userId: payload.sub,
        action: '2FA_CHALLENGE_FAILED',
        ...clientMeta(req),
        severity: 'HIGH',
      });
      throw new UnauthorizedException('Неверный код двухфакторной аутентификации');
    }
    await this.audit.log({
      userId: payload.sub,
      action: 'LOGIN_2FA_SUCCESS',
      ...clientMeta(req),
      severity: 'LOW',
    });
    return this.auth.issueFullTokens(payload.sub, clientMeta(req), res);
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: { refreshToken?: string },
  ) {
    const fromCookie = req.cookies?.[REFRESH_COOKIE_NAME];
    const fromBody = body?.refreshToken;
    const raw =
      typeof fromCookie === 'string' && fromCookie.length > 0
        ? fromCookie
        : typeof fromBody === 'string' && fromBody.length > 0
          ? fromBody
          : undefined;
    if (!raw) return { ok: false, error: 'Refresh token is required' };
    try {
      // Чтобы вернуть user при refresh, достаём userId по текущему refresh токену
      // (перед ротацией, т.к. rotate удаляет старый токен).
      const tokenHash = createHash('sha256').update(raw).digest('hex');
      const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
      const user = stored
        ? await this.prisma.user.findUnique({
            where: { id: stored.userId },
            select: { id: true, email: true, name: true, avatarUrl: true, isAdmin: true },
          })
        : null;

      const pair = await this.tokens.rotate(raw, clientMeta(req));
      setRefreshCookie(res, pair.refreshToken);
      if (!user) return { ok: false, error: 'User not found' };
      return { ok: true, accessToken: pair.accessToken, user };
    } catch {
      return { ok: false, error: 'Invalid or expired refresh token' };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response, @ReqUser() user: { id: string }) {
    clearRefreshCookie(res);
    await this.tokens.revokeAllForUser(user.id);
    await this.audit.log({
      userId: user.id,
      action: 'USER_LOGOUT',
      ...clientMeta(req),
      severity: 'LOW',
    });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/setup')
  async twoFaSetup(@ReqUser() user: { id: string; email: string }) {
    const gate = await this.twoFactor.canSetup(user.id);
    if (!gate.ok) return { ok: false, error: gate.error };
    const result = await this.twoFactor.generateSecret(user.id, gate.email);
    await this.audit.log({ userId: user.id, action: '2FA_SETUP_INITIATED', severity: 'MEDIUM' });
    return {
      ok: true,
      qrCode: result.qrCode,
      backupCodes: result.backupCodes,
      message: 'Сохраните резервные коды в надёжном месте.',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/activate')
  async twoFaActivate(
    @ReqUser() user: { id: string },
    @Body(new ZodValidationPipe(TwoFactorActivateSchema)) body: TwoFactorActivateDto,
  ) {
    const ok = await this.twoFactor.activateTotp(user.id, body.token);
    if (!ok) return { ok: false, error: 'Invalid TOTP code' };
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  async disableTwoFactor(@ReqUser() user: { id: string }, @Body() body: { token?: string }) {
    if (!body?.token) return { ok: false, error: 'Token required' };
    const ok = await this.twoFactor.disableTotp(user.id, body.token);
    if (!ok) return { ok: false, error: 'Неверный код' };
    return { ok: true };
  }
}
