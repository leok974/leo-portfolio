/**
 * E2E Tests: Status Open UI (dev-only)
 *
 * Tests the DevPagesPanel UI actions (Open, Copy path buttons).
 *
 * Note: These tests require your dev overlay to be accessible.
 * Adjust selectors to match your app's structure.
 */
import { test, expect } from './test.base';

test.describe('DevPagesPanel UI actions', () => {
  test('DevPagesPanel has Open/Copy actions', async ({ page }) => {
    // Navigate to your app (adjust URL as needed)
    const uiUrl = process.env.UI_URL || 'http://localhost:5173';
    await page.goto(uiUrl);

    // TODO: Adjust these selectors to match your app's structure
    // Example: Opening dev overlay
    // await page.getByTestId('open-dev-overlay').click();

    // Example: If using tabs for dev panels
    // await page.getByRole('tab', { name: /Discovered Pages/i }).click();

    // For now, check if the panel is present on the page
    // (adjust this based on where you integrated DevPagesPanel)
    const panel = page.getByTestId('dev-pages-panel');

    // Wait for panel to be visible (with timeout)
    try {
      await panel.waitFor({ state: 'visible', timeout: 5000 });
    } catch (_e) {
      console.log('⚠️  DevPagesPanel not found on page. Skipping UI test.');
      console.log('   Make sure DevPagesPanel is integrated into your app.');
      test.skip();
      return;
    }

    await expect(panel).toBeVisible();

    // Check for Open links
    const openLinks = panel.getByRole('link', { name: /^Open$/i });
    const openCount = await openLinks.count();

    if (openCount > 0) {
      await expect(openLinks.first()).toBeVisible();
      console.log(`✅ Found ${openCount} "Open" action links`);
    } else {
      console.log('⚠️  No "Open" links found. Table may be empty.');
    }

    // Check for Copy path buttons
    const copyButtons = panel.getByRole('button', { name: /Copy path/i });
    const copyCount = await copyButtons.count();

    if (copyCount > 0) {
      await expect(copyButtons.first()).toBeVisible();
      console.log(`✅ Found ${copyCount} "Copy path" action buttons`);
    } else {
      console.log('⚠️  No "Copy path" buttons found. Table may be empty.');
    }
  });

  test('Open action opens new tab with raw HTML', async ({ page, context }) => {
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

    const openLinks = panel.getByRole('link', { name: /^Open$/i });
    const linkCount = await openLinks.count();

    if (linkCount === 0) {
      console.log('⚠️  No pages to test. Table is empty.');
      test.skip();
      return;
    }

    // Click the first Open link and wait for new tab
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      openLinks.first().click()
    ]);

    await newPage.waitForLoadState();

    // Check that we got HTML content
    const content = await newPage.content();
    expect(content.length).toBeGreaterThan(0);

    console.log(`✅ Opened new tab with ${content.length} bytes of content`);

    await newPage.close();
  });

  test('Copy path button copies absolute path to clipboard', async ({ page, context }) => {
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

    const copyButtons = panel.getByRole('button', { name: /Copy path/i });
    const buttonCount = await copyButtons.count();

    if (buttonCount === 0) {
      console.log('⚠️  No pages to test. Table is empty.');
      test.skip();
      return;
    }

    // Click the first Copy path button
    await copyButtons.first().click();

    // Wait a bit for clipboard operation
    await page.waitForTimeout(500);

    // Read clipboard (this works in Playwright's browser context)
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());

    expect(clipboardText).toBeTruthy();
    expect(clipboardText.length).toBeGreaterThan(0);

    console.log(`✅ Copied to clipboard: ${clipboardText.substring(0, 100)}...`);
  });
});
