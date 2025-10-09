import { test, expect } from './test.base';
import { BASE, REQUIRE_CSS_200 } from './helpers/env';

const STRICT = process.env.PLAYWRIGHT_STRICT_STREAM === '1';
const STREAM_TIMEOUT_MS = Number(process.env.STREAM_TIMEOUT_MS || 15000);
const EXPECT_SERVED_BY = process.env.EXPECT_SERVED_BY; // pattern like "primary|ollama|fallback"

// Helper: fetch first stylesheet via request context rather than relying on browser fetch assets
// (removed unused getFirstStylesheetHref helper after multi-link logic)

test('page renders + css loads + streaming works', async ({ page, request }) => {
  await page.goto(BASE);
  await expect(page.locator('body')).toBeVisible();

  // Attempt multiple stylesheet links for resilience (preload/media differences)
  const links = await page.locator('link[rel="stylesheet"]').all();
  if (links.length === 0) {
    test.info().annotations.push({ type: 'css', description: 'no <link rel="stylesheet"> tags present' });
    test.skip(!REQUIRE_CSS_200, 'No stylesheet links — skipping in dev; set REQUIRE_CSS_200=1 to enforce.');
    expect(links.length, 'no <link rel="stylesheet"> tags found; did you build the app?').toBeGreaterThan(0);
  }
  let cssOk = false; let lastErr = '';
  for (let i=0;i<links.length;i++) {
    const href = await links[i].getAttribute('href');
    if (!href) continue;
    const url = href.startsWith('http') ? href : (href.startsWith('/') ? href : `/${href}`);
    const resp = await request.get(url);
    const ct = (resp.headers()['content-type'] || '').toLowerCase();
    if (resp.status() === 200 && ct.includes('text/css')) {
      const cc = (resp.headers()['cache-control'] || '');
      const isLocal = /localhost|127\.0\.0\.1/.test(BASE);
      if (REQUIRE_CSS_200) {
        if (!/immutable/.test(cc) && !isLocal) {
          expect(cc, 'Expected immutable cache header in strict mode (non-local)').toMatch(/immutable/);
        } else if (!/immutable/.test(cc) && isLocal) {
          test.info().annotations.push({ type: 'css-cache', description: `local-no-immutable: ${cc}` });
        }
      } else if (!/immutable/.test(cc)) {
        test.info().annotations.push({ type: 'css-cache', description: `non-immutable cache-control: ${cc}` });
      }
      cssOk = true; break;
    } else {
      lastErr = `Attempt ${i+1} status=${resp.status()} ct=${ct}`;
    }
  }
  if (!cssOk) {
    const html = await page.content();
    test.info().attach('index.html', { body: html, contentType: 'text/html' });
    test.skip(!REQUIRE_CSS_200, `No stylesheet passed preflight (dev tolerant). ${lastErr}`);
    expect(cssOk, `No stylesheet passed preflight. ${lastErr}\nHint: run production build (npm run build) or ensure nginx serves built assets.`).toBe(true);
  }
  // --- Backend availability probe (early) ---
  const backendRequired = process.env.BACKEND_REQUIRED === '1';
  let backendAvailable = false;
  let probeHitEndpoint: string | null = null;
  const probeEndpoints = ['/api/status/summary', '/api/ready', '/ready'];
  for (const ep of probeEndpoints) {
    try {
      const r = await request.get(ep);
      if (r.status() < 400) { backendAvailable = true; probeHitEndpoint = ep; break; }
      if (r.status() === 404) {
        test.info().annotations.push({ type: 'backend-probe', description: `${ep} -> 404` });
      } else {
        test.info().annotations.push({ type: 'backend-probe', description: `${ep} -> ${r.status()}` });
      }
    } catch (e) {
      test.info().annotations.push({ type: 'backend-probe-error', description: `${ep} ${(e as Error).message}` });
    }
  }

  // if no backend reachable AND BACKEND_REQUIRED != 1, SKIP for clean reporting
  if (!backendAvailable && process.env.BACKEND_REQUIRED !== '1') {
    test.info().annotations.push({
      type: 'skip-reason',
      description: 'Backend absent; BACKEND_REQUIRED=0 (frontend-only mode)'
    });
    test.skip(true, 'Backend absent (frontend-only mode)');
  }
  if (!backendAvailable && backendRequired) {
    expect(backendAvailable, 'Backend required but not reachable via status/ready probes').toBeTruthy();
  }
  if (backendAvailable) {
    // annotate which probe succeeded for debugging
    test.info().annotations.push({
      type: 'backend-probe',
      description: `reachable: ${probeHitEndpoint}`
    });
  }

  // --- Streaming test ---
  const result = await page.evaluate(
    async ({ timeoutMs }) => {
      const res = await fetch('/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hello with _served_by' }] }) }
      );
      if (!res.ok || !res.body) return { ok: false, err: `HTTP ${res.status}` };
      const reader = res.body.getReader();
      const td = new TextDecoder();
      const deadline = Date.now() + timeoutMs;
      let seenServed = false;
      let servedText = '';
      let bytes = 0;
      let buf = '';
      while (Date.now() < deadline) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.length;
        buf += td.decode(chunk.value, { stream: true });
        const m = buf.match(/_served_by[^:\n]*[:=]\s*([^\s,}]+)\b/i);
        if (m) {
          seenServed = true;
          servedText = m[1];
          break;
        }
      }
      return { ok: true, bytes, seenServed, servedText, sample: buf.slice(0, 800) };
    },
    { timeoutMs: STREAM_TIMEOUT_MS }
  );

  expect(result.ok, result.err || 'stream failed').toBeTruthy();
  expect(result.bytes).toBeGreaterThan(0);

  if (STRICT) {
    expect(result.seenServed).toBeTruthy();
    if (EXPECT_SERVED_BY) {
      const re = new RegExp(EXPECT_SERVED_BY, 'i');
      expect(re.test(result.servedText || '')).toBeTruthy();
    }
  } else {
    test.info().annotations.push({ type: 'stream-bytes', description: String(result.bytes) });
  }
});
