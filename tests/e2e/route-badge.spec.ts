import { test, expect } from './test.base';
import { installFastUI } from './lib/fast-ui';
import { mockReady } from './lib/mock-ready';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

test.describe('Assistant route badge', () => {
  test('shows rag/faq/chitchat pill under assistant reply', async ({ page }) => {
    await installFastUI(page);
    await mockReady(page, 'primary');

    const currentDir = dirname(fileURLToPath(import.meta.url));
    const distAssetsDir = resolve(currentDir, '../../dist/assets');
    const bundledScript = readdirSync(distAssetsDir).find((f) => f.startsWith('index-') && f.endsWith('.js'));
    if (!bundledScript) throw new Error(`Assistant bundle not found under ${distAssetsDir}. Run \`npm run build\` first.`);
    const bundledScriptBody = readFileSync(join(distAssetsDir, bundledScript), 'utf-8');

    await page.route('**/assets/index-*.js', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'cache-control': 'no-store' }, body: bundledScriptBody });
    });

    await page.route(/\/api\/chat\/stream$/, async (route) => {
      const body = [
        ': keepalive\n\n',
        'event: meta\n',
        'data: ' + JSON.stringify({ grounded: true, _served_by: 'primary', sources: [ { title: 'README.md', path: 'README.md' } ] }) + '\n\n',
        'event: data\n',
        'data: ' + JSON.stringify({ choices: [{ delta: { content: 'LedgerMind overview…' } }] }) + '\n\n',
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

    const badge = page.locator('[data-testid="route-badge"]').first();
    await expect(badge).toBeVisible({ timeout: 10_000 });
    const text = (await badge.innerText()).toLowerCase();
    expect.soft(/rag|faq|chitchat/.test(text)).toBeTruthy();
  });
});
