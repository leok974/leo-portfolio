/// <reference lib="webworker" />

// Progressive web app strategy (disabled on GitHub Pages by unregister in main.js)
// Network-first for navigations (HTML) to avoid stale releases.
// Cache-first for hashed static assets.
/** @type {ServiceWorkerGlobalScope} */
// @ts-ignore - self is ServiceWorkerGlobalScope in this file (webworker lib ref)
const sw = /** @type {ServiceWorkerGlobalScope} */ (self);

const ASSET_CACHE = 'assets-v1';

sw.addEventListener('install', () => sw.skipWaiting());
sw.addEventListener('activate', (event) => event.waitUntil(sw.clients.claim()));

/**
 * @param {string} path
 */
/**
 * @param {string} path
 */
function isHashedAsset(path) {
  return /\.(?:js|css|woff2|png|jpe?g|webp|gif|svg|ico)$/.test(path) && /\.[0-9a-f]{8,}\./.test(path);
}

sw.addEventListener('fetch', (event) => {
  /** @type {FetchEvent} */
  // @ts-ignore - event is a FetchEvent in SW context
  const fe = event;
  const req = fe.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // don't proxy cross-origin

  // Always network-first for navigations (fresh index.html)
  if (req.mode === 'navigate') {
    fe.respondWith(
      fetch(req).catch(async () => (await caches.match('/index.html')) || new Response('offline', { status: 503, statusText: 'Offline' }))
    );
    return;
  }

  const pathname = url.pathname;
  if (isHashedAsset(pathname)) {
    fe.respondWith((async () => {
      const cache = await caches.open(ASSET_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      cache.put(req, res.clone());
      return res;
    })());
  }
});
