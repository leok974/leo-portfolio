import { test, expect } from '@playwright/test';

test.describe('Agent orchestration', () => {
  test('status and dry-run tasks work', async ({ request }) => {
    const status = await request.get('https://assistant.ledger-mind.org/agent/status');
    expect(status.ok()).toBeTruthy();

    const statusData = await status.json();
    console.log('Agent status:', statusData);

    const run = await request.post('https://assistant.ledger-mind.org/agent/run', {
      data: { tasks: ['projects.sync', 'links.suggest', 'og.generate'], dry_run: true }
    });
    expect(run.ok()).toBeTruthy();

    const runData = await run.json();
    console.log('Agent run result:', runData);

    const artifacts = await request.get('https://assistant.ledger-mind.org/agent/artifacts');
    expect(artifacts.ok()).toBeTruthy();
    const body = await artifacts.text();
    expect(body.length).toBeGreaterThan(10);
    console.log('Artifacts preview:', body.substring(0, 200));
  });

  test('events stream is reachable (SSE)', async ({ request }) => {
    // SSE endpoint should be accessible and return streaming data
    const events = await request.get('https://assistant.ledger-mind.org/agent/events?level=info', {
      timeout: 5000
    });

    // SSE returns 200 OK with text/event-stream
    expect(events.ok()).toBeTruthy();
    const contentType = events.headers()['content-type'];
    expect(contentType).toContain('text/event-stream');
  });

  test('dev overlay enable endpoint works', async ({ request }) => {
    const enable = await request.get('https://assistant.ledger-mind.org/agent/dev/enable', {
      headers: {
        'Authorization': 'Bearer dev'
      }
    });

    expect(enable.ok()).toBeTruthy();

    // Should set a cookie
    const headers = enable.headers();
    const setCookie = headers['set-cookie'];
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain('sa_dev');
    expect(setCookie).toContain('Domain=.ledger-mind.org');
  });
});
