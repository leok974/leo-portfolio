# E2E Testing Infrastructure - Hardening Complete

**Date:** 2025-10-07
**Commit:** f5b78c9
**Status:** ✅ Ready for Final Validation

## 🎯 Root Cause Fixed

**The Bug:** Frontend `devGuard.ts` checked `data.enabled` while backend returned `{allowed: true}`.

**Result:** Tools page showed "Tools Unavailable" despite cookie being set correctly and API returning 200 OK.

## ✅ Hardening Patches Applied

### 1. Backend API - Future-Proof Shape (`assistant_api/routers/agent_public.py`)

```python
@router.get("/dev/status")
def dev_status(sa_dev: Optional[str] = Cookie(default=None)):
    """Returns both 'enabled' and 'allowed' keys for API compatibility."""
    key = os.environ.get("SITEAGENT_DEV_COOKIE_KEY", "")
    if not key or not sa_dev:
        return {"enabled": False, "allowed": False}
    ok = _verify_dev(sa_dev, key) is not None
    return {"enabled": ok, "allowed": ok}
```

**Impact:** Both frontend keys now work, preventing future drift.

### 2. Frontend Guard - Resilient Logic (`src/lib/devGuard.ts`)

```typescript
export async function isPrivilegedUIEnabled(): Promise<boolean> {
  try {
    const res = await fetch("/agent/dev/status", { cache: "no-store" });
    if (!res.ok) return false;
    const data = await res.json();

    // Accept either 'enabled' or 'allowed' (boolean or "1")
    const val = data?.enabled ?? data?.allowed;
    return val === true || val === "1";
  } catch {
    return false;
  }
}
```

**Impact:** Handles both API shapes + legacy "1" string values.

### 3. Test Infrastructure - Stable & Fast (`tests/e2e/lib/overlay.ts`)

```typescript
export async function enableOverlayOnPage(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(async () => {
    await fetch('/agent/dev/enable', { method: 'POST' });
  });
  // Small settle to ensure cookie write is visible
  await page.waitForTimeout(100);
}
```

**Impact:** Origin-based cookie with minimal wait time (reduced from 500ms).

### 4. Test Assertions - waitFor Pattern

**Before:**
```typescript
await expect(page.getByTestId("ab-analytics")).toBeVisible({ timeout: 10000 });
```

**After:**
```typescript
await page.getByTestId("ab-analytics").waitFor({ state: "visible" });
```

**Impact:** More explicit wait pattern, clearer intent.

### 5. Toast Test - Test ID Selector

**Before:**
```typescript
const toast = page.locator('[data-sonner-toast]');
```

**After:**
```typescript
const toast = page.getByTestId('toast');
```

**Impact:** Stable selector that survives DOM changes.

## 📊 Test Infrastructure Status

### Backend Configuration ✅
- FastAPI running without `--reload` (no restarts during file writes)
- `SCHEDULER_ENABLED=0` (deterministic tests)
- `SITEAGENT_DEV_COOKIE_KEY=test-key-for-e2e-only` (signed cookies)
- `APP_ENV=dev` (httponly=false for JS cookie access)

### Frontend Configuration ✅
- Vite dev server with `/agent` proxy → `http://127.0.0.1:8001`
- HMR enabled for fast iteration
- Multi-page build (index.html + tools.html)

### Playwright Setup ✅
- Global setup seeds data once (no race conditions)
- Auto-starts both servers (backend + frontend)
- Test IDs for stable selectors
- Origin-based cookie helper

## 🔍 Validation Checklist

Before running full test suite:

1. **Backend API Check:**
   ```powershell
   curl http://127.0.0.1:8001/agent/dev/status
   # Should return: {"enabled":false,"allowed":false}
   ```

2. **Frontend Proxy Check:**
   ```powershell
   curl http://127.0.0.1:5173/agent/dev/status
   # Should proxy to backend and return same JSON
   ```

3. **Cookie Enable Test:**
   ```powershell
   curl -X POST -c cookies.txt http://127.0.0.1:5173/agent/dev/enable
   curl -b cookies.txt http://127.0.0.1:5173/agent/dev/status
   # Should return: {"enabled":true,"allowed":true}
   ```

4. **Tools Page Manual Test:**
   - Visit: http://127.0.0.1:5173/tools.html
   - Should see: "AB Analytics Dashboard" with chart
   - Should NOT see: "Tools Unavailable" message

## 🚀 Running E2E Tests

### Full Suite
```powershell
# Clear any env overrides
$env:PW_SKIP_WS=$null
$env:PLAYWRIGHT_GLOBAL_SETUP_SKIP=$null

# Run all tests (Playwright auto-starts servers)
pnpm playwright test --project=chromium
```

### Specific Test Files
```powershell
pnpm playwright test tests/e2e/ab-winner-bold.spec.ts tests/e2e/run-now-badge.spec.ts tests/e2e/ab-toast.spec.ts --project=chromium
```

### Debug Mode
```powershell
pnpm playwright test tests/e2e/ab-winner-bold.spec.ts --project=chromium --headed --debug
```

## 📝 Expected Test Results

**Target:** 9/9 tests passing

**Current Known Issues:**
- Backend may not auto-start if Playwright global setup skipped
- Frontend HMR may not reload devGuard.ts changes (requires Vite restart)
- Toast test may be flaky if navigation isn't prevented

**If Tests Still Fail:**

1. **Check what page rendered:**
   ```typescript
   console.log(await page.content()); // Before failing assertion
   ```

2. **Verify cookie was set:**
   ```typescript
   const cookies = await page.context().cookies();
   console.log('Cookies:', cookies.filter(c => c.name === 'sa_dev'));
   ```

3. **Check API response:**
   ```typescript
   const response = await page.evaluate(async () => {
     const res = await fetch('/agent/dev/status');
     return { status: res.status, body: await res.json() };
   });
   console.log('API Response:', response);
   ```

## 🎯 Next Steps

1. **Restart Servers:**
   - Kill any running processes
   - Let Playwright global setup start fresh servers
   - Ensures new backend/frontend code is loaded

2. **Run Full Test Suite:**
   - Execute all E2E tests
   - Verify tools page tests pass
   - Check toast test stability

3. **Production Deployment:**
   - Once tests green, deploy to production
   - Verify APP_ENV=prod uses httponly=true cookies
   - Confirm Cloudflare Access integration

## 📚 Key Learnings

1. **API Compatibility:** Always return both old and new keys during migrations
2. **Cache Awareness:** Dev servers cache code; restart for reliability
3. **Test Determinism:** Origin-based cookies > request context cookies
4. **Selector Stability:** Test IDs > text selectors > class selectors
5. **Explicit Waits:** waitFor() > expect().toBeVisible() for clarity

## 🔗 Related Documentation

- [E2E Testing Guide](./E2E_TESTING_GUIDE.md)
- [E2E Quick Start](./E2E_QUICK_START.md)
- [Phase 50.3 Deployment Status](./PHASE_50.3_DEPLOYMENT_STATUS.md)
- [Final Summary](./FINAL_SUMMARY.md)

## ✅ Commit History

- **7ffd965:** Origin-based cookies + test ID selectors + httponly=false in dev
- **d9e234e:** Vite proxy configuration + global setup improvements
- **aa2ad90:** E2E reliability fixes (no reload, scheduler off, Windows compat)
- **bc7d8ce:** E2E infrastructure setup (API helper, test routing)
- **f5b78c9:** Future-proof API with dual keys + resilient devGuard ← **Current**

---

**Status:** All hardening patches applied and committed. Ready for final validation with fresh server restart.
