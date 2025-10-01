import { describe, it, expect } from 'vitest';
import { probeAll } from '../js/agent-status.js';

describe('agent-status probeAll', () => {
  it('returns first successful candidate (simulated /status/summary success)', async () => {
    let calls: string[] = [];
    // mock fetch to succeed only for /status/summary
    // @ts-ignore
    global.fetch = async (url: string) => {
      calls.push(url);
      if (url.includes('/status/summary')) {
        return new Response(JSON.stringify({ llm:{path:'x'}, rag:{ok:true}, openai_configured:true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('nf', { status: 404 });
    };
    const res = await probeAll();
    expect(res.ok).toBe(true);
    expect(res.base).toBeDefined();
    expect(res.path).toBe('/status/summary');
  });

  it('reports failure when all candidates fail', async () => {
    // @ts-ignore
    global.fetch = async () => new Response('nf', { status: 404 });
    const res = await probeAll();
    expect(res.ok).toBe(false);
    expect(res.error).toBeTypeOf('string');
  });
});
