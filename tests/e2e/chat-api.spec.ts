import { test, expect } from '@playwright/test';
// Allow long warmup if globalSetup skipped
test.setTimeout(130_000);
import { waitForPrimary } from './lib/wait-primary';

const backendRequired = process.env.BACKEND_REQUIRED === '1';

// Skip entirely if backend not required / not present
if (!backendRequired) {
  test.describe.skip('@backend chat API', () => {});
} else {
  test.describe('@backend chat API', () => {
    test.describe.configure({ timeout: 120000 });
  test.beforeAll(async () => { await waitForPrimary({ chatProbe: true }); });
    test('POST /api/chat returns JSON', async ({ request }) => {
      const res = await request.post('/api/chat', {
        data: { messages: [{ role: 'user', content: 'hi' }] },
      });
      expect(res.status(), 'chat endpoint should return 200').toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('choices');
      expect(JSON.stringify(body).toLowerCase()).not.toMatch(/served by fallback/);
    });

    test('GET /api/chat is rejected (method not allowed)', async ({ request }) => {
      const res = await request.get('/api/chat');
      const status = res.status();
      // FastAPI behind nginx shim may surface 405 (method not allowed) or 404 (if method routing differs upstream)
      expect([404, 405]).toContain(status);
      if (status === 200) {
        throw new Error('GET /api/chat unexpectedly returned 200 (should be non-POST only)');
      }
    });
  });
}
