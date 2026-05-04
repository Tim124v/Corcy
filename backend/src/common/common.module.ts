import { Module, Global } from '@nestjs/common';
import { PlanGuardService } from './plan-guard.service.js';

@Global()
@Module({
  providers: [PlanGuardService],
  exports: [PlanGuardService],
})
export class CommonModule {}

