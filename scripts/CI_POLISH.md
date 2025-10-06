# CI Polish Improvements - Fast, Low-Risk Enhancements

## Overview

This guide documents production-grade CI/CD polish improvements for Playwright test automation. These changes focus on **fail-fast behavior**, **rich diagnostics**, **quarantine patterns**, and **developer ergonomics**.

---

## 1. Fail Fast in CI (Stop After First Red)

### ✅ Implementation

All CI workflows now use `--max-failures=1` to stop immediately on the first test failure.

**Benefits**:
- Save CI minutes (stop early instead of running all tests)
- Faster feedback (fail in 2 min instead of waiting 15 min)
- Reduced noise (one failure at a time to fix)

**Workflows Updated**:
- `.github/workflows/e2e-hermetic.yml` (fast-frontend + full-stack jobs)
- `.github/workflows/e2e-ui-polish.yml` (UI polish + analytics suites)

**Example**:
```bash
npx playwright test -g "@ui-polish" --max-failures=1 --reporter=line,junit
```

**Local Override**:
```bash
# Run all tests locally (no fail-fast)
npm run test:all

# Fail-fast for quick iteration
npm run test:fast
```

---

## 2. Retries + Rich Artifacts Only in CI

### ✅ Implementation

`playwright.config.ts` now distinguishes between CI and local environments:

```typescript
const isCI = !!process.env.CI;

export default defineConfig({
  retries: isCI ? 2 : 0,  // 2 retries in CI for flaky network/timing
  use: {
    trace: isCI ? 'on-first-retry' : 'retain-on-failure',
    video: isCI ? 'on-first-retry' : 'off',
    screenshot: 'only-on-failure',
  },
});
```

**Benefits**:
- **CI**: Automatic retry for transient failures (network, timing)
- **Local**: No retries = faster iteration, clearer failures
- **Traces/Videos**: Only captured on retry in CI (saves storage)

**Override Locally**:
```bash
# Force CI-like behavior locally
CI=1 npm run test:all
```

---

## 3. Quarantine Tag (Keep Flaky Tests From Blocking)

### ✅ Implementation

**Separate workflow**: `.github/workflows/e2e-quarantine.yml`
- Runs tests tagged with `@quarantine`
- `continue-on-error: true` - doesn't block PR merges
- Runs daily on schedule to monitor quarantined tests

**Main workflows** now exclude quarantined tests:
```bash
npx playwright test -g "^(?!.*@quarantine).*$" --project=chromium
```

**Usage Pattern**:
```typescript
// Mark flaky test temporarily
test('@quarantine - Chat stream with slow network', async ({ page: _page }) => {
  // Test code...
});
```

**npm Scripts**:
```bash
# Run only quarantined tests (allowed to fail)
npm run test:quarantine

# Run non-quarantined tests (must pass)
npm run test:non-quarantine
```

**Benefits**:
- Flaky tests don't block PRs
- Still monitored daily
- Clear visibility which tests need fixing

---

## 4. Parallel Shards (Speed)

### ✅ Implementation

**New workflow**: `.github/workflows/e2e-sharded.yml`
- Matrix strategy runs 4 parallel shards
- Each shard runs 1/4 of the test suite
- Results merged into single HTML report

**Example**:
```yaml
strategy:
  matrix:
    shard: [1, 2, 3, 4]
steps:
  - run: npx playwright test --shard=${{ matrix.shard }}/4
```

**npm Scripts**:
```bash
# Manual sharding
npm run test:shard:1  # Run shard 1/2
npm run test:shard:2  # Run shard 2/2
```

**When to Use**:
- Large test suites (100+ tests)
- Need faster CI feedback
- Have available GitHub Actions minutes

**Performance**:
- 100 tests @ 15 min → 4 shards = ~4 min (4x speedup)

---

## 5. Upload HTML Report on Failure

### ✅ Implementation

All workflows now generate and upload HTML reports on test failures:

```yaml
- name: Generate HTML report (on failure)
  if: failure()
  run: npx playwright show-report --output=playwright-report || true

- name: Upload HTML report
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-html-report
    path: playwright-report/**
```

