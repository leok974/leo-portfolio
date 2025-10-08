# E2E Test Suite - Quick Runbook (Clean Slate)

**Last Updated:** 2025-10-07  
**Commit:** f5b78c9  
**Purpose:** Reliable E2E test execution from clean state

---

## 🚀 Quick Start (One Command)

```powershell
# 0) Kill any old servers
Get-Process | Where-Object {$_.ProcessName -match 'python|node|vite'} | Stop-Process -Force -EA SilentlyContinue

# 1) Clear environment variables that skip server startup
$env:PW_SKIP_WS=$null
$env:PLAYWRIGHT_GLOBAL_SETUP_SKIP=$null

# 2) Run the full test suite
# Playwright will automatically:
#   - Start FastAPI (no --reload, scheduler off, cookie key set)
#   - Start Vite dev server with /agent proxy
#   - Seed test data once
#   - Run all tests
pnpm playwright test --project=chromium
```

**Expected Result:** 8-9 tests passing (toast test may need tweaking)

---

## 🔍 Targeted Troubleshooting Checklist

If tests fail, verify each layer independently:

### 1. Backend Status Endpoint (Both Keys)

```powershell
# Should return both 'enabled' and 'allowed' keys
curl -s http://127.0.0.1:8001/agent/dev/status

# Expected (before enabling):
# {"enabled":false,"allowed":false}
```

**What this tests:** Backend API shape is correct

---

### 2. Same-Origin Cookie via Proxy

```powershell
# Enable overlay via frontend origin (5173) using Vite proxy
curl -s -X POST http://127.0.0.1:5173/agent/dev/enable -i

# Check status via proxy
curl -s http://127.0.0.1:5173/agent/dev/status

# Expected:
# {"enabled":true,"allowed":true}
```

**What this tests:** 
- Vite proxy forwards `/agent/*` to backend
- Cookie is set on correct origin
- Backend validates cookie correctly

---

### 3. Tools Page Renders Panel

Visit in browser: **http://127.0.0.1:5173/tools.html**

**Should See:**
- ✅ "Site Agent Tools" heading
- ✅ AB Analytics Dashboard with chart
- ✅ "Last Run" badge
- ✅ "Run Autotune" button

**Should NOT See:**
- ❌ "Tools Unavailable" message
- ❌ Blank page or error

**Browser Console Check:**
```javascript
// Check if guard passed
await fetch('/agent/dev/status').then(r => r.json())
// Should return: {enabled: true, allowed: true}

// Check cookies
document.cookie.split(';').find(c => c.includes('sa_dev'))
// Should exist if overlay enabled
```

---

## 🐛 Debug Failing Admin Tests

If `ab-winner-bold.spec.ts` or `run-now-badge.spec.ts` still fail:

### Step 1: Print DOM Before Assertion

Add temporary debug code:

```typescript
await enableOverlayOnPage(page);
await page.goto("/tools.html", { waitUntil: "networkidle" });

// DEBUG: See what actually rendered
console.log(await page.content());

await page.getByTestId("ab-analytics").waitFor({ state: "visible" });
```

**Look for:**
- Is `<div data-testid="ab-analytics">` present?
- Or is there a "Tools Unavailable" heading?
- Any error messages in the HTML?

### Step 2: Confirm Test Uses Correct Pattern

Verify test has:

```typescript
import { enableOverlayOnPage } from "./lib/overlay";

test("...", async ({ page }) => {
  // ✅ Set cookie via same-origin helper
  await enableOverlayOnPage(page);
  
  // ✅ Navigate to tools page
  await page.goto("/tools.html");
  
  // ✅ Wait for panel by test ID (not text)
  await page.getByTestId("ab-analytics").waitFor({ state: "visible" });
  
  // ✅ Continue with assertions...
});
```

**Common Mistakes:**
- ❌ Using `request.post(API_URL)` instead of `enableOverlayOnPage()`
- ❌ Using text selectors: `text=AB Analytics` instead of test IDs
- ❌ Using `expect().toBeVisible()` without `waitFor()` first

### Step 3: Verify Cookie Flow

Add debug to test:

```typescript
await enableOverlayOnPage(page);

// Check cookie was set
const cookies = await page.context().cookies();
console.log('Cookies:', cookies.filter(c => c.name === 'sa_dev'));

// Check API response
const apiResponse = await page.evaluate(async () => {
  const res = await fetch('/agent/dev/status');
  return { status: res.status, body: await res.json() };
});
console.log('API Response:', apiResponse);

await page.goto("/tools.html");
```

**Expected Output:**
```javascript
Cookies: [{ name: 'sa_dev', value: '<token>', domain: 'localhost', ... }]
API Response: { status: 200, body: { enabled: true, allowed: true } }
```

---

## ✅ Why This Should Now Pass

### 1. API/Guard Alignment
- **Backend:** Returns both `enabled` and `allowed` keys
- **Frontend:** Accepts either key (boolean `true` or string `"1"`)
- **Result:** No field name mismatches

### 2. Same-Origin Cookie
- **Helper:** `enableOverlayOnPage()` sets cookie from `:5173`
- **Proxy:** Vite forwards `/agent/*` → `:8001`
- **Result:** Cookie lands on correct origin, visible to frontend

### 3. Stable Servers
- **Backend:** Runs without `--reload` (no restarts during tests)
- **Frontend:** Vite dev proxies `/agent/*` (no 404s)
- **Result:** Servers don't restart unexpectedly

