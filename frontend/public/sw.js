const CACHE_NAME = 'connexy-v2';
const OFFLINE_URL = '/offline';

// Ресурсы которые кешируем при установке
const PRECACHE = [
  '/',
  '/offline',
  '/connexy_favicon.svg',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Удаляем старые кеши
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Приложение на :3000, API на :3001 — другой origin; SW не должен кешировать/перехватывать эти запросы
  if (url.origin !== self.location.origin) {
    return;
  }

  // Только GET запросы
  if (request.method !== 'GET') return;

  // Прокси API на том же origin (если появится /api/...)
  if (url.pathname.startsWith('/api')) {
    return;
  }

  // Навигационные запросы (переход по страницам)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL)),
    );
    return;
  }

  // Статические ресурсы — cache first, потом сеть
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
        // Кешируем только успешные ответы на статику
        if (
          response.ok &&
          (request.destination === 'image' ||
           request.destination === 'font' ||
           request.destination === 'style')
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
        })
        .catch(() => cached || Response.error());
    }),
  );
});

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Connexy', body: event.data.text(), url: '/dashboard' };
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/dashboard' },
    vibrate: [100, 50, 100],
    requireInteraction: false,
    tag: 'connexy-message',
  };

  event.waitUntil(self.registration.showNotification(data.title || 'Connexy', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const rawUrl = event.notification.data?.url || '/dashboard';
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then(() => {
            if ('navigate' in client && typeof client.navigate === 'function') {
              return client.navigate(targetUrl);
            }
          });
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    }),
  );
});

