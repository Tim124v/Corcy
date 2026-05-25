import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ReqUser } from '../auth/req-user.decorator.js';
import { ChangePasswordSchema, ChangePasswordDto } from '../auth/auth.schemas.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { UsersService } from './users.service.js';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadService } from '../messages/upload.service.js';
import { PushService } from '../auth/push.service.js';
import { PlanGuardService } from '../common/plan-guard.service.js';

const AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly uploadService: UploadService,
    private readonly push: PushService,
    private readonly planGuard: PlanGuardService,
  ) {}

  @Get('me/security-log')
  async securityLog(@ReqUser() user: { id: string }) {
    return this.users.getSecurityLog(user.id);
  }

  @Get('me')
  async me(@ReqUser() user: { id: string }) {
    return this.users.getMe(user.id);
  }

  @Patch('me')
  async updateMe(@ReqUser() user: { id: string }, @Body() body: { name?: string; avatarUrl?: string | null }) {
    return this.users.updateMe(user.id, body);
  }

  @Patch('me/password')
  async updatePassword(
    @ReqUser() user: { id: string },
    @Body(new ZodValidationPipe(ChangePasswordSchema)) body: ChangePasswordDto,
  ) {
    await this.users.changePassword(user.id, body.currentPassword, body.newPassword);
    return { ok: true };
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (AVATAR_MIME_TYPES.has(file.mimetype)) return cb(null, true);
        cb(new BadRequestException(`Тип файла ${file.mimetype} не разрешён для аватара`) as unknown as Error, false);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(@ReqUser() user: { id: string }, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('file is required');

    const result = await this.uploadService.upload(file.buffer, file.originalname, file.mimetype);
    await this.users.updateMe(user.id, { avatarUrl: result.url });

    return { avatarUrl: result.url };
  }

  @Get('me/plan')
  async getMyPlan(@ReqUser() user: { id: string }) {
    return this.planGuard.getUserLimits(user.id);
  }

  @Post('me/push-subscription')
  async savePushSubscription(
    @ReqUser() user: { id: string },
    @Body()
    body: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
      userAgent?: string;
    },
  ) {
    await this.push.saveSubscription(user.id, body);
    return { ok: true };
  }

  @Delete('me/push-subscription')
  async removePushSubscription(
    @ReqUser() user: { id: string },
    @Body() body: { endpoint: string },
  ) {
    await this.push.removeSubscription(body.endpoint, user.id);
    return { ok: true };
  }

  @Get('vapid-public-key')
  getVapidPublicKey() {
    const key = process.env.VAPID_PUBLIC_KEY;
    if (!key) return { key: null };
    return { key };
  }

  @Post('me/e2e-key')
  async uploadE2EKey(@ReqUser() user: { id: string }, @Body() body: { publicKey?: string }) {
    if (!body?.publicKey || typeof body.publicKey !== 'string') {
      throw new BadRequestException('publicKey required');
    }
    const decoded = Buffer.from(body.publicKey, 'base64');
    if (decoded.length !== 32) {
      throw new BadRequestException('Неверный формат публичного ключа (ожидается 32 байта X25519)');
    }
    await this.users.updateE2EPublicKey(user.id, body.publicKey);
    return { ok: true };
  }

  @Get(':userId/e2e-key')
  async getE2EKey(@Param('userId') userId: string) {
    const key = await this.users.getE2EPublicKey(userId);
    return { publicKey: key ?? null };
  }
}
