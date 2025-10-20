import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * E2E Tests for Project Hiding Feature
 * 
 * Tests that hidden projects:
 * 1. Don't render in the UI
 * 2. Are filtered from generated files (skills.json, etc.)
 * 3. Can be toggled via admin endpoints
 */

test.describe('Projects Hidden Feature', () => {
  const HIDDEN_FILE = path.join(process.cwd(), 'apps/portfolio-ui/public/projects.hidden.json');
  const PROJECTS_FILE = path.join(process.cwd(), 'apps/portfolio-ui/public/projects.json');
  
  let originalHidden: string[];
  let testSlug: string;

  test.beforeAll(async () => {
    // Backup original hidden list
    try {
      const content = await fs.readFile(HIDDEN_FILE, 'utf-8');
      originalHidden = JSON.parse(content);
    } catch {
      originalHidden = [];
    }

    // Find a test project slug
    const projectsContent = await fs.readFile(PROJECTS_FILE, 'utf-8');
    const projects = JSON.parse(projectsContent);
    const projectKeys = Object.keys(projects);
    
    if (projectKeys.length === 0) {
      throw new Error('No projects found in projects.json');
    }
    
    testSlug = projectKeys[0];
    console.log(`Using test project: ${testSlug}`);
  });

  test.afterAll(async () => {
    // Restore original hidden list
    await fs.writeFile(HIDDEN_FILE, JSON.stringify(originalHidden, null, 2));
  });

  test('hidden project is not rendered in UI', async ({ page }) => {
    // Hide the test project
    await fs.writeFile(HIDDEN_FILE, JSON.stringify([testSlug], null, 2));
    
    // Visit the page
    await page.goto('/');
    
    // Wait for projects to load
    await page.waitForSelector('[data-testid="project-card"]', { timeout: 5000 }).catch(() => {});
    
    // Check that the test project is not rendered
    const projectCards = await page.locator('[data-card]').all();
    const slugs = await Promise.all(
      projectCards.map(card => card.getAttribute('data-card'))
    );
    
    expect(slugs).not.toContain(testSlug);
    console.log(`✓ Project '${testSlug}' not rendered when hidden`);
  });

  test('unhidden project appears in UI', async ({ page }) => {
    // Ensure project is not hidden
    await fs.writeFile(HIDDEN_FILE, JSON.stringify([], null, 2));
    
    // Visit the page
    await page.goto('/');
    
    // Wait for projects to load
    await page.waitForSelector('[data-testid="project-card"]', { timeout: 5000 });
    
    // Check that the test project IS rendered
    const projectCards = await page.locator('[data-card]').all();
    const slugs = await Promise.all(
      projectCards.map(card => card.getAttribute('data-card'))
    );
    
    expect(slugs).toContain(testSlug);
    console.log(`✓ Project '${testSlug}' rendered when not hidden`);
  });

  test('hidden list is valid JSON array', async () => {
    const content = await fs.readFile(HIDDEN_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.every((item: any) => typeof item === 'string')).toBe(true);
    console.log(`✓ projects.hidden.json is valid (${parsed.length} items)`);
  });

  test('portfolio loads with multiple hidden projects', async ({ page }) => {
    // Get first 3 project slugs
    const projectsContent = await fs.readFile(PROJECTS_FILE, 'utf-8');
    const projects = JSON.parse(projectsContent);
    const slugsToHide = Object.keys(projects).slice(0, 3);
    
    // Hide them
    await fs.writeFile(HIDDEN_FILE, JSON.stringify(slugsToHide, null, 2));
    
    // Visit the page
    await page.goto('/');
    
    // Wait for projects to load
    await page.waitForSelector('[data-testid="project-card"]', { timeout: 5000 }).catch(() => {});
    
    // Check that none of the hidden projects are rendered
    const projectCards = await page.locator('[data-card]').all();
    const visibleSlugs = await Promise.all(
      projectCards.map(card => card.getAttribute('data-card'))
    );
    
    for (const hiddenSlug of slugsToHide) {
      expect(visibleSlugs).not.toContain(hiddenSlug);
    }
    
    console.log(`✓ ${slugsToHide.length} hidden projects not rendered`);
  });

  test('UI logs correct project count', async ({ page }) => {
    // Hide one project
    await fs.writeFile(HIDDEN_FILE, JSON.stringify([testSlug], null, 2));
    
    // Listen for console logs
    const logs: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('Loaded') && msg.text().includes('projects')) {
        logs.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForTimeout(2000); // Give time for logs
    
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some(log => log.includes('hidden'))).toBe(true);
    console.log(`✓ UI logs hidden project count: ${logs.join(', ')}`);
  });
});

test.describe('Admin Project Endpoints @admin', () => {
  const BASE_URL = process.env.PW_API || 'http://localhost:8001';
  const ADMIN_KEY = process.env.ADMIN_HMAC_KEY || 'test-key';
  const TEST_SLUG = 'test-project-hide';

  test.skip(
    !process.env.ADMIN_HMAC_KEY,
    'Skipping admin endpoint tests (ADMIN_HMAC_KEY not set)'
  );

  test('hide endpoint requires authentication', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/admin/projects/hide`, {
      data: { slug: TEST_SLUG }
    });
    
    expect(response.status()).toBe(401);
  });

  test('hide endpoint works with valid key', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/admin/projects/hide`, {
      headers: {
        'x-admin-key': ADMIN_KEY
      },
      data: { slug: TEST_SLUG }
    });
    
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.hidden).toContain(TEST_SLUG);
  });

  test('unhide endpoint works with valid key', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/admin/projects/unhide`, {
      headers: {
        'x-admin-key': ADMIN_KEY
      },
      data: { slug: TEST_SLUG }
    });
    
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.hidden).not.toContain(TEST_SLUG);
  });

  test('get hidden list endpoint works', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/admin/projects/hidden`, {
      headers: {
        'x-admin-key': ADMIN_KEY
      }
    });
    
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.hidden)).toBe(true);
  });
});
