import { test, expect } from './test.base';

const BASE = process.env.BASE ?? 'http://localhost:8080';
const EXPECT_EDGE = process.env.EXPECT_EDGE === '1' || process.env.NGINX_STRICT === '1';

/**
 * Runtime guard: After hydration, top-level document must not contain style= attributes
 * or <style> elements. (We ignore iframes / shadow roots explicitly; scope is document.)
 */
test('dom-no-inline-styles: top-level document contains no style= attributes or <style> elements', async ({ page }) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });

  const offenders = await page.evaluate(() => Array.from(document.querySelectorAll('[style]')).map(el => ({
    tag: el.tagName.toLowerCase(),
    id: el.id || undefined,
    cls: el.className || undefined,
    style: (el as HTMLElement).getAttribute('style') || ''
  })));
  const styledCount = offenders.length;
  const styleTagCount = await page.evaluate(() => document.getElementsByTagName('style').length);

  if (styledCount !== 0) {
    console.error('[dom-no-inline-styles] Offenders:', JSON.stringify(offenders, null, 2));
  }
  expect(styledCount, 'expected zero inline style= attributes').toBe(0);
  expect(styleTagCount, 'expected zero <style> elements').toBe(0);

  if (!EXPECT_EDGE) {
    console.warn('[dom-no-inline-styles] Ran outside edge mode (EXPECT_EDGE/NGINX_STRICT not set).');
  }
});
