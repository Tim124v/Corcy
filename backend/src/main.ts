import { config as loadEnv } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Подгружаем backend/.env (при npm run dev -w backend cwd может быть корень репо)
const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, '..', '.env') });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './modules/app.module.js';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { securityHeadersMiddleware } from './security/http-security.middleware.js';
import { cleanupExpiredRateLimits } from './auth/rate-limit.util.js';
import { PrismaService } from './prisma/prisma.service.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const configService = app.get(ConfigService);

  const port = configService.get<number>('PORT', 3001);
  const isDev = configService.get<string>('NODE_ENV') !== 'production';

  // Важно: CORS должен быть зарегистрирован как можно раньше, чтобы preflight (OPTIONS)
  // получил корректные заголовки даже если последующие middleware завершают ответ.
  const corsOriginRaw = [
    configService.get<string>('CORS_ORIGIN'),
    configService.get<string>('FRONTEND_URL'),
  ]
    .filter(Boolean)
    .join(',');

  const corsOrigins = new Set(
    (corsOriginRaw || 'http://localhost:3000')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

  // В dev почти всегда нужен localhost, даже если в .env случайно стоят прод-урлы.
  if (isDev) {
    corsOrigins.add('http://localhost:3000');
    corsOrigins.add('http://127.0.0.1:3000');
  }
  app.enableCors({
    origin: (origin, cb) => {
      // origin может быть undefined (например, curl/Postman) — разрешаем
      if (!origin) return cb(null, isDev);
      return cb(null, corsOrigins.has(origin));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  app.use(json({ limit: '512kb' }));
  app.use(urlencoded({ extended: true, limit: '512kb' }));
  app.use(cookieParser());
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX_AUTH) || 10,
    message: { ok: false, error: 'Too many attempts. Try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
  });
  app.use('/auth/login', authLimiter);
  app.use('/auth/register', authLimiter);
  app.use('/auth/refresh', authLimiter);
  app.use('/auth/2fa/challenge', authLimiter);

  const generalLimiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX_GENERAL) || 400,
    message: { ok: false, error: 'Too many requests. Try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(generalLimiter);

  app.use(securityHeadersMiddleware(!isDev));

  // Health endpoint (удобно для uptime/пингов и быстрой диагностики)
  app.getHttpAdapter().get('/health', (_req: unknown, res: unknown) =>
    (res as { json: (body: unknown) => void }).json({ status: 'ok', timestamp: new Date().toISOString() }),
  );

  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Backend listening on port ${port}`);

  // Очистка устаревших rate limit записей каждые 6 часов
  const prisma = app.get(PrismaService);
  setInterval(() => {
    cleanupExpiredRateLimits(prisma).catch(() => {});
  }, 6 * 60 * 60 * 1000);
}

bootstrap();


