import { test, expect } from '@playwright/test';

// This test requires env vars to be set when running locally or in CI:
// AGENT_REFRESH_URL, AGENT_ALLOW_KEY

const WORKER_URL = process.env.AGENT_REFRESH_URL || '';
const ALLOW_KEY = process.env.AGENT_ALLOW_KEY || '';

test.describe('Agent refresh status endpoint', () => {
  test('returns latest workflow run summary', async () => {
    test.skip(!WORKER_URL || !ALLOW_KEY, 'AGENT_REFRESH_URL and AGENT_ALLOW_KEY required');

    const res = await fetch(`${WORKER_URL.replace(/\/*$/, '')}/agent/refresh/status`, {
      method: 'GET',
      headers: { 'x-agent-key': ALLOW_KEY }
    });

    expect(res.ok).toBeTruthy();
    const j = await res.json();

    // We expect either an object with state or a run summary with id/status
    expect(typeof j === 'object').toBeTruthy();
    if (j.id) {
      expect(typeof j.id === 'number').toBeTruthy();
      expect(typeof j.status === 'string' || j.status === undefined).toBeTruthy();
    } else {
      expect(typeof j.state === 'string' || j.state === 'unknown').toBeTruthy();
    }
  });
});
