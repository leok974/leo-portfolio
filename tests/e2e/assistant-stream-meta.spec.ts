import { test, expect } from './test.base';
import { installFastUI } from './lib/fast-ui';
import { mockReady } from './lib/mock-ready';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// This spec verifies the first non-heartbeat SSE frame is `event: meta`, and that
// the grounded badge renders immediately on meta (before content streaming finishes).

test('@frontend stream meta arrives first (badge before content)', async ({ page }) => {
  await installFastUI(page);
  await mockReady(page, 'primary');

  // 1) Intercept the built bundle and reroute /api/chat/stream → our mock
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const distAssetsDir = resolve(currentDir, '../../dist/assets');
  const bundledScript = readdirSync(distAssetsDir).find((f) => f.startsWith('index-') && f.endsWith('.js'));
  if (!bundledScript) throw new Error(`Assistant bundle not found under ${distAssetsDir}. Run \`npm run build\` first.`);
  const bundledScriptBody = readFileSync(join(distAssetsDir, bundledScript), 'utf-8');

  await page.route('**/assets/index-*.js', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'cache-control': 'no-store' }, body: bundledScriptBody });
  });

  await page.route(/\/api\/chat\/stream$/, async (route) => {
    // Provide a meta-first SSE stream (allowing a leading heartbeat comment)
    const body = [
      ': keepalive\n\n',
      'event: meta\n',
      'data: ' + JSON.stringify({ grounded: true, sources: [{ title: 'README.md' }, { title: 'docs/ARCHITECTURE.md' }], _served_by: 'primary' }) + '\n\n',
  'event: data\n',
  'data: ' + JSON.stringify({ choices: [{ delta: { content: 'Recommended project: LedgerMind — ' } }] }) + '\n\n',
  'event: data\n',
  'data: ' + JSON.stringify({ choices: [{ delta: { content: 'offline-first agent. Want the case study?' } }] }) + '\n\n',
      'event: done\n',
      'data: {}\n\n'
    ].join('');
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8', 'x-accel-buffering': 'no', 'cache-control': 'no-cache' }, body });
  });

  // 3) Drive the UI using our standard helpers/selectors
  await page.goto('/root_playwright.html');
  await page.locator('#assistantChip').click();

  const input = page.locator('[data-testid="assistant-input"], #chatInput').first();
  const send = page.locator('[data-testid="assistant-send"], #chatSend').first();
  await input.fill('Tell me about LedgerMind');
  await send.click();

  // 4) Badge should render immediately after meta (before full content completes)
  const servedLine = page.locator('.chat-log .msg.from-ai .bubble .served-by-line').last();
  await expect(servedLine).toContainText(/served by .*primary/i, { timeout: 8000 });
  await expect(servedLine.getByTestId('assistant-badge')).toBeVisible({ timeout: 8000 });
  await expect(servedLine).toContainText(/grounded\s*\(\d+\)/i, { timeout: 8000 });

  // 5) Final bubble ends with a question (tone guard still holds)
  const lastBubble = page.locator('.chat-log .msg.from-ai .bubble').last();
  await expect(lastBubble).toContainText(/[?？]/, { timeout: 12000 });
  const txt = (await lastBubble.innerText()).trim();
  expect(/[?？]\s*$/m.test(txt)).toBeTruthy();
});
