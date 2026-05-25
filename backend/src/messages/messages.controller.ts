import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Body,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { MessagesService } from './messages.service.js';
import { UploadService } from './upload.service.js';
import { ReactionsService } from './reactions.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ReqUser } from '../auth/req-user.decorator.js';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  SendMessageSchema,
  SendMessageDto,
  SearchMessagesSchema,
  SearchMessagesDto,
  EditMessageSchema,
  EditMessageDto,
} from './messages.schemas.js';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/zip',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/ogg',
]);

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(
    private readonly messages: MessagesService,
    private readonly uploadService: UploadService,
    private readonly reactions: ReactionsService,
  ) {}

  @Get()
  async getThread(
    @ReqUser() user: { id: string },
    @Query('with') peerId: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messages.getThread(user.id, peerId, {
      before,
      limit: limit ? Math.min(parseInt(limit, 10), 100) : 50,
    });
  }

  @Get('search')
  async search(
    @ReqUser() user: { id: string },
    @Query(new ZodValidationPipe(SearchMessagesSchema)) query: SearchMessagesDto,
  ) {
    return this.messages.search(user.id, query.q, { limit: query.limit });
  }

  @Post()
  async send(
    @ReqUser() user: { id: string },
    @Body(new ZodValidationPipe(SendMessageSchema)) body: SendMessageDto,
  ) {
    return this.messages.send(user.id, body.to, body.text ?? '', body.attachment, body.replyToId);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.has(file.mimetype)) return cb(null, true);
        return cb(new BadRequestException(`Тип файла ${file.mimetype} не разрешён`) as unknown as Error, false);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('file is required');
    return this.uploadService.upload(file.buffer, file.originalname, file.mimetype);
  }

  @Patch(':id')
  async edit(
    @ReqUser() user: { id: string },
    @Param('id') id: string,
    @Body(new ZodValidationPipe(EditMessageSchema)) body: EditMessageDto,
  ) {
    return this.messages.edit(user.id, id, body.text);
  }

  @Post(':id/read')
  async markAsRead(@ReqUser() user: { id: string }, @Param('id') id: string) {
    return this.messages.markAsRead(user.id, id);
  }

  @Post(':id/reactions')
  async addReaction(
    @ReqUser() user: { id: string },
    @Param('id') id: string,
    @Body() body: { emoji?: string },
  ) {
    if (!body?.emoji) throw new BadRequestException('emoji обязателен');
    return this.reactions.toggleReaction(user.id, id, body.emoji);
  }

  @Get(':id/reactions')
  async getReactions(@ReqUser() user: { id: string }, @Param('id') id: string) {
    return this.reactions.getReactions(user.id, id);
  }

  @Delete(':id')
  async remove(@ReqUser() user: { id: string }, @Param('id') id: string) {
    return this.messages.remove(user.id, id);
  }
}
