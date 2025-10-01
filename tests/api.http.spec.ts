import { describe, it, expect, vi } from 'vitest';
import { http, status, chat } from '../js/api.js';

// Utility to mock fetch
function mockFetch(handler: (_input: RequestInfo | URL, _init?: RequestInit)=>Promise<Response>) {
  // @ts-ignore
  global.fetch = handler;
}

describe('api http helpers', () => {
  it('http GET json', async () => {
    mockFetch(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const data = await http('/status/summary', {}, 'https://x.test');
    expect(data).toEqual({ ok: true });
  });

  it('status(base) delegates to statusBase', async () => {
    mockFetch(async (url) => new Response(JSON.stringify({ base: String(url) }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const data = await status('https://x.test');
    expect(data.base).toContain('https://x.test/status/summary');
  });

  it('chat(base,messages) posts messages', async () => {
    const spy = vi.fn(async (_url, _init) => {
      const body = JSON.parse(String(_init?.body ?? '{}'));
      return new Response(JSON.stringify({ count: body.messages.length }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    mockFetch(spy);
    const data = await chat('https://x.test', [{ role: 'user', content: 'hi'}]);
    expect(data.count).toBe(1);
    expect(spy).toHaveBeenCalled();
  const [, firstInit] = spy.mock.calls[0];
  expect(firstInit?.method).toBe('POST');
  });

  it('http error path yields detailed message', async () => {
    mockFetch(async () => new Response('nope', { status: 500, statusText: 'ERR'}));
    await expect(http('/x', {}, 'https://x.test')).rejects.toThrow(/HTTP 500/);
  });
});
