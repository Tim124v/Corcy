import { Injectable } from '@nestjs/common';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditLogService } from './audit-log.service.js';

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async canSetup(userId: string): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, totpEnabled: true },
    });
    if (!u) return { ok: false, error: 'User not found' };
    if (u.totpEnabled) return { ok: false, error: '2FA already enabled' };
    return { ok: true, email: u.email };
  }

  async generateSecret(userId: string, userEmail: string) {
    const secret = speakeasy.generateSecret({
      issuer: process.env.TOTP_ISSUER || 'Connexy',
      name: `${process.env.TOTP_ISSUER || 'Connexy'}:${userEmail}`,
      length: 32,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { pendingTotpSecret: secret.base32 ?? null },
    });

    const qrCode = secret.otpauth_url ? await QRCode.toDataURL(secret.otpauth_url) : '';
    const backupCodes = Array.from({ length: 10 }, () => randomBytes(4).toString('hex').toUpperCase());
    const hashed = backupCodes.map((c) => createHash('sha256').update(c).digest('hex'));

    await this.prisma.user.update({
      where: { id: userId },
      data: { backupCodes: hashed },
    });

    return { secret: secret.base32, qrCode, backupCodes };
  }

  async activateTotp(userId: string, token: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.pendingTotpSecret) return false;
    const ok = speakeasy.totp.verify({
      secret: user.pendingTotpSecret,
      encoding: 'base32',
      token: String(token).replace(/\D/g, '').slice(0, 6),
      window: Number(process.env.TOTP_WINDOW) || 1,
    });
    if (!ok) return false;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret: user.pendingTotpSecret,
        pendingTotpSecret: null,
        totpEnabled: true,
        totpEnabledAt: new Date(),
      },
    });
    await this.audit.log({ userId, action: '2FA_ENABLED', severity: 'HIGH' });
    return true;
  }

  async verifyTotp(userId: string, token: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecret || !user.totpEnabled) return false;
    return speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token: String(token).replace(/\D/g, '').slice(0, 6),
      window: Number(process.env.TOTP_WINDOW) || 1,
    });
  }

  async disableTotp(userId: string, token: string): Promise<boolean> {
    const ok = await this.verifyTotp(userId, token);
    if (!ok) return false;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret: null,
        pendingTotpSecret: null,
        totpEnabled: false,
        backupCodes: [],
      },
    });
    await this.audit.log({ userId, action: '2FA_DISABLED', severity: 'HIGH' });
    return true;
  }
}
