# E2E Testing Quick Reference

## Running Tests

### Run all tests
```bash
npm run test:e2e
```

### Run specific file
```bash
npx playwright test tests/e2e/ops-agents.spec.ts
```

### Run with single worker (serial execution)
```bash
npx playwright test tests/e2e/ops-agents.spec.ts --workers=1
```

### Debug mode (opens browser, pauses execution)
```bash
# Windows (PowerShell)
$env:PWDEBUG="1"; npx playwright test tests/e2e/ops-agents.spec.ts

# Linux/Mac
PWDEBUG=1 npx playwright test tests/e2e/ops-agents.spec.ts
```

### UI mode (interactive test explorer)
```bash
npm run test:e2e:ui
```

### Run against live backend (skip mocks)
```bash
# Useful for smoke tests - requires backend running on port 8001
# Windows (PowerShell)
$env:E2E_LIVE="1"; npx playwright test tests/e2e/ops-agents.spec.ts

# Linux/Mac
E2E_LIVE=1 npx playwright test tests/e2e/ops-agents.spec.ts

# With custom base URL
E2E_LIVE=1 E2E_BASE_URL=http://localhost:8080 npx playwright test tests/e2e/ops-agents.spec.ts
```

## OpsAgents Test Coverage

The `ops-agents.spec.ts` file covers the Agent Task History UI:

| Test | What It Verifies |
|------|------------------|
| **loads, paginates, and shows rows** | Page loads, heading visible, "Load more" button exists |
| **filters by status pills and task list** | Status filter pills work, task input works, URL updates |
| **date presets update since and refetch** | Date preset buttons (Today, 7d, 30d) update filters |
| **download CSV link preserves filters** | CSV link href includes all current filters (status, task, since) |
| **Reset clears filters** | Reset button removes all filters from URL |

## Test Selectors (Locked)

All tests use `data-testid` attributes for stability:

- `since-input` - Date/time input field
- `preset-today`, `preset-7d`, `preset-30d` - Date preset buttons
- `status-pill-{status}` - Status filter pills (e.g., `status-pill-succeeded`)
- `task-input` - Task name input field
- `apply-btn` - Apply filters button
- `reset-btn` - Reset filters button
- `csv-link` - Download CSV anchor (test-friendly, deterministic href)
- `load-more` - Pagination button

**⚠️ Do not change these selectors** - they're referenced in tests.

## API Mocking

Tests mock two endpoints for deterministic results (unless `E2E_LIVE=1` is set):

1. **`/agents/tasks/paged`** - Returns paginated JSON
   - First page: 2 items + cursor
   - Second page: 2 items + null cursor
   - Filters work: status, task parameters

2. **`/agents/tasks/paged.csv`** - Returns CSV format
   - Fixed header + 1 sample row

### Live Mode (E2E_LIVE=1)
When `E2E_LIVE=1` is set, tests skip mocks and talk directly to your backend:
- Requires backend running on port 8001 (or custom `E2E_BASE_URL`)
- Useful for pre-deployment smoke tests
- Results depend on actual data in database

## Known Limitations

### Fixed-Position Admin Panel
The OpsAgents component is in a fixed-position admin panel (bottom-right). This causes viewport issues with Playwright's native `.click()` method.

**Solution:** Tests use `.evaluate(el => el.click())` to bypass viewport checks.

### Pagination Click
The "Load more" button test only verifies the button exists, not the click behavior. This is due to the fixed-position panel making reliable clicks difficult in automated tests.

**Manual verification recommended** for pagination click behavior.

### CSV Test
The CSV test now verifies the `<a>` tag's `href` attribute contains correct filters, rather than testing the popup window. This is more reliable and deterministic.

## CI/CD Integration

Tests run automatically on:
- Push to `main` branch
- Pull requests
- Manual workflow dispatch

### CI Jobs
1. **e2e (matrix: dev, strict)** - Runs with mocked APIs for determinism
2. **strict-full** - Full stack test with nginx + backend
3. **e2e-live** (optional) - Runs only on `workflow_dispatch` with `E2E_LIVE=1`

CI outputs:
- **Playwright report**: Uploaded on every run (`playwright-report-{mode}`)
- **Traces**: Uploaded on failure (`playwright-traces-{mode}`)
- **Retention**: 7 days

Download artifacts from GitHub Actions run summary page.

### Running Live Tests in CI
The `e2e-live` job is disabled by default (runs only on manual workflow dispatch). It:
- Starts the real backend API on port 8001
- Starts the dev UI on port 8080
- Runs tests with `E2E_LIVE=1` (no mocks)
- Useful for pre-deployment smoke tests

To trigger: Go to Actions → E2E workflow → Run workflow

## Debugging Failed Tests

1. **Check the HTML report**: `npx playwright show-report`
2. **View traces**: `npx playwright show-trace test-results/.../trace.zip`
3. **Run in headed mode**: Remove `headless: true` from config
4. **Use UI mode**: `npm run test:e2e:ui` for step-by-step debugging
5. **Check screenshots**: Located in `test-results/` after failure

## Best Practices

✅ **DO:**
- Use `data-testid` selectors (stable)
- Mock API responses for unit-level tests
- Use `E2E_LIVE=1` for smoke tests
- Keep tests independent (no shared state)

❌ **DON'T:**
- Query by text (localized, changes frequently)
- Query by CSS classes (Tailwind changes)
- Depend on external services in CI
- Share state between tests

## Adding New Tests

1. Add `data-testid` to new UI elements in component
2. Create test file: `tests/e2e/your-feature.spec.ts`
3. Add API mocks in `beforeEach` if needed
4. Use existing selectors as examples
5. Run locally with `--workers=1` first
6. Verify stability with `--repeat-each=3`

## Performance Tips

- **Parallel execution**: Default (faster, but may have race conditions)
- **Serial execution**: Use `--workers=1` (slower, but more stable)
- **Filter tests**: Use `-g "pattern"` to run subset
- **Skip setup**: Use `PW_SKIP_WS=1` if dev server already running

## Troubleshooting

### Tests timing out
- Increase timeout in test: `test.setTimeout(60000)`
- Check if backend is running (for `E2E_LIVE=1`)
- Verify dev server started: check port 5173

### Flaky tests
- Run with `--workers=1` to eliminate parallelism issues
- Add explicit `waitForURL` or `waitForResponse` calls
- Use `test.retry(2)` for known flaky tests

### Element not clickable
- Use `.evaluate(el => el.click())` for fixed-position elements
- Add `scrollIntoViewIfNeeded()` before click
- Check if element is visible with `expect(el).toBeVisible()`

## Resources

- [Playwright Documentation](https://playwright.dev)
- [E2E Testing Implementation Doc](../../E2E_TESTING_IMPLEMENTATION.md)
- [Component Source](../../src/components/OpsAgents.tsx)
- [API Endpoints](../../assistant_api/agents/routes.py)
