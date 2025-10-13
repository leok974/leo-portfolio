/**
 * @file tests/e2e/admin.panel.spec.ts
 * E2E tests for admin-gated controls in portfolio assistant panel.
 *
 * Validates:
 * - Admin controls hidden by default (normal visitors)
 * - Admin controls visible with dev override (?admin=1)
 * - Admin badge shows when admin enabled
 */

import { test, expect } from "@playwright/test";

const BASE = process.env.CI ? "http://127.0.0.1:8080" : "http://127.0.0.1:5174";

test.describe("Admin Panel Controls @frontend", () => {
  test.beforeEach(async ({ context }) => {
    // Clear admin override from localStorage before each test
    await context.clearCookies();
  });

  test("admin controls hidden by default for normal visitors", async ({ page }) => {
    await page.goto(BASE);

    // Assistant panel should be visible
    await expect(page.getByTestId("assistant-panel")).toBeVisible();

    // Admin badge should NOT be visible
    await expect(page.locator(".asst-badge-admin")).toHaveCount(0);

    // Admin buttons should NOT be visible
    await expect(page.getByTestId("btn-autotune")).toHaveCount(0);
    await expect(page.getByTestId("btn-reset")).toHaveCount(0);

    // Hide button (available to all users) should be visible
    await expect(page.locator("button:has-text('Hide')")).toBeVisible();
  });

  test("admin controls visible with dev override (?admin=1)", async ({ page }) => {
    // Enable admin mode via query param
    await page.goto(`${BASE}/?admin=1`);

    // Wait for admin init to process
    await page.waitForTimeout(100);

    // Reload clean (admin should persist in localStorage)
    await page.goto(BASE);

    // Wait for admin check to complete
    await page.waitForTimeout(500);

    // Assistant panel should be visible
    await expect(page.getByTestId("assistant-panel")).toBeVisible();

    // Admin badge SHOULD be visible
    await expect(page.locator(".asst-badge-admin")).toBeVisible();
    await expect(page.locator(".asst-badge-admin")).toHaveText("admin");

    // Admin buttons SHOULD be visible
    await expect(page.getByTestId("btn-autotune")).toBeVisible();
    await expect(page.getByTestId("btn-reset")).toBeVisible();

    // Hide button should still be visible
    await expect(page.locator("button:has-text('Hide')")).toBeVisible();
  });

  test("admin override disabled with ?admin=0", async ({ page }) => {
    // First enable admin
    await page.goto(`${BASE}/?admin=1`);
    await page.waitForTimeout(100);

    // Then disable it
    await page.goto(`${BASE}/?admin=0`);
    await page.waitForTimeout(100);

    // Reload clean
    await page.goto(BASE);
    await page.waitForTimeout(500);

    // Admin controls should NOT be visible
    await expect(page.locator(".asst-badge-admin")).toHaveCount(0);
    await expect(page.getByTestId("btn-autotune")).toHaveCount(0);
    await expect(page.getByTestId("btn-reset")).toHaveCount(0);
  });

  test("admin badge has proper styling", async ({ page }) => {
    // Enable admin mode
    await page.goto(`${BASE}/?admin=1`);
    await page.waitForTimeout(100);
    await page.goto(BASE);
    await page.waitForTimeout(500);

    const badge = page.locator(".asst-badge-admin");
    await expect(badge).toBeVisible();

    // Check computed styles
    const styles = await badge.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        fontSize: computed.fontSize,
        borderRadius: computed.borderRadius,
        color: computed.color,
        display: computed.display,
      };
    });

    // Validate badge styles (11px font, pill shape, inline-block or block)
    expect(styles.fontSize).toMatch(/11px/);
    expect(styles.borderRadius).toMatch(/999px/);
    expect(styles.display).toMatch(/^(inline-block|block)$/); // Both work for badges
    // Color is rgb format: #a7f3d0 ≈ rgb(167, 243, 208)
    expect(styles.color).toMatch(/rgb.*167.*243.*208/);
  });
});
