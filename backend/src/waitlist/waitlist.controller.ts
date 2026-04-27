import {
  Controller, Post, Get, Param, Body, Req,
  UseGuards, Query, HttpCode,
} from '@nestjs/common';
import { Request } from 'express';
import { WaitlistService } from './waitlist.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ReqUser } from '../auth/req-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { z } from 'zod';

const JoinSchema = z.object({
  email: z.string().email('Invalid email').max(255).toLowerCase().trim(),
  name: z.string().max(50).optional(),
  reason: z.string().max(500).optional(),
});

@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

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
  @UseGuards(JwtAuthGuard)
  async getList(@Query('status') status?: string) {
    return this.waitlist.getList(status);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats() {
    return this.waitlist.getStats();
  }

  @Post(':id/invite')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async sendInvite(
    @Param('id') id: string,
    @ReqUser() user: { id: string },
  ) {
    return this.waitlist.sendInvite(id, user.id);
  }
}

