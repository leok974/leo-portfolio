import { test, expect } from './test.base';
test.setTimeout(130_000);
import { waitForPrimary } from './lib/wait-primary';

const backendRequired = process.env.BACKEND_REQUIRED === '1';
const allowFallback = process.env.ALLOW_FALLBACK === '1';
// Allow skipping if backend not required or fallback explicitly allowed
if (!backendRequired || allowFallback) {
  test.describe.skip('@backend chat no fallback', () => {});
} else {
  test.describe('@backend chat no fallback', () => {
    test.describe.configure({ timeout: 120000 });
  test.beforeAll(async () => { await waitForPrimary({ chatProbe: true }); });
    test('chat never returns fallback', async ({ request }) => {
      const res = await request.post('/api/chat', {
        data: { messages: [{ role: 'user', content: 'hi' }] },
      });
      expect(res.ok(), 'chat POST should succeed').toBeTruthy();
      const body = await res.json();
      const serialized = JSON.stringify(body).toLowerCase();
      expect(serialized).not.toMatch(/served by fallback/);
    });
  });
}
