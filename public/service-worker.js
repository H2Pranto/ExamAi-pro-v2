
const CACHE_NAME = 'examai-pro-offline-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css',
  'https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap'
];

// Install Event: Cache core static assets immediately
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force activation
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use addAll to cache all static assets. 
      // If any of these fail (e.g. offline), the install fails, which is expected behavior
      // to ensure we have a consistent offline state.
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    )).then(() => self.clients.claim()) // Take control of all clients immediately
  );
});

// Fetch Event: Handle requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Strategy for Navigation (HTML): Network First -> Cache Fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkRes) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkRes.clone());
            return networkRes;
          });
        })
        .catch(() => {
          return caches.match('/index.html')
            .then((cachedRes) => cachedRes || caches.match('/'));
        })
    );
    return;
  }

  // Strategy for Assets: Cache First -> Network
  event.respondWith(
    caches.match(event.request).then((cachedRes) => {
      if (cachedRes) return cachedRes;

      return fetch(event.request).then((networkRes) => {
        // Cache new successful responses
        // We allow caching opaque responses (status 0) from CDNs if necessary,
        // though addAll handles CORS enabled resources better.
        // For dynamic fetching, we strictly cache valid responses.
        if (networkRes && (networkRes.status === 200 || networkRes.status === 0) && (url.protocol.startsWith('http'))) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => {
            try {
                cache.put(event.request, resClone);
            } catch (err) {
                // Ignore errors for unsupported request schemes etc.
            }
          });
        }
        return networkRes;
      });
    })
  );
});