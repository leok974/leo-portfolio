import { test, expect } from '@playwright/test';

test.describe('SEO: OG Images @seo', () => {
  test('home page has absolute og:image URL', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });

    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveCount(1);

    const content = await ogImage.getAttribute('content');
    expect(content).toBeTruthy();
    expect(content).toMatch(/^https?:\/\//);
  });

  test('projects page has absolute og:image URL', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/projects`, { waitUntil: 'domcontentloaded' });

    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveCount(1);

    const content = await ogImage.getAttribute('content');
    expect(content).toBeTruthy();
    expect(content).toMatch(/^https?:\/\//);
  });

  test('about page has absolute og:image URL', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/about`, { waitUntil: 'domcontentloaded' });

    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveCount(1);

    const content = await ogImage.getAttribute('content');
    expect(content).toBeTruthy();
    expect(content).toMatch(/^https?:\/\//);
  });

  test('project detail page has absolute og:image URL', async ({ page, baseURL }) => {
    // Test with LedgerMind project as example
    await page.goto(`${baseURL}/projects/ledgermind`, { waitUntil: 'domcontentloaded' });

    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveCount(1);

    const content = await ogImage.getAttribute('content');
    expect(content).toBeTruthy();
    expect(content).toMatch(/^https?:\/\//);
  });

  test('og:image URLs point to PNG files', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });

    const ogImage = page.locator('meta[property="og:image"]');
    const content = await ogImage.getAttribute('content');

    // Should end with .png extension
    expect(content).toMatch(/\.png(\?.*)?$/);
  });

  test('og:image dimensions are valid (1200×630)', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });

    const width = page.locator('meta[property="og:image:width"]');
    const height = page.locator('meta[property="og:image:height"]');

    // Optional: some sites include these meta tags
    const widthCount = await width.count();
    const heightCount = await height.count();

    if (widthCount > 0 && heightCount > 0) {
      await expect(width).toHaveAttribute('content', '1200');
      await expect(height).toHaveAttribute('content', '630');
    }
  });
});
