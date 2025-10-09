# Dev Overlay E2E Test Documentation

## Overview

The `tests/e2e/dev-overlay.spec.ts` test suite validates the dev overlay cookie authentication system that gates access to admin tools in the frontend.

## What It Tests

### Test 1: Enable overlay → cookie set → status enabled → tools unlocked

This test verifies the complete authentication flow:

1. **Cookie Issuance**: POST to `/agent/dev/enable` with HMAC signature sets `sa_dev` cookie
2. **Cookie Presence**: Verifies cookie exists in browser context with correct naming (`sa_dev*`)
3. **Status Without Auth**: Separate API context (no cookies) shows `enabled: false`
4. **Status With Auth**: Browser context (with cookie) shows `enabled: true`
5. **UI Gating**: Tools page shows admin panels and hides "Enable the admin overlay..." message
6. **Persistence**: Saves cookie to `playwright/.auth/dev-overlay.json` for reuse

### Test 2: Persists across reloads (storageState)

This test validates cookie persistence:

1. **Reloads** browser context from saved storage state
2. **Status check** shows enabled without re-authentication
3. **Tools page** remains unlocked after reload

## Running the Tests

### Prerequisites

1. **Backend** running on port 8001:
   ```powershell
   python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001
   ```

2. **Frontend dev server** running on port 5173:
   ```powershell
   npm run dev
   ```

   Or preview server on port 4173:
   ```powershell
   npm run preview
   ```

3. **Environment variable** `SITEAGENT_HMAC_SECRET` set in `.env` or `assistant_api/.env`:
   ```
   SITEAGENT_HMAC_SECRET=local-dev-secret-12345
   ```

### Run Commands

**Using the test script (recommended):**
```powershell
.\test-dev-overlay.ps1
```

**Direct Playwright command:**
```powershell
npx playwright test tests/e2e/dev-overlay.spec.ts --project=chromium
```

**With UI (headed mode):**
```powershell
npx playwright test tests/e2e/dev-overlay.spec.ts --project=chromium --headed
```

**Debug mode:**
```powershell
npx playwright test tests/e2e/dev-overlay.spec.ts --project=chromium --debug
```

**Watch mode (during development):**
```powershell
npx playwright test tests/e2e/dev-overlay.spec.ts --project=chromium --watch
```

## Architecture

### HMAC Signature Calculation

The test calculates HMAC-SHA256 signature using Web Crypto API:

```typescript
const body = JSON.stringify({ hours: 24 });
const signature = await page.evaluate(async (bodyText) => {
  const encoder = new TextEncoder();
  const key = encoder.encode('local-dev-secret-12345');
  const data = encoder.encode(bodyText);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}, body);
```

The signature is sent in the `X-SiteAgent-Signature` header with `sha256=` prefix.

### Cookie Storage

The test uses Playwright's `storageState` API to persist cookies:

```typescript
await context.storageState({ path: 'playwright/.auth/dev-overlay.json' });
```

This file contains:
- Cookies (including `sa_dev`)
- LocalStorage
- SessionStorage

The file is gitignored to prevent committing sensitive session data.

### Backend Endpoints

**POST /agent/dev/enable**
- Requires HMAC signature in `X-SiteAgent-Signature` header
- Request body: `{"hours": 2-24}` (default 2)
- Response: Sets `sa_dev` cookie with signed JWT
- Cookie properties:
  - `httponly`: false in dev (true in prod)
  - `secure`: false in dev (true in prod)
  - `samesite`: "lax"
  - `path`: "/"

**GET /agent/dev/status**
- Reads `sa_dev` cookie from request
- Validates signature and expiration
- Response: `{"enabled": boolean, "allowed": boolean}`

### Frontend Guard

The `isPrivilegedUIEnabled()` function in `src/lib/ui-guard.ts` checks:

1. Cookie presence (`sa_dev`)
2. URL query param (`?dev=1`)
3. Hostname (`localhost`, `127.0.0.1`, `*.local`)

## Troubleshooting

### Test Fails: "Backend not responding"

```powershell
# Check if backend is running
curl http://localhost:8001/ready

# Start backend
python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001
```

### Test Fails: "Frontend not responding"

```powershell
# Check if frontend is running
curl http://localhost:5173

# Start dev server
npm run dev

# Or preview server (port 4173)
npm run preview
```

### Test Fails: "Cookie not set"

- **Check HMAC secret** in `.env` or `assistant_api/.env`
- **Verify signature calculation** matches backend expectation
- **Check browser context** is not in incognito/strict mode
- **Inspect network tab** in headed mode to see cookie headers

### Test Fails: "Tools page shows 'Enable the admin overlay'"

- **Verify cookie** was set in previous step
- **Check cookie domain/path** matches frontend URL
- **Inspect storageState** file for cookie presence
- **Check frontend guard** logic in `src/lib/ui-guard.ts`

### Test Fails: "Status shows enabled: false"

- **Cookie expired** (default 2 hours, test uses 24 hours)
- **Cookie signature invalid** (HMAC secret mismatch)
- **Cookie not sent** (domain/path mismatch)
- **Backend error** (check logs)

## CI/CD Integration

### GitHub Actions

```yaml
- name: Run dev overlay tests
  run: |
    npm run build
    npm run preview &
    PREVIEW_PID=$!
    python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001 &
    BACKEND_PID=$!

    # Wait for servers
    sleep 5

    # Run tests
    npx playwright test tests/e2e/dev-overlay.spec.ts --project=chromium

    # Cleanup
    kill $PREVIEW_PID $BACKEND_PID
```

### Test Artifacts

Playwright generates:
- `playwright-report/` - HTML report
- `test-results/` - Screenshots/videos on failure
- `playwright/.auth/dev-overlay.json` - Cookie storage (gitignored)

## Security Considerations

1. **HMAC Secret**: Never commit actual production secrets. Use environment variables.
2. **Cookie Storage**: The `playwright/.auth/` directory is gitignored to prevent committing session cookies.
3. **Test Isolation**: Each test creates a new browser context to avoid cookie leakage between tests.
4. **Signature Validation**: Backend validates HMAC signature on every `/agent/dev/enable` request.
5. **Cookie Expiration**: Cookies expire after configured time (2-24 hours).

## Related Files

- `tests/e2e/dev-overlay.spec.ts` - Test suite
- `test-dev-overlay.ps1` - Test runner script
- `src/lib/ui-guard.ts` - Frontend guard logic
- `assistant_api/routers/agent_public.py` - Backend endpoints
- `playwright.config.ts` - Playwright configuration
- `.gitignore` - Excludes `playwright/.auth/`

## References

- [Playwright Authentication](https://playwright.dev/docs/auth)
- [Playwright Storage State](https://playwright.dev/docs/api/class-browsercontext#browser-context-storage-state)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [HMAC Authentication](https://en.wikipedia.org/wiki/HMAC)
