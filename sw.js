// Progressive web app strategy (disabled on GitHub Pages by unregister in main.js)
// Network-first for navigations (HTML) to avoid stale releases.
// Cache-first for hashed static assets.
const ASSET_CACHE = 'assets-v1';

self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

function isHashedAsset(path) {
  return /\.(?:js|css|woff2|png|jpe?g|webp|gif|svg|ico)$/.test(path) && /\.[0-9a-f]{8,}\./.test(path);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // don't proxy cross-origin

  // Always network-first for navigations (fresh index.html)
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/index.html')));
    return;
  }

  const pathname = url.pathname;
  if (isHashedAsset(pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(ASSET_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      cache.put(req, res.clone());
      return res;
    })());
  }
});
