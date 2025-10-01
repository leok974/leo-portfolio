/* Asset-guard SW: prevents caching/serving HTML for asset requests */
/// <reference lib="webworker" />
/** @type {ServiceWorkerGlobalScope} */
// @ts-ignore
const sw = /** @type {ServiceWorkerGlobalScope} */ (self);

sw.addEventListener('install', () => sw.skipWaiting());
sw.addEventListener('activate', (e) => e.waitUntil(sw.clients.claim()));

sw.addEventListener('fetch', (event) => {
  /** @type {FetchEvent} */
  // @ts-ignore
  const fe = event;
  const req = fe.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const assetPath = url.pathname.startsWith('/assets/')
    || /\.(css|js|mjs|woff2?|ttf|png|jpe?g|webp|avif|svg)$/i.test(url.pathname);
  const assetKind = ['style','script','image','font'].includes(req.destination);

  if (assetPath || assetKind) {
    fe.respondWith((async () => {
      let res = null;
      try {
        res = await fetch(req, { cache: 'no-cache' });
      } catch (_err) {
        return new Response('Gateway Timeout', { status: 504 });
      }
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('text/html')) {
        // Server fallback (likely SPA index) — do not allow HTML for asset URL
        return new Response('Asset Not Found', { status: 404, statusText: 'Not Found' });
      }
      return res;
    })());
  }
});
