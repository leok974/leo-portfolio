/**
 * E2E Test: Agent Content Refresh
 *
 * Tests the agent's ability to trigger GitHub Actions workflow
 * for content refresh (projects, skills, OG images).
 *
 * Prerequisites:
 * - VITE_AGENT_REFRESH_URL configured (Cloudflare Worker URL)
 * - VITE_AGENT_ALLOW_KEY configured (shared secret)
 * - Worker deployed with GH_PAT and ALLOW_KEY
 *
 * @tag @agent @refresh
 */

import { test, expect } from '@playwright/test';

test.describe('Agent Content Refresh', () => {
  test.skip(!process.env.VITE_AGENT_ALLOW_KEY, 'VITE_AGENT_ALLOW_KEY not configured');

  test('should detect "sync projects" command @agent', async ({ page }) => {
    // This test validates command detection only (no actual dispatch in CI)
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__APP_READY__ === true);

    // Add test helper to expose detectCommand
    await page.evaluate(() => {
      (window as any).__testDetectCommand = async (input: string) => {
        const { detectCommand } = await import('../../apps/portfolio-ui/src/agent/commands');
        return detectCommand(input);
      };
    });

    // Test various input patterns
    const testCases = [
      { input: 'sync projects', expected: 'sync-projects' },
      { input: 'pull repos', expected: 'sync-projects' },
      { input: 'update skills', expected: 'update-skills' },
      { input: 'refresh portfolio', expected: 'refresh-portfolio' },
      { input: 'redeploy site', expected: 'refresh-portfolio' },
      { input: 'just chatting', expected: null }
    ];

    for (const { input, expected } of testCases) {
      const detected = await page.evaluate(async (inp) => {
        return await (window as any).__testDetectCommand(inp);
      }, input);

      expect(detected).toBe(expected);
    }
  });

  test('should dispatch workflow for "update skills" @agent @refresh', async ({ page }) => {
    // Skip in CI unless explicitly enabled
    test.skip(!process.env.ENABLE_AGENT_REFRESH_TESTS, 'Agent refresh tests disabled (set ENABLE_AGENT_REFRESH_TESTS=1)');

    await page.goto('/');
    await page.waitForFunction(() => (window as any).__APP_READY__ === true);

    // Open chat (adjust selector based on your UI)
    const chatInput = page.getByPlaceholder(/type a message/i);
    if (!await chatInput.isVisible()) {
      await page.getByRole('button', { name: /chat/i }).click();
      await expect(chatInput).toBeVisible({ timeout: 3000 });
    }

    // Send command
    await chatInput.fill('update skills');
    await page.keyboard.press('Enter');

    // Verify response indicating dispatch
    await expect(page.getByText(/refresh dispatched/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/ping you when ci finishes/i)).toBeVisible({ timeout: 5000 });
  });

  test('should handle workflow dispatch errors gracefully @agent', async ({ page }) => {
    test.skip(!process.env.ENABLE_AGENT_REFRESH_TESTS, 'Agent refresh tests disabled');

    await page.goto('/');
    await page.waitForFunction(() => (window as any).__APP_READY__ === true);

    // Intercept and fail the request
    await page.route('**/agent/refresh', route => {
      route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'GitHub dispatch failed' })
      });
    });

    const chatInput = page.getByPlaceholder(/type a message/i);
    if (!await chatInput.isVisible()) {
      await page.getByRole('button', { name: /chat/i }).click();
      await expect(chatInput).toBeVisible({ timeout: 3000 });
    }

    await chatInput.fill('sync projects');
    await page.keyboard.press('Enter');

    // Should show error message
    await expect(page.getByText(/that failed/i)).toBeVisible({ timeout: 10000 });
  });

  test('should call Cloudflare Worker with correct payload @agent', async ({ request }) => {
    const workerUrl = process.env.VITE_AGENT_REFRESH_URL || 'https://agent-refresh.leoklemet.workers.dev';
    const allowKey = process.env.VITE_AGENT_ALLOW_KEY;

    if (!allowKey) {
      test.skip(true, 'VITE_AGENT_ALLOW_KEY not set');
      return;
    }

    // Mock request to verify payload structure
    const response = await request.post(workerUrl, {
      headers: {
        'Content-Type': 'application/json',
        'x-agent-key': allowKey
      },
      data: {
        reason: 'sync-projects',
        ref: 'main'
      }
    });

    // Should be accepted (202) or succeed (200)
    expect([200, 202]).toContain(response.status());

    const body = await response.json();
    expect(body).toHaveProperty('dispatched', true);
    expect(body).toHaveProperty('reason', 'sync-projects');
  });
});
