import {
  Controller, Post, Get, Param, Body, Req,
  UseGuards, Query, HttpCode,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { WaitlistService } from './waitlist.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { ReqUser } from '../auth/req-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { z } from 'zod';

const JoinSchema = z.object({
  email: z.string().email('Invalid email').max(255).toLowerCase().trim(),
  name: z.string().max(50).optional(),
  reason: z.string().max(500).optional(),
});

@Throttle({ short: { limit: 3, ttl: 60000 } })
@Controller('waitlist')
export class WaitlistController {
  constructor(
    private readonly waitlist: WaitlistService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('join')
  @HttpCode(200)
  async join(
    @Body(new ZodValidationPipe(JoinSchema)) body: z.infer<typeof JoinSchema>,
    @Req() req: Request,
  ) {
    return this.waitlist.join({
      email: body.email,
      name: body.name,
      reason: body.reason,
      ipAddress: req.ip,
    });
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getList(@ReqUser() user: { id: string }, @Query('status') status?: string) {
    return this.waitlist.getList(user.id, status);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getStats(@ReqUser() user: { id: string }) {
    return this.waitlist.getStats(user.id);
  }

  @Post(':id/invite')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(200)
  async sendInvite(
    @Param('id') id: string,
    @ReqUser() user: { id: string },
  ) {
    return this.waitlist.sendInvite(id, user.id);
  }
}

