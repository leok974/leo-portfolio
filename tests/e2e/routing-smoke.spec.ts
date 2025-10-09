import { test, expect } from './test.base';

/**
 * Purpose: verify nginx maps /api/chat* to the backend without depending on model
 * inference completion or holding open an SSE stream.
 *
 * Rationale for using OPTIONS instead of POST:
 *  - POST /api/chat may block >8s when a large model is cold-loading.
 *  - POST /api/chat/stream keeps the connection open indefinitely (SSE),
 *    which causes Playwright's request helpers to time out waiting for body end.
 *  - An OPTIONS request will still traverse nginx -> backend routing and return
 *    a fast non-404 status (likely 405 Method Not Allowed or a CORS/preflight
 *    response) proving the location mapping exists.
 *
 * Passing statuses (mapping proven): any status except 404.
 * Failing status: 404 (unmapped at edge)
 */
const mapped = (s: number) => s !== 404;

test.describe('@backend @routing routing smoke', () => {
  test('OPTIONS /api/chat is mapped (not 404)', async ({ request }) => {
    const res = await request.fetch('/api/chat', {
      method: 'OPTIONS',
      timeout: 4000,
      failOnStatusCode: false,
    });
    const status = res.status();
    expect(mapped(status), `Expected /api/chat to be mapped (got ${status}).`).toBe(true);
  });

  test('OPTIONS /api/chat/stream is mapped (not 404)', async ({ request }) => {
    const res = await request.fetch('/api/chat/stream', {
      method: 'OPTIONS',
      timeout: 4000,
      failOnStatusCode: false,
    });
    const status = res.status();
    expect(mapped(status), `Expected /api/chat/stream to be mapped (got ${status}).`).toBe(true);
  });
});
