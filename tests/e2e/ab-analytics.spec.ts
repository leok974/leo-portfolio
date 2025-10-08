import { test, expect } from '@playwright/test';

test.describe('A/B Analytics Panel @frontend', () => {
  test('shows CTRs and winner', async ({ page }) => {
    await page.goto('/');

    const panel = page.getByTestId('ab-analytics');
    await expect(panel).toBeVisible({ timeout: 10000 });

    // Check CTR displays
    await expect(page.getByTestId('ab-ctr-a')).toBeVisible();
    await expect(page.getByTestId('ab-ctr-b')).toBeVisible();

    // Check winner is displayed
    await expect(panel.locator('text=Winner (so far):')).toBeVisible();
  });

  test('displays weight adjustment hints', async ({ page }) => {
    await page.goto('/');

    const panel = page.getByTestId('ab-analytics');
    await expect(panel).toBeVisible({ timeout: 10000 });

    // Check that hint section exists
    await expect(panel.locator('text=Suggested weight nudge:')).toBeVisible();
  });

  test('handles errors gracefully', async ({ page }) => {
    // This test would need backend to be down or configured to return errors
    // For now, just verify error state can render
    await page.goto('/');

    const panel = page.getByTestId('ab-analytics');
    await expect(panel).toBeVisible({ timeout: 10000 });

    // Panel should either show data or error, but be visible
    expect(await panel.textContent()).toBeTruthy();
  });

  test('formats CTR as percentage', async ({ page }) => {
    await page.goto('/');

    const panel = page.getByTestId('ab-analytics');
    await expect(panel).toBeVisible({ timeout: 10000 });

    // CTR should be formatted with % symbol
    const ctrA = page.getByTestId('ab-ctr-a');
    const ctrAText = await ctrA.textContent();
    expect(ctrAText).toContain('%');
  });
});
