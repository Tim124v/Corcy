import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe | null;
  private readonly logger = new Logger(StripeService.name);
  private readonly enabled: boolean;

  readonly PRICES = {
    PRO_MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY ?? '',
    TEAM_MONTHLY: process.env.STRIPE_PRICE_TEAM_MONTHLY ?? '',
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (secretKey) {
      // Используем типизированную версию API по умолчанию из установленного stripe пакета
      this.stripe = new Stripe(secretKey);
      this.enabled = true;
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not set — payments disabled');
      this.stripe = null;
      this.enabled = false;
    }
  }

  isEnabled(): boolean {
    return this.enabled && !!this.stripe;
  }

  private getStripe(): Stripe {
    if (!this.stripe) throw new Error('Stripe is not configured');
    return this.stripe;
  }

  async getOrCreateCustomer(userId: string, email: string): Promise<string> {
    const stripe = this.getStripe();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true, name: true },
    });

    if (user?.stripeCustomerId) return user.stripeCustomerId;

    const customer = await stripe.customers.create({
      email,
      name: user?.name ?? undefined,
      metadata: { connexyUserId: userId },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  async createCheckoutSession(
    userId: string,
    email: string,
    priceId: string,
    plan: 'PRO' | 'TEAM',
  ): Promise<{ url: string }> {
    const stripe = this.getStripe();

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const customerId = await this.getOrCreateCustomer(userId, email);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${frontendUrl}/settings?payment=success&plan=${plan}`,
      cancel_url: `${frontendUrl}/settings?payment=canceled`,
      metadata: { connexyUserId: userId, plan },
      subscription_data: {
        metadata: { connexyUserId: userId, plan },
      },
      allow_promotion_codes: true,
    });

    if (!session.url) throw new Error('Stripe session URL is null');
    return { url: session.url };
  }

  async createBillingPortalSession(userId: string): Promise<{ url: string }> {
    const stripe = this.getStripe();

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      throw new Error('No Stripe customer found');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${frontendUrl}/settings`,
    });

    return { url: session.url };
  }

  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    const stripe = this.getStripe();

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      this.logger.warn('STRIPE_WEBHOOK_SECRET not set');
      return;
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      this.logger.error('Webhook signature verification failed:', err);
      throw new Error('Invalid webhook signature');
    }

    this.logger.log(`Stripe event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const stripe = this.getStripe();

    const userId = session.metadata?.connexyUserId;
    const plan = session.metadata?.plan as 'PRO' | 'TEAM' | undefined;

    if (!userId || !plan) {
      this.logger.error('Missing metadata in checkout session');
      return;
    }

    const subscriptionId = session.subscription as string;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const periodEnd = new Date((subscription as unknown as { current_period_end: number }).current_period_end * 1000);

    await this.users.setPlan(userId, plan, periodEnd);

    await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeSubId: subscriptionId,
        stripePriceId: subscription.items.data[0]?.price.id ?? '',
        status: subscription.status,
        currentPeriodStart: new Date((subscription as unknown as { current_period_start: number }).current_period_start * 1000),
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      update: {
        stripeSubId: subscriptionId,
        status: subscription.status,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });

    this.logger.log(`Plan upgraded: userId=${userId} plan=${plan}`);
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.connexyUserId;
    if (!userId) return;

    const periodEnd = new Date((subscription as unknown as { current_period_end: number }).current_period_end * 1000);
    const plan = subscription.metadata?.plan as 'PRO' | 'TEAM' | undefined;

    if (subscription.status === 'active' && plan) {
      await this.users.setPlan(userId, plan, periodEnd);
    }

    await this.prisma.subscription.updateMany({
      where: { stripeSubId: subscription.id },
      data: {
        status: subscription.status,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.connexyUserId;
    if (!userId) return;

    await this.users.setPlan(userId, 'FREE');

    await this.prisma.subscription.updateMany({
      where: { stripeSubId: subscription.id },
      data: { status: 'canceled' },
    });

    this.logger.log(`Plan downgraded to FREE: userId=${userId}`);
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;
    const user = await this.prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true, email: true },
    });

    if (user) {
      this.logger.warn(`Payment failed for userId=${user.id} email=${user.email}`);
    }
  }
}

