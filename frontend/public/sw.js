const STATIC_CACHE = 'abw-static-v1';
const DATA_CACHE = 'abw-data-v1';
const STATIC_ASSETS = ['/', '/dashboard', '/manifest.webmanifest', '/favicon.svg', '/favicon.ico'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== DATA_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  // Cache chapter/book read endpoints for offline chapter viewing.
  if (isSameOrigin && url.pathname.startsWith('/api/v1/') && (url.pathname.includes('/chapters') || url.pathname.includes('/books'))) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request, STATIC_CACHE).catch(async () => {
        const cachedDashboard = await caches.match('/dashboard');
        if (cachedDashboard) {
          return cachedDashboard;
        }
        const cachedRoot = await caches.match('/');
        if (cachedRoot) {
          return cachedRoot;
        }
        return Response.error();
      })
    );
    return;
  }

  if (isSameOrigin) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  }
});
