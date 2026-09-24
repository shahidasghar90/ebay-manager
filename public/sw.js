const CACHE_NAME = 'tradepilot-shell-v5';
const SHELL_ASSETS = ['/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!SHELL_ASSETS.includes(url.pathname)) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'TradePilot', body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || 'TradePilot', {
        body: data.body || '',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { url: data.url || '/dashboard' }
      }),
      // Lets an open app refresh its notification bell right away.
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clients) => clients.forEach((client) => client.postMessage({ type: 'notification' })))
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.url) || '/dashboard';
  const url = new URL(path, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const client = clients.find((c) => new URL(c.url).origin === self.location.origin);
      if (!client) return self.clients.openWindow(url);

      // client.navigate() is unreliable in installed apps (and throws for uncontrolled
      // clients), so the page navigates itself on this message.
      client.postMessage({ type: 'navigate', url });
      try {
        await client.focus();
      } catch {
        // Focus can be refused; the page still navigates.
      }
    })
  );
});
