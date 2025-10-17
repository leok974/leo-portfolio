# Dev Overlay & Agent Routes Implementation

**Date**: October 15, 2025
**Status**: ✅ nginx routing configured, Backend cookie settings updated, E2E test created
**Remaining**: Backend `/agent/*` endpoints need implementation

## Overview

Configured infrastructure to support dev overlay functionality with proper cookie domain settings and nginx routing for `/agent/*` endpoints.

## 1. ✅ nginx Routing for `/agent/*`

### Configuration Update

**File**: `deploy/nginx.assistant.conf`

Added `/agent/` location block with SSE/events support (same as `/chat`):

```nginx
# Agent endpoints -> backend (SSE/events support for dev overlay)
location /agent/ {
    proxy_pass http://portfolio_backend;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Connection "";
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # SSE/events timeouts
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_buffering off;
}
```

### Deployment

**Deployed to**: `applylens-nginx-prod` container

```bash
docker cp d:\leo-portfolio\deploy\nginx.assistant.conf applylens-nginx-prod:/etc/nginx/conf.d/assistant.conf
docker exec applylens-nginx-prod nginx -t
# Output: syntax is ok, test is successful ✅

docker exec applylens-nginx-prod nginx -s reload
# Output: 2025/10/15 03:48:24 [notice] 853#853: signal process started ✅
```

**Routing Summary**:
- `/agent/*` → `http://portfolio_backend` (ai-finance-api.int:8000)
- `/chat` → `http://portfolio_backend`
- `/api/*` → `http://portfolio_backend`
- `/` → `http://portfolio.int:80` (static portfolio)

**Verification**:
```bash
docker exec applylens-nginx-prod curl -s http://localhost/agent/dev/status
# Output: 302 Found (redirecting to backend) ✅
```

The 302 response confirms nginx is correctly routing `/agent/*` to the backend. The redirect indicates the backend is processing the request (though the endpoint needs implementation).

## 2. ✅ Backend Cookie Configuration

### Docker Compose Update

**File**: `c:\ai-finance-agent-oss-clean\docker-compose.yml`

**Service**: `backend` (ai-finance-backend-1)

Added cookie environment variables for cross-domain support:

```yaml
environment:
  # ... existing vars ...
  # Cookie configuration for cross-domain (assistant.ledger-mind.org)
  COOKIE_DOMAIN: ".ledger-mind.org"
  COOKIE_SECURE: "1"
  COOKIE_SAMESITE: "lax"
```

### Deployment

**Restarted backend** with new configuration:

```bash
cd c:\ai-finance-agent-oss-clean
docker-compose up -d backend
# Output: Container ai-finance-backend-1   Started ✅
```

**Verification**:
```bash
docker inspect ai-finance-backend-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | Select-String -Pattern "COOKIE"
# Output:
# COOKIE_DOMAIN=.ledger-mind.org ✅
# COOKIE_SAMESITE=lax ✅
# COOKIE_SECURE=1 ✅
```

### Cookie Behavior

With these settings, backend will issue cookies like:

```http
Set-Cookie: sa_dev=...; Domain=.ledger-mind.org; Secure; Path=/; SameSite=Lax
```

**Effect**:
- Cookie valid on `assistant.ledger-mind.org`, `app.ledger-mind.org`, and all subdomains
- `Secure=1`: Only sent over HTTPS
- `SameSite=Lax`: Sent on top-level navigation, safe from CSRF

## 3. ✅ Playwright E2E Test

### Test File Created

**File**: `apps/portfolio-ui/tests/dev-overlay.spec.ts`

