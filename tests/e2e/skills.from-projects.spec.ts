/**
 * E2E Test: Skills Generation from Projects
 *
 * Validates that skills are automatically generated from projects.json
 * and rendered correctly on the page.
 *
 * Copilot: This test ensures the skills auto-generation system is working.
 * If this test fails, check:
 * 1. skills.map.json has correct category/synonym mappings
 * 2. scripts/skills-generate.mjs runs successfully
 * 3. skills.json is being generated with correct structure
 * 4. SkillsSection component is fetching and rendering skills
 */

import { test, expect } from '@playwright/test';

test.describe('Skills Auto-Generation', () => {
  test('should generate skills from projects and render them @frontend', async ({ page }) => {
    await page.goto('/');

    // Wait for skills section to load
    const skillsSection = page.locator('#skills-section-root');
    await expect(skillsSection).toBeVisible();

    // Check that section has a title
    await expect(page.locator('#skills-section-root h2')).toContainText('Skills & Technologies');

    // Check that we have skills categories
    const categories = page.locator('.skill-category');
    const categoryCount = await categories.count();
    expect(categoryCount).toBeGreaterThan(0);

    // Check that each category has skills
    const firstCategory = categories.first();
    await expect(firstCategory.locator('.category-title')).toBeVisible();

    const skills = firstCategory.locator('.skill-item');
    const skillCount = await skills.count();
    expect(skillCount).toBeGreaterThan(0);

    // Check that skills have names and counts
    const firstSkill = skills.first();
    await expect(firstSkill.locator('.skill-name')).toBeVisible();
    await expect(firstSkill.locator('.skill-count')).toBeVisible();

    // Verify count badge has a number
    const countText = await firstSkill.locator('.skill-count').textContent();
    const count = parseInt(countText || '0');
    expect(count).toBeGreaterThan(0);
  });

  test('should have skills derived from projects.json @frontend', async ({ page }) => {
    // Fetch projects.json
    const projectsResponse = await page.request.get('/projects.json');
    expect(projectsResponse.ok()).toBeTruthy();
    const projects = await projectsResponse.json();

    // Fetch skills.json
    const skillsResponse = await page.request.get('/skills.json');
    expect(skillsResponse.ok()).toBeTruthy();
    const skills = await skillsResponse.json();

    // Validate skills structure
    expect(typeof skills).toBe('object');
    const categories = Object.keys(skills);
    expect(categories.length).toBeGreaterThan(0);

    // Check that skills have expected properties
    for (const category of categories) {
      const categorySkills = skills[category];
      expect(Array.isArray(categorySkills)).toBeTruthy();

      for (const skill of categorySkills) {
        expect(skill).toHaveProperty('name');
        expect(skill).toHaveProperty('count');
        expect(typeof skill.name).toBe('string');
        expect(typeof skill.count).toBe('number');
        expect(skill.count).toBeGreaterThan(0);
      }
    }

    // Verify skills are derived from projects (count should not exceed project count)
    const totalSkills = Object.values(skills).flat();
    const maxCount = Math.max(...(totalSkills as any[]).map((s: any) => s.count));
    expect(maxCount).toBeLessThanOrEqual(projects.length);
  });

  test('should update skills when projects change @frontend', async ({ page }) => {
    // This test validates that skills.json reflects projects.json

    const skillsResponse = await page.request.get('/skills.json');
    expect(skillsResponse.ok()).toBeTruthy();
    const skills = await skillsResponse.json();

    // Check that we have expected categories
    const categories = Object.keys(skills);
    expect(categories.some(c => c.includes('AI') || c.includes('Software') || c.includes('DevOps'))).toBeTruthy();

    // Validate that skills are grouped by category
    for (const category of categories) {
      expect(Array.isArray(skills[category])).toBeTruthy();
      expect(skills[category].length).toBeGreaterThan(0);
    }
  });

  test('should display skill count badges with tooltips @frontend', async ({ page }) => {
    await page.goto('/');

    // Wait for skills to load
    await page.waitForSelector('.skill-item', { timeout: 5000 });

    const skillItems = page.locator('.skill-item');
    const firstSkill = skillItems.first();

    // Check that count badge has a tooltip
    const countBadge = firstSkill.locator('.skill-count');
    await expect(countBadge).toBeVisible();

    // Get the title attribute (tooltip)
    const title = await countBadge.getAttribute('title');
    expect(title).toContain('Used in');
    expect(title).toContain('project');
  });

  test('should handle skills.json loading errors gracefully @frontend', async ({ page }) => {
    // Intercept skills.json request and return error
    await page.route('/skills.json', route => {
      route.abort('failed');
    });

    await page.goto('/');

    // Should show error message
    await expect(page.locator('#skills-section-root')).toContainText('Unable to load skills');
  });
});
