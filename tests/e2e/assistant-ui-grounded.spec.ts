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

function sseUngrounded() {
  return [
    ': keepalive',
    '',
    'event: meta',
    'data: ' + JSON.stringify({ grounded: false, sources: [], _served_by: 'primary' }),
    '',
    'event: data',
    'data: ' + JSON.stringify({ choices: [{ delta: { content: 'Here’s a quick overview.' } }] }),
    '',
    'event: data',
    'data: ' + JSON.stringify({ choices: [{ delta: { content: ' Want the case study or a 60-sec demo?' } }] }),
    '',
    'event: done',
    'data: {}',
    ''
  ].join('\n');
}

test.describe('@frontend grounded badge states', () => {
  test.beforeEach(async ({ page }) => {
    await installFastUI(page);
    await mockReady(page, 'primary');
    await page.route('**/assets/index-*.js', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'cache-control': 'no-store' }, body: bundledScriptBody });
    });
  });

  test('@frontend grounded badge appears with sources', async ({ page }) => {
    // Stream only meta (no tokens) to trigger JSON fallback path
    const metaOnly = [
      'event: meta',
      'data: ' + JSON.stringify({ grounded: true, sources: [{ t: 'a' }, { t: 'b' }], _served_by: 'primary' }),
      '',
      'event: done',
      'data: {}',
      ''
    ].join('\n');
    await page.route('**/api/chat/stream', async (route) => {
      await route.fulfill({ status: 200, contentType: 'text/event-stream', headers: { 'x-accel-buffering': 'no', 'cache-control': 'no-cache' }, body: metaOnly });
    });
    await page.route('**/api/chat', async (route) => {
      const body = {
        choices: [{ message: { role: 'assistant', content: 'Recommended project: LedgerMind. Want the case study?' } }],
        _served_by: 'primary',
        grounded: true,
        sources: [{ path: 'README.md' }, { path: 'docs/ARCHITECTURE.md' }]
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });

    await page.goto('/root_playwright.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#assistantChip').click();

  const input = page.locator('[data-testid="assistant-input"], #chatInput').first();
  const send = page.locator('[data-testid="assistant-send"], #chatSend').first();
  await input.fill('Tell me about LedgerMind');
  await send.click();

  const bubble = page.locator('.chat-log .msg.from-ai .bubble').last();
  // Wait for the JSON fallback to render the message
  await expect(bubble).toContainText('Want the case study?', { timeout: 12000 });

  const servedLine = bubble.locator('.served-by-line');
    await expect(servedLine).toContainText(/served by .*primary/i, { timeout: 8000 });
    await expect(servedLine.getByTestId('assistant-badge')).toBeVisible({ timeout: 8000 });
    await expect(servedLine).toContainText(/grounded(\s*\(\d+\))?/i, { timeout: 8000 });

  const text = (await bubble.innerText()).trim();
  expect(/[?？]\s*$/m.test(text)).toBeTruthy();
  });

  test('@frontend ungrounded shows a gentle overview hint', async ({ page }) => {
    await page.route('**/api/chat/stream', async (route) => {
      await route.fulfill({ status: 200, contentType: 'text/event-stream', headers: { 'x-accel-buffering': 'no', 'cache-control': 'no-cache' }, body: sseUngrounded() });
    });

    await page.goto('/root_playwright.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#assistantChip').click();

  const input = page.locator('[data-testid="assistant-input"], #chatInput').first();
  const send = page.locator('[data-testid="assistant-send"], #chatSend').first();
  await input.fill('Tell me about LedgerMind');
  await send.click();

  const bubble = page.locator('.chat-log .msg.from-ai .bubble').last();
  await expect(bubble).toContainText(/case study|60-?sec demo/i, { timeout: 8000 });

  const servedLine = bubble.locator('.served-by-line');
  await expect(servedLine).toContainText(/served by/i, { timeout: 8000 });
  await expect(servedLine).not.toContainText(/grounded/i, { timeout: 8000 });
  });
});
