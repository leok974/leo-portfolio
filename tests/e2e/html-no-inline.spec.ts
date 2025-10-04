import { test, expect } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:8080';
const EXPECT_EDGE = process.env.EXPECT_EDGE === '1' || process.env.NGINX_STRICT === '1';
// We only meaningfully enforce this against the edge-served HTML (headers, CSP). If not edge, still run but log.

/**
 * Build-time guard: index.html must not contain inline <style> blocks, style="..." attributes,
 * or inline event handlers (onclick=, onload=, etc.). This keeps CSP free of 'unsafe-inline'.
 */
test('html-no-inline: index.html has no inline <style>, no style= attrs, no inline handlers', async ({ request }) => {
  const res = await request.get(`${BASE}/`);
  expect(res.ok()).toBeTruthy();
  const html = await res.text();

  // No <style>...</style> blocks
  const hasStyleBlock = /<style\b[^>]*>[\s\S]*?<\/style>/i.test(html);
  expect(hasStyleBlock).toBeFalsy();

  // No style="..."
  const hasStyleAttr = /\sstyle\s*=\s*["'][\s\S]*?["']/i.test(html);
  expect(hasStyleAttr).toBeFalsy();

  // No inline event handlers like onclick=, onload=, etc. (case-insensitive)
  const hasInlineHandler = /\son[a-z]+\s*=\s*["'][\s\S]*?["']/i.test(html);
  expect(hasInlineHandler).toBeFalsy();

  if (!EXPECT_EDGE) {
    console.warn('[html-no-inline] Ran outside edge mode (EXPECT_EDGE/NGINX_STRICT not set).');
  }
});
