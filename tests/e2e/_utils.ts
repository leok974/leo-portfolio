import { APIRequestContext, test } from '@playwright/test';

export async function requireBackendOrSkip(request: APIRequestContext) {
  try {
    const r = await request.get('/ready', { timeout: 4000, headers: { 'cache-control': 'no-store' } });
    if (!r.ok()) test.skip(true, 'backend not ready at /ready');
  } catch {
    test.skip(true, 'backend not reachable');
  }
}
