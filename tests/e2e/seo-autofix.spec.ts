import { test, expect } from "@playwright/test";

test.describe("SEO Autofix Verification", () => {
  test("index has canonical, description, and OG basics", async ({ page }) => {
    await page.goto("/");

    // Canonical URL
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toBeTruthy();
    expect(canonical).toContain("http");

    // Meta description
    const desc = await page.locator('meta[name="description"]').getAttribute("content");
    expect(desc).toBeTruthy();
    expect(desc).not.toBeNull();
    if (desc) {
      expect(desc.length).toBeGreaterThan(10);
    }

    // Open Graph image
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(ogImage).toBeTruthy();

    // Open Graph title
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute("content");
    expect(ogTitle).toBeTruthy();

    // Open Graph description
    const ogDesc = await page.locator('meta[property="og:description"]').getAttribute("content");
    expect(ogDesc).toBeTruthy();

    // Open Graph type
    const ogType = await page.locator('meta[property="og:type"]').getAttribute("content");
    expect(ogType).toBe("website");

    // Open Graph URL
    const ogUrl = await page.locator('meta[property="og:url"]').getAttribute("content");
    expect(ogUrl).toBeTruthy();

    // Twitter card
    const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute("content");
    expect(twitterCard).toBe("summary_large_image");
  });

  test("images have alt text", async ({ page }) => {
    await page.goto("/");

    const imgs = page.locator("img");
    const count = await imgs.count();

    if (count === 0) {
      test.skip();
    }

    for (let i = 0; i < count; i++) {
      const alt = await imgs.nth(i).getAttribute("alt");
      expect(alt, `Image ${i} should have alt text`).toBeTruthy();
      expect(alt?.length, `Image ${i} alt text should not be empty`).toBeGreaterThan(0);
    }
  });

  test("meta viewport is present", async ({ page }) => {
    await page.goto("/");

    const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(viewport).toBeTruthy();
    expect(viewport).toContain("width=device-width");
  });

  test("page has title", async ({ page }) => {
    await page.goto("/");

    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
    // Verify title exists and is reasonable (Google shows ~50-60 chars, but longer is OK)
    expect(title.length).toBeGreaterThanOrEqual(10);
    expect(title.length).toBeLessThanOrEqual(100); // Warn if > 100
  });
});
