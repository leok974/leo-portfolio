import { test, expect } from './test.base';
import { installFastUI } from './lib/fast-ui';
import { mockReady } from './lib/mock-ready';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Verifies: badge visible → click opens popover → list shows titles → Esc and outside-click close → focus returns to badge.

test('@frontend sources popover lists title + path and links when url provided', async ({ page }) => {
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
      'data: ' + JSON.stringify({ grounded: true, _served_by: 'primary', sources: [
        { title: 'README.md', path: 'README.md', url: 'https://github.com/leok974/leo-portfolio/blob/main/README.md' },
        { title: 'ARCHITECTURE.md', path: 'docs/ARCHITECTURE.md', url: 'https://github.com/leok974/leo-portfolio/blob/main/docs/ARCHITECTURE.md' },
        { title: 'SECURITY.md', path: 'SECURITY.md' }
      ] }) + '\n\n',
      'event: data\n',
      'data: ' + JSON.stringify({ choices: [{ delta: { content: 'LedgerMind overview. Want the case study?' } }] }) + '\n\n',
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

  const badge = page.locator('[data-testid="assistant-badge"]');
  await expect(badge).toContainText(/grounded\s*\(\d+\)/i, { timeout: 8000 });

  // Open popover
  await badge.click();
  const pop = page.locator('[data-testid="assistant-sources-popover"]');
  await expect(pop).toBeVisible();
  const list = page.locator('[data-testid="assistant-sources-list"]');
  await expect(list).toContainText(/README\.md — README\.md/);
  await expect(list).toContainText(/ARCHITECTURE\.md — docs\/ARCHITECTURE\.md/);
  await expect(list).toContainText(/SECURITY\.md — SECURITY\.md/);

  // Links present for items with URL
  const links = page.locator('[data-testid="assistant-source-link"]');
  await expect(links.nth(0)).toHaveAttribute('href', /README\.md$/);
  await expect(links.nth(1)).toHaveAttribute('href', /docs\/ARCHITECTURE\.md$/);

  // ESC closes
  await page.keyboard.press('Escape');
  await expect(pop).toBeHidden();

  // Reopen, then outside click closes
  await badge.click();
  await expect(pop).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(pop).toBeHidden();
  // Focus returns to badge (allow brief settle)
  await page.waitForFunction(() => document.activeElement?.id === 'assistant-badge-focus');
  await expect(badge).toBeFocused();
});
