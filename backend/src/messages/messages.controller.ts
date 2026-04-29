import {
  Controller,
  Delete,
  Get,
  Param,
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
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ReqUser } from '../auth/req-user.decorator.js';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

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

  @Post()
  async send(
    @ReqUser() user: { id: string },
    @Body() body: { to: string; text?: string; attachment?: { url?: string; name?: string; type?: string } },
  ) {
    return this.messages.send(user.id, body.to, body.text || '', body.attachment);
  }

  @Post(':id/read')
  async markAsRead(@ReqUser() user: { id: string }, @Param('id') id: string) {
    return this.messages.markAsRead(user.id, id);
  }

  @Delete(':id')
  async remove(@ReqUser() user: { id: string }, @Param('id') id: string) {
    return this.messages.remove(user.id, id);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.has(file.mimetype)) return cb(null, true);
        return cb(new BadRequestException(`Тип файла ${file.mimetype} не разрешён`) as unknown as Error, false);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('file is required');
    return this.uploadService.upload(file.buffer, file.originalname, file.mimetype);
  }
}
