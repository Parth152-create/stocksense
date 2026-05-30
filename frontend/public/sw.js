/**
 * StockSense Service Worker
 *
 * Strategy:
 *   - App shell (JS/CSS/fonts) → Cache First
 *   - API calls (/api/*) → Network First with 3s timeout, fallback to cache
 *   - Static assets (icons, images) → Cache First
 *   - Navigation requests → Network First, fallback to cached /dashboard
 *
 * Cache names are versioned — bump CACHE_VERSION to force full refresh.
 */

const CACHE_VERSION   = 'v1';
const SHELL_CACHE     = `stocksense-shell-${CACHE_VERSION}`;
const API_CACHE       = `stocksense-api-${CACHE_VERSION}`;
const STATIC_CACHE    = `stocksense-static-${CACHE_VERSION}`;

const SHELL_URLS = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// ── Install — pre-cache app shell ─────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing StockSense service worker');
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      // Use individual adds so one 404 doesn't kill the whole install
      return Promise.allSettled(
        SHELL_URLS.map(url => cache.add(url).catch(err =>
          console.warn(`[SW] Failed to cache ${url}:`, err)
        ))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate — delete old caches ──────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating StockSense service worker');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(key => key.startsWith('stocksense-') && !key.endsWith(CACHE_VERSION))
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch — route requests ────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin + GET requests
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // API calls → Network First with timeout
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithTimeout(request, API_CACHE, 3000));
    return;
  }

  // Navigation (HTML pages) → Network First, fallback to /dashboard
  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }

  // Static assets → Cache First
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Everything else → Network First
  event.respondWith(networkFirst(request, SHELL_CACHE));
});

// ── Strategies ────────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? new Response('Offline', { status: 503 });
  }
}

async function networkFirstWithTimeout(request, cacheName, timeoutMs) {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeout);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    clearTimeout(timeout);
    const cached = await caches.match(request);
    if (cached) return cached;
    // Return structured offline JSON for API calls
    return new Response(
      JSON.stringify({ error: 'Offline', message: 'No cached data available' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function navigationHandler(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Fallback to cached dashboard shell
    const cached = await caches.match('/dashboard') ?? await caches.match('/');
    return cached ?? new Response('Offline — please reconnect to use StockSense', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}