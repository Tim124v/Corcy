import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { AuditLogService } from '../security/audit-log.service.js';
import { TokenRefreshService } from '../security/token-refresh.service.js';
import { TwoFactorService } from '../security/two-factor.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-secret-change-in-production'),
        // По умолчанию access token короткий. Refresh — отдельный механизм (httpOnly cookie).
        signOptions: { expiresIn: config.get<string>('JWT_ACCESS_EXPIRES_IN', config.get<string>('JWT_EXPIRES_IN', '15m')) },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, AuditLogService, TokenRefreshService, TwoFactorService],
  controllers: [AuthController],
  exports: [AuthService, JwtModule, AuditLogService, TokenRefreshService, TwoFactorService],
})
export class AuthModule {}
