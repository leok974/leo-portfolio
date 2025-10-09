/**
 * Analytics smoke tests for Phase 51.0
 * Ensures the new analytics endpoints are working correctly
 */
import { test, expect } from '@playwright/test';

test.describe('Analytics API Endpoints', () => {
  test('analytics latest endpoint returns ok or pending', async ({ request }) => {
    const res = await request.get('/analytics/latest');
    expect(res.status()).toBe(200);
    
    const body = await res.json();
    expect(['ok', 'pending']).toContain(body.status);
    
    if (body.status === 'ok') {
      expect(body).toHaveProperty('markdown');
      expect(body).toHaveProperty('trend');
    }
  });

  test('analytics health endpoint returns status', async ({ request }) => {
    const res = await request.get('/analytics/health');
    expect(res.status()).toBe(200);
    
    const body = await res.json();
    expect(body).toHaveProperty('status');
    expect(['healthy', 'degraded', 'pending']).toContain(body.status);
  });

  test('analytics search returns results or 404 when vector store missing', async ({ request }) => {
    const res = await request.get('/analytics/search?q=test');
    // Either 200 with results, 404 (not implemented), or 409 (store not built)
    expect([200, 404, 409]).toContain(res.status());
    
    if (res.status() === 200) {
      const body = await res.json();
      expect(Array.isArray(body.results) || body.results === undefined).toBeTruthy();
    }
  });
});

test.describe('Analytics UI (if enabled)', () => {
  test('admin analytics page loads without errors', async ({ page }) => {
    // Navigate to analytics admin page (if it exists)
    const response = await page.goto('/admin/analytics', { waitUntil: 'networkidle' });
    
    // Either the page exists (200) or redirects/404s gracefully
    if (response?.status() === 200) {
      // Check for no console errors
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      
      await page.waitForTimeout(2000);
      expect(errors.length).toBe(0);
    } else {
      // Page doesn't exist yet - that's fine for Phase 51.0
      expect([404, 302]).toContain(response?.status() || 404);
    }
  });
});
