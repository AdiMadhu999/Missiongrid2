const CACHE_NAME = 'missiongrid-static-v2';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/app_logo.jpg',
  '/app_logo.png',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching core assets');
        return Promise.allSettled(
          PRECACHE_ASSETS.map(url => {
            return cache.add(url).catch(err => {
              console.warn(`[SW] Pre-cache failed for: ${url}`, err);
            });
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Bypass Service Worker for non-GET requests, API routes, WebSockets, reCAPTCHA, and Firebase Services
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@vite/') ||
    url.pathname.startsWith('/@id/') ||
    url.pathname.includes('node_modules') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('googleusercontent') ||
    url.hostname.includes('recaptcha') ||
    (url.hostname === 'localhost' && event.request.url.includes('socket'))
  ) {
    return; // Let the browser handle the network request normally
  }

  // 2. Handle Navigation requests (SPA page loads / deep links)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If response is valid, clone and cache it
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/', responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline fallback - serve cached index.html
          return caches.match('/') || caches.match('/index.html');
        })
    );
    return;
  }

  // 3. Handle static assets (Stale-While-Revalidate strategy)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch((err) => {
          console.log('[SW] Fetch failed for:', event.request.url, err);
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
