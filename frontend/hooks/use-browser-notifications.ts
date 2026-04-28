'use client';

import { useEffect, useCallback } from 'react';

// Запросить разрешение на уведомления
export function useBrowserNotifications() {
  // Запрашиваем разрешение при первом использовании
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      Notification.permission !== 'default'
    ) {
      return;
    }

    // Небольшая задержка чтобы не спрашивать сразу при загрузке
    const timer = setTimeout(() => {
      void Notification.requestPermission();
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // Показать уведомление
  const showNotification = useCallback(
    (
      title: string,
      options?: {
        body?: string;
        icon?: string;
        tag?: string;
        onClick?: () => void;
      },
    ) => {
      if (
        typeof window === 'undefined' ||
        !('Notification' in window) ||
        Notification.permission !== 'granted' ||
        document.visibilityState === 'visible' // не показывать если вкладка активна
      ) {
        return;
      }

      try {
        const notification = new Notification(title, {
          body: options?.body,
          icon: options?.icon || '/connexy_favicon.svg',
          tag: options?.tag, // предотвращает дублирование
          silent: false,
        });

        if (options?.onClick) {
          notification.onclick = () => {
            window.focus();
            options.onClick?.();
            notification.close();
          };
        }

        // Автозакрытие через 5 секунд
        setTimeout(() => notification.close(), 5000);
      } catch {
        // Уведомления могут не работать в некоторых браузерах
      }
    },
    [],
  );

  return { showNotification };
}

