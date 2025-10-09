import { test, expect } from './test.base';
import { requireBackendOrSkip } from './_utils';

test('set brand via /agent/act reflects in /agent/report', async ({ request }) => {
  await requireBackendOrSkip(request);
  const brand = 'E2E BRAND ' + Date.now();
  const r1 = await request.post('/agent/act', { data: { command: `set brand to ${brand}` } });
  expect(r1.ok()).toBeTruthy();
  const r2 = await request.get('/agent/report', { headers: { 'cache-control': 'no-store' } });
  const j = await r2.json();
  expect(j.brand).toBe(brand);
});