**Benefits**:
- Quick triage with interactive HTML report
- Screenshots, traces, and videos inline
- No need to download raw test-results

**Accessing Reports**:
1. Go to failed workflow run
2. Artifacts section → `playwright-html-report`
3. Download and open `index.html`

---

## 6. PR Annotations (Inline Test Results)

### ✅ Implementation

Uses `mikepenz/action-junit-report@v4` to annotate PRs with test failures:

```yaml
- name: Annotate PR with test results
  if: failure()
  uses: mikepenz/action-junit-report@v4
  with:
    report_paths: "junit*.xml"
    check_name: "Playwright Tests (Frontend)"
    include_passed: false
    annotate_only: true
```

**Benefits**:
- See failing test names directly in PR
- No need to click into workflow logs
- Linked to exact line numbers (if applicable)

**Example PR Annotation**:
```
❌ Playwright Tests (Frontend)
- tests/e2e/ui-polish.spec.ts:42 - Button hover effect animation
- tests/e2e/analytics.spec.ts:18 - Clarity beacon fires on page load
```

---

## 7. Public Smoke Guard with Default Skip

### ✅ Implementation

**Environment Variable Guard**:
```yaml
- name: Public smoke (optional)
  if: vars.PUBLIC_BASE_URL != ''
  env:
    PUBLIC_BASE_URL: ${{ vars.PUBLIC_BASE_URL }}
  run: npx playwright test -g "@public" --project=chromium
```

**Benefits**:
- Silent for forks (no PUBLIC_BASE_URL set)
- Only runs in main repo with production URL
- Prevents credential leakage in fork PRs

**Local Testing**:
```bash
PUBLIC_BASE_URL=https://assistant.ledger-mind.org npm run test:grep -- "@public"
```

---

## 8. Playwright Config Optimizations

### ✅ Lower Navigation Timeout for CSS/UX Tests

**New project configuration**:
```typescript
// Example project configuration
const _project = {
  name: 'chromium-ui-polish',
  testMatch: /.*@ui-polish.*/,
  use: {
    navigationTimeout: 10_000, // 10s instead of 15s
  },
};
```

