import { BadRequestException, Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ReqUser } from '../auth/req-user.decorator.js';
import { hashPassword, verifyPassword } from '../security/password.util.js';
import { ChangePasswordSchema, ChangePasswordDto } from '../auth/auth.schemas.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me/security-log')
  async securityLog(@ReqUser() user: { id: string }) {
    const logs = await this.prisma.auditLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, action: true, ipAddress: true, severity: true, createdAt: true },
    });
    return { logs };
  }

  @Get('me')
  async me(@ReqUser() user: { id: string }) {
    const u = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true, isVerified: true, isAdmin: true },
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
    @Body(new ZodValidationPipe(ChangePasswordSchema)) body: ChangePasswordDto,
  ) {
    const { currentPassword, newPassword } = body;

    const existing = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, passwordHash: true },
    });
    if (!existing) throw new BadRequestException('Пользователь не найден');

    const isValidCurrent = await verifyPassword(currentPassword, existing.passwordHash);
    if (!isValidCurrent) {
      throw new BadRequestException('Текущий пароль неверный');
    }

    const passwordHash = await hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await this.prisma.auditLog
      .create({
        data: {
          userId: user.id,
          action: 'PASSWORD_CHANGED',
          severity: 'MEDIUM',
        },
      })
      .catch(() => {});

    return { ok: true };
  }
}
