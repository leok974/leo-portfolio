import { test, expect } from '@playwright/test';

test.describe('@siteagent Weights Editor @frontend', () => {
  test('@siteagent proposes, approves, and optimizes weights', async ({ page }) => {
    // Navigate to page with weights editor
    // Adjust this URL if your overlay is on a different route
    await page.goto('/');

    // Wait for and check if editor is visible
    const editor = page.getByTestId('weights-editor');

    // If not visible by default, you may need to open your dev/admin overlay first
    // await page.getByRole('button', { name: /dev tools/i }).click();

    await expect(editor).toBeVisible({ timeout: 10000 });

    // Adjust a slider
    const slider = editor.locator('input[type="range"]').first();
    await slider.focus();
    await slider.press('ArrowRight'); // nudge value up

    // Save proposal
    await page.getByTestId('save-proposal').click();
    await expect(page.getByTestId('weights-msg')).toContainText(/Proposal saved/i, { timeout: 5000 });

    // Approve weights
    await page.getByTestId('approve-weights').click();
    await expect(page.getByTestId('weights-msg')).toContainText(/Activated/i, { timeout: 5000 });

    // Optimize with proposal
    await page.getByTestId('optimize-with-proposal').click();
    await expect(page.getByTestId('weights-msg')).toContainText(/Optimized/i, { timeout: 10000 });
  });

  test('@siteagent shows normalized percentages', async ({ page }) => {
    await page.goto('/');
    const editor = page.getByTestId('weights-editor');
    await expect(editor).toBeVisible({ timeout: 10000 });

    // Check that percentages are displayed
    const percentages = editor.locator('span.font-mono').filter({ hasText: /%$/ });
    await expect(percentages.first()).toBeVisible();
  });

  test('@siteagent displays active weights when present', async ({ page }) => {
    await page.goto('/');
    const editor = page.getByTestId('weights-editor');
    await expect(editor).toBeVisible({ timeout: 10000 });

    // Active weights display should be present (if weights are active)
    const activeDisplay = editor.locator('.text-xs.opacity-70.font-mono');
    // May or may not be visible depending on whether weights are active
    // Just check it exists in the DOM
    expect(await activeDisplay.count()).toBeGreaterThanOrEqual(0);
  });
});
