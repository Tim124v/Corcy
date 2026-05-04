import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller.js';
import { StripeService } from './stripe.service.js';
import { UsersModule } from '../users/users.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [UsersModule, AuthModule],
  controllers: [PaymentsController],
  providers: [StripeService],
  exports: [StripeService],
})
export class PaymentsModule {}

