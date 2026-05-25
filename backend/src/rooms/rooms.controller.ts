import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RoomsService } from './rooms.service.js';
import { LiveKitService } from './livekit.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ReqUser } from '../auth/req-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  CreateRoomSchema,
  CreateRoomDto,
  JoinRoomSchema,
  JoinRoomDto,
  SendRoomMessageSchema,
  SendRoomMessageDto,
  SearchRoomMessagesSchema,
  SearchRoomMessagesDto,
  EditRoomMessageSchema,
  EditRoomMessageDto,
} from './rooms.schemas.js';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly livekit: LiveKitService,
  ) {}

  @Get()
  async list(@ReqUser() user: { id: string }) {
    return this.rooms.listRooms(user.id);
  }

  @Post()
  async create(
    @ReqUser() user: { id: string },
    @Body(new ZodValidationPipe(CreateRoomSchema)) body: CreateRoomDto,
  ) {
    return this.rooms.createRoom(user.id, body.name ?? 'Комната', body.password);
  }

  @Post('join')
  async join(
    @ReqUser() user: { id: string },
    @Body(new ZodValidationPipe(JoinRoomSchema)) body: JoinRoomDto,
  ) {
    return this.rooms.joinRoom(user.id, body.roomId, body.password);
  }

  @Delete(':id')
  async remove(@ReqUser() user: { id: string }, @Param('id') id: string) {
    return this.rooms.deleteRoom(user.id, id);
  }

  @Post(':id/leave')
  async leave(@ReqUser() user: { id: string }, @Param('id') id: string) {
    return this.rooms.leaveRoom(user.id, id);
  }

  @Get(':id/members')
  async members(@ReqUser() user: { id: string }, @Param('id') id: string) {
    return this.rooms.listMembers(user.id, id);
  }

  @Get(':id/search')
  async searchMessages(
    @ReqUser() user: { id: string },
    @Param('id') id: string,
    @Query(new ZodValidationPipe(SearchRoomMessagesSchema)) query: SearchRoomMessagesDto,
  ) {
    return this.rooms.searchMessages(user.id, id, query.q, { limit: query.limit });
  }

  @Get(':id/messages')
  async messages(
    @ReqUser() user: { id: string },
    @Param('id') id: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    return this.rooms.listMessages(user.id, id, {
      before,
      limit: limit ? Math.min(parseInt(limit, 10), 100) : 50,
    });
  }

  @Post(':id/messages')
  async send(
    @ReqUser() user: { id: string },
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SendRoomMessageSchema)) body: SendRoomMessageDto,
  ) {
    return this.rooms.sendMessage(user.id, id, body.text ?? '', body.attachment, body.replyToId);
  }

  @Post(':id/call-token')
  async getCallToken(
    @ReqUser() user: { id: string; email: string },
    @Param('id') roomId: string,
  ) {
    if (!this.livekit.enabled) {
      return {
        ok: false,
        error: 'SFU не настроен',
        fallback: 'mesh',
      };
    }

    const members = await this.rooms.listMembers(user.id, roomId);
    const isMember = members.some((m) => m.userId === user.id);
    if (!isMember) {
      return { ok: false, error: 'Нет доступа к комнате' };
    }

    const me = members.find((m) => m.userId === user.id);
    const displayName = me?.name || user.email.split('@')[0] || user.id.slice(0, 8);

    const token = await this.livekit.generateToken({
      roomName: roomId,
      userId: user.id,
      displayName,
    });

    return {
      ok: true,
      token,
      wsUrl: this.livekit.wsUrl,
      displayName,
    };
  }

  @Patch(':id/messages/:messageId')
  async editMessage(
    @ReqUser() user: { id: string },
    @Param('id') roomId: string,
    @Param('messageId') messageId: string,
    @Body(new ZodValidationPipe(EditRoomMessageSchema)) body: EditRoomMessageDto,
  ) {
    return this.rooms.editMessage(user.id, roomId, messageId, body.text);
  }
}
