/**
 * Валидатор URL вложений.
 *
 * Разрешает только URL с доверенных доменов (Cloudinary).
 * Если CLOUDINARY не настроен — разрешает только https-URL (мягкий режим для dev).
 */

import { BadRequestException } from '@nestjs/common';

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME?.trim();

/**
 * Возвращает true если URL допустим для сохранения как вложение.
 */
export function isAllowedAttachmentUrl(url: string | undefined | null): boolean {
  if (!url) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // Только HTTPS
  if (parsed.protocol !== 'https:') return false;

  // Если Cloudinary настроен — проверяем домен строго
  if (CLOUDINARY_CLOUD_NAME) {
    const allowedHosts = [`res.cloudinary.com`];
    return allowedHosts.some((host) => parsed.hostname === host);
  }

  // Dev-режим без Cloudinary: разрешаем любой https (но не javascript:, data:, etc.)
  return true;
}

/**
 * Бросает BadRequestException если URL не прошёл валидацию.
 */
export function assertAllowedAttachmentUrl(url: string | undefined | null): void {
  if (url && !isAllowedAttachmentUrl(url)) {
    throw new BadRequestException('Недопустимый URL вложения');
  }
}
