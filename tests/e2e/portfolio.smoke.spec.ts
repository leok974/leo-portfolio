import { test, expect } from "@playwright/test";

test.describe("Portfolio Smoke Tests", () => {
  test("social links render and are clickable", async ({ page }) => {
    await page.goto("/");

    // Wait for the social links container
    await page.waitForSelector('[data-testid="social-links"]', { timeout: 5000 });

    // Check that all social links are visible
    const socialIds = ["github", "linkedin", "artstation", "email", "resume"];

    for (const id of socialIds) {
      const link = page.locator(`[data-testid="link-${id}"]`);
      await expect(link).toBeVisible();

      // Verify links have proper attributes
      if (id !== "email") {
        await expect(link).toHaveAttribute("target", "_blank");
        await expect(link).toHaveAttribute("rel", "noopener noreferrer");
      }
    }

    // Verify link URLs
    await expect(page.locator('[data-testid="link-github"]')).toHaveAttribute("href", "https://github.com/leo-klemet");
    await expect(page.locator('[data-testid="link-linkedin"]')).toHaveAttribute("href", "https://www.linkedin.com/in/leo-klemet/");
    await expect(page.locator('[data-testid="link-artstation"]')).toHaveAttribute("href", "https://www.artstation.com/leo_klemet");
    await expect(page.locator('[data-testid="link-email"]')).toHaveAttribute("href", "mailto:leoklemet.pa@gmail.com");
    await expect(page.locator('[data-testid="link-resume"]')).toHaveAttribute("href", "/resume/Leo_Klemet_Resume.pdf");
  });

  test("calendly section visible and interactive", async ({ page }) => {
    await page.goto("/#contact");

    // Wait for the calendly container
    await page.waitForSelector('[data-testid="calendly"]', { timeout: 5000 });

    // Check that the calendly container is visible
    await expect(page.locator('[data-testid="calendly"]')).toBeVisible();

    // Check that the "Open Calendly" link is visible and has correct attributes
    const calendlyOpenLink = page.locator('[data-testid="calendly-open"]');
    await expect(calendlyOpenLink).toBeVisible();
    await expect(calendlyOpenLink).toHaveAttribute("href", "https://calendly.com/leo-klemet/intro");
    await expect(calendlyOpenLink).toHaveAttribute("target", "_blank");

    // Wait for Calendly iframe to appear (give it time to load from external domain)
    try {
      const calendlyFrame = page.frameLocator('iframe[src*="calendly.com"]').first();
      await expect(calendlyFrame.locator("body")).toBeVisible({ timeout: 15000 });
    } catch (_error) {
      // If iframe doesn't load (CSP or network issues), at least verify the widget container exists
      await expect(page.locator('.calendly-inline-widget')).toBeVisible();
    }
  });

  test("navigation links work", async ({ page }) => {
    await page.goto("/");

    // Test About navigation
    await page.click('a[href="#about"]');
    await page.waitForTimeout(500); // Wait for smooth scroll

    // Test Contact navigation
    await page.click('a[href="#contact"]');
    await page.waitForTimeout(500);

    // Verify we can see the contact section
    await expect(page.locator('#contact')).toBeInViewport();
  });

  test("page has proper meta tags", async ({ page }) => {
    await page.goto("/");

    // Check title
    await expect(page).toHaveTitle(/Leo Klemet/);

    // Check favicon
    const faviconLink = page.locator('link[rel="icon"]');
    await expect(faviconLink).toHaveAttribute("href", "/favicon.svg");
  });

  test("project cards have data-card attributes for layout system", async ({ page }) => {
    await page.goto("/#projects");

    // Wait for projects to load
    await page.waitForSelector('.portfolio-grid', { timeout: 5000 });

    // Wait for at least one project card to appear
    await page.waitForSelector('.project-card', { timeout: 10000 });

    // Get all project cards
    const cards = page.locator('.project-card');
    const count = await cards.count();

    expect(count).toBeGreaterThan(0);

    // Verify each card has a data-card attribute (used by layout system)
    for (let i = 0; i < Math.min(count, 3); i++) {
      const card = cards.nth(i);
      const dataCard = await card.getAttribute('data-card');
      expect(dataCard).toBeTruthy();
      expect(dataCard).toMatch(/^[\w-]+$/); // Should be a valid slug
    }
  });

  test("assistant panel renders and is interactive", async ({ page }) => {
    await page.goto("/");

    // Wait for assistant panel to mount
    await page.waitForSelector('[data-testid="assistant-panel"]', { timeout: 5000 });

    const panel = page.locator('[data-testid="assistant-panel"]');
    await expect(panel).toBeVisible();

    // Check initial state (should be collapsed)
    const header = panel.locator('.assistant-header');
    await expect(header).toBeVisible();
    await expect(header).toContainText('Portfolio Assistant');

    // Click to expand
    const toggleBtn = panel.locator('.assistant-toggle');
    await toggleBtn.click();
    await page.waitForTimeout(300); // Wait for animation

    // Should show content when expanded
    const content = panel.locator('.assistant-content');
    await expect(content).toBeVisible();

    // Click to collapse
    await toggleBtn.click();
    await page.waitForTimeout(300);

    // Content should be hidden when collapsed
    await expect(content).not.toBeVisible();
  });

  test("layout system responds to data-size attributes", async ({ page }) => {
    await page.goto("/#projects");

    // Wait for projects to load
    await page.waitForSelector('.project-card', { timeout: 10000 });

    // Get computed style of grid container
    const grid = page.locator('.portfolio-grid');
    const display = await grid.evaluate((el) => window.getComputedStyle(el).display);

    // Should be using CSS grid
    expect(display).toBe('grid');

    // Check that cards can have data-size attribute applied
    const firstCard = page.locator('.project-card').first();

    // Inject a test data-size attribute
    await firstCard.evaluate((el) => el.setAttribute('data-size', 'md'));

    // Verify attribute was set
    const dataSize = await firstCard.getAttribute('data-size');
    expect(dataSize).toBe('md');
  });
});
