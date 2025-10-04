import { test, expect } from '@playwright/test';
import { installFastUI } from './lib/fast-ui';
import { mockReady } from './lib/mock-ready';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// This spec verifies that if a token arrives before meta, the badge still renders by the end of the stream.

test('@frontend stream meta arrives after data (badge still renders)', async ({ page }) => {
  await installFastUI(page);
  await mockReady(page, 'primary');

  // Intercept the built bundle script like other fast UI tests
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const distAssetsDir = resolve(currentDir, '../../dist/assets');
  const bundledScript = readdirSync(distAssetsDir).find((f) => f.startsWith('index-') && f.endsWith('.js'));
  if (!bundledScript) throw new Error(`Assistant bundle not found under ${distAssetsDir}. Run \`npm run build\` first.`);
  const bundledScriptBody = readFileSync(join(distAssetsDir, bundledScript), 'utf-8');

  await page.route('**/assets/index-*.js', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'cache-control': 'no-store' }, body: bundledScriptBody });
  });

  await page.route(/\/api\/chat\/stream$/, async (route) => {
    // Send a first data chunk, then meta, then a final chunk
    const body = [
      ': keepalive\n\n',
      'event: data\\n',
      'data: ' + JSON.stringify({ choices: [{ delta: { content: 'LedgerMind is an offline-first agent. ' } }] }) + '\\n\\n',
      'event: meta\n',
      'data: ' + JSON.stringify({ grounded: true, sources: [{ title: 'README.md' }], _served_by: 'primary' }) + '\n\n',
      'event: data\\n',
      'data: ' + JSON.stringify({ choices: [{ delta: { content: 'Want the case study?' } }] }) + '\\n\\n',
      'event: done\n',
      'data: {}\n\n'
    ].join('');
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8', 'x-accel-buffering': 'no', 'cache-control': 'no-cache' }, body });
  });

  await page.goto('/root_playwright.html');
  await page.locator('#assistantChip').click();

  const input = page.locator('[data-testid="assistant-input"], #chatInput').first();
  const send = page.locator('[data-testid="assistant-send"], #chatSend').first();
  await input.fill('Tell me about LedgerMind');
  await send.click();

  // By the end of the stream, the badge must be there.
  const servedLine = page.locator('.chat-log .msg.from-ai .bubble .served-by-line').last();
  await expect(servedLine).toContainText(/served by .*primary/i, { timeout: 8000 });
  await expect(servedLine.getByTestId('assistant-badge')).toBeVisible({ timeout: 8000 });
  await expect(servedLine).toContainText(/grounded(\s*\(\d+\))?/i, { timeout: 8000 });

  // Tone guard: question mark
  const lastBubble = page.locator('.chat-log .msg.from-ai .bubble').last();
  await expect(lastBubble).toContainText(/[?？]/, { timeout: 12000 });
  const txt = (await lastBubble.innerText()).trim();
  expect(/[?？]\s*$/m.test(txt)).toBeTruthy();
});
