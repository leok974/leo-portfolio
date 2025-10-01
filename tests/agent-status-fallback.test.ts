// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';

describe('agent-status.js fallback (succession)', () => {
  it('fetchStatus falls back from /status/summary 404 to /llm/health 200', async () => {
    const calls: string[] = [];
    global.document = { getElementById: () => null, createElement: () => ({ style: {} }) };
    global.location = { hostname: 'leok974.github.io' };
    global.window = {
      addEventListener: () => {},
      AgentStatus: {},
      setInterval: () => 0,
    };
    global.fetch = vi.fn((url) => {
      calls.push(String(url));
      if (String(url).endsWith('/status/summary')) return Promise.resolve(new Response('', { status: 404 }));
      if (String(url).endsWith('/llm/health')) return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
      return Promise.resolve(new Response('', { status: 500 }));
    });
    require('../js/agent-status.js');
    const result = await global.window.AgentStatus._fetchStatus();
    expect(calls.some(u => u.endsWith('/api/status/summary'))).toBe(true);
    expect(calls.some(u => u.endsWith('/api/llm/health'))).toBe(true);
    expect(result.llm).toBeTruthy();
  });
});
