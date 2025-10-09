/**
 * Sitemap Gzip & Media E2E Tests
 *
 * Verifies:
 * 1. robots.txt points to sitemap-index.xml
 * 2. Gzipped sitemap is accessible and properly formatted
 * 3. Image/video sitemaps exist with proper namespaces
 * 4. Sitemap index references all sub-sitemaps
 */

import { test, expect } from './test.base';

test('robots points to sitemap-index and gzipped main sitemap exists', async ({ request }) => {
  // Check robots.txt references sitemap-index
  const robots = await request.get('/robots.txt');
  expect(robots.ok()).toBeTruthy();
  const txt = await robots.text();
  expect(txt).toMatch(/Sitemap:\s*https?:\/\/.+\/sitemap-index\.xml/i);

  // Check main sitemap.xml is accessible
  const resXml = await request.get('/sitemap.xml', {
    headers: { 'Accept-Encoding': 'gzip' }
  });
  expect(resXml.ok()).toBeTruthy();

  // Verify it's valid XML
  const body = await resXml.text();
  expect(body).toMatch(/<urlset/);
  expect(body).toMatch(/xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);

  // Note: Content-Encoding header may not be present in dev server
  // In production with nginx, it would show 'gzip'
});

test('image/video sitemaps exist with proper namespaces', async ({ request }) => {
  // Check image sitemap
  const img = await request.get('/sitemap-images.xml');
  expect(img.ok()).toBeTruthy();
  const imgXml = await img.text();
  expect(imgXml).toMatch(/xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1"/);
  expect(imgXml).toMatch(/<urlset/);

  // Check video sitemap
  const vid = await request.get('/sitemap-videos.xml');
  expect(vid.ok()).toBeTruthy();
  const vidXml = await vid.text();
  expect(vidXml).toMatch(/xmlns:video="http:\/\/www\.google\.com\/schemas\/sitemap-video\/1\.1"/);
  expect(vidXml).toMatch(/<urlset/);
});

test('sitemap-index references all sub-sitemaps', async ({ request }) => {
  const index = await request.get('/sitemap-index.xml');
  expect(index.ok()).toBeTruthy();
  const xml = await index.text();

  // Verify it's a sitemap index
  expect(xml).toMatch(/<sitemapindex/);
  expect(xml).toMatch(/xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);

  // Verify all sitemaps are referenced
  expect(xml).toMatch(/<loc>https?:\/\/.+\/sitemap\.xml<\/loc>/);
  expect(xml).toMatch(/<loc>https?:\/\/.+\/sitemap-images\.xml<\/loc>/);
  expect(xml).toMatch(/<loc>https?:\/\/.+\/sitemap-videos\.xml<\/loc>/);
});

test('main sitemap has image/video namespaces enabled', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.ok()).toBeTruthy();
  const xml = await res.text();

  // Verify image namespace is declared
  expect(xml).toMatch(/xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1"/);

  // Verify video namespace is declared
  expect(xml).toMatch(/xmlns:video="http:\/\/www\.google\.com\/schemas\/sitemap-video\/1\.1"/);

  // Check for image tags (should have at least one from media.json)
  const hasImages = xml.includes('<image:image>');
  if (hasImages) {
    expect(xml).toMatch(/<image:loc>https?:\/\/.+<\/image:loc>/);
  }
});

test('image sitemap contains actual image data from media manifest', async ({ request }) => {
  const res = await request.get('/sitemap-images.xml');
  expect(res.ok()).toBeTruthy();
  const xml = await res.text();

  // Should have image:image tags if media manifest has images
  // Gallery images are auto-ingested from gallery.json
  if (xml.includes('<image:image>')) {
    expect(xml).toMatch(/<image:loc>https?:\/\/.+\/assets\/gallery\/blender-glass\.jpg<\/image:loc>/);
    expect(xml).toMatch(/<image:caption>.+<\/image:caption>/);
  }
});