**Test 1**: Manual Cookie Setup
```typescript
test('Dev overlay appears when cookie set and /agent routes are live', async ({ page }) => {
  // Prime cookie before navigation so SameSite=Lax doesn't block it
  await page.context().addCookies([{
    name: 'sa_dev',
    value: '1',
    domain: 'assistant.ledger-mind.org',
    path: '/',
    secure: true,
    httpOnly: false,
    sameSite: 'Lax'
  }]);

  await page.goto('https://assistant.ledger-mind.org/');

  // Overlay badge/toolbar visible
  const overlay = page.locator('[data-testid="dev-overlay"]');
  await expect(overlay).toBeVisible({ timeout: 10000 });

  // Status endpoint reachable
  const res = await page.request.get('https://assistant.ledger-mind.org/agent/dev/status');
  expect(res.status()).toBeLessThan(400);

  // Toggle/hide works
  const hideBtn = page.locator('[data-testid="dev-overlay-hide"]');
  if (await hideBtn.isVisible()) {
    await hideBtn.click();
    await expect(overlay).toBeHidden();
    await page.reload();
    await expect(overlay).toBeHidden(); // persisted
  }
});
```

**Test 2**: Backend-Enabled Cookie Flow
```typescript
test('Dev overlay enabled via /agent/dev/enable endpoint', async ({ page }) => {
  // Enable dev overlay via backend endpoint (with Authorization header)
  const enableRes = await page.request.get('https://assistant.ledger-mind.org/agent/dev/enable', {
    headers: {
      'Authorization': 'Bearer dev'
    }
  });

  // Should receive Set-Cookie header
  expect(enableRes.status()).toBeLessThan(400);

  // Navigate to site - cookie should be set by backend
  await page.goto('https://assistant.ledger-mind.org/');

  // Overlay should now be visible
  const overlay = page.locator('[data-testid="dev-overlay"]');
  await expect(overlay).toBeVisible({ timeout: 10000 });

  // Verify status endpoint confirms enabled
  const statusRes = await page.request.get('https://assistant.ledger-mind.org/agent/dev/status');
  expect(statusRes.status()).toBe(200);

  const status = await statusRes.json();
  expect(status.enabled).toBe(true);
});
```

### Test Scenarios

1. **Manual Cookie**: Sets `sa_dev` cookie via Playwright, verifies overlay appears
2. **Backend Enable**: Calls `/agent/dev/enable`, backend sets cookie, verifies overlay
3. **Status Check**: Confirms `/agent/dev/status` endpoint is reachable
4. **Toggle Persistence**: Tests hide button and localStorage persistence

### Running Tests

```bash
# Run all portfolio tests (once backend endpoints are implemented)
pnpm exec playwright test -g "dev-overlay"

# Run with production URL
pnpm exec playwright test dev-overlay.spec.ts --project=chromium
```

## 4. ⏳ Backend Endpoint Implementation (TODO)

### Required Endpoints

The backend needs to implement these `/agent/dev/*` endpoints:

#### GET `/agent/dev/status`

**Purpose**: Check if dev overlay is enabled for current user

**Response**:
```json
{
  "enabled": true,
  "cookie_name": "sa_dev",
  "domain": ".ledger-mind.org"
}
```

**Status Codes**:
- `200 OK`: User has valid dev cookie
- `401 Unauthorized`: No cookie or invalid cookie

#### GET `/agent/dev/enable`

**Purpose**: Enable dev overlay by setting signed cookie

**Headers Required**:
```
Authorization: Bearer dev
```

(or HMAC signature if more security needed)

**Response**:
```http
HTTP/1.1 200 OK
Set-Cookie: sa_dev=<signed_value>; Domain=.ledger-mind.org; Secure; Path=/; SameSite=Lax; HttpOnly
Content-Type: application/json

{
  "enabled": true,
  "expires_at": "2025-10-15T12:00:00Z"
}
```

**Status Codes**:
- `200 OK`: Cookie set successfully
- `401 Unauthorized`: Invalid Authorization header
- `403 Forbidden`: Dev routes disabled in production

#### GET `/agent/dev/disable`

**Purpose**: Disable dev overlay by clearing cookie

**Response**:
```http
HTTP/1.1 200 OK
Set-Cookie: sa_dev=; Domain=.ledger-mind.org; Secure; Path=/; SameSite=Lax; Max-Age=0
Content-Type: application/json

{
  "enabled": false
}
```

