/**
 * StockSense Service Worker
 *
 * Strategy:
 *   - App shell (JS/CSS/fonts) → Cache First
 *   - API calls (/api/*) → Network First with 3s timeout, fallback to cache
 *   - Static assets (icons, images) → Cache First
 *   - Navigation requests → Network First, fallback to cached /dashboard
 *
 * PWA Widget:
 *   - Handles widgetinstall / widgetclick / widgetresume events
 *   - Fetches /api/widget/portfolio and renders into the portfolio widget
 *
 * Cache names are versioned — bump CACHE_VERSION to force full refresh.
 */

const CACHE_VERSION = 'v2';
const SHELL_CACHE   = `stocksense-shell-${CACHE_VERSION}`;
const API_CACHE     = `stocksense-api-${CACHE_VERSION}`;
const STATIC_CACHE  = `stocksense-static-${CACHE_VERSION}`;

const SHELL_URLS = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/widget-template.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing StockSense service worker');
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      Promise.allSettled(
        SHELL_URLS.map(url =>
          cache.add(url).catch(err => console.warn(`[SW] Failed to cache ${url}:`, err))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating StockSense service worker');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(key => key.startsWith('stocksense-') && !key.endsWith(CACHE_VERSION))
          .map(key => { console.log('[SW] Deleting old cache:', key); return caches.delete(key); })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithTimeout(request, API_CACHE, 3000));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }

  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/widget-template.json'
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  event.respondWith(networkFirst(request, SHELL_CACHE));
});

// ── PWA Widget events ─────────────────────────────────────────────────────────
//
// The Widgets API (Chrome 114+ / Android 14+) fires these lifecycle events.
// We fetch fresh portfolio data from /api/widget/portfolio and push it into
// the widget via self.widgets.updateByTag().
//
// Fallback: if self.widgets is undefined (browser doesn't support widgets yet),
// the handlers exit silently — no errors, no impact on the rest of the SW.
// ─────────────────────────────────────────────────────────────────────────────

const WIDGET_TAG = 'portfolio-widget';

/** Fetch portfolio summary and shape it for the Adaptive Card template */
async function getWidgetPayload() {
  try {
    // Retrieve the JWT from IndexedDB if available, else try without auth
    // (widget data endpoint should handle missing auth gracefully)
    const res = await fetch('/api/widget/portfolio', {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) return buildFallbackPayload();
    const data = await res.json();

    const totalValue = data.totalValue ?? 0;
    const pnl        = data.totalPnl   ?? 0;
    const pnlPct     = data.totalPnlPct ?? 0;
    const invested   = data.totalInvested ?? data.totalCost ?? 0;
    const positions  = data.positions ?? 0;
    const currency   = data.currency ?? '$';

    const fmt = (n) => `${currency}${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return {
      totalValue: fmt(totalValue),
      pnlSign:    pnl >= 0 ? '+' : '-',
      pnlAbs:     fmt(pnl),
      pnlPct:     (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(2),
      pnlColor:   pnl >= 0 ? 'Good' : 'Attention',  // Adaptive Card color tokens
      invested:   fmt(invested),
      positions:  String(positions),
      updatedAt:  new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
  } catch {
    return buildFallbackPayload();
  }
}

function buildFallbackPayload() {
  return {
    totalValue: '—',
    pnlSign:    '',
    pnlAbs:     '—',
    pnlPct:     '—',
    pnlColor:   'Default',
    invested:   '—',
    positions:  '—',
    updatedAt:  'Offline',
  };
}

/** Update the widget with fresh data */
async function updatePortfolioWidget() {
  if (!self.widgets) return; // Browser doesn't support Widgets API yet

  const widget = await self.widgets.getByTag(WIDGET_TAG);
  if (!widget) return;

  const payload = await getWidgetPayload();

  await self.widgets.updateByTag(WIDGET_TAG, {
    data: JSON.stringify(payload),
  });

  console.log('[SW] Portfolio widget updated:', payload.totalValue);
}

// Widget installed — user added it to their home screen
self.addEventListener('widgetinstall', (event) => {
  console.log('[SW] Widget installed:', event.widget?.tag);
  event.waitUntil(updatePortfolioWidget());
});

// Widget resumed (home screen visible again / periodic refresh)
self.addEventListener('widgetresume', (event) => {
  console.log('[SW] Widget resumed:', event.widget?.tag);
  event.waitUntil(updatePortfolioWidget());
});

// Widget clicked — navigate to portfolio page
self.addEventListener('widgetclick', (event) => {
  console.log('[SW] Widget clicked:', event.widget?.tag, event.action);
  event.waitUntil(
    (async () => {
      // Refresh data on click
      await updatePortfolioWidget();

      // Open / focus the portfolio page
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const portfolioClient = allClients.find(c => c.url.includes('/dashboard'));

      if (portfolioClient) {
        portfolioClient.focus();
      } else {
        self.clients.openWindow('/dashboard/portfolio');
      }
    })()
  );
});

// Widget uninstalled — nothing to clean up for now
self.addEventListener('widgetuninstall', (event) => {
  console.log('[SW] Widget uninstalled:', event.widget?.tag);
});

// Periodic background sync — refresh widget data every 15 minutes
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'portfolio-widget-sync') {
    event.waitUntil(updatePortfolioWidget());
  }
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
    const cached = await caches.match('/dashboard') ?? await caches.match('/');
    return cached ?? new Response('Offline — please reconnect to use StockSense', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}