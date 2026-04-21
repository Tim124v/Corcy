import type { PrismaService } from '../prisma/prisma.service.js';

export interface RateLimitOptions {
  key: string; // уникальный ключ: "verify:email@example.com"
  maxAttempts: number; // максимум попыток
  windowMs: number; // окно в миллисекундах
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number; // сколько попыток осталось
  resetAt: Date; // когда сбрасывается счётчик
}

export async function checkRateLimit(prisma: PrismaService, options: RateLimitOptions): Promise<RateLimitResult> {
  const { key, maxAttempts, windowMs } = options;
  const now = new Date();

  const record = await prisma.rateLimit.findUnique({ where: { key } });

  // Запись не существует или окно истекло — разрешаем (инкремент будет при ошибке верификации)
  if (!record || record.resetAt < now) {
    const resetAt = new Date(now.getTime() + windowMs);
    return { allowed: true, remaining: Math.max(0, maxAttempts - 1), resetAt };
  }

  const remaining = Math.max(0, maxAttempts - record.count);
  return { allowed: record.count < maxAttempts, remaining, resetAt: record.resetAt };
}

export async function incrementRateLimit(
  prisma: PrismaService,
  options: Pick<RateLimitOptions, 'key' | 'windowMs'>,
): Promise<void> {
  const { key, windowMs } = options;
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);

  // Если записи нет — создаём. Если есть — увеличиваем.
  // Если окно истекло — сбрасываем счётчик отдельным запросом.
  await prisma.rateLimit.upsert({
    where: { key },
    create: { key, count: 1, resetAt },
    update: { count: { increment: 1 } },
  });

  await prisma.rateLimit.updateMany({
    where: { key, resetAt: { lt: now } },
    data: { count: 1, resetAt },
  });
}

export async function clearRateLimit(prisma: PrismaService, key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key } }).catch(() => {});
}

export async function cleanupExpiredRateLimits(prisma: PrismaService): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } }).catch(() => {});
}

