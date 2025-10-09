import { test, expect } from './test.base';

const BASE = process.env.BASE ?? 'http://localhost:8080';
const EXPECT_EDGE = process.env.EXPECT_EDGE === '1' || process.env.NGINX_STRICT === '1';

/**
 * Runtime guard: ensure no inline event handlers (on*) exist in top-level document.
 */
 test('dom-no-inline-handlers: no on* attributes in top document', async ({ page }) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const offenders = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*'))
      .flatMap(el => Array.from(el.getAttributeNames())
        .filter(n => /^on[a-z]+$/.test(n))
        .map(n => `${el.tagName.toLowerCase()}[${n}]`));
  });
  if (offenders.length) {
    console.error('[dom-no-inline-handlers] Offenders:', offenders);
  }
  expect(offenders, `Inline handlers found: ${offenders.join(', ')}`).toHaveLength(0);
  if (!EXPECT_EDGE) console.warn('[dom-no-inline-handlers] Ran outside edge mode');
});
