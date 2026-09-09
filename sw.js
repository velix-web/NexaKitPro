const CACHE = 'nexakit-pro-v20';
const PRECACHE = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

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
  event.respondWith(
    fetch(event.request, {cache:'no-store'}).then(response => {
      if (response.ok) caches.open(CACHE).then(c => c.put(event.request, response.clone()));
      return response;
    }).catch(() => caches.match(event.request).then(cached => cached || (
      event.request.mode === 'navigate' ? caches.match('/') : new Response('', {status:504})
    )))
  );
});
