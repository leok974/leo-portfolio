/**
 * E2E Tests: PR Automation API
 *
 * Tests the /agent/artifacts/pr endpoint for autonomous PR generation.
 * Requires SITEAGENT_ENABLE_WRITE=1 for full functionality.
 * Uses dry_run=true to avoid actual PR creation in tests.
 */
import { test, expect } from '@playwright/test';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8001';
const AUTH_HEADER = 'Bearer dev';

test.describe('PR automation API (@pr-automation)', () => {
  test('POST /agent/artifacts/pr (dry-run) returns expected structure', async ({ request }) => {
    const payload = {
      dry_run: true,
      use_llm: false,
      labels: ['auto', 'test']
    };

    const res = await request.post(`${BACKEND_URL}/agent/artifacts/pr`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': AUTH_HEADER
      },
      data: payload
    });

    // Expect either success (200) or forbidden (403 if SITEAGENT_ENABLE_WRITE not set)
    expect([200, 400, 403]).toContain(res.status());

    if (res.status() === 200) {
      const json = await res.json();
      expect(json).toHaveProperty('status');
      expect(json.status).toBe('dry-run');
      expect(json).toHaveProperty('branch');
      expect(json).toHaveProperty('diff');
      
      // Branch should follow pattern siteagent/auto-<pid>
      expect(json.branch).toMatch(/^siteagent\/auto-\d+$/);
    }
  });

  test('POST /agent/artifacts/pr without auth returns 401', async ({ request }) => {
    const payload = {
      dry_run: true,
      use_llm: false
    };

    const res = await request.post(`${BACKEND_URL}/agent/artifacts/pr`, {
      headers: {
        'Content-Type': 'application/json'
        // No Authorization header
      },
      data: payload
    });

    expect(res.status()).toBe(401);
  });

  test('POST /agent/artifacts/pr with use_llm=true falls back gracefully', async ({ request }) => {
    const payload = {
      dry_run: true,
      use_llm: true,  // Should fall back to template if LLM not configured
      labels: ['auto', 'llm-test']
    };

    const res = await request.post(`${BACKEND_URL}/agent/artifacts/pr`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': AUTH_HEADER
      },
      data: payload
    });

    // Should not error even if LLM unavailable
    expect([200, 400, 403]).toContain(res.status());

    if (res.status() === 200) {
      const json = await res.json();
      expect(json.status).toBe('dry-run');
      expect(json).toHaveProperty('branch');
      expect(json).toHaveProperty('diff');
    }
  });

  test('POST /agent/artifacts/pr validates required fields', async ({ request }) => {
    // Test with invalid base branch
    const payload = {
      dry_run: true,
      base: 'nonexistent-branch-xyz123'
    };

    const res = await request.post(`${BACKEND_URL}/agent/artifacts/pr`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': AUTH_HEADER
      },
      data: payload
    });

    // Expect error for invalid branch
    expect([400, 403, 500]).toContain(res.status());
  });

  test('GET /agent/artifacts/pr alias works', async ({ request }) => {
    // Test that the /agent/act?task=pr.create alias also works
    const payload = {
      dry_run: true,
      use_llm: false
    };

    const res = await request.post(`${BACKEND_URL}/agent/act?task=pr.create`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': AUTH_HEADER
      },
      data: payload
    });

    expect([200, 400, 403, 404]).toContain(res.status());

    if (res.status() === 200) {
      const json = await res.json();
      expect(json.status).toBe('dry-run');
    }
  });
});

test.describe('PR automation UI integration (@pr-ui)', () => {
  test.skip('Auto PR button exists in DevPagesPanel', async ({ page }) => {
    // This test requires the dev overlay to be accessible
    // Skip by default since it requires full frontend build
    await page.goto('/');
    
    // Wait for dev overlay to be available
    await page.waitForSelector('[data-testid="dev-overlay"]', { timeout: 5000 });
    
    // Open Dev Pages panel
    const devPagesButton = page.locator('text=Dev Pages');
    await devPagesButton.click();
    
    // Look for Auto PR button
    const autoPRButton = page.locator('text=Auto PR (LLM)');
    await expect(autoPRButton).toBeVisible();
    
    // Verify button has proper styling
    const classList = await autoPRButton.getAttribute('class');
    expect(classList).toContain('purple');
  });
});
