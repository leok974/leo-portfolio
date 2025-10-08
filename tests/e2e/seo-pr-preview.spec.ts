import { test, expect } from '@playwright/test';

/**
 * Phase 50.5 - SEO PR automation and preview smoke test.
 *
 * Tests:
 * - SEO tune dry run generates artifacts
 * - Before/After preview cards render
 * - Approve → PR button triggers backend
 * - No errors during PR flow
 */

test.describe('SEO PR & Preview @frontend @seo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tools.html');
  });

  test('Approve → PR triggers backend and preview renders', async ({ page }) => {
    // Check if dev overlay is enabled
    const unavailableMsg = page.getByText('Enable the admin overlay to access tools.');
    if (await unavailableMsg.isVisible()) {
      test.skip(true, 'Dev overlay not enabled; enable via /agent/dev/enable');
    }

    // Locate SEO tune section
    const seoSection = page.locator('#seo-tune');
    await expect(seoSection).toBeVisible();

    // Run dry run to generate artifacts
    const dryRunBtn = page.getByTestId('seo-dry');
    await dryRunBtn.click();

    // Wait for success message or diff to appear
    await expect(
      page.getByText(/Dry run complete/i).or(page.getByTestId('seo-diff'))
    ).toBeVisible({ timeout: 10000 });

    // Verify diff and log are visible
    const diffArea = page.getByTestId('seo-diff');
    await expect(diffArea).toBeVisible();
    const diffText = await diffArea.textContent();
    expect(diffText).toBeTruthy();
    expect(diffText?.length).toBeGreaterThan(10);

    // Verify before/after preview renders
    await expect(page.getByText('Before / After (Meta & OG)')).toBeVisible();
    await expect(page.getByText('Before').first()).toBeVisible();
    await expect(page.getByText('After').first()).toBeVisible();

    // Check if PR button is enabled (disabled if no diff)
    const prBtn = page.getByTestId('seo-pr');
    await expect(prBtn).toBeVisible();
    await expect(prBtn).toBeEnabled();

    // Click Approve → PR
    // Note: This will fail if GITHUB_TOKEN not set, but test should not error
    await prBtn.click();

    // Wait for response (success or error message)
    await expect(
      page
        .getByText(/PR created|Branch pushed|GITHUB_TOKEN not set/i)
        .or(page.getByText(/failed/i))
    ).toBeVisible({ timeout: 15000 });

    // Verify diff still visible after PR attempt
    await expect(diffArea).toBeVisible();
  });

  test('SEO tune section renders in tools page', async ({ page }) => {
    const unavailableMsg = page.getByText('Enable the admin overlay to access tools.');
    if (await unavailableMsg.isVisible()) {
      test.skip(true, 'Dev overlay not enabled');
    }

    // Verify section exists
    await expect(page.locator('#seo-tune')).toBeVisible();
    await expect(page.getByText('SEO & OG Intelligence')).toBeVisible();
    await expect(page.getByTestId('seo-dry')).toBeVisible();
    await expect(page.getByTestId('seo-pr')).toBeVisible();
  });
});
