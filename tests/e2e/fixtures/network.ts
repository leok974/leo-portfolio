/**
 * Network fixtures for deterministic testing
 * Stubs external LLM and analytics calls to prevent flaky network issues
 * Seeds localStorage with E2E-friendly flags
 */
import { test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    // Seed localStorage flags for E2E mode BEFORE navigating
    await page.addInitScript(() => {
      // Enable AB analytics in tests
      localStorage.setItem('ab.analytics.enabled', 'true');
      // Enable dev tools/privileged UI
      localStorage.setItem('dev.tools.enabled', 'true');
      // Consent flags (auto-granted in E2E)
      localStorage.setItem('consent.analytics', 'true');
      localStorage.setItem('consent.calendly', 'true');
    });

    // Disable animations - must happen AFTER page navigation
    page.on('load', async () => {
      await page.addStyleTag({
        content: `
          *,
          *::before,
          *::after {
            transition-duration: 0s !important;
            transition-delay: 0s !important;
            animation-duration: 0s !important;
            animation-delay: 0s !important;
          }
        `
      }).catch(() => {
        // Ignore errors if page is closing
      });
    });

    // Stub Ollama/LLM calls (to prevent 404s when model not available)
    await page.route('**/v1/chat/completions', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-completion',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-oss:20b',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: '**Test Insight**: All metrics within normal range. No action needed.'
            },
            finish_reason: 'stop'
          }]
        })
      })
    );

    // Stub analytics beacon calls
    await page.route('**/analytics/beacon', route =>
      route.fulfill({ status: 204, body: '' })
    );

    // Stub external analytics services (if any)
    await page.route('**/collect', route =>
      route.fulfill({ status: 200, body: '{}' })
    );

    await use(page);
  },
});

export const expect = base.expect;
