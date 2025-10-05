# Analytics Testing

## Overview

The analytics beacon e2e tests validate client-side telemetry without requiring a backend. They use Playwright route interception to capture `navigator.sendBeacon` calls and verify the payload structure and behavior.

## Test Files

- **`tests/e2e/analytics-beacons.spec.ts`**: Four tests validating analytics beacon behavior:
  - `page_view` beacon fires on first load
  - `scroll_depth` beacon emits after scrolling
  - `link_click` beacon tracks outbound links
  - `resume` link click + `dwell` beacon on visibility change

- **`tests/e2e/utils/beacons.ts`**: Beacon capture utility with route interception helper
  - `Beacon` interface matching actual payload structure
  - `captureBeacons(page, urlGlob)` helper for route interception
  - Handles both `application/json` and `text/plain` content types

- **`tests/e2e/metrics.smoke.spec.ts`**: Simple reachability test for `/metrics` endpoint

## Running the Tests

### Quick Start

```bash
# In one terminal: start static server
npm run serve

# In another terminal: run analytics tests
npm run test:analytics
```

### Individual Test Suites

```bash
# Run only beacon tests
npm run test:analytics-beacons

# Run all @analytics tagged tests (beacons + metrics smoke)
npm run test:analytics
```

## How It Works

1. **Static Server**: Tests run against `dist/` served on port 5173 (via `http-server`)
2. **Route Interception**: Playwright intercepts `/analytics/collect` POST requests
3. **Beacon Capture**: JSON payloads are captured in-memory without hitting the backend
4. **Assertions**: Tests validate beacon structure, timing, and behavior

## Test Configuration

- **BASE_URL**: Set to `http://127.0.0.1:5173` (static server, not full-stack 8080)
- **PW_SKIP_WS**: Skips workspace server startup (not needed for static tests)
- **PLAYWRIGHT_GLOBAL_SETUP_SKIP**: Bypasses global setup for faster iteration

## Beacon Structure

```typescript
interface Beacon {
  type: string;            // "page_view" | "dwell" | "scroll_depth" | "link_click" | "session_start"
  ts: number | string;     // Unix timestamp
  path?: string;           // Page path
  ref_host?: string;       // Referrer hostname
  device?: string;         // "mobile" | "tablet" | "desktop"
  theme?: string;          // "dark" | "light"
  meta?: Record<string, any>; // Type-specific metadata
}
```

### Beacon Types

- **`page_view`**: Fires on initial page load; includes `path`, `device`, `theme`, `ref_host`
- **`scroll_depth`**: Emits when user scrolls past depth thresholds (25%, 50%, 75%, 100%); `meta.percent` contains the depth bin
- **`link_click`**: Tracks clicks on outbound/external links; `meta.href` contains the full URL, `meta.kind` may contain link classification
- **`dwell`**: Fires on `visibilitychange` (hidden) or `pagehide` events; `meta.seconds` contains time spent on page

## Privacy-First Design

The analytics implementation is privacy-first:
- **No cookies**: All tracking uses ephemeral beacons
- **No session tracking**: `anon_session` is stored locally but never sent to the server
- **DNT respect**: Analytics code checks `doNotTrack` and bails early if enabled
- **Minimal data**: Only collects page path, device type, theme, and referrer hostname

## Troubleshooting

### Tests Fail with "ERR_CONNECTION_REFUSED"

**Cause**: Static server not running on port 5173

**Fix**: Start the server in a separate terminal:
```bash
npm run serve
```

### Tests Show Empty Beacons Array

**Cause**: BASE_URL pointing to wrong port (e.g., 8080 full-stack instead of 5173 static)

**Fix**: The test scripts already set `BASE_URL=http://127.0.0.1:5173`. If you're running custom commands, ensure this env var is set.

### Dwell Beacon Not Captured

**Cause**: Visibility change event not triggered (browser optimizations)

**Fix**: Tests now explicitly trigger visibility change via:
```text
Object.defineProperty(document, 'visibilityState', { value: 'hidden' });
document.dispatchEvent(new Event('visibilitychange'));
```

## CI Integration

To integrate these tests in CI:

1. Build the frontend: `npm run build`
2. Start static server in background: `npm run serve &`
3. Wait for server to be ready (e.g., `wait-on http://127.0.0.1:5173`)
4. Run tests: `npm run test:analytics`
5. Kill server process

Example GitHub Actions:
```yaml
- name: Build frontend
  run: npm run build

- name: Start static server
  run: npm run serve &

- name: Wait for server
  run: npx wait-on http://127.0.0.1:5173

- name: Run analytics tests
  run: npm run test:analytics
```

## Adding New Tests

1. Add test case to `tests/e2e/analytics-beacons.spec.ts`
2. Use `captureBeacons(page)` to intercept beacon calls
3. Trigger the user interaction (scroll, click, etc.)
4. Use `byType(beacons, 'beacon_type')` to filter captured beacons
5. Assert on beacon structure and metadata

Example:
```typescript
test('validates custom beacon', async ({ page, baseURL }) => {
  const beacons = await captureBeacons(page);
  await page.goto(baseURL!);

  // Trigger custom event
  await page.evaluate(() => {
    window.trackCustomEvent('action', { detail: 'value' });
  });

  await page.waitForTimeout(200);

  const custom = byType(beacons, 'custom_event');
  expect(custom.length).toBeGreaterThan(0);
  expect(custom[0].meta?.detail).toBe('value');
});
```

## References

- [Analytics Documentation](./analytics.md)
- [Grafana Dashboard](./grafana-portfolio-analytics.json)
- [Playwright Route Interception](https://playwright.dev/docs/api/class-route)
