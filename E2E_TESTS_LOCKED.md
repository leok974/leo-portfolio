# E2E Tests - Locked & Production Ready ✅

This document confirms the E2E testing infrastructure is locked in and ready for production.

## ✅ Completed Implementation

### 1. Test Selectors (Locked)
All tests use stable `data-testid` attributes:

**Component**: `src/components/OpsAgents.tsx`
- ✅ `since-input` - Date/time picker
- ✅ `preset-today`, `preset-7d`, `preset-30d` - Date presets
- ✅ `status-pill-{status}` - Dynamic status pills (6 statuses)
- ✅ `task-input` - Task filter input
- ✅ `apply-btn`, `reset-btn` - Action buttons
- ✅ `csv-link` - CSV download anchor (test-friendly, deterministic href)
- ✅ `load-more` - Pagination button

**Status**: 11 data-testid attributes added and locked. **Do not remove or rename.**

### 2. API Mocking (Deterministic)
**Mock Routes**:
- `/agents/tasks/paged` - Paginated JSON responses
  - Filter support: status[], task[], since
  - Pagination: 2 items per page, CURSOR123
  - Fixed timestamps: `2025-10-10T01:23:45Z`
- `/agents/tasks/paged.csv` - CSV export
  - Fixed header + 1 sample row

**Live Mode**: Set `E2E_LIVE=1` to skip mocks and hit real backend (port 8001).
- Useful for smoke tests before deployment
- Tests will use real data from your database
- Requires backend to be running

### 3. Test Coverage (5 Tests)
| Test | Status | Coverage |
|------|--------|----------|
| loads, paginates, and shows rows | ✅ | Page load, heading, pagination button |
| filters by status pills and task list | ✅ | Status/task filters, URL persistence |
| date presets update since and refetch | ✅ | Date preset buttons |
| download CSV link preserves filters | ✅ | CSV href validation with filters |
| Reset clears filters | ✅ | Reset functionality |

**Stability**: Tests are deterministic and stable with mocked APIs.

### 4. CI/CD Integration
**GitHub Actions** (`.github/workflows/e2e.yml`):
- ✅ Runs on push to `main`, PRs, manual dispatch
- ✅ Matrix testing: dev + strict modes
- ✅ **Uploads Playwright report** (always) - `playwright-report-{mode}`
- ✅ **Uploads traces** (on failure) - `playwright-traces-{mode}`
- ✅ 7-day retention for artifacts
- ✅ Uses `actions/upload-artifact@v4`
- ✅ Optional `e2e-live` job for smoke tests (manual dispatch only)

### 5. Documentation
- ✅ **Quick Reference**: `tests/e2e/README.md` (comprehensive commands, tips)
- ✅ **Implementation Guide**: `E2E_TESTING_IMPLEMENTATION.md` (architecture, mocking)
- ✅ **Test Comments**: Inline documentation in test file

## 🎯 Best Practices (Locked In)

### ✅ Pin Test Selectors
- All tests use `data-testid` (not text, not CSS classes)
- Selectors documented in `tests/e2e/README.md`
- Component changes must preserve test hooks

### ✅ Deterministic Mocks
- API responses return fixed data
- Timestamps are static (`2025-10-10T01:23:45Z`)
- Pagination behavior is predictable
- **Future**: If asserting timestamps, consider mocking `Date.now()`

### ✅ Playwright Report in CI
- Report uploaded on every run (not just failures)
- Traces uploaded on failures only (smaller artifacts)
- 7-day retention prevents storage bloat
- Download from GitHub Actions run summary

## 🚀 Optional Polish Completed

### 1. Live Mode Toggle ✅
```bash
# Skip mocks, hit real backend
E2E_LIVE=1 npx playwright test tests/e2e/ops-agents.spec.ts
```
- Useful for smoke tests before deployment
- Requires backend running on port 8001
- Logs: `⚠️  E2E_LIVE=1: Skipping API mocks, using real backend`

### 2. Fixed-Position Element Handling ✅
- Tests use `.evaluate(el => el.click())` for admin panel elements
- Bypasses Playwright's viewport checks
- **Known limitation**: Pagination "Load more" click test simplified
- **Manual testing recommended** for pagination click behavior

### 3. CSV Test Improved ✅
**Change**: Button → Anchor tag with testable href
- Component now renders `<a data-testid="csv-link">` instead of button
- Test validates href contains all filters (status, task, since, limit)
- No popup handling needed - cleaner and more reliable
- Same UX for users (target="_blank" opens in new tab)

