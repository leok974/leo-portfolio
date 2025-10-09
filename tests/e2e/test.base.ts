/**
 * Default E2E test base with all fixtures applied automatically.
 * Import this instead of '@playwright/test' to get:
 * - localStorage seeding (AB analytics, dev tools, consent)
 * - Network stubs (LLM, analytics beacons)
 * - Animation disabling
 * - E2E mode detection
 */
import { test as base, expect as baseExpect, request as baseRequest } from '@playwright/test';

// Apply fixtures to all tests automatically
base.beforeEach(async ({ page }) => {
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

  // Stub agent metrics ingest
  await page.route('**/agent/metrics/ingest', route =>
    route.fulfill({ status: 204, body: '' })
  );

  // Stub external analytics services (if any)
  await page.route('**/collect', route =>
    route.fulfill({ status: 200, body: '{}' })
  );
});

export const test = base;
export const expect = baseExpect;
export const request = baseRequest;
