import { Module } from '@nestjs/common';
import { WaitlistController } from './waitlist.controller.js';
import { WaitlistService } from './waitlist.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuditLogService } from '../security/audit-log.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { AdminGuard } from '../auth/admin.guard.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [WaitlistController],
  providers: [WaitlistService, AuditLogService, AdminGuard],
  exports: [WaitlistService],
})
export class WaitlistModule {}

