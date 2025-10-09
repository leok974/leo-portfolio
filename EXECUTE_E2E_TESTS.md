# E2E Test Execution - Final Instructions

**Status:** Ready to Execute ✅
**Last Updated:** 2025-10-08
**Final Commit:** 8e8a9f9

---

## 🚀 Step 1: Clean Slate + Run (Required)

Execute these commands in sequence:

```powershell
# Kill any leftover processes
Get-Process | Where-Object {$_.ProcessName -match 'python|node|vite'} | Stop-Process -Force -EA SilentlyContinue

# Clear skip flags that prevent server startup
$env:PW_SKIP_WS=$null
$env:PLAYWRIGHT_GLOBAL_SETUP_SKIP=$null

# Run full test suite (Playwright auto-starts servers)
pnpm playwright test --project=chromium
```

**What Happens:**
- Playwright starts FastAPI backend on `:8001` (no reload, scheduler off, dev cookie key set)
- Playwright starts Vite dev server on `:5173` (with `/agent` proxy)
- Global setup seeds overlay + layout data once
- 9 tests execute in parallel

**Expected Result:** 8-9 tests passing

---

## 🔍 Step 2: Quick Manual Spot-Check (Optional, 1 min)

If tests pass, great! If they fail, run these commands to diagnose:

### Backend Status Check
```powershell
curl -s http://127.0.0.1:8001/agent/dev/status
```
**Expected:** `{"enabled":false,"allowed":false}` (before enabling)

---

### Enable Overlay via Proxy
```powershell
curl -s -X POST http://127.0.0.1:5173/agent/dev/enable
```
**Expected:** Sets cookie, returns success

---

### Status via Proxy
```powershell
curl -s http://127.0.0.1:5173/agent/dev/status
```
**Expected:** `{"enabled":true,"allowed":true}` (after enabling)

---

### Visual Check - Tools Page
Visit in browser: **http://127.0.0.1:5173/tools.html**

**Should See:**
- ✅ "Site Agent Tools" heading
- ✅ AB Analytics Dashboard with chart
- ✅ "Last Run" badge
- ✅ "Run Autotune" button

**Browser Console:**
```
[ToolsPage] isPrivilegedUIEnabled()=true
```

---

## 📊 Understanding Test Results

### Success (Target: 8-9/9)
```
Running 9 tests using 9 workers

✓ [chromium] › ab-toast.spec.ts › should display toast notification
✓ [chromium] › ab-toast.spec.ts › should track visitor ID
✓ [chromium] › ab-toast.spec.ts › should initialize AB bucket
✓ [chromium] › ab-winner-bold.spec.ts › should bold winner CTR
✓ [chromium] › ab-winner-bold.spec.ts › should display winner
✓ [chromium] › ab-winner-bold.spec.ts › should show refresh button
✓ [chromium] › run-now-badge.spec.ts › should show autotune button
✓ [chromium] › run-now-badge.spec.ts › should trigger autotune
✓ [chromium] › run-now-badge.spec.ts › should show learning rate

9 passed (45s)
```

---

### Failure Example
```
TimeoutError: locator.waitFor: Timeout 10000ms exceeded.
  waiting for getByTestId('ab-analytics') to be visible
```

**Diagnosis Steps:**

1. **Check Backend Response:**
   ```powershell
   curl http://127.0.0.1:8001/agent/dev/status
   ```
   If 404 or connection refused → backend didn't start

2. **Check Proxy:**
   ```powershell
   curl http://127.0.0.1:5173/agent/dev/status
   ```
   If 404 → Vite proxy not working

3. **Check Tools Page:**
   - Visit http://127.0.0.1:5173/tools.html
   - If "Tools Unavailable" → guard failing
   - Check browser console for: `[ToolsPage] isPrivilegedUIEnabled()=false`

4. **Deep Dive:**
   See **[E2E_RUNBOOK.md](./E2E_RUNBOOK.md)** for complete troubleshooting

---

## 🎯 After Tests Pass

### 1. View HTML Report
```powershell
pnpm playwright show-report
```

### 2. Update Deployment Status
Mark E2E tests as passing in `PHASE_50.3_DEPLOYMENT_STATUS.md`

### 3. Production Deployment
```powershell
# Build production assets
pnpm build

# Deploy dist/ folder to GitHub Pages or CDN
# Deploy backend with APP_ENV=prod for secure cookies
```

---

## 📚 Documentation Index

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **This File** | Quick execution steps | Run tests now |
| [E2E_RUNBOOK.md](./E2E_RUNBOOK.md) | Troubleshooting guide | Tests failing |
| [E2E_SESSION_SUMMARY.md](./E2E_SESSION_SUMMARY.md) | Complete overview | Understand what was built |
| [E2E_HARDENING_COMPLETE.md](./E2E_HARDENING_COMPLETE.md) | Technical deep-dive | Architecture details |

---

## ✅ What Was Fixed

**Root Problem:** Frontend checked `data.enabled`, backend returned `{allowed: true}`

**Solutions Applied:**
- ✅ Backend returns both `enabled` AND `allowed` keys
- ✅ Frontend accepts either key (boolean or "1")
- ✅ Same-origin cookie via Vite proxy
- ✅ Test IDs for stable selectors
- ✅ Debug logging added

**Total Changes:**
- 4 commits (7ffd965, f5b78c9, 87ee291, 8e8a9f9)
- 18 files modified
- 1,200+ insertions
- 9 E2E tests hardened

---

## 🚨 Common Issues

### "Backend didn't start"
**Symptom:** `curl: connection refused on port 8001`

**Fix:**
```powershell
# Check if PLAYWRIGHT_GLOBAL_SETUP_SKIP was set
$env:PLAYWRIGHT_GLOBAL_SETUP_SKIP
# Should be empty/null

# If set, clear it and re-run
$env:PLAYWRIGHT_GLOBAL_SETUP_SKIP=$null
pnpm playwright test --project=chromium
```

---

### "Tools Unavailable on page"
**Symptom:** Page loads but shows access denied

**Fix:**
```powershell
# Manually enable via proxy
curl -X POST http://127.0.0.1:5173/agent/dev/enable

# Refresh tools page
# http://127.0.0.1:5173/tools.html
```

---

### "Tests timeout waiting for elements"
**Symptom:** All tools tests fail after 10 seconds

**Fix:**
1. Check browser console on tools page for: `[ToolsPage] isPrivilegedUIEnabled()=false`
2. If false, backend cookie validation is failing
3. Verify backend returned 200 OK on `/agent/dev/enable`
4. Check backend logs for cookie validation errors

---

## 💡 Pro Tips

1. **Always kill old processes first** - Prevents port conflicts
2. **Check backend logs** - Shows cookie validation details
3. **Use browser DevTools** - Console shows guard result
4. **View trace files** - `pnpm exec playwright show-trace <path>`

---

**Ready?** Run Step 1 above to execute the test suite! 🚀

**Need Help?** See [E2E_RUNBOOK.md](./E2E_RUNBOOK.md) for detailed troubleshooting
