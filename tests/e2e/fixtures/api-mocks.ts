/**
 * API mocks fixture for E2E tests
 * Intercepts and mocks all backend API calls for deterministic testing
 */
import { Page } from '@playwright/test';

type Json = Record<string, any>;

export async function installApiMocks(page: Page) {
  // === AB analytics endpoints ===
  await page.route('**/agent/ab/suggest**', (route) => {
    const data: Json = {
      status: 'ok',
      better: 'A',
      ctr_a: 0.042,
      ctr_b: 0.038,
      hint: {
        'section.hero': 0.65,
        'section.pricing': 0.55,
      },
      winners: [
        { id: 'home.hero-A', uplift_pct: 3.8 },
        { id: 'pricing.card-C', uplift_pct: 2.1 }
      ],
      variants: [
        { id: 'home.hero-A', weight: 0.6 },
        { id: 'home.hero-B', weight: 0.4 }
      ],
      ts: Date.now(),
    };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });

  await page.route('**/agent/ab/summary**', (route) => {
    const data: Json = {
      status: 'ok',
      series: [
        { day: '2025-10-06', A_ctr: 0.042, B_ctr: 0.038, A_views: 1000, A_clicks: 42, B_views: 950, B_clicks: 36 },
        { day: '2025-10-07', A_ctr: 0.045, B_ctr: 0.041, A_views: 1100, A_clicks: 50, B_views: 1050, B_clicks: 43 },
        { day: '2025-10-08', A_ctr: 0.051, B_ctr: 0.044, A_views: 1200, A_clicks: 61, B_views: 1150, B_clicks: 51 },
      ],
      overall: {
        A_ctr: 0.046,
        B_ctr: 0.041,
        A: { views: 3300, clicks: 153 },
        B: { views: 3150, clicks: 130 },
        days: 3,
      },
    };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });

  await page.route('**/agent/ab/metrics**', (route) => {
    const data: Json = {
      status: 'ok',
      series: [
        { date: '2025-10-06', ctr: 0.042, conversions: 12 },
        { date: '2025-10-07', ctr: 0.045, conversions: 15 },
        { date: '2025-10-08', ctr: 0.051, conversions: 18 },
      ],
    };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });

  // === Maintenance overlay / feature status ===
  await page.route('**/agent/overlay/status**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ maintenance: false, enabled: true })
    })
  );

  await page.route('**/agent/dev/status**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ enabled: true, allowed: true })
    })
  );

  // === Analytics endpoints ===
  await page.route('**/analytics/beacon', (route) =>
    route.fulfill({ status: 204, contentType: 'text/plain', body: '' })
  );

  await page.route('**/analytics/latest', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        markdown: '## Test Insight\n\nAll metrics nominal.',
        trend: { kpis: [] }
      })
    })
  );

  await page.route('**/analytics/health', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'healthy' })
    })
  );

  // === Agent metrics ingest ===
  await page.route('**/agent/metrics/ingest', (route) =>
    route.fulfill({ status: 204, contentType: 'text/plain', body: '' })
  );

  // === Generic LLM endpoints (no-op) ===
  await page.route('**/v1/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'mock-completion',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-oss:20b',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Mock LLM response for testing'
          },
          finish_reason: 'stop'
        }]
      })
    })
  );

  // === External analytics services ===
  await page.route('**/collect', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  );
}
