import { BadRequestException, Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ReqUser } from '../auth/req-user.decorator.js';
import { compare, hash } from 'bcrypt';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  async me(@ReqUser() user: { id: string }) {
    const u = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true, isVerified: true },
    });
    if (!u) throw new Error('User not found');
    return u;
  }

  @Patch('me')
  async updateMe(@ReqUser() user: { id: string }, @Body() body: { name?: string; avatarUrl?: string | null }) {
    if (body.avatarUrl !== undefined && body.avatarUrl !== null && typeof body.avatarUrl !== 'string') {
      throw new BadRequestException('avatarUrl must be a string or null');
    }
    const u = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        name: body.name != null ? body.name : undefined,
        avatarUrl: body.avatarUrl !== undefined ? body.avatarUrl : undefined,
      },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });
    return u;
  }

  @Patch('me/password')
  async updatePassword(
    @ReqUser() user: { id: string },
    @Body() body: { currentPassword?: string; newPassword?: string; confirmPassword?: string },
  ) {
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    const confirmPassword = String(body.confirmPassword || '');

    if (!currentPassword || !newPassword || !confirmPassword) {
      throw new BadRequestException('Все поля пароля обязательны');
    }
    if (newPassword.length < 8) {
      throw new BadRequestException('Новый пароль должен быть не короче 8 символов');
    }
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Пароли не совпадают');
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, passwordHash: true },
    });
    if (!existing) throw new BadRequestException('Пользователь не найден');

    const isValidCurrent = await compare(currentPassword, existing.passwordHash);
    if (!isValidCurrent) {
      throw new BadRequestException('Текущий пароль неверный');
    }

    const passwordHash = await hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return { ok: true };
  }
}
