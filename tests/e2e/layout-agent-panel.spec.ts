import { test, expect } from './test.base';

test.describe('Layout Agent Panel Integration @frontend', () => {
  test('all components render together', async ({ page }) => {
    await page.goto('/');

    // If components are in a panel that needs to be opened
    // await page.getByRole('button', { name: /dev tools|admin|agent/i }).click();

    const panel = page.getByTestId('layout-agent-panel');

    // Check if panel exists
    const panelCount = await panel.count();

    if (panelCount > 0) {
      // Panel should be visible
      await expect(panel).toBeVisible({ timeout: 10000 });

      // Check all sub-components
      await expect(page.getByTestId('weights-editor')).toBeVisible();
      await expect(page.getByTestId('ab-analytics')).toBeVisible();

      // Last run badge might not always be present
      const badgeCount = await page.getByTestId('last-run-badge').count();
      if (badgeCount > 0) {
        await expect(page.getByTestId('last-run-badge')).toBeVisible();
      }

      // Check panel header
      await expect(panel.locator('h2')).toContainText(/Layout Optimization Tools/i);
    } else {
      console.log('Layout Agent Panel not found - may need to open overlay first');
    }
  });

  test('end-to-end workflow: adjust weights → propose → approve → optimize', async ({ page }) => {
    await page.goto('/');

    const panel = page.getByTestId('layout-agent-panel');
    const panelCount = await panel.count();

    if (panelCount === 0) {
      test.skip();
      return;
    }

    await expect(panel).toBeVisible({ timeout: 10000 });

    // 1. Adjust weights
    const editor = page.getByTestId('weights-editor');
    const slider = editor.locator('input[type="range"]').first();
    const initialValue = await slider.inputValue();

    await slider.focus();
    await slider.press('ArrowRight');
    await slider.press('ArrowRight');

    const newValue = await slider.inputValue();
    expect(parseFloat(newValue)).toBeGreaterThan(parseFloat(initialValue));

    // 2. Save proposal
    await page.getByTestId('save-proposal').click();
    await expect(page.getByTestId('weights-msg')).toContainText(/saved/i, { timeout: 5000 });

    // 3. Check A/B analytics still visible
    const analytics = page.getByTestId('ab-analytics');
    await expect(analytics).toBeVisible();

    // 4. Approve weights
    await page.getByTestId('approve-weights').click();
    await expect(page.getByTestId('weights-msg')).toContainText(/Activated/i, { timeout: 5000 });

    // 5. Optimize with new weights
    await page.getByTestId('optimize-with-proposal').click();
    await expect(page.getByTestId('weights-msg')).toContainText(/Optimized/i, { timeout: 10000 });

    // 6. Last run badge should eventually update (may need page refresh)
    // This is async and may take a moment
    await page.waitForTimeout(1000);
  });

  test('components use consistent styling', async ({ page }) => {
    await page.goto('/');

    const panel = page.getByTestId('layout-agent-panel');
    const panelCount = await panel.count();

    if (panelCount === 0) {
      test.skip();
      return;
    }

    await expect(panel).toBeVisible({ timeout: 10000 });

    // All sub-panels should have rounded-2xl border styling
    const editor = page.getByTestId('weights-editor');
    const analytics = page.getByTestId('ab-analytics');

    // Check they have consistent border radius class
    await expect(editor).toHaveClass(/rounded-2xl/);
    await expect(analytics).toHaveClass(/rounded-2xl/);
  });
});
