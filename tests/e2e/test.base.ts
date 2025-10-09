/**
 * Default E2E test base with all fixtures applied automatically.
 * Import this instead of '@playwright/test' to get:
 * - localStorage seeding (AB analytics, dev tools, consent)
 * - Network stubs (LLM, analytics beacons)
 * - Animation disabling
 * - E2E mode detection
 */
import { test as base, expect as baseExpect, request as baseRequest } from '@playwright/test';
import { installApiMocks } from './fixtures/api-mocks';

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

  // Install API mocks for all backend endpoints
  await installApiMocks(page);

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
});

export const test = base;
export const expect = baseExpect;
export const request = baseRequest;
