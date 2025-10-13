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

test.describe('@frontend assistant UI fallback', () => {
  test.beforeEach(async ({ page }) => {
    await installFastUI(page);
    await mockReady(page, 'primary');

    await page.route('**/assets/index-*.js', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        headers: {
          'cache-control': 'no-store'
        },
        body: bundledScriptBody
      });
    });
  });

  test('falls back to JSON when stream has no tokens', async ({ page }) => {
    page.on('console', (msg) => {
      console.log('[console]', msg.type(), msg.text());
    });
    const streamRequests: string[] = [];
    await page.route('**/api/chat/stream', async (route) => {
      streamRequests.push(route.request().url());
      const body = [
        'event: meta',
        'data: {"_served_by":"primary"}',
        '',
        'event: done',
        'data: [DONE]',
        ''
      ].join('\n');
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body
      });
    });

    const fallbackResponse = {
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Hello from fallback!'
          }
        }
      ]
    };

    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fallbackResponse)
      });
    });

    await page.goto('/root_playwright.html', { waitUntil: 'domcontentloaded' });

    await page.locator('#assistantChip').click();

    const input = page.locator('[data-testid="assistant-input"], #chatInput').first();
    const send = page.locator('[data-testid="assistant-send"], #chatSend').first();

    await expect(input).toBeVisible();
    await expect(send).toBeVisible();
    await expect(send).toBeEnabled();

    await input.fill('hi');

    const chatPromise = page.waitForRequest('**/api/chat', { timeout: 35000 });
    await send.click();

    await chatPromise;

    await expect.poll(() => streamRequests.length).toBeGreaterThan(0);

    // Expect the fallback text to appear exactly once in the visible bubble (no duplication)
    const bubble = page.locator('.chat-log .msg.from-ai .bubble').last();
    await expect(bubble).toContainText('Hello from fallback!');

    // Verify no duplicate messages in chat log
    const allMessages = page.locator('.chat-log .msg.from-ai');
    await expect(allMessages).toHaveCount(1);
  });
});
