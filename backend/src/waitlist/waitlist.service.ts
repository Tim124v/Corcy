import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditLogService } from '../security/audit-log.service.js';
import { createTransport } from 'nodemailer';

function sendWaitlistConfirmEmail(to: string, name?: string | null): Promise<void> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || smtpUser;

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    // eslint-disable-next-line no-console
    console.warn('[Waitlist] SMTP not configured, skipping email');
    return Promise.resolve();
  }

  const transporter = createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const displayName = name || 'there';

  return transporter
    .sendMail({
      from: smtpFrom,
      to,
      subject: "You're on the Connexy waitlist",
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;background:#020617;color:#f8fafc;padding:40px 32px;border-radius:16px;">
          <div style="text-align:center;margin-bottom:32px;">
            <h1 style="font-size:28px;font-weight:700;letter-spacing:0.3em;margin:0;">CONNEXY</h1>
            <p style="color:#6366f1;font-size:12px;letter-spacing:0.2em;margin-top:4px;">PRIVATE · SECURE</p>
          </div>
          <h2 style="font-size:20px;font-weight:600;margin-bottom:12px;">You're on the list, ${displayName}!</h2>
          <p style="color:#94a3b8;line-height:1.6;margin-bottom:24px;">
            Thanks for your interest in Connexy. We'll review your request and send you an invite link when your spot is ready.
          </p>
          <div style="background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.2);border-radius:12px;padding:16px;margin-bottom:24px;">
            <p style="margin:0;font-size:13px;color:#a5b4fc;">
              🔐 <strong>What is Connexy?</strong><br/>
              A private messaging space — only the people you choose.
              End-to-end encrypted. Invite only.
            </p>
          </div>
          <p style="color:#475569;font-size:12px;text-align:center;">
            Connexy · Private connections, refined
          </p>
        </div>
      `,
    })
    .then(() => {})
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[Waitlist] Failed to send confirmation email:', (err as Error).message);
    });
}

function sendInviteFromWaitlistEmail(
  to: string,
  inviteLink: string,
  name?: string | null,
): Promise<void> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || smtpUser;

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    return Promise.resolve();
  }

  const transporter = createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const displayName = name || 'there';

  return transporter
    .sendMail({
      from: smtpFrom,
      to,
      subject: 'Your Connexy invite is ready 🎉',
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;background:#020617;color:#f8fafc;padding:40px 32px;border-radius:16px;">
          <div style="text-align:center;margin-bottom:32px;">
            <h1 style="font-size:28px;font-weight:700;letter-spacing:0.3em;margin:0;">CONNEXY</h1>
          </div>
          <h2 style="font-size:20px;font-weight:600;margin-bottom:12px;">Your invite is ready, ${displayName}!</h2>
          <p style="color:#94a3b8;line-height:1.6;margin-bottom:24px;">
            Your spot on Connexy is confirmed. Click the button below to create your account.
          </p>
          <div style="text-align:center;margin-bottom:24px;">
            <a href="${inviteLink}"
              style="display:inline-block;background:linear-gradient(to right,#2563eb,#7c3aed);color:white;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:600;font-size:15px;">
              Accept Invitation →
            </a>
          </div>
          <p style="color:#475569;font-size:12px;text-align:center;">
            This link expires in 48 hours.<br/>
            Connexy · Private connections, refined
          </p>
        </div>
      `,
    })
    .then(() => {})
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[Waitlist] Failed to send invite email:', (err as Error).message);
    });
}

@Injectable()
export class WaitlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async join(data: {
    email: string;
    name?: string;
    reason?: string;
    ipAddress?: string;
  }) {
    const email = data.email.toLowerCase().trim();

    const existing = await this.prisma.waitlist.findUnique({ where: { email } });
    if (existing) {
      if (existing.status === 'invited') {
        return { ok: true, message: 'You already have an invite! Check your email.' };
      }
      return { ok: true, message: "You're already on the waitlist. We'll notify you soon!" };
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      throw new ConflictException('This email is already registered. Please sign in.');
    }

    const entry = await this.prisma.waitlist.create({
      data: {
        email,
        name: data.name?.trim() || null,
        reason: data.reason?.trim() || null,
        ipAddress: data.ipAddress || null,
      },
    });

    await this.audit.log({
      action: 'WAITLIST_JOIN',
      ipAddress: data.ipAddress,
      severity: 'LOW',
      metadata: { email },
    });

    void sendWaitlistConfirmEmail(email, data.name);

    return {
      ok: true,
      id: entry.id,
      message: "You're on the list! We'll email you when your spot is ready.",
    };
  }

  async getList(status?: string) {
    return this.prisma.waitlist.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async sendInvite(waitlistId: string, adminUserId: string) {
    const entry = await this.prisma.waitlist.findUnique({ where: { id: waitlistId } });
    if (!entry) throw new BadRequestException('Waitlist entry not found');
    if (entry.status === 'invited') throw new BadRequestException('Already invited');

    const { InviteTokenUtil } = await import('../invites/invite-security.util.js');
    const rawToken = InviteTokenUtil.generate();
    const tokenHash = InviteTokenUtil.hash(rawToken);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const invite = await this.prisma.invite.create({
      data: {
        token: rawToken,
        tokenHash,
        fromUserId: adminUserId,
        toEmail: entry.email,
        maxUses: 1,
        usedCount: 0,
        isActive: true,
        expiresAt,
      },
    });

    const appUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const inviteLink = `${appUrl}/invite/${rawToken}`;

    await this.prisma.waitlist.update({
      where: { id: waitlistId },
      data: { status: 'invited', inviteId: invite.id },
    });

    void sendInviteFromWaitlistEmail(entry.email, inviteLink, entry.name);

    await this.audit.log({
      userId: adminUserId,
      action: 'WAITLIST_INVITE_SENT',
      severity: 'LOW',
      metadata: { waitlistId, email: entry.email },
    });

    return { ok: true, message: `Invite sent to ${entry.email}` };
  }

  async getStats() {
    const [total, pending, invited] = await Promise.all([
      this.prisma.waitlist.count(),
      this.prisma.waitlist.count({ where: { status: 'pending' } }),
      this.prisma.waitlist.count({ where: { status: 'invited' } }),
    ]);
    return { total, pending, invited };
  }
}

