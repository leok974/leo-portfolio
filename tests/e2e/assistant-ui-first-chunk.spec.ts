import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { installFastUI } from './lib/fast-ui';
import { mockReady } from './lib/mock-ready';

function findBundle(distDir: string): string {
  const distAssetsDir = join(distDir, 'assets');
  const files = readdirSync(distAssetsDir);

  // prefer index-*.js (siteagent), else main-*.js (portfolio), else any .js
  const candidates = [
    (f: string) => f.startsWith('index-') && f.endsWith('.js'),
    (f: string) => f.startsWith('main-') && f.endsWith('.js'),
    (f: string) => f.endsWith('.js') && !f.endsWith('.map.js'),
  ];

  for (const pred of candidates) {
    const hit = files.find(pred);
    if (hit) return join(distAssetsDir, hit);
  }
  throw new Error(`No JS bundle found under ${distAssetsDir}`);
}

const currentDir = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(currentDir, '../../dist');
const bundledScriptPath = findBundle(distDir);
const bundledScriptBody = readFileSync(bundledScriptPath, 'utf-8');

function sseFrames() {
  return [
    ': keepalive',
    '',
    'event: meta',
    'data: {"_served_by":"primary"}',
    '',
    'event: data',
    'data: {"choices":[{"delta":{"content":"Hello! "}}]}',
    '',
    'event: data',
    'data: {"choices":[{"delta":{"content":"Want the case study?"}}]}',
    '',
    'event: done',
    'data: [DONE]',
    ''
  ].join('\n');
}

test.describe('@portfolio @frontend no console warn on timely first token', () => {
  test.beforeEach(async ({ page }) => {
    await installFastUI(page);
    await mockReady(page, 'primary');
    await page.route('**/assets/index-*.js', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'cache-control': 'no-store' }, body: bundledScriptBody });
    });
  });

  test('@portfolio no warn on timely first token', async ({ page }) => {
    const warns: string[] = [];
    page.on('console', (m) => m.type() === 'warning' && warns.push(m.text()));

    await page.route('**/api/chat/stream', async (route) => {
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sseFrames() });
    });
    await page.route('**/api/chat', async (route) => {
      // Should not be called in happy path; respond if it is
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'fallback' } }] }) });
    });

    await page.goto('/root_playwright.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#assistantChip').click();

    const input = page.locator('[data-testid="assistant-input"], #chatInput').first();
    const send = page.locator('[data-testid="assistant-send"], #chatSend').first();

    await input.fill('hi');
    await send.click();

    const bubble = page.locator('.chat-log .msg.from-ai .bubble').last();
    await expect(bubble).toContainText('Want the case study?', { timeout: 8000 });

    expect(warns.join('\n')).not.toMatch(/grace elapsed|grace period/i);
  });
});
