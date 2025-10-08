# E2E Testing Guide

This guide explains how to run the E2E tests for the Leo Portfolio project with the Phase 50.3 + Tools Page implementation.

## Quick Start (Automated Servers)

The E2E test suite is configured to automatically start both backend and frontend servers.

### Prerequisites

1. **Build the frontend** (required for preview server):
   ```powershell
   pnpm build
   ```

2. **Ensure Python environment is set up**:
   ```powershell
   # Windows
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   ```

### Running Tests (Single Command)

```powershell
# Run all E2E tests (Playwright will start both servers)
pnpm playwright test --project=chromium

# Run specific test suites
pnpm playwright test tests/e2e/ab-toast.spec.ts --project=chromium           # Public site AB tracking
pnpm playwright test tests/e2e/ab-winner-bold.spec.ts --project=chromium     # Admin tools - AB analytics
pnpm playwright test tests/e2e/run-now-badge.spec.ts --project=chromium      # Admin tools - Autotune
```

**How it works:**
- `playwright.config.ts` defines a `webServer` that runs `pnpm preview --port 5173`
- `global-setup.ts` checks if backend is running at `http://127.0.0.1:8001` and starts it if needed
- Tests wait for both servers to be ready before executing

## Manual Server Control (Alternative)

If you prefer to manually control the servers (for debugging or faster iteration):

### Terminal 1: Backend Server
```powershell
# Start the FastAPI backend
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001 --reload
```

### Terminal 2: Frontend Preview Server
```powershell
# Serve the built frontend
pnpm preview --port 5173
```

### Terminal 3: Run Tests
```powershell
# Skip automatic server startup (reuse existing servers)
$env:PW_SKIP_WS='1'
pnpm playwright test --project=chromium
```

## Test Architecture

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
    command: 'pnpm preview --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

### `global-setup.ts`
- Checks if backend is reachable at `$API_URL`
- Starts `uvicorn assistant_api.main:app` if not running
- Waits up to 30 seconds for backend to be ready
- Returns cleanup function to stop backend after tests

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `BASE_URL` | `http://127.0.0.1:5173` | Frontend URL for tests |
| `API_URL` | `http://127.0.0.1:8001` | Backend API URL |
| `PW_SKIP_WS` | `undefined` | Skip webServer startup (reuse existing) |
| `PLAYWRIGHT_GLOBAL_SETUP_SKIP` | `undefined` | Skip backend startup (frontend-only tests) |

## Troubleshooting

### Issue: "net::ERR_CONNECTION_REFUSED"

**Cause**: Frontend server not running
**Solution**:
1. Build frontend: `pnpm build`
2. Check if port 5173 is available
3. Manually start preview: `pnpm preview --port 5173`

### Issue: "Backend failed to start within 30 seconds"

**Cause**: Python/uvicorn not accessible or port 8001 busy
**Solution**:
1. Check Python is installed: `python --version`
2. Check port: `Get-NetTCPConnection -LocalPort 8001`
3. Manually start backend: `uvicorn assistant_api.main:app --port 8001`

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

**Cause**: `pnpm preview` takes longer than 120 seconds (rare)
**Solution**:
1. Build first: `pnpm build`
2. Use manual server control method instead

## CI/CD Integration

For CI environments (GitHub Actions, etc.):

```yaml
- name: Build frontend
  run: pnpm build

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