**Benefits**:
- Faster failures for CSS/UX tests (don't need 30s)
- UI polish tests are snappier
- Still 10s timeout = plenty for static content

**Adding @slow Tag**:
```typescript
test('@slow - Full RAG document ingestion', async ({ page: _page }) => {
  test.setTimeout(120_000); // 2 minutes
  // Long-running test...
});
```

---

## 9. Dev Ergonomics (npm Wrappers)

### ✅ New npm Scripts

```json
{
  "test:changed": "git diff origin/main...HEAD | grep -E '^(src|tests)/' && pwsh ./scripts/test-all.ps1 -FrontendOnly",
  "test:quarantine": "npx playwright test -g '@quarantine' --reporter=line || true",
  "test:non-quarantine": "npx playwright test -g '^(?!.*@quarantine).*$' --reporter=line",
  "test:shard:1": "npx playwright test --shard=1/2 --reporter=line",
  "test:shard:2": "npx playwright test --shard=2/2 --reporter=line"
}
```

**Usage**:
```bash
# Run only tests for changed files
npm run test:changed

# Quick quarantine check
npm run test:quarantine

# Local parallel execution
npm run test:shard:1 & npm run test:shard:2
```

---

## 10. Tiny Tunnel Sanity Check

### ✅ One-Liner Health Probe

**Script**: `scripts/tunnel-probe.ps1`

```powershell
pwsh ./scripts/tunnel-probe.ps1
# Output: ✅ OK: 142 bytes
```

**Custom URL**:
```powershell
pwsh ./scripts/tunnel-probe.ps1 -Url "https://your-domain.com" -TimeoutSec 10
```

**Benefits**:
- Quick production health check
- No need for full test suite
- Can run from any machine (no dependencies)

---

## Summary of All Improvements

| Improvement | Files Changed | Benefit | Impact |
|-------------|---------------|---------|--------|
| Fail-fast (--max-failures=1) | 2 workflows | Save CI minutes | ✅ Low-risk |
| CI-only retries/traces | playwright.config.ts | Faster local, resilient CI | ✅ Low-risk |
| @quarantine tag | New workflow | Unblock PRs | ✅ Low-risk |
| Parallel shards | New workflow | 4x faster (optional) | ✅ Optional |
| HTML report upload | 2 workflows | Easy triage | ✅ Low-risk |
| PR annotations | 2 workflows | Inline failures | ✅ Low-risk |
| Public smoke guard | Documented pattern | Fork-safe | ✅ Low-risk |
| Lower nav timeout | playwright.config.ts | Snappier UI tests | ✅ Low-risk |
| npm wrappers | package.json | Dev convenience | ✅ Low-risk |
| Tunnel probe | New script | Production checks | ✅ Low-risk |

**Total Changes**: 10 improvements across 8 files

---

## Quick Start

### 1. Run Tests Locally (No Changes Needed)
```bash
npm run test:all              # Full hermetic suite
npm run test:all:frontend     # Frontend-only (fastest)
npm run test:changed          # Only changed files
```

### 2. Tag Flaky Tests as @quarantine
```typescript
test('@quarantine - Flaky WebSocket test', async ({ page: _page }) => {
  // This won't block PRs but will run daily
});
```

### 3. Enable Sharding (Optional)
```bash
# Update .github/workflows/e2e-sharded.yml
# Set shards: [1, 2, 3, 4] in matrix
```

### 4. Check Production Health
```bash
pwsh ./scripts/tunnel-probe.ps1
```

---

## CI Workflow Overview

### Fast Lane (5 min)
```
e2e-hermetic: fast-frontend
  ├─ Build site
  ├─ Run @ui-polish + @analytics-beacons
  ├─ Stop on first failure (--max-failures=1)
  ├─ Upload HTML report (if failed)
  ├─ Annotate PR with failures
  └─ Upload diagnostics
```

### Full Lane (25 min)
```
e2e-hermetic: full-stack
  ├─ Docker services (test mode)
  ├─ Run complete suite
  ├─ Stop on first failure (--max-failures=1)
  ├─ Upload HTML report (if failed)
  ├─ Annotate PR with failures
  └─ Upload diagnostics
```

### Quarantine Lane (allowed to fail)
```
e2e-quarantine
  ├─ Run @quarantine tests
  ├─ continue-on-error: true
  ├─ Comment on PR if fails
  └─ Daily schedule for monitoring
```

---

## Troubleshooting

### Q: HTML report not showing up in artifacts
A: Ensure `npx playwright show-report` runs before upload step

### Q: PR annotations not appearing
A: Check that `mikepenz/action-junit-report@v4` step runs after test failure

### Q: Quarantine tests still blocking PRs
A: Verify `continue-on-error: true` in job definition

### Q: Sharding not working
A: Ensure all shards use same `--shard=X/N` format

### Q: Tunnel probe times out
A: Check network connectivity, increase `-TimeoutSec` parameter

---

## Best Practices

### ✅ DO
- Use `@quarantine` for temporarily flaky tests
- Monitor quarantine workflow daily
- Keep HTML reports for 7 days (triage window)
- Use fail-fast in CI (save minutes)
- Run full suite locally before pushing

### ❌ DON'T
- Leave tests in quarantine forever (fix within 2 weeks)
- Skip retries in CI (network flakes are real)
- Upload videos/traces on every run (storage cost)
- Ignore quarantine failures (they indicate real issues)

---

## Future Enhancements

1. **Visual regression testing** - Automated screenshot comparison
2. **Performance budgets** - Fail on slow page loads
3. **Smart test selection** - Run only affected tests based on git diff
4. **Flaky test detection** - Auto-quarantine tests with <80% pass rate
5. **Test result caching** - Skip unchanged tests on repeat runs

---

## Related Documentation

- **README.md** - Main project documentation
- **scripts/HERMETIC_TEST_IMPROVEMENTS.md** - Hermetic test suite phase 1
- **scripts/HERMETIC_TEST_PRODUCTION.md** - Production features phase 2
- **scripts/HERMETIC_TEST_SUMMARY.md** - Complete implementation summary

---

## Support

For issues or questions about CI polish improvements, check:
1. This documentation
2. GitHub workflow logs
3. Diagnostic bundles in artifacts
4. Playwright HTML reports
