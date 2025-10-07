/**
 * E2E Test: AB Winner Highlighting
 * @tags @frontend @phase50.2 @analytics
 */
import { test, expect } from "@playwright/test";

test.describe("AB Winner Bold Highlighting", () => {
  test("should bold the winner CTR and dim the loser", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    // Wait for AB analytics panel to load
    await page.waitForSelector('[data-testid="ab-analytics"]', { timeout: 5000 });

    // Get both CTR elements
    const ctrA = page.locator('[data-testid="ab-ctr-a"]');
    const ctrB = page.locator('[data-testid="ab-ctr-b"]');

    await expect(ctrA).toBeVisible();
    await expect(ctrB).toBeVisible();

    // Check which one is bold (winner)
    const aClasses = await ctrA.getAttribute("class") || "";
    const bClasses = await ctrB.getAttribute("class") || "";

    const aIsBold = aClasses.includes("font-bold");
    const bIsBold = bClasses.includes("font-bold");

    // Exactly one should be bold
    expect(aIsBold || bIsBold).toBe(true);
    expect(aIsBold && bIsBold).toBe(false);

    // The non-bold one should be dimmed
    if (aIsBold) {
      expect(bClasses).toContain("opacity-75");
    } else {
      expect(aClasses).toContain("opacity-75");
    }
  });

  test("should display winner indicator in summary", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    await page.waitForSelector('[data-testid="ab-analytics"]', { timeout: 5000 });

    // Check for "Better: A" or "Better: B" text
    const panel = page.locator('[data-testid="ab-analytics"]');
    const text = await panel.textContent();

    expect(text).toMatch(/Better:\s*(A|B)/);
  });

  test("should show suggested nudge value", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    await page.waitForSelector('[data-testid="ab-analytics"]', { timeout: 5000 });

    const panel = page.locator('[data-testid="ab-analytics"]');
    const text = await panel.textContent();

    // Should show "Suggested nudge: ±X.XX"
    expect(text).toMatch(/Suggested nudge:\s*[±+-]\d+\.\d+/);
  });
});
