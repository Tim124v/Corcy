import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UseGuards,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ReqUser } from '../auth/req-user.decorator.js';
import { StripeService } from './stripe.service.js';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly stripe: StripeService) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async createCheckout(
    @ReqUser() user: { id: string; email: string },
    @Body() body: { plan: 'PRO' | 'TEAM' },
  ) {
    if (!this.stripe.isEnabled()) {
      throw new BadRequestException('Payments not configured');
    }

    if (!body.plan || !['PRO', 'TEAM'].includes(body.plan)) {
      throw new BadRequestException('Invalid plan');
    }

    const priceId =
      body.plan === 'PRO'
        ? this.stripe.PRICES.PRO_MONTHLY
        : this.stripe.PRICES.TEAM_MONTHLY;

    if (!priceId) {
      throw new BadRequestException('Price not configured for this plan');
    }

    return this.stripe.createCheckoutSession(user.id, user.email, priceId, body.plan);
  }

  @Post('billing-portal')
  @UseGuards(JwtAuthGuard)
  async billingPortal(@ReqUser() user: { id: string }) {
    if (!this.stripe.isEnabled()) {
      throw new BadRequestException('Payments not configured');
    }
    return this.stripe.createBillingPortalSession(user.id);
  }

  @Post('webhook')
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody) {
      throw new BadRequestException('Raw body required');
    }
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }
    await this.stripe.handleWebhook(req.rawBody, signature);
    return { received: true };
  }
}

