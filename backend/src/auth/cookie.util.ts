import type { Response } from 'express';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const REFRESH_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 30);

export const REFRESH_COOKIE_NAME = 'connexy_refresh';

export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: (IS_PRODUCTION ? 'none' : 'lax') as 'none' | 'lax' | 'strict',
  maxAge: REFRESH_DAYS * 24 * 60 * 60 * 1000,
  path: '/', // было '/auth', теперь '/' — кука отправляется на все запросы
};

export function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: REFRESH_COOKIE_OPTIONS.sameSite,
    path: '/',
  });
}
