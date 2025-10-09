import { test, expect } from './test.base';

test('gallery renders and consent gate works @gallery', async ({ page }) => {
  await page.goto('/gallery.html');

  // Wait for gallery to load
  await page.waitForFunction(() => window.__galleryReady === true, { timeout: 5000 });

  // Verify cards are rendered
  const cards = await page.locator('[data-testid="gallery-card"]').count();
  expect(cards).toBeGreaterThan(0);

  // Verify at least one card has content
  const firstTitle = await page.locator('[data-testid="gallery-card"] .title').first().textContent();
  expect(firstTitle).toBeTruthy();
});

test('gallery embed consent gate shows placeholder when embeds disabled @gallery', async ({ page }) => {
  // Disable embeds consent
  await page.goto('/gallery.html');
  await page.evaluate(() => {
    window.consent?.set?.('embeds', false);
  });

  await page.waitForFunction(() => window.__galleryReady === true, { timeout: 5000 });

  // Check for embed placeholder
  const placeholder = page.locator('.embed-placeholder').first();
  await expect(placeholder).toBeVisible({ timeout: 3000 });

  // Verify placeholder message contains enable text
  await expect(placeholder).toContainText('enable');
});

test('gallery embed consent gate shows iframe when embeds enabled @gallery', async ({ page }) => {
  await page.goto('/gallery.html');

  // Enable embeds consent
  await page.evaluate(() => {
    window.consent?.set?.('embeds', true);
  });

  await page.waitForFunction(() => window.__galleryReady === true, { timeout: 5000 });

  // Check for iframe (if there are any youtube/vimeo items)
  const iframes = page.locator('iframe.embed');
  const count = await iframes.count();
  if (count > 0) {
    await expect(iframes.first()).toBeVisible();
  }
});

test('gallery filter by tool works @gallery', async ({ page }) => {
  await page.goto('/gallery.html');
  await page.waitForFunction(() => window.__galleryReady === true, { timeout: 5000 });

  const initialCount = await page.locator('[data-testid="gallery-card"]').count();

  // Click a specific tool filter (e.g., ComfyUI)
  const comfyBtn = page.locator('.tags .tag').filter({ hasText: 'ComfyUI' });
  if (await comfyBtn.count() > 0) {
    await comfyBtn.click();

    // Verify filter is active
    await expect(comfyBtn).toHaveAttribute('aria-pressed', 'true');

    // Verify cards are filtered (count may be same or less)
    const filteredCount = await page.locator('[data-testid="gallery-card"]').count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
    expect(filteredCount).toBeGreaterThan(0);
  }
});

test('gallery search filters items @gallery', async ({ page }) => {
  await page.goto('/gallery.html');
  await page.waitForFunction(() => window.__galleryReady === true, { timeout: 5000 });

  const initialCount = await page.locator('[data-testid="gallery-card"]').count();

  // Type in search box
  const searchBox = page.locator('#search');
  await searchBox.fill('Blender');

  // Wait a bit for filtering
  await page.waitForTimeout(200);

  const filteredCount = await page.locator('[data-testid="gallery-card"]').count();

  // Should have filtered results (at least one Blender item exists)
  expect(filteredCount).toBeLessThanOrEqual(initialCount);

  // Clear search
  await searchBox.clear();
  await page.waitForTimeout(200);

  const clearedCount = await page.locator('[data-testid="gallery-card"]').count();
  expect(clearedCount).toBe(initialCount);
});

test('gallery workflow details are present @gallery', async ({ page }) => {
  await page.goto('/gallery.html');
  await page.waitForFunction(() => window.__galleryReady === true, { timeout: 5000 });

  // Find first card with workflow
  const workflowDetails = page.locator('[data-testid="gallery-card"] .workflow').first();
  await expect(workflowDetails).toBeVisible();

  // Verify summary exists
  const summary = workflowDetails.locator('summary');
  await expect(summary).toBeVisible();

  // Open workflow
  await summary.click();

  // Verify steps are present
  const steps = workflowDetails.locator('.steps li');
  const stepCount = await steps.count();
  expect(stepCount).toBeGreaterThan(0);
});
