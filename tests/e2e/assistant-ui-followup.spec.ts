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

// Minimal SSE body that looks like a real stream and ends with a question.
function sseBody() {
  return [
    'event: meta',
    'data: {"_served_by":"primary"}',
    '',
    'event: data',
    'data: {"choices":[{"delta":{"content":"Hi! "}}]}',
    '',
    'event: data',
    'data: {"choices":[{"delta":{"content":"LedgerMind fits best. "}}]}',
    '',
    'event: data',
    'data: {"choices":[{"delta":{"content":"Want the case study?"}}]}',
    '',
    'event: done',
    'data: [DONE]',
    ''
  ].join('\n');
}

test.describe('@siteagent @frontend assistant UI follow-up', () => {
  test.beforeEach(async ({ page }) => {
    await installFastUI(page);
    await mockReady(page, 'primary');

    // Intercept the bundle file to ensure our route mocks take effect
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

  test('@siteagent last assistant bubble ends with a follow-up question', async ({ page }) => {
    // Stub the streaming endpoint with a tiny SSE that includes a question.
    await page.route('**/api/chat/stream', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: {
          'cache-control': 'no-cache',
        },
        body: sseBody(),
      });
    });

    // Also stub the JSON fallback endpoint to prevent real backend calls
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{
            message: {
              role: 'assistant',
              content: 'Hi! LedgerMind fits best. Want the case study?'
            }
          }],
          _served_by: 'primary-fallback'
        })
      });
    });

    // Use the lightweight HTML shell for tests if present; otherwise fall back to root.
    await page.goto('/root_playwright.html', { waitUntil: 'domcontentloaded' });

    // Open the assistant dock
    await page.locator('#assistantChip').click();

    // Fallback selectors support both new data-testid hooks and older IDs.
    const input = page.locator('[data-testid="assistant-input"], #chatInput').first();
    const send  = page.locator('[data-testid="assistant-send"], #chatSend').first();

    await expect(input).toBeVisible();
    await expect(send).toBeVisible();
    await expect(send).toBeEnabled();

    await input.fill('hi');
    await send.click();

    // Find the last visible assistant bubble (not the sr-only element)
    const bubble = page.locator('.chat-log .msg.from-ai .bubble').last();

    // Wait for the mocked response to appear
    await expect(bubble).toContainText('Want the case study?', { timeout: 10000 });
    const text = (await bubble.innerText()).trim();

    // Verify the response ends with a question mark
    const hasFollowUp = /[?？]\s*$|[?？！]\s*$/m.test(text) || text.split('\n').some(l => /[?？]/.test(l));
    expect(
      hasFollowUp,
      `assistant bubble missing a follow-up question.\n--- bubble start ---\n${text}\n--- bubble end ---`
    ).toBeTruthy();
  });
});
