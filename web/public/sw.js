/* Minimal service worker so Chromium can offer Add to Home Screen, plus Web
   Push for the business portal (daily goal, messages from SelliX).
   Do not intercept uploads or non-GET API calls — large PUT bodies break otherwise. */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' && req.method !== 'HEAD') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return;
  event.respondWith(fetch(req));
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'SelliX';
  const refund = data.tone === 'refund';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/favicon-32.png',
      tag: data.tag || undefined,
      renotify: true,
      // Browsers ignore CSS color; red circle in title + this flag for clients.
      data: { url: data.url || '/portal', tone: data.tone || 'print' },
      // Chromium: vibrate pattern hints urgency on refund
      vibrate: refund ? [120, 60, 120] : undefined
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/portal', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const win of wins) {
        if (win.url.startsWith(self.location.origin)) {
          win.focus();
          return win.navigate ? win.navigate(target) : undefined;
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
