// tests/e2e/api-ready.spec.ts
import { test, expect } from '@playwright/test';

test('api /ready is reachable via same-origin proxy', async ({ request }) => {
  const res = await request.get('/api/ready');
  expect(res.status()).toBe(200);
});