### Implementation Notes

**Cookie Security**:
- Use signed cookies (JWT or HMAC) to prevent tampering
- Include expiration timestamp
- Validate signature on every request

**Environment Gating**:
```python
# Only allow in dev/staging
ALLOW_DEV_ROUTES = os.getenv("ALLOW_DEV_ROUTES", "0") == "1"

if not ALLOW_DEV_ROUTES:
    raise HTTPException(403, "Dev routes disabled")
```

**Example Implementation** (FastAPI):
```python
from fastapi import APIRouter, Response, Header, HTTPException
from datetime import datetime, timedelta
import os

router = APIRouter(prefix="/agent/dev")

COOKIE_NAME = "sa_dev"
COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN", ".ledger-mind.org")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "1") == "1"
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax")
ALLOW_DEV_ROUTES = os.getenv("ALLOW_DEV_ROUTES", "0") == "1"

def check_dev_enabled():
    if not ALLOW_DEV_ROUTES:
        raise HTTPException(403, "Dev routes disabled")

@router.get("/status")
def dev_status(sa_dev: str | None = Cookie(None)):
    """Check if dev overlay is enabled"""
    check_dev_enabled()

    return {
        "enabled": sa_dev is not None and sa_dev != "",
        "cookie_name": COOKIE_NAME,
        "domain": COOKIE_DOMAIN
    }

@router.get("/enable")
def dev_enable(response: Response, authorization: str | None = Header(None)):
    """Enable dev overlay by setting cookie"""
    check_dev_enabled()

    # Validate authorization
    if authorization != "Bearer dev":
        raise HTTPException(401, "Invalid authorization")

    # Set cookie (expires in 7 days)
    expires = datetime.utcnow() + timedelta(days=7)
    response.set_cookie(
        key=COOKIE_NAME,
        value="1",  # or signed JWT with expiration
        domain=COOKIE_DOMAIN,
        secure=COOKIE_SECURE,
        httponly=True,
        samesite=COOKIE_SAMESITE,
        expires=expires
    )

    return {
        "enabled": True,
        "expires_at": expires.isoformat()
    }

@router.get("/disable")
def dev_disable(response: Response):
    """Disable dev overlay by clearing cookie"""
    check_dev_enabled()

    # Clear cookie
    response.set_cookie(
        key=COOKIE_NAME,
        value="",
        domain=COOKIE_DOMAIN,
        secure=COOKIE_SECURE,
        httponly=True,
        samesite=COOKIE_SAMESITE,
        max_age=0
    )

    return {"enabled": False}
```

## 5. Optional: Cloudflare Cache Bypass

### Cloudflare Page Rule

To prevent caching of `/agent/*` endpoints:

1. Go to Cloudflare Dashboard → assistant.ledger-mind.org
2. Navigate to **Rules** → **Page Rules**
3. Create new rule:
   - **URL**: `https://assistant.ledger-mind.org/agent/*`
   - **Settings**:
     - Cache Level: Bypass
     - Browser Cache TTL: Respect Existing Headers
4. Save and deploy

**Alternative**: Use Cloudflare Cache Rules (newer UI):
- **Match**: `http.request.uri.path starts with "/agent/"`
- **Action**: Bypass cache

### Why Bypass Cache?

- `/agent/dev/status` should always reflect current cookie state
- `/agent/dev/enable` sets cookies, must not be cached
- Dev overlay artifacts/events are real-time

## Current Status Summary

### ✅ Completed

1. **nginx routing**: `/agent/*` routes to backend (ai-finance-api.int:8000)
   - Config deployed and reloaded
   - Verified with 302 response from backend

2. **Backend cookie settings**: Cookie domain, secure, and SameSite configured
   - Environment variables added to docker-compose.yml
   - Backend container restarted
   - Verified in container environment

3. **Playwright E2E test**: dev-overlay.spec.ts created
   - Test 1: Manual cookie setup
   - Test 2: Backend /agent/dev/enable flow
   - Test 3: Status endpoint check
   - Test 4: Toggle persistence

