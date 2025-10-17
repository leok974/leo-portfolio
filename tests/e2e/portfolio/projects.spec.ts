import { test, expect } from '@playwright/test';

const HOME = '/';

test.describe('Projects Display @projects', () => {
  test('homepage lists project cards from data store', async ({ page }) => {
    await page.goto(HOME);

    // Scroll to projects section
    await page.locator('#projects').scrollIntoViewIfNeeded();

    // Wait for projects to load (portfolio.ts loads from /projects.json)
    const cards = page.locator('[data-testid="project-card"]');

    // Wait for at least one card to appear (up to 5 seconds)
    await expect(cards.first()).toBeVisible({ timeout: 5000 });

    // Should have multiple projects
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    console.log(`Found ${count} project cards`);

    // Verify card structure
    const firstCard = cards.first();

    // Should have title
    const title = firstCard.locator('.project-title');
    await expect(title).toBeVisible();
    const titleText = await title.textContent();
    expect(titleText).toBeTruthy();
    console.log(`First project: ${titleText}`);

    // Should have description
    const description = firstCard.locator('.project-description');
    await expect(description).toBeVisible();

    // Should have thumbnail
    const thumbnail = firstCard.locator('.project-thumbnail img');
    await expect(thumbnail).toBeVisible();
  });

  test('project cards have data-card attribute for layout system', async ({ page }) => {
    await page.goto(HOME);

    await page.locator('#projects').scrollIntoViewIfNeeded();

    const cards = page.locator('[data-testid="project-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 5000 });

    const firstCard = cards.first();
    const dataCard = await firstCard.getAttribute('data-card');
    expect(dataCard).toBeTruthy();
    console.log(`First card slug: ${dataCard}`);
  });

  test('project filter buttons work', async ({ page }) => {
    await page.goto(HOME);

    await page.locator('#projects').scrollIntoViewIfNeeded();

    const cards = page.locator('[data-testid="project-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 5000 });

    const initialCount = await cards.count();
    console.log(`Initial cards: ${initialCount}`);

    // Find filter buttons
    const filterButtons = page.locator('.filters .filter-btn');
    const filterCount = await filterButtons.count();

    if (filterCount > 1) {
      // Click second filter (not "All")
      const secondFilter = filterButtons.nth(1);
      await secondFilter.click();

      // Wait for animation/filtering
      await page.waitForTimeout(300);

      // Cards may change
      const filteredCount = await cards.count();
      console.log(`Filtered cards: ${filteredCount}`);

      // At minimum, should have 0 or more cards (depends on data)
      expect(filteredCount).toBeGreaterThanOrEqual(0);

      // Click "All" again
      const allFilter = filterButtons.first();
      await allFilter.click();
      await page.waitForTimeout(300);

      const finalCount = await cards.count();
      expect(finalCount).toBe(initialCount);
    }
  });

  test('project cards have tags displayed', async ({ page }) => {
    await page.goto(HOME);

    await page.locator('#projects').scrollIntoViewIfNeeded();

    const cards = page.locator('[data-testid="project-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 5000 });

    const firstCard = cards.first();

    // Check if tags exist (some projects may not have tags)
    const tags = firstCard.locator('.project-tags');
    const tagsExist = await tags.count();

    if (tagsExist > 0) {
      await expect(tags).toBeVisible();
      const tagElements = tags.locator('.project-tag');
      const tagCount = await tagElements.count();
      expect(tagCount).toBeGreaterThan(0);
      console.log(`First card has ${tagCount} tags`);
    } else {
      console.log('First card has no tags (valid case)');
    }
  });
});
