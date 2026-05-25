import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AuditLogService } from '../security/audit-log.service.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminController],
  providers: [AuditLogService, AdminGuard],
})
export class AdminModule {}
