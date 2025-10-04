import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { installFastUI } from './lib/fast-ui';
import { mockReady } from './lib/mock-ready';

const currentDir = dirname(fileURLToPath(import.meta.url));
const distAssetsDir = resolve(currentDir, '../../dist/assets');
const bundledScript = readdirSync(distAssetsDir).find(
  (file) => file.startsWith('index-') && file.endsWith('.js')
);
if (!bundledScript) {
  throw new Error(`Assistant bundle not found under ${distAssetsDir}. Run \`npm run build\` before executing this spec.`);
}
const bundledScriptBody = readFileSync(join(distAssetsDir, bundledScript), 'utf-8');

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

test.describe('@frontend no console warn on timely first token', () => {
  test.beforeEach(async ({ page }) => {
    await installFastUI(page);
    await mockReady(page, 'primary');
    await page.route('**/assets/index-*.js', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'cache-control': 'no-store' }, body: bundledScriptBody });
    });
  });

  test('no warn on timely first token', async ({ page }) => {
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
