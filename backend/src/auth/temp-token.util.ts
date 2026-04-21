import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';

const TEMP_SECRET_RAW = process.env.JWT_TEMP_SECRET;
if (!TEMP_SECRET_RAW?.trim()) {
  throw new Error('[TempToken] JWT_TEMP_SECRET не задан в .env');
}
const TEMP_SECRET = TEMP_SECRET_RAW.trim();
const TEMP_EXPIRES = process.env.JWT_TEMP_EXPIRES || '5m';

export type TempTokenPayload = {
  sub: string;
  purpose: '2fa';
  iat?: number;
  exp?: number;
};

export const TempToken = {
  sign(userId: string): string {
    return jwt.sign({ sub: userId, purpose: '2fa' } satisfies TempTokenPayload, TEMP_SECRET, {
      expiresIn: TEMP_EXPIRES as StringValue,
      algorithm: 'HS256',
    });
  },

  verify(token: string): TempTokenPayload {
    const payload = jwt.verify(token, TEMP_SECRET) as TempTokenPayload;
    if (payload.purpose !== '2fa') throw new Error('Invalid token purpose');
    return payload;
  },
};
