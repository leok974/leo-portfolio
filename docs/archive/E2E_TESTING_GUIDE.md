# E2E Testing Guide

This guide explains how to run the E2E tests for the Leo Portfolio project with the Phase 50.3 + Tools Page implementation.

## Quick Start (Automated Servers)

The E2E test suite is configured to automatically start both backend and frontend servers with optimal settings for test stability.

### Prerequisites

**Ensure Python environment is set up**:
```powershell
# Windows
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

**Note:** No frontend build needed - E2E uses Vite dev server which serves from source.

### Running Tests (Single Command)

```powershell
# Clear any previous environment variables (important!)
$env:PW_SKIP_WS=$null
$env:PLAYWRIGHT_GLOBAL_SETUP_SKIP=$null

# Run all E2E tests (Playwright will start both servers)
pnpm playwright test --project=chromium

# Run specific test suites
pnpm playwright test tests/e2e/ab-toast.spec.ts --project=chromium           # Public site AB tracking
pnpm playwright test tests/e2e/ab-winner-bold.spec.ts --project=chromium     # Admin tools - AB analytics
pnpm playwright test tests/e2e/run-now-badge.spec.ts --project=chromium      # Admin tools - Autotune
```

**How it works:**
- `playwright.config.ts` starts Vite dev server via `pnpm exec vite --port 5173 --strictPort`
- `vite.config.ts` proxies `/agent/*` requests to backend (fixes 404s)
- `global-setup.ts` starts backend WITHOUT `--reload` (prevents restarts when tests write files)
- `global-setup.ts` sets `SCHEDULER_ENABLED=0` (keeps tests deterministic)
- `global-setup.ts` seeds dev overlay and initial layout data once
- Tests wait for both servers to be ready before executing

## Manual Server Control (Alternative)

If you prefer to manually control the servers (for debugging or faster iteration):

### Terminal 1: Backend Server
```powershell
# Start the FastAPI backend WITHOUT reload (prevents restarts during tests)
# Also disable scheduler for deterministic tests
$env:SCHEDULER_ENABLED='0'
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001
```

### Terminal 2: Frontend Dev Server with Proxy
```powershell
# Vite dev server with /agent/* proxy to backend
# NO BUILD NEEDED - serves from source
pnpm exec vite --port 5173 --strictPort
```

**Key:** Use `vite` (dev mode), NOT `vite preview`. Dev server has proxy configured in `vite.config.ts` to forward `/agent/*` requests to the backend.

### Terminal 3: Run Tests
```powershell
# Skip automatic server startup (reuse existing servers)
$env:PW_SKIP_WS='1'
pnpm playwright test --project=chromium
```

## Test Architecture

### Vite Dev Server Proxy (Critical Fix)
- **File**: `vite.config.ts`
- **Configuration**:
  ```typescript
  server: {
    proxy: {
      '/agent': 'http://127.0.0.1:8001',  // Forward all /agent/* to FastAPI
    },
  }
  ```
- **Why**: Vite preview doesn't proxy requests, causing 404s on `/agent/*` endpoints
- **Result**: Frontend can fetch from `/agent/ab/summary`, etc., and it reaches the backend

### API Configuration
- **File**: `tests/e2e/lib/api.ts`
- **Purpose**: Centralizes API URL configuration
- **Default**: `http://127.0.0.1:8001`
- **Override**: Set `$env:API_URL='http://your-backend:port'`

### Test Categories

#### 1. Public Site Tests (`ab-toast.spec.ts`)
- **URL**: `http://127.0.0.1:5173/` (index.html)
- **Features Tested**:
  - AB tracking initialization on page load
  - Visitor ID persistence in localStorage
  - Toast notifications on project card clicks
  - Bucket assignment (A or B)
- **No dev overlay required**

#### 2. Admin Tools Tests (`ab-winner-bold.spec.ts`, `run-now-badge.spec.ts`)
- **URL**: `http://127.0.0.1:5173/tools.html`
- **Features Tested**:
  - AB Analytics Dashboard rendering
  - Winner highlighting (bold CTR)
  - Date filters and refresh button
  - Autotune button functionality
  - Learning rate display
- **Requires dev overlay** (automatically enabled via `beforeEach`)

### Dev Overlay Enablement

Admin tests automatically enable the dev overlay before each test:

```typescript
test.beforeEach(async ({ request }) => {
  await request.post(`${API_URL}/agent/dev/enable`);
});
```

This sets the `sa_dev=1` cookie, allowing access to `/tools.html`.

## Configuration Files

### `playwright.config.ts`
```typescript
const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:5173';

export default defineConfig({
  use: {
    baseURL,
  },
  webServer: process.env.PW_SKIP_WS ? undefined : {
    // Dev server (not preview) - has proxy for /agent/*
    command: 'pnpm exec vite --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

**Key Changes:**
- Uses `vite` (dev mode) instead of `vite preview`
- Dev server includes proxy configuration from `vite.config.ts`
- No build needed - serves from source with fast HMR

### `vite.config.ts`
**Critical proxy configuration:**
```typescript
export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/agent': 'http://127.0.0.1:8001',  // Forward all /agent/* to FastAPI
    },
  },
});
```

**Why this matters:**
- Vite preview doesn't proxy requests → 404s on `/agent/*`
- Dev server with proxy → frontend can fetch from `/agent/ab/summary` and it reaches backend
- This is the **root cause fix** for most E2E flakiness

### `global-setup.ts`
**Automatic backend startup with optimal settings:**
- Starts `uvicorn` WITHOUT `--reload` flag (prevents restarts when tests write files)
- Sets `SCHEDULER_ENABLED=0` environment variable (disables nightly jobs during tests)
- Waits for backend health check at `/agent/dev/status`
- Seeds dev overlay cookie and initial layout data once
- Returns cleanup function to gracefully stop backend

**Why no reload?**
When tests write to `assets/layout.json` or `data/*.jsonl`, uvicorn's file watcher triggers a restart, killing active requests. Running without reload keeps the server stable during test execution.

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `BASE_URL` | `http://127.0.0.1:5173` | Frontend URL for tests |
| `API_URL` | `http://127.0.0.1:8001` | Backend API URL |
| `PW_SKIP_WS` | `undefined` | Skip webServer startup (reuse existing) |
| `PLAYWRIGHT_GLOBAL_SETUP_SKIP` | `undefined` | Skip backend startup (frontend-only tests) |

## Troubleshooting

### Issue: "/agent/* requests return 404"

**Cause**: Using Vite preview instead of dev server (preview doesn't proxy)
**Solution**:
1. Check `playwright.config.ts` uses `pnpm exec vite` (not `vite preview`)
2. Check `vite.config.ts` has `server.proxy['/agent']`
3. Manual test: `pnpm exec vite --port 5173` and verify `/agent/dev/status` works

### Issue: "net::ERR_CONNECTION_REFUSED"

**Cause**: Frontend server not running
**Solution**:
1. No build needed - use dev server
2. Check if port 5173 is available: `Get-NetTCPConnection -LocalPort 5173`
3. Manually start dev: `pnpm exec vite --port 5173 --strictPort`

### Issue: "Backend failed to start within 30 seconds"

**Cause**: Python/uvicorn not accessible or port 8001 busy
**Solution**:
1. Check Python is installed: `python --version`
2. Check port: `Get-NetTCPConnection -LocalPort 8001`
3. Manually start backend: `$env:SCHEDULER_ENABLED='0'; uvicorn assistant_api.main:app --port 8001`

### Issue: "Target page, context or browser has been closed"

**Cause**: Environment variables from previous runs
**Solution**:
```powershell
# Clear all Playwright env vars
$env:PLAYWRIGHT_GLOBAL_SETUP_SKIP = $null
$env:PW_SKIP_WS = $null
$env:BASE_URL = $null
$env:API_URL = $null
```

### Issue: webServer timeout

**Cause**: Vite dev server takes longer than 120 seconds (rare)
**Solution**:
1. Check if port 5173 is already in use
2. Use manual server control method instead
3. Increase timeout in playwright.config.ts if needed

## CI/CD Integration

For CI environments (GitHub Actions, etc.):

```yaml
# No build needed - dev server serves from source
- name: Run E2E tests
  run: pnpm playwright test --project=chromium
  env:
    CI: true
```

The configuration automatically detects CI environments and adjusts:
- Retries: 2 in CI, 0 locally
- Video: Only on first retry in CI
- Reporters: `html` + `line` in CI, `line` only locally

## Test Data Seeding (Optional)

Use the seed utility to pre-populate test data:

```typescript
import { seedLayout, seedAbEvents } from './lib/seed';

test.beforeEach(async ({ request }) => {
  await seedLayout(request, 'recruiter');  // Seed layout optimization
  await seedAbEvents(request);              // Seed AB test events
});
```

## Performance Tips

1. **Parallel execution**: Tests run in parallel by default
   - Speeds: ~3 workers locally, configurable via `PW_WORKERS`

2. **Headed mode** (for debugging):
   ```powershell
   pnpm playwright test --headed --project=chromium
   ```

3. **Debug mode** (step-by-step):
   ```powershell
   pnpm playwright test --debug --project=chromium
   ```

4. **Watch mode** (re-run on changes):
   ```powershell
   pnpm playwright test --watch --project=chromium
   ```

## Test Reports

### View HTML Report
```powershell
pnpm playwright show-report
```

### View Trace (for failed tests)
```powershell
pnpm playwright show-trace test-results/[test-name]/trace.zip
```

## Production Safety

### Dev Overlay Protection

The dev overlay endpoint `/agent/dev/enable` has production safety built in:

```python
# In production (APP_ENV=prod), the enable endpoint returns 403 by default
# This prevents unauthorized access to admin features
```

**Environment variables for production:**
- `APP_ENV=prod` - Enables production mode (blocks dev overlay by default)
- `ALLOW_DEV_OVERLAY_IN_PROD=1` - Explicitly allows dev overlay in production (not recommended)

**Recommended production setup:**
1. Use Cloudflare Access or similar authentication on `/agent/*` routes
2. Set `APP_ENV=prod` in production environment
3. Dev overlay will be blocked unless request passes through Cloudflare Access

**For testing/staging environments:**
- Leave `APP_ENV=dev` (default)
- Dev overlay works freely for development/testing

## Success Criteria

All tests passing indicates:
- ✅ Backend API accessible and responding
- ✅ Frontend serving tools.html and index.html
- ✅ Dev overlay cookie authentication working
- ✅ AB Analytics Dashboard rendering correctly
- ✅ Autotune button functional
- ✅ Public AB tracking capturing events
- ✅ Toast notifications displaying

## Next Steps

After all E2E tests pass:
1. Review test coverage
2. Add additional test cases as needed
3. Configure CI/CD pipeline
4. Deploy to production environment
