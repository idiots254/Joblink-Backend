// Service Worker for offline support with smart cache updating
const CACHE_NAME = 'joblink-cache-' + new Date().getTime();
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install event - cache core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching core files');
      return cache.addAll(urlsToCache).catch((error) => {
        console.log('Service Worker: Some files failed to cache', error);
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      console.log('Service Worker: Cleaning old caches');
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheName.startsWith('joblink-cache-') || cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network-first for HTML, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (!url.origin.includes(self.location.origin.replace(/https?:\/\//, ''))) {
    return;
  }

  const createOfflineResponse = (message) => {
    return new Response(message, {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({ 'Content-Type': 'text/plain' })
    });
  };

  const getCachedHtmlResponse = () => {
    return caches.match(request).then((response) => {
      if (response) {
        return response;
      }
      return caches.match('/index.html').then((fallbackResponse) => {
        return fallbackResponse || createOfflineResponse('Offline - Please check your connection');
      });
    });
  };

  const getCachedDataResponse = () => {
    return caches.match(request).then((response) => {
      return response || createOfflineResponse('Offline - Data not available');
    });
  };

  const getCachedResourceResponse = () => {
    return caches.match(request).then((response) => {
      return response || createOfflineResponse('Offline - Resource not available');
    });
  };

  // Strategy 1: NETWORK-FIRST for HTML pages (always check Netlify for updates)
  if (request.mode === 'navigate' || request.url.includes('index.html') || url.pathname === '/') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          console.log('Service Worker: No internet, using cached HTML');
          return getCachedHtmlResponse();
        })
    );
    return;
  }

  // Strategy 2: NETWORK-FIRST for API/data requests
  if (url.pathname.includes('/api') || url.pathname.includes('supabase')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => getCachedDataResponse())
    );
    return;
  }

  // Strategy 3: CACHE-FIRST for static assets (js, css, images)
  if (request.url.includes('/static/') || 
      request.url.endsWith('.js') || 
      request.url.endsWith('.css') ||
      request.url.endsWith('.png') ||
      request.url.endsWith('.jpg') ||
      request.url.endsWith('.jpeg') ||
      request.url.endsWith('.svg') ||
      request.url.endsWith('.gif') ||
      request.url.endsWith('.woff') ||
      request.url.endsWith('.woff2')) {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          return response;
        }
        return fetch(request).then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        }).catch(() => {
          console.log('Service Worker: Failed to fetch asset', request.url);
          return createOfflineResponse('Offline - Resource not available');
        });
      })
    );
    return;
  }

  // Default: Try network first, then cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        return response;
      })
      .catch(() => getCachedResourceResponse())
  );
});

