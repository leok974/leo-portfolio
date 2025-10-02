import { test, expect } from '@playwright/test';
import { BASE } from './helpers/env';

test.describe('@security root html mime', () => {
  test('serves / as text/html (no attachment)', async ({ request }) => {
    if (process.env.NGINX_STRICT !== '1') {
      test.info().annotations.push({ type: 'skip-reason', description: 'NGINX_STRICT=1 not set' });
      test.skip(true, 'Requires nginx strict environment');
    }
    const res = await request.get(`${BASE || ''}/`, { headers: { Accept: 'text/html' } });
    expect(res.status()).toBe(200);
    const ct = (res.headers()['content-type'] || '').toLowerCase();
    expect(ct).toContain('text/html');
    const cd = (res.headers()['content-disposition'] || '').toLowerCase();
    expect(cd.includes('attachment')).toBeFalsy();
  });
});
