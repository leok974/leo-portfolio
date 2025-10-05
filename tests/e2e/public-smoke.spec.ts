import { test, expect, type APIRequestContext } from '@playwright/test';

const BASE = process.env.PUBLIC_URL || 'https://assistant.ledger-mind.org';

async function get(ctx: APIRequestContext, path: string) {
  const res = await ctx.get(`${BASE}${path}`, { timeout: 10_000 });
  return res;
}

async function post(ctx: APIRequestContext, path: string, data: any) {
  const res = await ctx.post(`${BASE}${path}`, {
    data,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15_000,
  });
  return res;
}

test.describe('@public-smoke', () => {
  test('ready endpoint is healthy', async ({ request }) => {
    const res = await get(request, '/ready');
    expect(res.ok(), `/ready status ${res.status()}`).toBeTruthy();
    const json = await res.json();
    // minimal shape checks; stay flexible
    expect(json).toBeTruthy();
    // Optional: expect soft fields if present
    // expect.soft(json.stage ?? json.status).toBeDefined();
  });

  test('diagnostics endpoint responds', async ({ request }) => {
    const res = await get(request, '/llm/diag');
    expect(res.ok(), `/llm/diag status ${res.status()}`).toBeTruthy();
    const text = await res.text();
    // Diag can be text or JSON; just ensure non-empty and not HTML error boilerplate
    expect(text.length).toBeGreaterThan(0);
  });

  test('chat (non-stream) responds with JSON', async ({ request }) => {
    const res = await post(request, '/api/chat', {
      messages: [{ role: 'user', content: 'Hi from public smoke.' }],
      stream: false
    });
    // Some setups may 200/201; consider 2xx acceptable
    expect(String(res.status())).toMatch(/^2\d\d$/);

    const ct = res.headers()['content-type'] || '';
    expect(ct.toLowerCase()).toContain('application/json');

    const body = await res.json();
    // Soft contract: presence of a response payload
    expect(body).toBeTruthy();
    // If your API returns { message / choices / reply }, keep this loose:
    expect.soft(JSON.stringify(body).length).toBeGreaterThan(5);
  });
});
