import { test, expect, type Page } from '@playwright/test';

const SITE = process.env.PW_BASE_URL ?? 'http://localhost:5173';

// Helpers
async function getLocalStorage(page: Page) {
  return page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
}

test.describe('Portfolio Assistant panel', () => {
  test.beforeEach(async ({ page }) => {
    // Default: mock /api/layout => { layout: null }
    await page.route('**/api/layout', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ layout: null }),
      });
    });
  });

  test('Hide button collapses panel and persists; Alt+P reopens', async ({ page }) => {
    await page.goto(SITE);

    // Find the assistant dock/panel
    const panel = page.locator('[data-testid="assistant-panel"]');
    await expect(panel).toBeVisible();

    // Click Hide
    const hideBtn = page.locator('[data-testid="assistant-hide"]');
    await expect(hideBtn).toBeVisible();
    await hideBtn.click();

    // Panel should be hidden (via style.display = 'none')
    await expect(panel).toBeHidden();

    // LocalStorage should reflect hidden
    const ls1 = await getLocalStorage(page);
    expect(ls1['portfolio:assistant:hidden']).toBe('1');

    // Reload -> should still be hidden
    await page.reload();

    // Wait a bit for the dock to initialize and restore state
    await page.waitForTimeout(500);
    await expect(panel).toBeHidden();

    // Alt+P reopens
    await page.keyboard.press('Alt+p');

    // Wait for panel to become visible
    await page.waitForTimeout(200);
    await expect(panel).toBeVisible();

    const ls2 = await getLocalStorage(page);
    expect(ls2['portfolio:assistant:hidden']).toBe('0');
  });

  test('Escape key hides the panel', async ({ page }) => {
    await page.goto(SITE);

    const panel = page.locator('[data-testid="assistant-panel"]');
    await expect(panel).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    await expect(panel).toBeHidden();

    const ls = await getLocalStorage(page);
    expect(ls['portfolio:assistant:hidden']).toBe('1');
  });

  test('Layout panel shows friendly message when layout is null', async ({ page }) => {
    await page.goto(SITE);

    // Open the "Layout" details/section (if collapsed)
    const layoutToggle = page.locator('[data-testid="assistant-layout-toggle"]');
    await layoutToggle.click();

    // Check for friendly message
    const friendly = page.locator('[data-testid="assistant-layout-empty"]');
    await expect(friendly).toBeVisible();
    await expect(friendly).toContainText(/layout learning is off|not learned yet/i);

    // Check that Refresh button is present
    const refresh = page.locator('[data-testid="assistant-layout-refresh"]');
    await expect(refresh).toBeVisible();

    // Click refresh - should trigger another fetch (still returns null)
    let fetchCount = 0;
    await page.route('**/api/layout', async (route) => {
      fetchCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ layout: null }),
      });
    });

    await refresh.click();

    // Wait for the fetch
    await page.waitForTimeout(300);

    // Should still show friendly message
    await expect(friendly).toBeVisible();
  });

  test('Layout panel renders JSON when layout exists', async ({ page }) => {
    // Override the default route to return real layout JSON for this test
    await page.route('**/api/layout', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          layout: {
            grid: 'A/B',
            weights: { hero: 0.7, projects: 0.3 }
          }
        }),
      });
    });

    await page.goto(SITE);

    // Open layout section
    const layoutToggle = page.locator('[data-testid="assistant-layout-toggle"]');
    await layoutToggle.click();

    // Wait for layout to load
    await page.waitForTimeout(500);

    // Expect <pre>{JSON.stringify(layout, …)}</pre> to appear
    const jsonBlock = page.locator('[data-testid="assistant-layout-json"]');
    await expect(jsonBlock).toBeVisible();
    await expect(jsonBlock).toContainText('"grid"');
    await expect(jsonBlock).toContainText('A/B');
    await expect(jsonBlock).toContainText('0.7');

    // Friendly message should NOT be visible
    const friendly = page.locator('[data-testid="assistant-layout-empty"]');
    await expect(friendly).not.toBeVisible();
  });

  test('Hide button has correct type="button" attribute', async ({ page }) => {
    await page.goto(SITE);

    const hideBtn = page.locator('[data-testid="assistant-hide"]');
    const buttonType = await hideBtn.getAttribute('type');
    expect(buttonType).toBe('button');
  });

  test('Panel persists hidden state across multiple reloads', async ({ page }) => {
    await page.goto(SITE);

    // Hide the panel
    const hideBtn = page.locator('[data-testid="assistant-hide"]');
    await hideBtn.click();

    // Reload 1
    await page.reload();
    await page.waitForTimeout(500);
    let panel = page.locator('[data-testid="assistant-panel"]');
    await expect(panel).toBeHidden();

    // Reload 2
    await page.reload();
    await page.waitForTimeout(500);
    panel = page.locator('[data-testid="assistant-panel"]');
    await expect(panel).toBeHidden();

    // Show it again with Alt+P
    await page.keyboard.press('Alt+p');
    await page.waitForTimeout(200);
    await expect(panel).toBeVisible();

    // Reload 3 - should be visible now
    await page.reload();
    await page.waitForTimeout(500);
    panel = page.locator('[data-testid="assistant-panel"]');
    await expect(panel).toBeVisible();
  });
});

test.describe('SEO: OG image', () => {
  test('og:image is absolute and points to leoklemet.com', async ({ page }) => {
    await page.goto(SITE);

    // Find meta[property="og:image"]
    const ogImage = page.locator('head meta[property="og:image"]');
    await expect(ogImage).toHaveCount(1);

    const content = await ogImage.getAttribute('content');
    expect(content).toBeTruthy();
    expect(content).toMatch(/^https:\/\/leoklemet\.com\//i);
  });

  test('og:url is absolute and points to leoklemet.com', async ({ page }) => {
    await page.goto(SITE);

    const ogUrl = page.locator('head meta[property="og:url"]');
    await expect(ogUrl).toHaveCount(1);

    const content = await ogUrl.getAttribute('content');
    expect(content).toBe('https://leoklemet.com/');
  });

  test('canonical link points to leoklemet.com', async ({ page }) => {
    await page.goto(SITE);

    const canonical = page.locator('head link[rel="canonical"]');
    await expect(canonical).toHaveCount(1);

    const href = await canonical.getAttribute('href');
    expect(href).toBe('https://leoklemet.com/');
  });

  test('og:image has width and height meta tags', async ({ page }) => {
    await page.goto(SITE);

    const width = page.locator('head meta[property="og:image:width"]');
    const height = page.locator('head meta[property="og:image:height"]');

    await expect(width).toHaveCount(1);
    await expect(height).toHaveCount(1);

    const widthContent = await width.getAttribute('content');
    const heightContent = await height.getAttribute('content');

    expect(widthContent).toBe('1200');
    expect(heightContent).toBe('630');
  });

  test('twitter:image points to leoklemet.com', async ({ page }) => {
    await page.goto(SITE);

    const twitterImage = page.locator('head meta[name="twitter:image"]');
    await expect(twitterImage).toHaveCount(1);

    const content = await twitterImage.getAttribute('content');
    expect(content).toMatch(/^https:\/\/leoklemet\.com\//i);
  });

  test('JSON-LD structured data has correct URL', async ({ page }) => {
    await page.goto(SITE);

    const jsonLd = await page.locator('script#jsonld-profile').textContent();
    expect(jsonLd).toBeTruthy();

    const data = JSON.parse(jsonLd!);
    expect(data.url).toBe('https://leoklemet.com');
    expect(data.name).toBe('Leo Klemet');
    expect(data['@type']).toBe('Person');
  });
});
