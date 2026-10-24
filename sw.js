// Bump CACHE whenever the app shell changes shape: `activate` below deletes
// every cache whose name isn't this one, which is what evicts stale assets.
// Strategy is network-first (cache:'no-store'), so online users always get
// fresh code; the cache only exists as an offline fallback.
const CACHE = 'nextgen1-v2';
const PRECACHE = ['/', '/index.html', '/styles.css', '/theme-init.js', '/load-fa.js', '/ui.js', '/app.js', '/auth.js', '/manifest.json', '/favicon.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all(
    PRECACHE.map(url => fetch(url, {cache:'reload'}).then(r => r.ok ? cache.put(url, r) : null).catch(() => null))
  )).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== CACHE).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  // Never cache API responses: downloader/maker/health endpoints are dynamic.
  if (url.pathname.startsWith('/api/')) return;
  event.respondWith(
    fetch(event.request, {cache:'no-store'}).then(response => {
      if (response.ok && response.status === 200) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(c => c.put(event.request, copy)).catch(() => {}));
      }
      return response;
    }).catch(() => caches.match(event.request).then(cached => cached || (
      event.request.mode === 'navigate' ? caches.match('/') : new Response('', {status:504})
    )))
  );
});
