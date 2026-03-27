const CACHE = 'vsc-v1';
const OFFLINE_URLS = ['/', '/static/js/main.chunk.js', '/static/js/bundle.js'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(OFFLINE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Only cache GET requests; let WebSocket and API calls pass through
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/stream') || e.request.url.includes('localhost:8000')) return;

  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
