/* Minimal service worker so Chromium can offer Add to Home Screen.
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
