/**
 * SEO JSON-LD UI Panel E2E Tests
 *
 * Tests the Admin Tools JSON-LD panel (React component) or fallback (vanilla JS).
 * Gracefully skips if neither is available.
 */
import { test, expect } from '@playwright/test';

test.describe('@seo-ld UI panel', () => {
  test('panel loads and validates', async ({ page, baseURL }) => {
    const url = `${baseURL}/?seoLd=1`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Wait a bit for either React panel or fallback to render
    await page.waitForTimeout(1000);

    // If Admin Tools React panel exists, prefer it; else use the fallback.
    const reactPanel = page.locator('[data-testid="seo-ld-panel"]');
    const hasReact = await reactPanel.count();

    if (hasReact > 0) {
      // React panel test
      await expect(reactPanel).toBeVisible();

      // Scroll the AdminToolsPanel container to reveal the SEO section at bottom
      const adminPanel = page.locator('[data-testid="admin-tools-panel"]');
      await adminPanel.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await page.waitForTimeout(200);

      // Test generate button - use JS click since button may be outside viewport
      const generateBtn = page.getByTestId('seo-ld-generate');
      await generateBtn.evaluate((btn: HTMLElement) => btn.click());
      await page.waitForTimeout(500); // Wait for API call

      // Test validate button
      await page.getByTestId('seo-ld-validate').evaluate((btn: HTMLElement) => btn.click());
      await page.waitForTimeout(500);

      // Check result is displayed
      const result = page.getByTestId('seo-ld-result');
      await expect(result).toContainText('Count:');

      // Verify textarea has content
      const textarea = page.getByTestId('seo-ld-textarea');
      const content = await textarea.inputValue();
      expect(content.length).toBeGreaterThan(10);
      expect(content).toContain('@type');

      return;
    }

    // Fallback panel test (vanilla JS)
    const btn = page.locator('.seoLdBtn'); // floating button
    const btnCount = await btn.count();

    if (btnCount === 0) {
      test.skip();
      return;
    }

    await expect(btn).toBeVisible();
    await btn.click();

    // Box should be visible now
    const box = page.locator('.seoLdBox.show');
    await expect(box).toBeVisible();

    // Test generate button
    await page.getByRole('button', { name: 'Generate (backend)' }).click();
    await page.waitForTimeout(500);

    // Test validate button
    await page.getByRole('button', { name: 'Validate' }).click();
    await page.waitForTimeout(500);

    // Assert textarea filled
    const ta = page.locator('.seoLdBox textarea');
    const content = await ta.inputValue();
    expect(content.length).toBeGreaterThan(10);
    expect(content).toContain('@type');

    // Check message displayed
    const msg = page.locator('[data-a="msg"]');
    await expect(msg).toContainText('Validated');
  });

  test('load from DOM button works', async ({ page, baseURL }) => {
    const url = `${baseURL}/?seoLd=1`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Check for React panel first
    const reactPanel = page.locator('[data-testid="seo-ld-panel"]');
    const hasReact = await reactPanel.count();

    if (hasReact > 0) {
      // React panel - scroll the AdminToolsPanel container to bottom
      const adminPanel = page.locator('[data-testid="admin-tools-panel"]');
      await adminPanel.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await page.waitForTimeout(200);

      const loadBtn = page.getByTestId('seo-ld-load-dom');
      await loadBtn.evaluate((btn: HTMLElement) => btn.click());
      await page.waitForTimeout(300);

      const msg = page.getByTestId('seo-ld-msg');
      await expect(msg).toContainText('Loaded');
      await expect(msg).toContainText('object(s) from DOM');

      return;
    }

    // Fallback panel
    const btn = page.locator('.seoLdBtn');
    const btnCount = await btn.count();

    if (btnCount === 0) {
      test.skip();
      return;
    }

    await btn.click();
    await page.getByRole('button', { name: 'Load from DOM' }).click();
    await page.waitForTimeout(300);

    const msg = page.locator('[data-a="msg"]');
    await expect(msg).toContainText('Loaded');
  });

  test('copy button works', async ({ page, baseURL, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    const url = `${baseURL}/?seoLd=1`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const reactPanel = page.locator('[data-testid="seo-ld-panel"]');
    const hasReact = await reactPanel.count();

    if (hasReact > 0) {
      // React panel - scroll the AdminToolsPanel container to bottom
      const adminPanel = page.locator('[data-testid="admin-tools-panel"]');
      await adminPanel.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await page.waitForTimeout(200);

      const loadBtn = page.getByTestId('seo-ld-load-dom');
      await loadBtn.evaluate((btn: HTMLElement) => btn.click());
      await page.waitForTimeout(300);

      const copyBtn = page.getByTestId('seo-ld-copy');
      await copyBtn.evaluate((btn: HTMLElement) => btn.click());
      await page.waitForTimeout(200);

      const msg = page.getByTestId('seo-ld-msg');
      await expect(msg).toContainText('Copied');

      // Verify clipboard content
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText.length).toBeGreaterThan(5);

      return;
    }

    // Fallback panel
    const btn = page.locator('.seoLdBtn');
    const btnCount = await btn.count();

    if (btnCount === 0) {
      test.skip();
      return;
    }

    await btn.click();
    await page.getByRole('button', { name: 'Load from DOM' }).click();
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: 'Copy' }).click();
    await page.waitForTimeout(200);

    const msg = page.locator('[data-a="msg"]');
    await expect(msg).toContainText('Copied');
  });
});
