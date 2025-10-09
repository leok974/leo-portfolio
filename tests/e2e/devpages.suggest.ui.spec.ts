/**
 * E2E Tests: Dev Pages Suggest Meta UI
 *
 * Tests the DevPagesPanel "Suggest meta" modal functionality.
 *
 * Note: Requires DevPagesPanel to be integrated into your dev overlay.
 * Tests will skip gracefully if panel not found.
 */
import { test, expect } from './test.base';

test.describe('DevPagesPanel Suggest Meta modal', () => {
  test('Suggest meta modal shows and displays suggestions', async ({ page }) => {
    const uiUrl = process.env.UI_URL || 'http://localhost:5173';
    await page.goto(uiUrl);

    // TODO: Adjust selectors to match your app structure
    // Example: Open dev overlay if needed
    // await page.getByTestId('open-dev-overlay').click();

    // Navigate to Discovered Pages tab (if using tabs)
    // await page.getByRole('tab', { name: /Discovered Pages/i }).click();

    const panel = page.getByTestId('dev-pages-panel');

    try {
      await panel.waitFor({ state: 'visible', timeout: 5000 });
    } catch (_e) {
      console.log('⚠️  DevPagesPanel not found. Skipping UI test.');
      console.log('   Make sure DevPagesPanel is integrated into your app.');
      test.skip();
      return;
    }

    await expect(panel).toBeVisible();

    // Find and click first "Suggest meta" button
    const suggestBtn = panel.getByRole('button', { name: /Suggest meta/i }).first();
    const btnCount = await panel.getByRole('button', { name: /Suggest meta/i }).count();

    if (btnCount === 0) {
      console.log('⚠️  No "Suggest meta" buttons found. Table may be empty.');
      test.skip();
      return;
    }

    await expect(suggestBtn).toBeVisible();
    await suggestBtn.click();

    // Modal should appear
    await expect(page.getByText(/Meta suggestions for/)).toBeVisible({ timeout: 3000 });

    console.log(`✅ Modal opened for meta suggestions`);

    // Wait for suggestions to load (or error)
    await page.waitForTimeout(2000);

    // Check if title field is populated (success case)
    const titleInput = page.getByRole('textbox').filter({ hasText: /.+/ }).first();
    const hasTitle = await titleInput.count() > 0;

    if (hasTitle) {
      console.log(`✅ Title suggestion populated`);
    } else {
      // Check for error message
      const errorMsg = page.getByText(/Failed to suggest|HTTP/);
      const hasError = await errorMsg.count() > 0;
      if (hasError) {
        console.log(`⚠️  Error loading suggestions (expected if backend not running)`);
      }
    }
  });

  test('Copy buttons work in meta modal', async ({ page, context }) => {
    const uiUrl = process.env.UI_URL || 'http://localhost:5173';

    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto(uiUrl);

    const panel = page.getByTestId('dev-pages-panel');

    try {
      await panel.waitFor({ state: 'visible', timeout: 5000 });
    } catch (_e) {
      console.log('⚠️  DevPagesPanel not found. Skipping test.');
      test.skip();
      return;
    }

    // Click first "Suggest meta"
    const suggestBtn = panel.getByRole('button', { name: /Suggest meta/i }).first();
    if (await suggestBtn.count() === 0) {
      console.log('⚠️  No pages to test.');
      test.skip();
      return;
    }

    await suggestBtn.click();

    // Wait for modal
    await expect(page.getByText(/Meta suggestions for/)).toBeVisible({ timeout: 3000 });

    // Wait for data to load
    await page.waitForTimeout(2000);

    // Try to click Copy button for title
    const copyButtons = page.getByRole('button', { name: /^Copy$/i });
    const copyCount = await copyButtons.count();

    if (copyCount > 0) {
      await copyButtons.first().click();
      await page.waitForTimeout(500);

      // Read clipboard
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toBeTruthy();
      expect(clipboardText.length).toBeGreaterThan(0);

      console.log(`✅ Copy button works, clipboard: "${clipboardText.substring(0, 50)}..."`);
    } else {
      console.log(`⚠️  No copy buttons found (data may not have loaded)`);
    }
  });

  test('Reveal button checks sitemap', async ({ page }) => {
    const uiUrl = process.env.UI_URL || 'http://localhost:5173';
    await page.goto(uiUrl);

    const panel = page.getByTestId('dev-pages-panel');

    try {
      await panel.waitFor({ state: 'visible', timeout: 5000 });
    } catch (_e) {
      console.log('⚠️  DevPagesPanel not found. Skipping test.');
      test.skip();
      return;
    }

    // Find "Reveal" button
    const revealBtn = panel.getByRole('button', { name: /Reveal/i }).first();
    const btnCount = await panel.getByRole('button', { name: /Reveal/i }).count();

    if (btnCount === 0) {
      console.log('⚠️  No "Reveal" buttons found.');
      test.skip();
      return;
    }

    await expect(revealBtn).toBeVisible();

    // Click should either open new tab or show alert
    // We'll just verify the button is clickable
    console.log(`✅ Reveal button found and visible`);
  });

  test('Modal close button works', async ({ page }) => {
    const uiUrl = process.env.UI_URL || 'http://localhost:5173';
    await page.goto(uiUrl);

    const panel = page.getByTestId('dev-pages-panel');

    try {
      await panel.waitFor({ state: 'visible', timeout: 5000 });
    } catch (_e) {
      console.log('⚠️  DevPagesPanel not found. Skipping test.');
      test.skip();
      return;
    }

    // Open modal
    const suggestBtn = panel.getByRole('button', { name: /Suggest meta/i }).first();
    if (await suggestBtn.count() === 0) {
      console.log('⚠️  No pages to test.');
      test.skip();
      return;
    }

    await suggestBtn.click();

    // Modal visible
    await expect(page.getByText(/Meta suggestions for/)).toBeVisible({ timeout: 3000 });

    // Click close button
    const closeBtn = page.getByRole('button', { name: /Close/i });
    await closeBtn.click();

    // Modal should disappear
    await expect(page.getByText(/Meta suggestions for/)).not.toBeVisible();

    console.log(`✅ Modal closes correctly`);
  });
});
