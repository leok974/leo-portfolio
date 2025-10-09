import { test, expect } from './test.base';

test('GET /agent/tasks returns JSON, not HTML', async ({ request }) => {
  const res = await request.get('/agent/tasks');
  expect(res.ok()).toBeTruthy();
  const ct = res.headers()['content-type'] || '';
  expect(ct).toMatch(/json/i);
  const j = await res.json();
  expect(Array.isArray(j.tasks)).toBeTruthy();
});
