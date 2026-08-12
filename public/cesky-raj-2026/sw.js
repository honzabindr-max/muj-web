// Cache-first service worker pro /cesky-raj-2026 — funguje bez signálu
// po prvním načtení na wifi. Scope je omezen na tuto routu (soubor
// leží v /cesky-raj-2026/, takže se netýká zbytku webu).

const CACHE_NAME = 'cesky-raj-2026-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('cesky-raj-2026-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      try {
        const response = await fetch(request);
        if (response && response.status === 200) {
          cache.put(request, response.clone());
        }
        return response;
      } catch (err) {
        if (request.mode === 'navigate') {
          const fallback = await cache.match('/cesky-raj-2026');
          if (fallback) return fallback;
        }
        throw err;
      }
    })
  );
});