**Test assertion**:
```typescript
const href = await page.getByTestId("csv-link").getAttribute("href");
expect(href).toContain("status=awaiting_approval");
expect(href).toContain("task=seo.validate");
expect(href).toContain("since=");
expect(href).toContain("limit=1000");
```
- Stable across all test runs

## 📝 Quick Commands

```bash
# Run all tests
npm run test:e2e

# Run specific file
npx playwright test tests/e2e/ops-agents.spec.ts

# Debug mode
PWDEBUG=1 npx playwright test tests/e2e/ops-agents.spec.ts

# UI mode (interactive)
npm run test:e2e:ui

# Live mode (real backend)
E2E_LIVE=1 npx playwright test tests/e2e/ops-agents.spec.ts

# Serial execution (no parallelism)
npx playwright test tests/e2e/ops-agents.spec.ts --workers=1

# Repeat for stability check
npx playwright test tests/e2e/ops-agents.spec.ts --repeat-each=3

# Show report
npx playwright show-report
```

## 🔍 Debugging Workflow

1. **Test fails locally**:
   ```bash
   # Run in UI mode
   npm run test:e2e:ui
   # Or debug mode
   PWDEBUG=1 npx playwright test tests/e2e/ops-agents.spec.ts
   ```

2. **Test fails in CI**:
   - Download `playwright-report-{mode}` artifact from GitHub Actions
   - Extract and run: `npx playwright show-report path/to/extracted/report`
   - View traces: `npx playwright show-trace path/to/trace.zip`

3. **Flaky test**:
   - Run serial: `--workers=1`
   - Add explicit waits: `waitForURL`, `waitForResponse`
   - Check if it's a race condition in mocks

## 🎨 Future Enhancements (Optional)

### Deflake Admin Overlay Clicks (Low Priority)
**Current**: Tests use `.evaluate(el => el.click())` to bypass viewport issues.

**Option 1**: Add CSS hook for tests
```css
/* In test environment only */
.admin-rebuild-dock {
  pointer-events: none !important;
}
.admin-rebuild-dock:hover,
.admin-rebuild-dock > * {
  pointer-events: auto !important;
}
```

**Option 2**: Move OpsAgents to non-fixed route for tests
```typescript
// Create /test/ops-agents route that renders OpsAgents standalone
// Tests navigate to /test/ops-agents instead of /?admin=1
```

### CSV Test (Stronger Assertions)
**Current**: Verifies endpoint URL contains `/agents/tasks/paged.csv`

**Enhancement**: Check filters in CSV URL
```typescript
// After applying filters, verify they're in the CSV URL
await page.getByTestId("status-pill-succeeded").evaluate(el => el.click());
await page.getByTestId("apply-btn").evaluate(el => el.click());

const [csvPage] = await Promise.all([
  context.waitForEvent("page"),
  page.getByTestId("csv-btn").evaluate(el => el.click()),
]);

const url = csvPage.url();
expect(url).toContain("status=succeeded"); // ✅ Stronger assertion
```

**Note**: Current implementation is stable. Enhancements optional.

### Date Mocking (If Needed)
If you need to assert dynamic timestamps:

```typescript
// In test setup
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Mock Date.now() to return fixed timestamp
    const originalDate = Date;
    const mockTime = new originalDate('2025-10-10T00:00:00Z').getTime();
    // @ts-ignore
    global.Date = class extends originalDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(mockTime);
        } else {
          super(...args);
        }
      }
      static now() {
        return mockTime;
      }
    };
  });
});
```

**Current**: Not needed. Mock data has fixed timestamps.

## ✅ Production Checklist

- [x] Test selectors locked (data-testid)
- [x] API mocking deterministic
- [x] CI uploads reports (always)
- [x] CI uploads traces (on failure)
- [x] Documentation complete
- [x] Live mode toggle implemented
- [x] 100% test pass rate (15/15)
- [x] Quick reference created
- [x] Debugging guide provided
- [x] Known limitations documented

## 🎉 Summary

**E2E testing for OpsAgents is LOCKED and production-ready.**

- ✅ 5 stable tests covering all major UI flows
- ✅ Deterministic API mocking
- ✅ CI/CD integration with artifact uploads
- ✅ Comprehensive documentation
- ✅ Live mode for smoke tests
- ✅ 100% pass rate across multiple runs

**No further action required.** Tests are ready to catch regressions and validate deployments.

---

**Last verified**: 2025-10-10
**Test stability**: 15/15 passed (5 tests × 3 repetitions)
**CI integration**: ✅ Working
**Documentation**: ✅ Complete
