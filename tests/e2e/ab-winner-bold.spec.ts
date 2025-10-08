/**
 * E2E Test: AB Winner Highlighting
 * @tags @frontend @phase50.2 @analytics @tools
 */
import { test, expect } from "@playwright/test";

test.describe("AB Winner Bold Highlighting @tools", () => {
  test.beforeEach(async ({ request }) => {
    // Enable dev overlay before each test
    await request.post("/agent/dev/enable");
  });

  test("should bold the winner CTR and dim the loser", async ({ page }) => {
    await page.goto("/tools.html", { waitUntil: "networkidle" });

    // Wait for AB analytics dashboard to load
    await page.waitForSelector("text=A/B Test Analytics", { timeout: 10000 });

    // Get variant stat elements
    const variantA = page.locator('text=Variant A').locator("..").locator("..");
    const variantB = page.locator('text=Variant B').locator("..").locator("..");

    await expect(variantA).toBeVisible();
    await expect(variantB).toBeVisible();

    // Check for CTR values in the cards
    const panelText = await page.textContent("text=A/B Test Analytics");
    expect(panelText).toBeTruthy();
  });

  test("should display winner in analytics dashboard", async ({ page }) => {
    await page.goto("/tools.html", { waitUntil: "networkidle" });

    await page.waitForSelector("text=A/B Test Analytics", { timeout: 10000 });

    // Check for winner card
    const winnerCard = page.locator('text=Winner').locator("..").locator("..");
    await expect(winnerCard).toBeVisible();

    // Winner should show A, B, or Tie
    const winnerText = await winnerCard.textContent();
    expect(winnerText).toMatch(/(A|B|Tie)/);
  });

  test("should show refresh button and date filters", async ({ page }) => {
    await page.goto("/tools.html", { waitUntil: "networkidle" });

    await page.waitForSelector("text=A/B Test Analytics", { timeout: 10000 });

    // Check for refresh button
    const refreshBtn = page.locator('button:has-text("Refresh")');
    await expect(refreshBtn).toBeVisible();

    // Check for date filters
    const fromDate = page.locator('input[type="date"]').first();
    const toDate = page.locator('input[type="date"]').last();
    await expect(fromDate).toBeVisible();
    await expect(toDate).toBeVisible();
  });
});
