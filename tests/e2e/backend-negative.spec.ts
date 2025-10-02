import { test, expect, request } from '@playwright/test';
import { BASE } from './helpers/env';

// Negative readiness test: asserts ready=false when FAIL_READY=1 and EXPECT_READY_FALSE=1 provided.
// Runs only in full-stack strict mode with injected failure.
test.describe('@backend @negative readiness degraded', () => {
  test('ready=false when injected', async () => {
    if (
      process.env.NGINX_STRICT !== '1' ||
      process.env.BACKEND_REQUIRED !== '1' ||
      process.env.EXPECT_READY_FALSE !== '1'
    ) {
      test.info().annotations.push({
        type: 'skip-reason',
        description: 'Not in injected-failure full-stack strict mode'
      });
      test.skip(true);
    }
    const ctx = await request.newContext();
    const res = await ctx.get(`${BASE || ''}/api/ready`, { headers: { Accept: 'application/json' } });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ready).toBe(false);
  });
});
