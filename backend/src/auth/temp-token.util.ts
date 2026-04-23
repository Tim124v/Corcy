import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';

function getTempSecret(): string {
  const raw = process.env.JWT_TEMP_SECRET;
  if (!raw?.trim()) {
    // Важно: не кидаем ошибку на этапе импорта модуля (ESM может импортировать раньше dotenv),
    // а только в момент реального использования.
    throw new Error('[TempToken] JWT_TEMP_SECRET не задан');
  }
  return raw.trim();
}

function getTempExpires(): string {
  return process.env.JWT_TEMP_EXPIRES || '5m';
}

export type TempTokenPayload = {
  sub: string;
  purpose: '2fa';
  iat?: number;
  exp?: number;
};

export const TempToken = {
  sign(userId: string): string {
    const secret = getTempSecret();
    const expires = getTempExpires();
    return jwt.sign({ sub: userId, purpose: '2fa' } satisfies TempTokenPayload, secret, {
      expiresIn: expires as StringValue,
      algorithm: 'HS256',
    });
  },

  verify(token: string): TempTokenPayload {
    const secret = getTempSecret();
    const payload = jwt.verify(token, secret) as TempTokenPayload;
    if (payload.purpose !== '2fa') throw new Error('Invalid token purpose');
    return payload;
  },
};
