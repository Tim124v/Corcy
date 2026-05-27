'use client';

import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // В dev SW часто мешает HMR/манифестам Next (turbo). По умолчанию снимаем регистрацию.
    // Для локального теста Web Push: NEXT_PUBLIC_ENABLE_SW_IN_DEV=1 в .env.local и перезапуск dev.
    const enableSwInDev = process.env.NEXT_PUBLIC_ENABLE_SW_IN_DEV === '1';
    if (process.env.NODE_ENV !== 'production' && !enableSwInDev) {
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => {});
      return;
    }

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // Новая версия доступна — можно показать тост
              console.log('[PWA] Новая версия Corsy доступна');
            }
          });
        });
      } catch (err) {
        console.warn('[PWA] Service worker registration failed:', err);
      }
    };

    void register();
  }, []);

  return null;
}

