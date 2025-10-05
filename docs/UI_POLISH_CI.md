# UI Polish CI/CD Pipeline

Automated testing for Tailwind v4.1 polish utilities, custom CSS, and analytics beacons on every PR.

## GitHub Actions Workflow

**File**: `.github/workflows/e2e-ui-polish.yml`

### Key Features

- **Concurrency Control**: Auto-cancels outdated runs (`cancel-in-progress: true`)
- **Draft PR Skip**: Skips tests on draft PRs
- **Timeout Protection**: 15-minute max runtime
- **Cached Dependencies**: Faster runs with npm and Playwright caching
- **JUnit Reports**: Separate reports for UI polish and analytics suites
- **Comprehensive Artifacts**: Test results, HTML reports, and JUnit XML on failure

### Trigger Paths

Workflow runs on PR changes to:
- `tests/e2e/**` - E2E test files
- `src/styles/**` - CSS and Tailwind styles
- `tailwind.config.*` - Tailwind configuration
- `package.json` - Dependencies
- `.github/workflows/e2e-ui-polish.yml` - Workflow itself

**Weekly Schedule**: Mondays 09:00 UTC (catches toolchain drift)

### Workflow Steps

1. **Setup** - Checkout, Node.js 20, npm cache
2. **Install** - `npm ci` for reproducible builds
3. **Build** - `npm run build` to generate dist/
4. **Playwright** - Install Chromium (cached via `microsoft/playwright-github-action@v1`)
5. **Verify Import** - Guard against missing `tw-animate-css`
6. **Test UI Polish** - Run `@ui-polish` suite (4 tests, JUnit output)
7. **Test Analytics** - Run `@analytics-beacons` suite (4 tests, JUnit output)
8. **Upload Artifacts** - On failure, save test-results/, playwright-report/, and JUnit XMLs

### Example Run

```yaml
# --- UI polish suite ---
- name: Run UI polish tests
  run: npx playwright test -g "@ui-polish" --project=chromium --reporter=line,junit

- name: Rename JUnit (ui-polish)
  run: if [ -f junit.xml ]; then mv junit.xml junit-ui-polish.xml; fi

# --- Analytics beacons suite ---
- name: Run analytics beacons suite
  run: npx playwright test -g "@analytics-beacons" --project=chromium --reporter=line,junit

- name: Rename JUnit (analytics)
  run: if [ -f junit.xml ]; then mv junit.xml junit-analytics-beacons.xml; fi
```

**Environment Variables** (job-level):
- `PLAYWRIGHT_GLOBAL_SETUP_SKIP=1` - Skips backend health checks (frontend-only tests)
- `BASE_URL=http://127.0.0.1:5173` - Static preview server for analytics tests

## NPM Scripts

### Development

```bash
# Local test (with backend if configured)
npm run test:ui-polish

# Local test (frontend-only, skip backend)
$env:PLAYWRIGHT_GLOBAL_SETUP_SKIP='1'; npm run test:ui-polish
```

### CI/CD

```bash
# CI-optimized (frontend-only, Chromium only)
npm run test:ui-polish:ci
```

### Debugging

```bash
# Open trace files after failure
npm run trace:open
```

## Script Definitions

```json
{
  "test:ui-polish": "playwright test -g \"@ui-polish\"",
  "test:ui-polish:ci": "cross-env PLAYWRIGHT_GLOBAL_SETUP_SKIP=1 playwright test -g \"@ui-polish\" --project=chromium",
  "trace:open": "playwright show-trace test-results/**/trace.zip"
}
```

## Test Coverage

### UI Polish Suite (4 tests)

| Test | Validates | CI Impact |
|------|-----------|-----------|
| **tw-animate-css utilities** | Animation classes work | Catches missing import |
| **text-shadow-lg** | Tailwind v4.1 built-in | Catches plugin regressions |
| **hover-glow** | Custom utility with hover state | Validates CSS is applied |
| **aspect-video** | Tailwind v4.1 aspect ratio | Ensures built-in works |

### Analytics Beacons Suite (4 tests)

| Test | Validates | CI Impact |
|------|-----------|-----------|
| **DOM beacon** | Fires on page load | Catches tracking regressions |
| **Navigation beacon** | Fires on route change | Validates SPA navigation tracking |
| **Scroll beacon** | Fires on scroll interaction | Ensures scroll tracking works |
| **Chat beacon** | Fires on assistant interaction | Validates user engagement tracking |

**Total Runtime**: ~8 seconds (4 UI polish + 4 analytics)
| **hover-glow** | Custom utility | Catches CSS deletions |
| **aspect-video** | Tailwind v4.1 built-in | Catches plugin regressions |

## CI Hardening

### 1. Import Guard

```yaml
- name: Verify tw-animate-css import
  run: |
    if ! grep -R "tw-animate-css" src/styles; then
      echo "❌ Missing tw-animate-css import in src/styles"
      exit 1
    fi
    echo "✅ tw-animate-css import verified"
```

**Prevents**:
- Accidental removal of `@import "tw-animate-css"`
- Breaking animation utilities
- Failing builds in production

### 2. Chromium-Only Testing

