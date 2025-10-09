import { test, expect, type Page } from './test.base';

/**
 * Site-wide typography enforcement
 * - Discovers pages from internal links, sitemap.xml, and projects.json
 * - Enforces Space Grotesk for headings and Inter for body text
 * - Verifies fonts actually loaded using the Font Loading API
 *
 * Environment variables:
 *   TYPO_MAX_PAGES=40          Max pages to crawl (default: 40)
 *   TYPO_USE_SITEMAP=1         Enable sitemap.xml discovery (default: 1)
 *   TYPO_PROJECTS_JSON=/projects.json  Path to projects.json (default: /projects.json)
 */

const START_PATHS = ['/', '/completed.html'];
const MAX_PAGES = parseInt(process.env.TYPO_MAX_PAGES || '40', 10);
const USE_SITEMAP = process.env.TYPO_USE_SITEMAP !== '0'; // default ON
const PROJECTS_JSON_PATH = process.env.TYPO_PROJECTS_JSON || '/projects.json';

function normFamily(f: string) {
  return (f || '').replace(/"/g, '').toLowerCase().trim();
}

async function fontsReady(page: Page) {
  await page.evaluate(async () => {
    // @ts-ignore
    if (document.fonts && document.fonts.ready) { await document.fonts.ready; }
  });
}

async function checkFontLoaded(page: Page, font: string, weight = 400, size = '16px') {
  const ok = await page.evaluate(({ font, weight, size }: { font: string; weight: number; size: string }) => {
    // @ts-ignore
    if (!document.fonts || !document.fonts.check) return false;
    // @ts-ignore
    return document.fonts.check(`${weight} ${size} "${font}"`);
  }, { font, weight, size });
  return ok;
}

/**
 * Discover internal links from anchor tags on current page
 */
async function discoverFromAnchors(page: Page): Promise<string[]> {
  try {
    const discovered: string[] = await page.evaluate(() => {
      const a = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
      const hrefs = a.map(x => x.getAttribute('href') || '').filter(Boolean);
      const internal = hrefs
        .map(href => {
          try {
            const u = new URL(href, location.origin);
            if (u.origin !== location.origin) return null; // external
            // normalize to path + search (ignore hash for crawl)
            let path = u.pathname;
            if (u.search) path += u.search;
            // ignore mailto, tel, file, hash-only
            if (/^(mailto:|tel:|#)/i.test(href)) return null;
            return path;
          } catch { return null; }
        })
        .filter((v): v is string => !!v)
        .filter(p => !p.match(/\.(png|jpg|jpeg|gif|svg|pdf|webp|ico)$/i));
      return Array.from(new Set(internal));
    });
    return discovered;
  } catch {
    return [];
  }
}

/**
 * Discover pages from sitemap.xml
 */
async function discoverFromSitemap(page: Page): Promise<string[]> {
  try {
    const response = await page.goto('/sitemap.xml', { waitUntil: 'domcontentloaded' });
    if (!response || !response.ok()) return [];

    const paths = await page.evaluate(() => {
      const locs = Array.from(document.querySelectorAll('loc'));
      return locs.map(loc => {
        try {
          const url = new URL(loc.textContent || '');
          return url.pathname;
        } catch {
          return null;
        }
      }).filter((p): p is string => !!p);
    });
    return Array.from(new Set(paths));
  } catch {
    return [];
  }
}

/**
 * Discover project pages from projects.json
 */
async function discoverFromProjectsJSON(page: Page): Promise<string[]> {
  try {
    const response = await page.goto(PROJECTS_JSON_PATH, { waitUntil: 'domcontentloaded' });
    if (!response || !response.ok()) return [];

    const json = await response.json();
    const paths: string[] = [];

    if (Array.isArray(json)) {
      // Extract project pages
      for (const project of json) {
        if (project.slug) {
          paths.push(`/projects/${project.slug}.html`);
        }
        // Extract internal links from project data
        if (project.links) {
          for (const link of Object.values(project.links)) {
            if (typeof link === 'string' && link.startsWith('/')) {
              paths.push(link);
            }
          }
        }
      }
    }
    return Array.from(new Set(paths));
  } catch {
    return [];
  }
}

/**
 * Build comprehensive crawl list from all sources
 */
async function buildCrawlList(page: Page): Promise<string[]> {
  const set = new Set<string>(START_PATHS);

  // Anchors from home
  await page.goto('/');
  const fromHome = await discoverFromAnchors(page);
  fromHome.forEach(p => set.add(p));

  // Optional: sitemap.xml
  if (USE_SITEMAP) {
    const fromSitemap = await discoverFromSitemap(page);
    fromSitemap.forEach(p => set.add(p));
  }

  // Optional: projects.json-derived pages
  const fromProjects = await discoverFromProjectsJSON(page);
  fromProjects.forEach(p => set.add(p));

  // Cap at MAX_PAGES
  return Array.from(set).slice(0, MAX_PAGES);
}

// Master test: crawl and validate every discovered page
test.describe('Site-wide typography', () => {
  test('Every crawled page uses Inter (body) and Space Grotesk (headings)', async ({ page }) => {
    // 0) Start at home and wait for fonts
    await page.goto('/');
    await fontsReady(page);

    // 1) Ensure fonts truly loaded (once)
    const sg = await checkFontLoaded(page, 'Space Grotesk', 700, '24px');
    const inter = await checkFontLoaded(page, 'Inter', 400, '16px');
    expect(sg, 'Space Grotesk did not load (check <link> or @font-face)').toBeTruthy();
    expect(inter, 'Inter did not load (check <link> or @font-face)').toBeTruthy();

    // 2) Build comprehensive crawl list from all sources
    const paths = await buildCrawlList(page);
    test.info().annotations.push({ type: 'info', description: `Typography crawl: ${paths.length} page(s)` });

    for (const path of paths) {
      await test.step(`check ${path}`, async () => {
        await page.goto(path);
        await fontsReady(page);

        // Body font
        const bodyFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
        expect(normFamily(bodyFamily).startsWith('inter'), `Body font on ${path} should be Inter, got: ${bodyFamily}`).toBeTruthy();

        // Headings font
        const headingFamilies = await page.$$eval('h1,h2,h3,h4,h5,h6', els => els.map(el => getComputedStyle(el).fontFamily));
        if (headingFamilies.length === 0) {
          test.info().annotations.push({ type: 'info', description: `No headings found on ${path}; skipping heading check.` });
        } else {
          for (const fam of headingFamilies) {
            expect(normFamily(fam).startsWith('space grotesk'), `Heading font on ${path} should be Space Grotesk, got: ${fam}`).toBeTruthy();
          }
        }

        // Optional CSS variables check
        const { sans, display } = await page.evaluate(() => {
          const cs = getComputedStyle(document.documentElement);
          return {
            sans: cs.getPropertyValue('--font-sans') || '',
            display: cs.getPropertyValue('--font-display') || '',
          };
        });
        if (sans || display) {
          expect(sans.toLowerCase(), `--font-sans should contain "inter" on ${path}`).toContain('inter');
          expect(display.toLowerCase(), `--font-display should contain "space grotesk" on ${path}`).toContain('space grotesk');
        }
      });
    }
  });

  test('Brand header logo and text use correct fonts', async ({ page }) => {
    await page.goto('/');
    await fontsReady(page);

    // Brand text should use Space Grotesk (display font)
    const brandText = page.locator('.brand-text');
    if (await brandText.count() > 0) {
      const brandFamily = await brandText.evaluate(el => getComputedStyle(el).fontFamily);
      expect(normFamily(brandFamily).startsWith('space grotesk'), 'Brand text should use Space Grotesk').toBeTruthy();

      const brandWeight = await brandText.evaluate(el => getComputedStyle(el).fontWeight);
      expect(brandWeight, 'Brand text should be weight 600').toBe('600');
    }
  });

  test('About section uses consistent typography', async ({ page }) => {
    await page.goto('/');
    await fontsReady(page);

    const aboutSection = page.locator('.about');
    if (await aboutSection.count() > 0) {
      // About heading uses Space Grotesk
      const aboutH1 = aboutSection.locator('h1');
      if (await aboutH1.count() > 0) {
        const h1Family = await aboutH1.evaluate(el => getComputedStyle(el).fontFamily);
        expect(normFamily(h1Family).startsWith('space grotesk'), 'About h1 should use Space Grotesk').toBeTruthy();
      }

      // About body text uses Inter
      const aboutP = aboutSection.locator('p');
      if (await aboutP.count() > 0) {
        const pFamily = await aboutP.first().evaluate(el => getComputedStyle(el).fontFamily);
        expect(normFamily(pFamily).startsWith('inter'), 'About paragraph should use Inter').toBeTruthy();
      }
    }
  });

  test('Links use correct color and hover states', async ({ page }) => {
    await page.goto('/');
    await fontsReady(page);

    // Find any link in the body
    const link = page.locator('a').first();
    if (await link.count() > 0) {
      const linkColor = await link.evaluate(el => getComputedStyle(el).color);
      // Cyan color should be rgb(138, 216, 255) or #8ad8ff
      const rgbMatch = linkColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (rgbMatch) {
        const [, r, g, b] = rgbMatch;
        // Allow some tolerance for color values
        expect(parseInt(r), 'Link red component should be ~138').toBeGreaterThan(130);
        expect(parseInt(g), 'Link green component should be ~216').toBeGreaterThan(200);
        expect(parseInt(b), 'Link blue component should be ~255').toBeGreaterThan(240);
      }
    }
  });

  test('Buttons use Inter semibold', async ({ page }) => {
    await page.goto('/');
    await fontsReady(page);

    const buttons = page.locator('button, .btn');
    const count = await buttons.count();

    if (count > 0) {
      const button = buttons.first();
      const btnFamily = await button.evaluate(el => getComputedStyle(el).fontFamily);
      const btnWeight = await button.evaluate(el => getComputedStyle(el).fontWeight);

      expect(normFamily(btnFamily).startsWith('inter'), 'Buttons should use Inter').toBeTruthy();
      expect(btnWeight, 'Buttons should be weight 600').toBe('600');
    }
  });

  test('Fluid typography scales correctly', async ({ page }) => {
    // Test at mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await fontsReady(page);

    const h1Mobile = page.locator('h1').first();
    if (await h1Mobile.count() > 0) {
      const mobileFontSize = await h1Mobile.evaluate(el => {
        const size = getComputedStyle(el).fontSize;
        return parseFloat(size);
      });
      expect(mobileFontSize, 'h1 on mobile should be ~30px minimum').toBeGreaterThanOrEqual(28);
      expect(mobileFontSize, 'h1 on mobile should be <44px').toBeLessThan(44);
    }

    // Test at desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await fontsReady(page);

    const h1Desktop = page.locator('h1').first();
    if (await h1Desktop.count() > 0) {
      const desktopFontSize = await h1Desktop.evaluate(el => {
        const size = getComputedStyle(el).fontSize;
        return parseFloat(size);
      });
      expect(desktopFontSize, 'h1 on desktop should be >35px').toBeGreaterThan(35);
      expect(desktopFontSize, 'h1 on desktop should be ≤52px maximum').toBeLessThanOrEqual(52);
    }
  });

  test('Font rendering settings are applied', async ({ page }) => {
    await page.goto('/');
    await fontsReady(page);

    const renderSettings = await page.evaluate(() => {
      const body = document.body;
      const cs = getComputedStyle(body);
      return {
        fontSmoothing: cs.getPropertyValue('-webkit-font-smoothing'),
        mozFontSmoothing: cs.getPropertyValue('-moz-osx-font-smoothing'),
        textRendering: cs.getPropertyValue('text-rendering'),
      };
    });

    // Chromium on Windows often reports 'auto' regardless of CSS; only enforce when browser returns a concrete value
    if (renderSettings.fontSmoothing && renderSettings.fontSmoothing !== 'auto') {
      expect(renderSettings.fontSmoothing, 'Webkit font smoothing should be antialiased').toBe('antialiased');
    }
    // -moz-osx-font-smoothing is Firefox-only; Chromium returns empty string
    if (renderSettings.mozFontSmoothing) {
      expect(renderSettings.mozFontSmoothing, 'Mozilla font smoothing should be grayscale').toBe('grayscale');
    }
    expect(renderSettings.textRendering, 'Text rendering should be optimizeLegibility').toBe('optimizelegibility');
  });

  test('CSS variables are defined and accessible', async ({ page }) => {
    await page.goto('/');

    const variables = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return {
        fontSans: cs.getPropertyValue('--font-sans').trim(),
        fontDisplay: cs.getPropertyValue('--font-display').trim(),
        text: cs.getPropertyValue('--text').trim(),
        muted: cs.getPropertyValue('--muted').trim(),
      };
    });

    expect(variables.fontSans, '--font-sans should be defined').toBeTruthy();
    expect(variables.fontSans.toLowerCase(), '--font-sans should contain "inter"').toContain('inter');

    expect(variables.fontDisplay, '--font-display should be defined').toBeTruthy();
    expect(variables.fontDisplay.toLowerCase(), '--font-display should contain "space grotesk"').toContain('space grotesk');

    expect(variables.text, '--text color should be defined').toBeTruthy();
    expect(variables.muted, '--muted color should be defined').toBeTruthy();
  });
});
