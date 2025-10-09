import { test, expect, Page } from "@playwright/test";

async function enablePrivileged(page: Page) {
  // Enable dev overlay using the backend endpoint
  await page.goto(process.env.BASE_URL || "http://localhost:5173");
  await page.request.post("http://127.0.0.1:8001/agent/dev/enable");
}

test.describe("Privileged Metrics Panel", () => {
  test("shows Behavior Metrics only when privileged is enabled", async ({
    page,
  }) => {
    const base = process.env.BASE_URL || "http://localhost:5173";

    // First load without enabling - navigate to admin panel if it exists
    await page.goto(base, { waitUntil: "domcontentloaded" });

    // Check if iframe is not present initially (or restricted message is shown)
    const iframeCount = await page.locator('iframe[title="Behavior Metrics"]').count();
    const restrictedMsg = await page.locator('text=Restricted').count();
    
    // Either no iframe OR restricted message should be shown
    expect(iframeCount === 0 || restrictedMsg > 0).toBeTruthy();

    // Now enable and reload
    await enablePrivileged(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    // Wait for privileged content to load
    await page.waitForTimeout(1000);

    // After enabling, iframe should be present
    await expect(
      page.locator('iframe[title="Behavior Metrics"]')
    ).toBeVisible();
  });
});