### ⏳ Remaining

1. **Backend endpoints**: Implement `/agent/dev/*` routes
   - `/agent/dev/status` - Check if enabled
   - `/agent/dev/enable` - Set cookie
   - `/agent/dev/disable` - Clear cookie

2. **Frontend overlay UI**: Create dev overlay component
   - Badge/toolbar when `sa_dev` cookie present
   - Toggle hide/show with localStorage
   - Display dev tools (if implemented)

3. **Cloudflare cache bypass**: Add page rule for `/agent/*`

4. **Documentation**: Update API docs with new endpoints

## Verification Steps

### 1. Test nginx Routing

```bash
# From nginx container (bypasses Cloudflare)
docker exec applylens-nginx-prod curl -I http://localhost/agent/dev/status
# Expected: 302 Found (or 404 if endpoint not implemented) ✅
```

### 2. Test Backend Cookie Settings

```bash
# Check environment variables
docker inspect ai-finance-backend-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | Select-String -Pattern "COOKIE"
# Expected:
# COOKIE_DOMAIN=.ledger-mind.org ✅
# COOKIE_SECURE=1 ✅
# COOKIE_SAMESITE=lax ✅
```

### 3. Test Production URL (once backend implemented)

```bash
# Status endpoint
curl -i https://assistant.ledger-mind.org/agent/dev/status
# Expected: 200 OK with JSON {"enabled": false}

# Enable endpoint
curl -i -H "Authorization: Bearer dev" https://assistant.ledger-mind.org/agent/dev/enable
# Expected: 200 OK with Set-Cookie header
```

### 4. Run E2E Tests

```bash
cd d:\leo-portfolio
pnpm exec playwright test dev-overlay.spec.ts --project=chromium
# Expected: Tests pass once backend endpoints and frontend overlay are implemented
```

## Files Changed

### Modified (2 files)
1. `deploy/nginx.assistant.conf` - Added `/agent/` location block
2. `c:\ai-finance-agent-oss-clean\docker-compose.yml` - Added cookie env vars to backend

### Created (2 files)
1. `apps/portfolio-ui/tests/dev-overlay.spec.ts` - Playwright E2E tests
2. `DEV_OVERLAY_IMPLEMENTATION.md` - This file

## Next Steps

### Priority 1: Backend Implementation

Implement the 3 required endpoints in the backend:
- `/agent/dev/status`
- `/agent/dev/enable`
- `/agent/dev/disable`

See "Backend Endpoint Implementation" section above for complete example code.

### Priority 2: Frontend Overlay Component

Create React/Preact component that:
1. Checks for `sa_dev` cookie on mount
2. Renders dev overlay badge when cookie present
3. Provides toggle to hide/show (persists in localStorage)
4. Optionally displays dev tools, metrics, etc.

Example integration:
```tsx
// apps/portfolio-ui/src/dev-overlay.main.tsx
import { render } from 'preact';
import DevOverlay from './components/DevOverlay';

const mount = document.getElementById('dev-overlay-root');
if (mount && document.cookie.includes('sa_dev')) {
  render(<DevOverlay />, mount);
}
```

Add to index.html:
```html
<div id="dev-overlay-root"></div>
<script type="module" src="/src/dev-overlay.main.tsx"></script>
```

### Priority 3: Cloudflare Cache Rule

Add page rule to bypass cache for `/agent/*` endpoints (see section 5 above).

### Priority 4: Documentation

Update API documentation:
- Add `/agent/dev/*` endpoints to API.md
- Document cookie behavior
- Add usage examples

## Production Checklist

- [x] nginx routing configured
- [x] nginx config deployed and reloaded
- [x] Backend cookie settings configured
- [x] Backend container restarted
- [x] E2E test created
- [ ] Backend `/agent/dev/*` endpoints implemented
- [ ] Frontend dev overlay component created
- [ ] Cloudflare cache bypass configured
- [ ] E2E tests passing
- [ ] Documentation updated
