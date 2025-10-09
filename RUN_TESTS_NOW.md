# 🚀 READY TO RUN - E2E Test Suite

**Last Commit:** 4d2a80e  
**Status:** All hardening complete ✅  
**Action:** Execute command below 👇

---

## One Command to Rule Them All

```powershell
# Kill old servers + clear env + run full test suite
Get-Process | Where-Object {$_.ProcessName -match 'python|node|vite'} | Stop-Process -Force -EA SilentlyContinue; $env:PW_SKIP_WS=$null; $env:PLAYWRIGHT_GLOBAL_SETUP_SKIP=$null; pnpm playwright test --project=chromium
```

**Expected Result:** 8-9 tests passing

---

## What This Does

1. **Kills old servers** - No port conflicts or stale processes
2. **Clears env vars** - Ensures Playwright starts fresh servers
3. **Runs full test suite** - All 9 E2E tests in chromium

### Behind the Scenes (Automatic)

Playwright will:
- ✅ Start FastAPI backend on port 8001 (no reload, scheduler off)
- ✅ Start Vite dev server on port 5173 (with `/agent` proxy)
- ✅ Seed test data once (layout + overlay enabled)
- ✅ Run all tests in parallel
- ✅ Generate HTML report

---

## If Tests Fail

See: **[E2E_RUNBOOK.md](./E2E_RUNBOOK.md)** for troubleshooting steps

**Quick Debug:**
```powershell
# Check backend API
curl http://127.0.0.1:8001/agent/dev/status

# Check proxy
curl http://127.0.0.1:5173/agent/dev/status

# Manual tools page check
# Visit: http://127.0.0.1:5173/tools.html
```

---

## Understanding the Output

### Success Looks Like:
```
Running 9 tests using 9 workers

✓ [chromium] › tests\e2e\ab-toast.spec.ts:8:3 › should display toast
✓ [chromium] › tests\e2e\ab-toast.spec.ts:38:3 › should track visitor ID
✓ [chromium] › tests\e2e\ab-toast.spec.ts:50:3 › should initialize AB bucket
✓ [chromium] › tests\e2e\ab-winner-bold.spec.ts:9:3 › should bold winner CTR
✓ [chromium] › tests\e2e\ab-winner-bold.spec.ts:29:3 › should display winner
✓ [chromium] › tests\e2e\ab-winner-bold.spec.ts:43:3 › should show refresh button
✓ [chromium] › tests\e2e\run-now-badge.spec.ts:9:3 › should show autotune button
✓ [chromium] › tests\e2e\run-now-badge.spec.ts:22:3 › should trigger autotune
✓ [chromium] › tests\e2e\run-now-badge.spec.ts:48:3 › should show learning rate

9 passed (45s)
```

### Failure Looks Like:
```
TimeoutError: locator.waitFor: Timeout 10000ms exceeded.
  waiting for getByTestId('ab-analytics') to be visible
```

**Cause:** Tools page showing "Tools Unavailable" (guard failing)

**Fix:** Follow runbook troubleshooting steps

---

## After Tests Pass

1. **View HTML Report:**
   ```powershell
   pnpm playwright show-report
   ```

2. **Update Deployment Status:**
   - Mark E2E tests as ✅ passing in `PHASE_50.3_DEPLOYMENT_STATUS.md`

3. **Production Deployment:**
   ```powershell
   pnpm build
   # Deploy dist/ to GitHub Pages or CDN
   # Deploy backend with APP_ENV=prod
   ```

---

## Documentation Reference

| Doc | Purpose |
|-----|---------|
| **E2E_RUNBOOK.md** | 👈 Troubleshooting guide (start here if tests fail) |
| **E2E_SESSION_SUMMARY.md** | Complete session overview |
| **E2E_HARDENING_COMPLETE.md** | Technical deep-dive on fixes |
| **E2E_TESTING_GUIDE.md** | Comprehensive testing guide |

---

**Ready?** Copy the command above and run it! 🎯