```yaml
run: npx playwright install --with-deps chromium
```

**Benefits**:
- Faster CI runs (~50% faster than all browsers)
- Sufficient for CSS utility validation
- Reduced resource usage

### 3. Trace Upload on Failure

```yaml
- name: Upload traces on failure
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-traces-ui-polish
    path: test-results/**/trace.zip
    retention-days: 7
```

**Debugging**:
1. Download artifact from failed workflow
2. Run `npm run trace:open`
3. Inspect visual timeline, network, console

## Integration with Existing Workflows

### Option 1: Standalone Workflow (Current)

✅ **Pros**:
- Fast feedback (runs only on style changes)
- Clear pass/fail status
- Independent of other E2E tests

❌ **Cons**:
- Additional workflow run

### Option 2: Add to Main E2E Workflow

Add to existing `.github/workflows/e2e.yml`:

```yaml
- name: Run UI polish tests
  env:
    PLAYWRIGHT_GLOBAL_SETUP_SKIP: "1"
  run: npx playwright test -g "@ui-polish" --project=chromium
```

### Option 3: PR Smoke Suite

Include in smoke tests:

```bash
npm run smoke:pr && npm run test:ui-polish:ci
```

## Monitoring & Alerts

### Failure Scenarios

| Scenario | Detection | Fix |
|----------|-----------|-----|
| Missing `tw-animate-css` | Import guard fails | Add `@import "tw-animate-css"` to `src/styles/tailwind.css` |
| Text shadow not applied | Test fails | Check Tailwind config plugins |
| Hover glow missing | Test fails | Verify `.hover-glow` in `src/styles/tailwind.css` |
| Animation not running | Test fails | Check `tw-animate-css` version |
| Aspect ratio broken | Test fails | Verify Tailwind v4.1+ installed |

### Expected Results

```
Running 4 tests using 4 workers
  ✓ tw-animate-css utilities are available and animate (0.8s)
  ✓ text-shadow utility works (0.5s)
  ✓ hover-glow applies glow shadow on hover (0.6s)
  ✓ aspect-video utility sets aspect ratio (0.6s)

  4 passed (2.5s)
```

## Migration Notes

### Tailwind v4.1 Built-ins

If you fully migrate to built-in `text-shadow-*` utilities:

1. **Remove plugin** (optional):
   ```bash
   npm uninstall tailwindcss-textshadow
   ```

2. **Update config**:
   ```text
   plugins: [
     require("@tailwindcss/typography"),
     // Removed: require("tailwindcss-textshadow"),
   ],
   ```

3. **Tests continue working**: Already use `text-shadow-lg` ✅

### Plugin Removal Checklist

- [ ] Tests pass with built-in utilities
- [ ] Visual regression check (compare screenshots)
- [ ] Update CI workflow if needed
- [ ] Update documentation

## Troubleshooting

### CI Fails but Local Passes

**Cause**: Different Node/npm versions, missing cache

**Fix**:
```bash
# Match CI environment
nvm use 20
npm ci  # Not npm install
npm run build
npm run test:ui-polish:ci
```

### Trace Upload Missing

**Cause**: Artifact retention expired (7 days)

**Fix**: Re-run workflow or increase retention:
```yaml
retention-days: 30
```

### Chromium-Only Limitation

**Issue**: Need cross-browser validation

**Fix**: Update workflow to test all browsers:
```yaml
- name: Install Playwright
  run: npx playwright install --with-deps
# ...
- name: Run tests
  run: npx playwright test -g "@ui-polish"  # All browsers
```

## Performance Metrics

| Metric | Value | Impact |
|--------|-------|--------|
| **Workflow runtime** | ~2-3 min | Fast feedback |
| **Test execution** | ~2.5s | Minimal overhead |
| **Chromium install** | ~30s | Browser setup |
| **npm ci** | ~45s (cached) | Dependency install |
| **Build time** | ~2s | Vite build |

**Total PR overhead**: ~3 minutes per style change

## Related Documentation

- `docs/UI_POLISH_TESTS.md` - Test suite documentation
- `docs/TAILWIND_POLISH_COMPLETE.md` - Migration guide
- `tests/e2e/ui-polish.spec.ts` - Test implementation
- `.github/workflows/e2e-ui-polish.yml` - Workflow definition

## Future Enhancements

### Visual Regression Testing

Add Playwright screenshot comparison:

```typescript
test('hero section visual snapshot', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.hero')).toHaveScreenshot('hero.png');
});
```

### Performance Budgets

Add CSS size checks:

```yaml
- name: Check CSS bundle size
  run: |
    SIZE=$(stat -f%z dist/assets/*.css)
    if [ $SIZE -gt 100000 ]; then
      echo "CSS bundle too large: ${SIZE} bytes"
      exit 1
    fi
```

### Accessibility Checks

Add axe-core testing:

```typescript
import { injectAxe, checkA11y } from 'axe-playwright';

test('polish utilities are accessible', async ({ page }) => {
  await page.goto('/');
  await injectAxe(page);
  await checkA11y(page, '.hero');
});
```

---

✅ **Status**: Production-ready CI pipeline for UI polish validation
