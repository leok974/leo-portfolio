import { test, expect } from '@playwright/test';
import { BASE } from './helpers/env';

test.describe('@content cache-control projects.json', () => {
  test('projects.json served with short-lived cache header', async ({ request }) => {
    const res = await request.get(`${BASE}/projects.json`, { headers: { 'Accept': 'application/json' } });
    expect(res.status()).toBe(200);
    const cc = (res.headers()['cache-control'] || '').toLowerCase();
    expect(cc).toContain('public');
    expect(cc).toContain('max-age=300');
    // Ensure it is NOT immutable and not the long-lived 1y cache
    expect(cc).not.toContain('immutable');
    expect(/max-age=31536000/.test(cc)).toBeFalsy();
  });
});
