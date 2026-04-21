import type { Response } from 'express';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export const REFRESH_COOKIE_NAME = 'connexy_refresh';

/** В prod (разные домены фронта и API) нужны SameSite=None + Secure. Локально — Lax. */
export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: (IS_PRODUCTION ? 'none' : 'lax') as 'none' | 'lax' | 'strict',
  maxAge: Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 7) * 24 * 60 * 60 * 1000,
  path: '/auth',
};

export function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: REFRESH_COOKIE_OPTIONS.sameSite,
    path: '/auth',
  });
}
