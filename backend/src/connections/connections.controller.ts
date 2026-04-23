import { Controller, Get, Post, Body, UseGuards, Delete, Param, Query, BadRequestException } from '@nestjs/common';
import { ConnectionsService } from './connections.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ReqUser } from '../auth/req-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { SkipThrottle } from '@nestjs/throttler';
import {
  CreateInviteSchema,
  CreateInviteDto,
  InviteEmailSchema,
  InviteEmailDto,
  UseInviteSchema,
  UseInviteDto,
} from '../auth/auth.schemas.js';

@Controller('connections')
export class ConnectionsController {
  constructor(private readonly connections: ConnectionsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@ReqUser() user: { id: string }) {
    return this.connections.listMy(user.id);
  }

  @Get('invites')
  @UseGuards(JwtAuthGuard)
  async listInvites(@ReqUser() user: { id: string }) {
    return this.connections.listInvites(user.id);
  }

  @Delete('invites/:id')
  @UseGuards(JwtAuthGuard)
  async revoke(@ReqUser() user: { id: string }, @Param('id') id: string) {
    return this.connections.revokeInvite(user.id, id);
  }

  @Post('invite-link')
  @UseGuards(JwtAuthGuard)
  async createInviteLink(
    @ReqUser() user: { id: string },
    @Body(new ZodValidationPipe(CreateInviteSchema)) body: CreateInviteDto,
  ) {
    return this.connections.createInviteLink(user.id, body);
  }

  @Post('invite')
  @UseGuards(JwtAuthGuard)
  async invite(
    @ReqUser() user: { id: string },
    @Body(new ZodValidationPipe(InviteEmailSchema)) body: InviteEmailDto,
  ) {
    return this.connections.invite(user.id, body.email, body);
  }

  // GET /connections/invite-info?token=XXX
  // Публичный эндпоинт — не требует авторизации
  // Возвращает информацию об инвайте для красивой страницы
  @SkipThrottle()
  @Get('invite-info')
  async getInviteInfo(@Query('token') token: string) {
    if (!token) {
      throw new BadRequestException('Token is required');
    }
    return this.connections.getInviteInfo(token);
  }

  @Post('accept')
  @UseGuards(JwtAuthGuard)
  async accept(
    @ReqUser() user: { id: string },
    @Body(new ZodValidationPipe(UseInviteSchema)) body: UseInviteDto,
  ) {
    return this.connections.acceptInvite(body.token, user.id);
  }

  @Post('add-by-id')
  @UseGuards(JwtAuthGuard)
  async requestById(@ReqUser() user: { id: string }, @Body() body: { userId: string }) {
    return this.connections.requestByUserId(user.id, body.userId || '');
  }

  @Get('requests')
  @UseGuards(JwtAuthGuard)
  async listRequests(@ReqUser() user: { id: string }) {
    return this.connections.listIncomingRequests(user.id);
  }

  @Post('requests/:id/accept')
  @UseGuards(JwtAuthGuard)
  async acceptRequest(@ReqUser() user: { id: string }, @Param('id') id: string) {
    return this.connections.acceptRequest(user.id, id);
  }

  @Post('requests/:id/reject')
  @UseGuards(JwtAuthGuard)
  async rejectRequest(@ReqUser() user: { id: string }, @Param('id') id: string) {
    return this.connections.rejectRequest(user.id, id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async removeConnection(@ReqUser() user: { id: string }, @Param('id') id: string) {
    return this.connections.removeConnection(user.id, id);
  }
}
