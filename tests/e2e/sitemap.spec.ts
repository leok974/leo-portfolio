/**
 * Sitemap & robots.txt E2E Test
 *
 * Verifies:
 * 1. robots.txt exists and references sitemap
 * 2. sitemap.xml exists with correct content-type
 * 3. sitemap.xml is valid XML with urlset structure
 * 4. sitemap contains at least one valid URL
 * 5. lastmod timestamps are present
 */

import { test, expect } from './test.base';

test('robots.txt references sitemap and sitemap.xml is valid', async ({ request }) => {
  // Check robots.txt
  const robots = await request.get('/robots.txt');
  expect(robots.ok()).toBeTruthy();
  const robotsTxt = await robots.text();
  // Now points to sitemap-index.xml after upgrade
  expect(robotsTxt).toMatch(/Sitemap:\s*https?:\/\/.+\/sitemap(-index)?\.xml/i);

  // Check sitemap.xml exists
  const res = await request.get('/sitemap.xml');
  expect(res.ok()).toBeTruthy();

  // Verify content-type (application/xml or text/xml)
  const contentType = res.headers()['content-type'];
  expect(contentType).toMatch(/application\/xml|text\/xml/);

  // Parse XML
  const xml = await res.text();

  // Basic XML structure validation
  expect(xml).toMatch(/<\?xml version="1\.0" encoding="UTF-8"\?>/);
  expect(xml).toMatch(/<urlset[\s\S]*<\/urlset>/);
  expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');

  // Verify at least one URL entry
  expect(xml).toMatch(/<url>[\s\S]*<\/url>/);
  expect(xml).toMatch(/<loc>https?:\/\/.+<\/loc>/);

  // Verify required fields are present
  expect(xml).toMatch(/<priority>[\d.]+<\/priority>/);
  expect(xml).toMatch(/<changefreq>\w+<\/changefreq>/);
  expect(xml).toMatch(/<lastmod>[\d\-T:.Z]+<\/lastmod>/);
});

test('sitemap contains key pages', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.ok()).toBeTruthy();
  const xml = await res.text();

  // Verify homepage
  expect(xml).toMatch(/<loc>https?:\/\/[^<]+\/<\/loc>/);

  // Count URLs (should have at least index, book, privacy)
  const urlMatches = xml.match(/<url>/g);
  expect(urlMatches).toBeTruthy();
  expect(urlMatches!.length).toBeGreaterThanOrEqual(3);
});

test('sitemap lastmod timestamps are valid ISO 8601', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.ok()).toBeTruthy();
  const xml = await res.text();

  // Extract all lastmod values
  const lastmodRegex = /<lastmod>([\d\-T:.Z]+)<\/lastmod>/g;
  const matches = [...xml.matchAll(lastmodRegex)];

  expect(matches.length).toBeGreaterThan(0);

  // Verify each timestamp is valid ISO 8601
  for (const match of matches) {
    const timestamp = match[1];
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    // Verify it's a valid date
    const date = new Date(timestamp);
    expect(date.toString()).not.toBe('Invalid Date');

    // Verify it's not in the future (with 1 hour tolerance for clock skew)
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    expect(date.getTime()).toBeLessThanOrEqual(oneHourFromNow.getTime());
  }
});
