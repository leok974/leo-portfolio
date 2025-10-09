/**
 * SEO JSON-LD E2E Tests
 *
 * Tests for JSON-LD structured data presence and validation on frontend pages.
 * Ensures WebSite, WebPage, BreadcrumbList and other schema.org types are correctly embedded.
 */
import { test, expect } from './test.base';

/**
 * Helpers
 */
async function readLdJsonArray(page: any) {
  const handles = await page.locator('script[type="application/ld+json"]').elementHandles();
  const all: any[] = [];
  for (const h of handles) {
    const txt = await (await h.getProperty('textContent'))!.jsonValue();
    if (!txt) continue;
    try {
      const parsed = JSON.parse(txt as string);
      if (Array.isArray(parsed)) {
        all.push(...parsed);
      } else if (parsed['@graph']) {
        // Handle @graph format: copy parent @context to each item
        const context = parsed['@context'];
        const items = parsed['@graph'].map((item: any) => {
          // Only add @context if the item doesn't already have one
          if (context && !item['@context']) {
            return { '@context': context, ...item };
          }
          return item;
        });
        all.push(...items);
      } else {
        all.push(parsed);
      }
    } catch (_) {
      // Ignore malformed; assertions will fail later
    }
  }
  return all;
}

function byType(objs: any[], type: string) {
  return objs.filter(o => o['@type'] === type);
}

/**
 * Config:
 * - BASE_URL is expected (your suite already uses it)
 * - Dev overlay cookie is injected in your global setup (Phase 50.5)
 */

test.describe('@seo-ld Home & Project pages', () => {
  test('Home page exposes JSON-LD (WebSite/WebPage)', async ({ page, baseURL }) => {
    const url = `${baseURL}/`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Wait for runtime injector to complete (it's async) - look for #ld-main or WebPage in JSON-LD
    await page.waitForFunction(() => {
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      return scripts.some(s => {
        try {
          const parsed = JSON.parse(s.textContent || '{}');
          const items = parsed['@graph'] || [parsed];
          return items.some((item: any) => item['@type'] === 'WebPage') || s.id === 'ld-main';
        } catch {
          return false;
        }
      });
    }, { timeout: 5000 }).catch(() => {
      // If timeout, continue anyway - static JSON-LD should be present
    });

    const ld = await readLdJsonArray(page);
    expect(ld.length, 'ld+json script(s) should exist with at least one object').toBeGreaterThan(0);

    // Basic invariants
    for (const obj of ld) {
      expect(obj['@context']).toBe('https://schema.org');
      expect(typeof obj['@type']).toBe('string');
    }

    // Presence checks (at least 1 of each on home)
    expect(byType(ld, 'WebSite').length).toBeGreaterThanOrEqual(1);
    expect(byType(ld, 'WebPage').length).toBeGreaterThanOrEqual(1);
    expect(byType(ld, 'Person').length).toBeGreaterThanOrEqual(1);
    expect(byType(ld, 'Organization').length).toBeGreaterThanOrEqual(1);

    // Canonical URL match for WebPage
    const pages = byType(ld, 'WebPage');
    for (const wp of pages) {
      expect(typeof wp.url).toBe('string');
      // Accept either dev server URL or production URL (static JSON-LD uses production URLs)
      const wpUrl = String(wp.url);
      const currentOrigin = new URL(url).origin;
      const productionOrigin = 'https://leok974.github.io';
      expect(wpUrl.includes(currentOrigin) || wpUrl.includes(productionOrigin)).toBeTruthy();
    }
  });

  test('Project page exposes BreadcrumbList and WebPage invariants', async ({ page, baseURL }) => {
    // Pick a stable project path; adjust if you have a known slug
    const projectUrl = `${baseURL}/projects/ledgermind`;
    await page.goto(projectUrl, { waitUntil: 'domcontentloaded' });

    // Wait for runtime injector to add WebPage/BreadcrumbList
    await page.waitForFunction(() => {
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      return scripts.some(s => {
        try {
          const parsed = JSON.parse(s.textContent || '{}');
          const items = parsed['@graph'] || [parsed];
          return items.some((item: any) => item['@type'] === 'WebPage') || s.id === 'ld-main';
        } catch {
          return false;
        }
      });
    }, { timeout: 5000 }).catch(() => {
      // Continue anyway
    });

    const ld = await readLdJsonArray(page);
    expect(ld.length).toBeGreaterThan(0);

    // Required types for a project page
    expect(byType(ld, 'WebPage').length).toBeGreaterThanOrEqual(1);
    // Breadcrumb may be in its own object or nested, so handle both:
    const crumbs = byType(ld, 'BreadcrumbList');
    const hasBreadcrumbType = crumbs.length >= 1;
    const nestedBreadcrumb = byType(ld, 'WebPage').some(wp => !!wp.breadcrumb);
    expect(hasBreadcrumbType || nestedBreadcrumb).toBeTruthy();

    // CreativeWork should be present for projects
    expect(byType(ld, 'CreativeWork').length).toBeGreaterThanOrEqual(1);

    // Image hygiene (if present)
    for (const img of byType(ld, 'ImageObject')) {
      expect(typeof img.url).toBe('string');
      expect(String(img.url)).toMatch(/^https?:\/\//);
    }
  });
});