### 4. Deterministic Seeding
- **Global Setup:** Seeds overlay + layout once before tests
- **Scheduler:** Disabled (`SCHEDULER_ENABLED=0`)
- **Result:** No race conditions or random data

### 5. Robust Tests
- **Selectors:** Use test IDs (stable across changes)
- **Waits:** Use `.waitFor()` pattern (explicit intent)
- **Toast Test:** Prevents navigation so toast can render
- **Result:** Less flake, clearer failures

---

## 🔧 Optional Enhancements

### 1. Add Debug Logging to AgentToolsPanel

Helps diagnose future guard failures:

```typescript
// src/components/AgentToolsPanel.tsx
const allowed = await isPrivilegedUIEnabled();

if (!allowed) {
  console.debug('[AgentToolsPanel] hidden: isPrivilegedUIEnabled()=false');
  return null;
}
```

### 2. Increase Global Setup Timeout (Optional)

If you see timeouts during backend startup:

```typescript
// tests/e2e/global-setup.ts
// Change from 30 tries (15s) to 60 tries (30s)
for (let i = 0; i < 60; i++) {
  try {
    const res = await ctx.get(`${API_URL}/agent/dev/status`);
    if (res.ok) {
      console.log(`[globalSetup] Backend ready after ${i * 0.5}s`);
      break;
    }
  } catch {
    // Continue trying...
  }
  await new Promise(r => setTimeout(r, 500));
}
```

---

## 📊 Expected Test Results

### Target: 9/9 Tests Passing

**Public Site Tests (3):**
- ✅ Toast notification on card click
- ✅ Visitor ID in localStorage
- ✅ AB bucket initialization

**Tools Page Tests (6):**
- ✅ Winner CTR bold highlighting
- ✅ Winner displayed in dashboard
- ✅ Refresh button and date filters
- ✅ Autotune button visible
- ✅ Autotune triggers and shows feedback
- ✅ Learning rate displayed

### Known Flaky Tests

**Toast Test** may occasionally fail if:
- Navigation happens before toast renders
- Toast auto-dismisses too quickly
- Timing variance in different environments

**Fix:** Already implemented `e.preventDefault()` in test

---

## 🚨 Troubleshooting Guide

### "Timeout: locator.waitFor exceeded"

**Symptom:** `TimeoutError: locator.waitFor: Timeout 10000ms exceeded`

**Causes:**
1. Tools page showing "Tools Unavailable" (guard failing)
2. Frontend devGuard.ts has stale code (Vite cache)
3. Backend cookie validation failing

**Solutions:**
```powershell
# 1. Kill everything and restart
Get-Process | ? {$_.ProcessName -match 'python|node|vite'} | Stop -Force

# 2. Clear Playwright cache
pnpm playwright clean

# 3. Re-run tests
pnpm playwright test --project=chromium
```

### "Failed to connect to 127.0.0.1 port 8001"

**Symptom:** Backend not running

**Causes:**
1. `PLAYWRIGHT_GLOBAL_SETUP_SKIP=1` was set
2. Backend failed to start in global setup
3. Port 8001 already in use

**Solutions:**
```powershell
# 1. Check if port in use
Get-NetTCPConnection -LocalPort 8001 -EA SilentlyContinue

# 2. Clear env vars
$env:PLAYWRIGHT_GLOBAL_SETUP_SKIP=$null
$env:PW_SKIP_WS=$null

# 3. Re-run
pnpm playwright test --project=chromium
```

### "Tools Unavailable" on Tools Page

**Symptom:** Page renders but shows access denied message

**Causes:**
1. Cookie not set (check `document.cookie`)
2. Backend returning `{enabled: false}`
3. Frontend devGuard logic bug

**Solutions:**
```javascript
// In browser console on tools page:
await fetch('/agent/dev/status').then(r => r.json())
// Should return: {enabled: true, allowed: true}

document.cookie
// Should contain: sa_dev=<token>
```

If status returns false, manually enable:
```powershell
curl -X POST http://127.0.0.1:5173/agent/dev/enable
```

---

## 📝 Quick Command Reference

```powershell
# Full test suite
pnpm playwright test --project=chromium

# Specific test file
pnpm playwright test tests/e2e/ab-winner-bold.spec.ts --project=chromium

# Single test by name
pnpm playwright test --grep "should bold" --project=chromium

# Debug mode (headed browser, pause on failure)
pnpm playwright test --project=chromium --headed --debug

# Show test report
pnpm playwright show-report

# View trace for failed test
pnpm exec playwright show-trace test-results/<test-name>/trace.zip
```

---

## 🎯 Success Criteria

All tests green means:
- ✅ Backend API returns correct JSON shape
- ✅ Vite proxy forwards /agent/* correctly
- ✅ Cookies set on correct origin
- ✅ Frontend devGuard validates cookies
- ✅ Tools page renders with admin panel
- ✅ Public site shows AB toast notifications

**Next Step:** Production deployment with `APP_ENV=prod` for secure cookies (httponly=true)

---

**Related Docs:**
- [E2E Hardening Complete](./E2E_HARDENING_COMPLETE.md)
- [E2E Testing Guide](./E2E_TESTING_GUIDE.md)
- [Phase 50.3 Deployment Status](./PHASE_50.3_DEPLOYMENT_STATUS.md)
