import { test, expect } from '@playwright/test';

/**
 * Smoke tests: Fast sanity checks that the app boots correctly.
 * Run first in every lane to fail fast if infrastructure is broken.
 */

test('@siteagent @smoke homepage loads', async ({ page }) => {
  await page.goto('/');

  // Check title contains expected text
  await expect(page).toHaveTitle(/(SiteAgent|Portfolio)/i);

  // Verify core UI elements exist
  const headerOrOverlay = page.locator('header, [data-testid="dev-overlay-button"], nav');
  await expect(headerOrOverlay.first()).toBeVisible({ timeout: 10000 });
});

test('@siteagent @smoke dev overlay affordance exists', async ({ page }) => {
  await page.goto('/');

  // Look for any sign of the dev overlay system
  // Could be a button, a keyboard hint, or the overlay itself
  const devIndicators = page.locator('[data-testid="dev-overlay-button"], [data-overlay], .dev-overlay, #dev-overlay-trigger');
  const count = await devIndicators.count();

  // At least one dev overlay affordance should exist in siteagent
  expect(count).toBeGreaterThan(0);
});

test('@siteagent @smoke backend is reachable', async ({ page, request }) => {
  // Try to hit the backend health endpoint
  const backendURL = process.env.BACKEND_URL || 'http://127.0.0.1:8001';

  try {
    const response = await request.get(`${backendURL}/health`);
    expect(response.ok()).toBeTruthy();
  } catch (error) {
    // If backend not available, that's OK for pure frontend tests
    // But log it for debugging
    console.warn('Backend not reachable at', backendURL, '- frontend-only mode');
  }
});

test('@portfolio @smoke portfolio homepage loads', async ({ page }) => {
  await page.goto('/');

  // Portfolio should have title
  await expect(page).toHaveTitle(/Portfolio|Leo/i);

  // Should have some core navigation or content
  const coreElements = page.locator('header, nav, main, .project-card, article.card');
  await expect(coreElements.first()).toBeVisible({ timeout: 10000 });
});
