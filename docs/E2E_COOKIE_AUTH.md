# E2E Testing with Dev Overlay Cookie Authentication

## Overview

E2E tests now use a global setup that automatically fetches and injects the dev overlay HttpOnly cookie before running tests. This eliminates the need for manual cookie management and ensures tests run with proper authentication.

## How It Works

1. **Global Setup** (`tests/e2e/setup/dev-overlay.ui.setup.ts`):
   - Calls `/agent/dev/enable` with Bearer token authentication
   - Extracts the `siteagent_dev_overlay` HttpOnly cookie from the response
   - Creates a Playwright storage state file with the cookie for both UI and backend origins
   - Saves to `tests/e2e/.auth/dev-overlay-state.json`

2. **Playwright Config** (`playwright.config.ts`):
   - Points `globalSetup` to the cookie fetcher
   - Sets `storageState` to auto-load the saved cookie in all test contexts
   - Keeps `extraHTTPHeaders` with `Authorization: Bearer dev` for API calls

3. **Tests**:
   - All tests automatically have the dev overlay cookie injected
   - API calls include both the Bearer token (header) and the HttpOnly cookie
   - Frontend UI tests have the cookie available for XHR/fetch requests

## Running E2E Tests

### Prerequisites

Backend must be running with dev routes enabled:

```powershell
# PowerShell
$env:ALLOW_DEV_ROUTES="1"
$env:SITEAGENT_DEV_COOKIE_KEY="dev-secret-please-change"
python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001
```

```bash
# Bash
export ALLOW_DEV_ROUTES=1
export SITEAGENT_DEV_COOKIE_KEY=dev-secret-please-change
python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001
```

### Running Tests

**All tests**:
```bash
npx playwright test
```

**Specific test file**:
```bash
npx playwright test tests/e2e/seo-analytics.spec.ts
```

**Specific project (chromium only)**:
```bash
npx playwright test --project=chromium
```

**With UI** (for debugging):
```bash
npx playwright test --ui
```

### Environment Variables

Override defaults if needed:

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_URL` | `http://127.0.0.1:8001` | Backend API base URL |
| `UI_URL` | `http://127.0.0.1:5173` | Frontend UI base URL (Vite dev server) |
| `PW_STATE` | `tests/e2e/.auth/dev-overlay-state.json` | Storage state file path |
| `DEV_OVERLAY_COOKIE_NAME` | `siteagent_dev_overlay` | Cookie name |
| `DEV_BEARER` | `dev` | Bearer token for API auth |

**Example with custom URLs**:
```powershell
$env:UI_URL="http://localhost:5173"
$env:BACKEND_URL="http://localhost:8001"
npx playwright test
```

## CI Configuration

Add these environment variables to your CI workflow (e.g., `.github/workflows/e2e.yml`):

```yaml
- name: Run E2E Tests
  env:
    ALLOW_DEV_ROUTES: 1
    SITEAGENT_DEV_COOKIE_KEY: ci-dev-secret
    DEV_OVERLAY_COOKIE_NAME: siteagent_dev_overlay
    DEV_BEARER: dev
    UI_URL: http://127.0.0.1:5173
    BACKEND_URL: http://127.0.0.1:8001
  run: |
    npx playwright test
```

## Troubleshooting

### Cookie not being set

**Symptom**: Tests fail with 403 or authentication errors

**Check**:
1. Backend has `ALLOW_DEV_ROUTES=1` set
2. Backend has `SITEAGENT_DEV_COOKIE_KEY` set (required for cookie signing)
3. Global setup logs show `✅ Dev overlay cookie installed`
4. Storage state file exists at `tests/e2e/.auth/dev-overlay-state.json`

**Fix**:
```bash
# Delete old state and re-run
rm -f tests/e2e/.auth/dev-overlay-state.json
npx playwright test
```

### Wrong backend URL

**Symptom**: Global setup fails with connection refused

**Fix**:
```bash
# Check backend is running
curl http://127.0.0.1:8001/ready

# Or set correct URL
export BACKEND_URL=http://localhost:8001
npx playwright test
```

### Cookie expired

**Symptom**: Tests work initially then start failing after some time

**Explanation**: Dev overlay cookies have a 30-day expiration. If tests haven't run in a while, the cookie may be stale.

**Fix**:
```bash
# Delete old state to force refresh
rm -f tests/e2e/.auth/dev-overlay-state.json
npx playwright test
```

### Manual cookie refresh

If you need to manually regenerate the storage state:

```bash
# Run only the global setup
npx playwright test --grep @setup

# Or just delete the state file - it will regenerate on next run
rm -f tests/e2e/.auth/dev-overlay-state.json
```

## Architecture Details

### Storage State Structure

The saved storage state file contains:

```json
{
  "cookies": [
    {
      "name": "siteagent_dev_overlay",
      "value": "<signed-cookie-value>",
      "domain": "127.0.0.1",
      "path": "/",
      "httpOnly": true,
      "secure": false,
      "sameSite": "Lax"
    }
  ],
  "origins": []
}
```

Cookies are set for **both** UI and backend domains to ensure they're available for:
- Frontend page loads (UI domain)
- XHR/fetch API calls (backend domain)
- Playwright API request context calls (backend domain)

### Authentication Flow

```
Test Run Start
    ↓
Global Setup
    ↓
API POST /agent/dev/enable
    ← Bearer dev header
    → Set-Cookie: siteagent_dev_overlay=<signed>; HttpOnly
    ↓
Extract cookie from Set-Cookie header
    ↓
Create storage state with cookie for both domains
    ↓
Save to tests/e2e/.auth/dev-overlay-state.json
    ↓
Test Execution
    ↓
All test contexts auto-load storage state
    ↓
Requests include:
    - Authorization: Bearer dev (header)
    - siteagent_dev_overlay (HttpOnly cookie)
    ↓
Backend validates either:
    - Bearer token (dev auth)
    - HttpOnly cookie (dev overlay)
    ↓
✅ Authenticated
```

### Security Notes

- ✅ Storage state file is in `.gitignore` - won't be committed
- ✅ Cookie is HttpOnly - not accessible to client-side JavaScript
- ✅ Cookie is signed - tampering detected by backend
- ✅ Only works when `ALLOW_DEV_ROUTES=1` - safe in production
- ✅ Cookie expires after 30 days - automatic security timeout

## Migration from Old Setup

### Old Approach (Manual)
```typescript
// In each test file
const headers = { 'Authorization': 'Bearer dev' };
await request.post('/agent/analytics/ingest', { headers, data: payload });
```

### New Approach (Automatic)
```typescript
// Global setup handles authentication
// Tests just call endpoints normally
await request.post('/agent/analytics/ingest', { data: payload });
// Cookie is automatically included
```

### Benefits

1. **Simpler test code** - No manual header management
2. **More realistic** - Tests use the same auth mechanism as production (cookies)
3. **Better coverage** - Tests validate cookie signing/verification
4. **Easier debugging** - Storage state can be inspected directly
5. **CI-friendly** - Single setup step handles all authentication

---

**Status**: ✅ **IMPLEMENTED**
**Date**: 2025-10-08
**Related**: Phase 50.6.2, Dev Auth Bypass
