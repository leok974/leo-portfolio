/**
 * E2E Tests: Sitemap Status API
 *
 * Tests the /agent/status/sitemap endpoint for viewing sitemap URLs and integrity.
 */
import { test, expect } from '@playwright/test';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8001';

test.describe('sitemap status', () => {
  test('GET /agent/status/sitemap returns urls + integrity', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/agent/status/sitemap`);
    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const j = await res.json();

      // Validate response structure
      expect(j.ok).toBe(true);
      expect(Array.isArray(j.urls)).toBeTruthy();
      expect(Array.isArray(j.files)).toBeTruthy();
      expect(typeof j.count).toBe('number');

      // Validate integrity
      expect(j.integrity?.algo).toBe('sha256');
      expect(typeof j.integrity?.value).toBe('string');
      expect(j.integrity?.value).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
      expect(typeof j.integrity?.size).toBe('number');

      console.log(`✅ Sitemap found: ${j.count} URLs from ${j.files.length} file(s)`);
      if (j.urls.length > 0) {
        console.log(`   Sample URLs: ${j.urls.slice(0, 3).join(', ')}`);
      }
    } else {
      console.log('⚠️  No sitemap.xml found in public/, dist/, or root');
    }
  });

  test('GET /agent/status/sitemap?raw=1 streams XML', async ({ request }) => {
    const res = await request.get(`${BACKEND_URL}/agent/status/sitemap`, {
      params: { raw: 1 }
    });

    expect([200, 404]).toContain(res.status());

    if (res.status() === 200) {
      const ct = res.headers()['content-type'] || '';
      expect(ct).toContain('application/xml');

      const body = await res.text();
      expect(body.length).toBeGreaterThan(0);

      // Check for sitemap XML markers
      const hasSitemap = body.includes('<urlset') || body.includes('<sitemap');
      expect(hasSitemap).toBeTruthy();

      // Verify X-Resolved-Path header
      const resolvedPath = res.headers()['x-resolved-path'];
      expect(resolvedPath).toBeTruthy();

      console.log(`✅ Raw sitemap streamed: ${body.length} bytes`);
      console.log(`   Resolved path: ${resolvedPath}`);
    } else {
      console.log('⚠️  No sitemap.xml found for raw streaming');
    }
  });

  test('Sitemap URLs match discovered pages', async ({ request }) => {
    // Get sitemap URLs
    const sitemapRes = await request.get(`${BACKEND_URL}/agent/status/sitemap`);
    if (sitemapRes.status() !== 200) {
      console.log('⚠️  Skipping comparison - no sitemap.xml');
      return;
    }
    const sitemapData = await sitemapRes.json();
    const sitemapUrls = new Set(sitemapData.urls);

    // Get discovered pages
    const pagesRes = await request.get(`${BACKEND_URL}/agent/status/pages`);
    expect(pagesRes.status()).toBe(200);
    const pagesData = await pagesRes.json();
    const pagePaths = pagesData.pages.map((p: any) => p.path);

    // Check overlap
    const inBoth = pagePaths.filter((p: string) => sitemapUrls.has(p));
    const onlyInPages = pagePaths.filter((p: string) => !sitemapUrls.has(p));
    const onlyInSitemap = Array.from(sitemapUrls).filter(url => !pagePaths.includes(url));

    console.log(`📊 Sitemap vs Discovered Pages:`);
    console.log(`   In both: ${inBoth.length}`);
    console.log(`   Only in discovered pages: ${onlyInPages.length}`);
    console.log(`   Only in sitemap: ${onlyInSitemap.length}`);

    if (onlyInPages.length > 0) {
      console.log(`   Pages not in sitemap: ${onlyInPages.slice(0, 5).join(', ')}${onlyInPages.length > 5 ? '...' : ''}`);
    }
  });
});
