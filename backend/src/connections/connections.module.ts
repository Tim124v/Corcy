import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ConnectionsController } from './connections.controller.js';
import { ConnectionsService } from './connections.service.js';
import { PlanGuardService } from '../common/plan-guard.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ConnectionsController],
  providers: [ConnectionsService, PlanGuardService],
})
export class ConnectionsModule {}
