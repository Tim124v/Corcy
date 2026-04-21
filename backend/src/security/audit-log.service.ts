import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export type AuditSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AuditEvent = {
  userId?: string;
  action: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  severity?: AuditSeverity;
};

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(event: AuditEvent): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: event.userId ?? null,
          action: event.action,
          ipAddress: event.ipAddress ?? null,
          userAgent: event.userAgent ?? null,
          severity: event.severity ?? 'LOW',
          metadata: event.metadata === undefined ? undefined : (event.metadata as object),
        },
      });
    } catch {
      // eslint-disable-next-line no-console
      console.warn('[AUDIT]', JSON.stringify({ t: new Date().toISOString(), ...event }));
    }
  }
}
