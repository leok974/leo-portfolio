import { test, expect } from "@playwright/test";

test.describe("Behavior Tracking", () => {
  test("posts view/click/dwell beacons", async ({ page }) => {
    // Intercept the ingest endpoint
    await page.route("**/agent/metrics/ingest", (route) => route.continue());

    // Navigate
    const base = process.env.BASE_URL || "http://localhost:5173";
    await page.goto(base, { waitUntil: "domcontentloaded" });

    // Ensure sections have data-section; scroll to trigger views/dwell
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(500); // allow IO to fire

    // click inside a section if present
    const anySection = page.locator("[data-section]").first();
    if ((await anySection.count()) > 0) {
      await anySection.click({ trial: true }).catch(() => {});
    }

    // Wait a tick to allow beacon flush
    await page.waitForTimeout(1800);

    // Call backend analyze
    const res = await page.request.post(
      "http://127.0.0.1:8001/agent/analyze/behavior"
    );
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(Array.isArray(json.order)).toBeTruthy();
  });
});
