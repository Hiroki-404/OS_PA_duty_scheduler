const CACHE_NAME = 'duty-scheduler-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// API 호출은 항상 네트워크 우선, 나머지는 네트워크 패스스루
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
