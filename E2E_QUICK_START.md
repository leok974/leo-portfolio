# E2E Testing - Quick Start Guide

## ✅ Recommended Approach (Automatic - Let Playwright Start Servers)

Playwright is configured to automatically start both servers with proper proxying. **No build needed** - dev server serves from source.

### One-Command Test Run
```powershell
# Clear any manual control env vars
$env:PW_SKIP_WS=$null
$env:PLAYWRIGHT_GLOBAL_SETUP_SKIP=$null

# Run E2E tests (Playwright handles everything)
pnpm playwright test --project=chromium
```

**What Playwright does automatically:**
1. ✅ Starts FastAPI backend (no reload, scheduler disabled)
2. ✅ Starts Vite dev server with `/agent/*` proxy to backend
3. ✅ Seeds dev overlay + initial layout once
4. ✅ Runs all tests
5. ✅ Cleans up servers when done

### Run Specific Tests
```powershell
# Public AB tracking tests
pnpm playwright test tests/e2e/ab-toast.spec.ts --project=chromium

# Admin tools tests
pnpm playwright test tests/e2e/ab-winner-bold.spec.ts tests/e2e/run-now-badge.spec.ts --project=chromium
```

## 🔧 Manual Control (Optional)

If you need to debug or iterate without restarting servers:

### Step 1: Start Backend (Terminal 1)
```powershell
# NO reload flag - prevents restarts when tests write files
# SCHEDULER_ENABLED=0 - keeps tests deterministic
$env:SCHEDULER_ENABLED='0'
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001
```

**Important:** Do NOT use `--reload`. Tests write to `assets/layout.json` and `data/*.jsonl`, which would trigger server restarts.

### Step 2: Start Frontend with Proxy (Terminal 2)
```powershell
# Dev server with /agent/* proxy to backend
pnpm exec vite --port 5173 --strictPort
```

**Key:** Use `vite` (dev), NOT `vite preview`. Dev server has proxy configured, preview doesn't.

### Step 3: Run Tests (Terminal 3)
```powershell
# Skip automatic server startup (reuse manual servers)
$env:PW_SKIP_WS='1'
pnpm playwright test --project=chromium
```

## Test Suites

### Public Site Tests
```powershell
$env:PW_SKIP_WS='1'
pnpm playwright test tests/e2e/ab-toast.spec.ts --project=chromium
```
**Tests:**
- AB tracking initialization on page load
- Visitor ID persistence in localStorage
- Toast notifications on project card clicks
- Bucket assignment (A or B)

### Admin Tools Tests
```powershell
$env:PW_SKIP_WS='1'
pnpm playwright test tests/e2e/ab-winner-bold.spec.ts tests/e2e/run-now-badge.spec.ts --project=chromium
```
**Tests:**
- AB Analytics Dashboard rendering
- Winner highlighting (bold CTR)
- Date filters and refresh button
- Autotune button functionality
- Learning rate display

## What Global Setup Does

When tests run, `global-setup.ts` automatically:
1. ✅ Checks if backend is already running (uses manual server if found)
2. ✅ Starts backend if needed (no reload, SCHEDULER_ENABLED=0)
3. ✅ Enables dev overlay cookie for admin tests
4. ✅ Seeds initial layout optimization data once
5. ✅ Waits for backend to be fully ready

This means you don't need to manually seed data or enable the overlay!

## Why Dev Server (Not Preview)?

**The Key Fix:** Vite preview doesn't proxy `/agent/*` requests to the backend, causing 404s in tests.

**Solution:** Vite dev server has `server.proxy` configured in `vite.config.ts`:
```typescript
server: {
  proxy: {
    '/agent': 'http://127.0.0.1:8001',  // All /agent/* → FastAPI
  },
}
```

**Bonus:** No build needed for E2E - dev serves from source with fast HMR.

## Production Safety

The dev overlay has production protection:
- `APP_ENV=prod` → `/agent/dev/enable` returns 403
- Recommended: Use Cloudflare Access on `/agent/*` routes
- For testing: Leave `APP_ENV=dev` (default)

## Troubleshooting

### "Connection Refused"
- **Backend:** Check if running on port 8001: `Get-NetTCPConnection -LocalPort 8001`
- **Frontend:** Check if running on port 5173: `Get-NetTCPConnection -LocalPort 5173`

### "Backend Restarts Mid-Test"
- **Cause:** Using `--reload` flag
- **Fix:** Remove `--reload` from uvicorn command

### "Tests Are Flaky"
- **Cause:** Scheduler modifying data during tests
- **Fix:** Set `$env:SCHEDULER_ENABLED='0'` before starting backend

### "Dev Overlay Not Working"
- **Cause:** global-setup.ts automatically enables it
- **Check:** Visit `http://localhost:8001/agent/dev/status`
- **Manual:** `curl -X POST http://localhost:8001/agent/dev/enable`

## Environment Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `PW_SKIP_WS` | `'1'` | Skip webServer startup (use manual servers) |
| `SCHEDULER_ENABLED` | `'0'` | Disable scheduler during tests |
| `APP_ENV` | `'dev'` | Allow dev overlay (default) |

## View Results

```powershell
# HTML report
pnpm playwright show-report

# Trace for specific test
pnpm playwright show-trace test-results/[test-name]/trace.zip
```

## CI/CD Note

For CI environments, the automatic server startup should work reliably:
```yaml
- run: pnpm build
- run: pnpm playwright test --project=chromium
```

The webServer timeout is set to 120 seconds, which is sufficient for CI environments.

## Success Checklist

Before running tests:
- ✅ Frontend built (`pnpm build`)
- ✅ Backend running on port 8001 (no reload)
- ✅ Frontend preview on port 5173
- ✅ `$env:PW_SKIP_WS='1'` set in test terminal
- ✅ `$env:SCHEDULER_ENABLED='0'` set before backend start
