import { test, expect, request } from '@playwright/test';

const HOME = '/';

test.describe('OG Meta Tags @og', () => {
  test('homepage has OG fallback meta + image resolves', async ({ page }) => {
    await page.goto(HOME);

    // Check og:image meta tag
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogImage).toBeTruthy();
    expect(ogImage).toBe('https://www.leoklemet.com/og/og.png');

    // Check og:site_name
    const ogSiteName = await page.locator('meta[property="og:site_name"]').getAttribute('content');
    expect(ogSiteName).toBe('Leo Klemet — Portfolio');

    // Check og:title
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toBeTruthy();

    // Check og:description
    const ogDesc = await page.locator('meta[property="og:description"]').getAttribute('content');
    expect(ogDesc).toBeTruthy();

    // Check og:url
    const ogUrl = await page.locator('meta[property="og:url"]').getAttribute('content');
    expect(ogUrl).toBe('https://www.leoklemet.com/');

    // Check twitter:card
    const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute('content');
    expect(twitterCard).toBe('summary_large_image');

    // Check twitter:image
    const twitterImage = await page.locator('meta[name="twitter:image"]').getAttribute('content');
    expect(twitterImage).toBe('https://www.leoklemet.com/og/og.png');

    // HEAD request to verify image exists
    const apiContext = await request.newContext();
    const resp = await apiContext.get(ogImage!);
    expect(resp.status()).toBe(200);

    const contentType = resp.headers()['content-type'] || '';
    expect(contentType).toMatch(/image\/(png|jpeg)/);

    const buffer = await resp.body();
    expect(buffer.byteLength).toBeGreaterThan(100); // Sanity check - real image should be larger

    await apiContext.dispose();
  });

  test('OG image dimensions specified', async ({ page }) => {
    await page.goto(HOME);

    const ogWidth = await page.locator('meta[property="og:image:width"]').getAttribute('content');
    expect(ogWidth).toBe('1200');

    const ogHeight = await page.locator('meta[property="og:image:height"]').getAttribute('content');
    expect(ogHeight).toBe('630');
  });

  test('preload link exists for OG image', async ({ page }) => {
    await page.goto(HOME);

    const preload = await page.locator('link[rel="preload"][as="image"]').getAttribute('href');
    expect(preload).toMatch(/\/og\/og\.png/);
  });
});
