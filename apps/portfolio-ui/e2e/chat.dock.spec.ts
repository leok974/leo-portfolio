import { test, expect } from '@playwright/test';

const HOME = '/';

test.describe('Chat dock @ui', () => {
  test('collapse/expand + persistence via localStorage', async ({ page }) => {
    await page.goto(HOME);

    const dock = page.getByTestId('chat-dock');
    const toggle = page.getByTestId('dock-toggle');
    const tab = page.getByTestId('dock-tab');

    // Initially expanded
    await expect(dock).toBeVisible();
    await expect(toggle).toBeVisible();

    // Collapse
    await toggle.click();
    await expect(dock).toHaveClass(/collapsed/);
    await expect(tab).toBeVisible();

    // Reload — should stay collapsed (persisted in localStorage)
    await page.reload();
    await expect(dock).toHaveClass(/collapsed/);
    await expect(tab).toBeVisible();

    // Expand via tab
    await tab.click();
    await expect(dock).not.toHaveClass(/collapsed/);

    // Verify localStorage flag
    const flag = await page.evaluate(() => localStorage.getItem('chatDock:collapsed'));
    expect(flag).toBe('0');
  });

  test('keyboard shortcuts: C to toggle, Escape to collapse', async ({ page }) => {
    await page.goto(HOME);

    const dock = page.getByTestId('chat-dock');

    // Press C to collapse
    await page.keyboard.press('c');
    await expect(dock).toHaveClass(/collapsed/);

    // Press C to expand
    await page.keyboard.press('c');
    await expect(dock).not.toHaveClass(/collapsed/);

    // Press Escape to collapse
    await page.keyboard.press('Escape');
    await expect(dock).toHaveClass(/collapsed/);
  });

  test('C shortcut does not fire when typing in input', async ({ page }) => {
    await page.goto(HOME);

    const dock = page.getByTestId('chat-dock');
    const textarea = page.locator('.asst-compose textarea');

    // Ensure expanded
    await expect(dock).not.toHaveClass(/collapsed/);

    // Focus textarea and type 'c'
    await textarea.click();
    await textarea.fill('c');

    // Dock should still be expanded (C should not toggle when in input)
    await expect(dock).not.toHaveClass(/collapsed/);
    await expect(textarea).toHaveValue('c');
  });
});

test.describe('Layout section gating @features', () => {
  test('hidden when layout=0 (override off)', async ({ page }) => {
    await page.goto(`${HOME}?layout=0`);
    await expect(page.getByTestId('layout-section')).toHaveCount(0);
  });

  test('visible when layout=1 (enabled)', async ({ page }) => {
    await page.goto(`${HOME}?layout=1`);
    const section = page.getByTestId('layout-section');
    await expect(section).toBeVisible();

    // Ensure we don't show the "off/not learned" copy when enabled
    await expect(section).not.toContainText(/off or not learned yet/i);
  });

  test('shows friendly loading message when no layout data', async ({ page }) => {
    await page.goto(`${HOME}?layout=1`);
    const section = page.getByTestId('layout-section');
    
    // Should show loading message, not error
    await expect(section).toContainText(/Loading layout model/i);
  });
});
