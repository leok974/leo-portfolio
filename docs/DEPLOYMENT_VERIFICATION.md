# Deployment Verification Playbook

**Generated**: October 13, 2025
**Purpose**: Fast verification checklist for staging/production deployments.

---

## Quick Verification (5 minutes)

Run these checks after deploying to staging or production.

---

## A. Backend Authentication (HMAC-Signed Cookies)

### 1. Admin Login (Set Cookie)

```bash
# Login as admin (replace with your email)
curl -i -X POST "https://assistant.ledger-mind.org/api/auth/admin/login?email=you@yourdomain.com"

# Expected response:
# HTTP/1.1 200 OK
# Set-Cookie: admin_auth=<token>; Max-Age=604800; Path=/; Domain=.ledger-mind.org; HttpOnly; Secure; SameSite=None
#
# {"ok": true, "email": "you@yourdomain.com"}
```

**Extract Cookie**:
```bash
# Copy the admin_auth value from Set-Cookie header above
ADMIN_COOKIE="admin_auth=<paste-token-here>"

# Or extract automatically:
ADMIN_COOKIE=$(curl -i -X POST "https://assistant.ledger-mind.org/api/auth/admin/login?email=you@yourdomain.com" 2>&1 | grep -i 'set-cookie: admin_auth' | sed 's/.*admin_auth=\([^;]*\).*/admin_auth=\1/')
```

### 2. Verify Auth Status

```bash
# Check /api/auth/me with cookie
curl -s -H "Cookie: $ADMIN_COOKIE" "https://assistant.ledger-mind.org/api/auth/me" | jq

# Expected response:
{
  "user": {
    "email": "you@yourdomain.com"
  },
  "roles": ["admin"],
  "is_admin": true
}
```

### 3. Test Without Cookie (Should Fail)

```bash
# Without cookie → no admin status
curl -s "https://assistant.ledger-mind.org/api/auth/me" | jq

# Expected response:
{
  "user": null,
  "roles": [],
  "is_admin": false
}
```

### 4. Admin Logout

```bash
# Logout (delete cookie)
curl -i -H "Cookie: $ADMIN_COOKIE" -X POST "https://assistant.ledger-mind.org/api/auth/admin/logout"

# Expected response:
# HTTP/1.1 200 OK
# Set-Cookie: admin_auth=; Max-Age=0; Path=/; Domain=.ledger-mind.org
# {"ok": true}
```

### 5. Cookie Attributes Verification

**Check in Browser DevTools**:
1. Open DevTools (F12)
2. Application tab → Cookies → `https://assistant.ledger-mind.org`
3. Find `admin_auth` cookie
4. **Verify attributes**:
   - ✅ **Domain**: `.ledger-mind.org` (note the leading dot)
   - ✅ **Path**: `/`
   - ✅ **Expires**: 7 days from now
   - ✅ **HttpOnly**: Yes (checked)
   - ✅ **Secure**: Yes (checked)
   - ✅ **SameSite**: None

**Why These Matter**:
- **Domain**: `.ledger-mind.org` works on all subdomains (assistant., api., etc.)
- **HttpOnly**: JavaScript can't steal the cookie (XSS protection)
- **Secure**: Only sent over HTTPS
- **SameSite=None**: Works across subdomains (requires Secure=true)

---

## A2. 60-Second Smoke Test (curl)

**Quick smoke test for staging/production** — replace `<site>` with your portfolio origin and `<email>` with your admin email.

```bash
# 1) Get admin cookie (HMAC-signed)
curl -i -X POST "https://<site>/api/auth/admin/login?email=<email>" | sed -n '1,5p'

# Copy the cookie value into $C (everything after "admin_auth=" up to the semicolon)
C="<paste_cookie_value>"

# 2) Verify /api/auth/me sees you as admin
curl -s -H "Cookie: admin_auth=$C" "https://<site>/api/auth/me" | jq

# 3) Protected actions: should be 200 with cookie, 401/403 without
curl -i -H "Cookie: admin_auth=$C" -X POST "https://<site>/api/layout/reset"   | sed -n '1,2p'
curl -i -H "Cookie: admin_auth=$C" -X POST "https://<site>/api/layout/autotune" | sed -n '1,2p'
curl -i -X POST "https://<site>/api/layout/reset"   | sed -n '1,2p'  # expect 401/403

# Optional (SSE + cookies pass through):
curl -I -H "Cookie: admin_auth=$C" "https://<site>/agent/events" | sed -n '1,3p'
```

**Example (Production)**:
```bash
# Login
curl -i -X POST "https://assistant.ledger-mind.org/api/auth/admin/login?email=leoklemet.pa@gmail.com" | sed -n '1,5p'

# Expected:
# HTTP/1.1 200 OK
# Set-Cookie: admin_auth=eyJ...xyz; Max-Age=604800; Path=/; Domain=.ledger-mind.org; HttpOnly; Secure; SameSite=None
# Content-Type: application/json
# 
# {"ok":true,"email":"leoklemet.pa@gmail.com"}

# Extract cookie
C="eyJ...xyz"  # Copy from Set-Cookie header

# Verify admin
curl -s -H "Cookie: admin_auth=$C" "https://assistant.ledger-mind.org/api/auth/me" | jq
# {"user":{"email":"leoklemet.pa@gmail.com"},"roles":["admin"],"is_admin":true}

# Test autotune (with cookie → 200)
curl -i -H "Cookie: admin_auth=$C" -X POST "https://assistant.ledger-mind.org/api/layout/autotune" | sed -n '1,2p'
# HTTP/1.1 200 OK
# {"ok":true,"message":"Layout autotuned"}

# Test autotune (without cookie → 401)
curl -i -X POST "https://assistant.ledger-mind.org/api/layout/autotune" | sed -n '1,2p'
# HTTP/1.1 401 Unauthorized
# {"detail":"Authentication required"}
```

---

## A3. PowerShell One-Shot Verifier

**Copy/paste this into PowerShell** to verify all admin authentication in one go:

```powershell
# Save as: scripts/Test-PortfolioAdmin.ps1

function Test-PortfolioAdmin {
  param(
    [Parameter(Mandatory=$true)][string]$Site,     # e.g. https://assistant.ledger-mind.org
    [Parameter(Mandatory=$true)][string]$Email     # your admin email
  )
  $ProgressPreference = 'SilentlyContinue'
  Write-Host "1) Logging in as admin..." -ForegroundColor Cyan
  $resp = Invoke-WebRequest -Uri "$Site/api/auth/admin/login?email=$Email" -Method POST -UseBasicParsing
  $cookie = ($resp.Headers.'Set-Cookie' | Select-String -Pattern 'admin_auth=([^;]+)').Matches.Groups[1].Value
  if (-not $cookie) { throw "No admin_auth cookie in response." }
  Write-Host "   ✓ Got cookie (len $($cookie.Length))"

  $hdr = @{ Cookie = "admin_auth=$cookie" }

  Write-Host "2) Checking /api/auth/me..." -ForegroundColor Cyan
  $me = Invoke-WebRequest -Uri "$Site/api/auth/me" -Headers $hdr -UseBasicParsing
  $json = $me.Content | ConvertFrom-Json
  if (-not $json.is_admin) { throw "/api/auth/me did not return is_admin=true" }
  Write-Host "   ✓ is_admin=true for $($json.user.email)"

  Write-Host "3) Hitting protected endpoints..." -ForegroundColor Cyan
  $ok1 = (Invoke-WebRequest -Uri "$Site/api/layout/reset" -Method POST -Headers $hdr -UseBasicParsing).StatusCode
  $ok2 = (Invoke-WebRequest -Uri "$Site/api/layout/autotune" -Method POST -Headers $hdr -UseBasicParsing).StatusCode
  $forbid = (Invoke-WebRequest -Uri "$Site/api/layout/reset" -Method POST -UseBasicParsing -ErrorAction SilentlyContinue)
  if ($ok1 -ge 400 -or $ok2 -ge 400) { throw "Protected endpoints failed with admin cookie." }
  if ($forbid.StatusCode -lt 400) { throw "Endpoint allowed without cookie." }
  Write-Host "   ✓ Protected endpoints enforce admin correctly"

  Write-Host "4) (Optional) SSE reachable..." -ForegroundColor Cyan
  $head = Invoke-WebRequest -Method Head -Uri "$Site/agent/events" -Headers $hdr -UseBasicParsing
  if ($head.StatusCode -lt 200 -or $head.StatusCode -ge 400) {
    Write-Host "   ! SSE HEAD non-200 (ok on some backends)"
  } else {
    Write-Host "   ✓ SSE HEAD OK"
  }

  Write-Host "`nAll admin verifications passed ✅" -ForegroundColor Green
}

# Example:
# Test-PortfolioAdmin -Site "https://assistant.ledger-mind.org" -Email "leoklemet.pa@gmail.com"
```

**Run locally**:
```powershell
.\scripts\Test-PortfolioAdmin.ps1 -Site "https://assistant.ledger-mind.org" -Email "leoklemet.pa@gmail.com"
```

**Run against local dev**:
```powershell
.\scripts\Test-PortfolioAdmin.ps1 -Site "http://127.0.0.1:5174" -Email "dev@localhost"
```

**Expected output**:
```
1) Logging in as admin...
   Email: leoklemet.pa@gmail.com
   Site:  https://assistant.ledger-mind.org
   ✓ Got admin_auth cookie (length: 180)

2) Checking /api/auth/me...
   ✓ is_admin=true for leoklemet.pa@gmail.com
   ✓ Roles: admin

3) Testing protected endpoints...
   a) With admin cookie:
      ✓ POST /api/layout/reset → 200
      ✓ POST /api/layout/autotune → 200
   b) Without cookie (should fail):
      ✓ POST /api/layout/reset → 401 (blocked)

4) Testing SSE endpoint...
   ✓ HEAD /agent/events → 200

============================================================
All admin authentication verifications passed ✅
============================================================
```

---

## A4. Playwright E2E Test

**Full integration test** (saves cookie, checks UI + endpoints):

**File**: `tests/e2e/admin.auth.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

const SITE  = process.env.PW_SITE  || 'http://127.0.0.1:5174';
const EMAIL = process.env.ADMIN_TEST_EMAIL || 'leoklemet.pa@gmail.com';

test.describe('admin HMAC cookie + UI gating', () => {
  test('login → /api/auth/me → protected endpoints → UI buttons visible', async ({ page, context }) => {
    // 1) login to get Set-Cookie
    const rlogin = await page.request.post(`${SITE}/api/auth/admin/login?email=${encodeURIComponent(EMAIL)}`);
    expect(rlogin.ok()).toBeTruthy();
    const setCookie = rlogin.headers()['set-cookie'] || rlogin.headers()['Set-Cookie'];
    expect(setCookie).toBeTruthy();

    // 2) Carry cookie into browser context
    const cookieVal = /admin_auth=([^;]+)/.exec(setCookie!)?.[1];
    expect(cookieVal).toBeTruthy();
    await context.addCookies([{
      name: 'admin_auth',
      value: cookieVal!,
      url: SITE,
      httpOnly: true,
      secure: SITE.startsWith('https'),
      sameSite: 'None'
    }]);

    // 3) API says we are admin
    const rme = await page.request.get(`${SITE}/api/auth/me`);
    const me = await rme.json();
    expect(me.is_admin).toBe(true);

    // 4) Protected endpoints succeed
    const r1 = await page.request.post(`${SITE}/api/layout/reset`);
    const r2 = await page.request.post(`${SITE}/api/layout/autotune`);
    expect(r1.ok()).toBeTruthy();
    expect(r2.ok()).toBeTruthy();

    // 5) UI shows admin-only controls (assistant island)
    await page.goto(`${SITE}/`);
    await expect(page.getByTestId('assistant-panel')).toBeVisible();
    await expect(page.getByTestId('btn-autotune')).toBeVisible();
    await expect(page.getByTestId('btn-reset')).toBeVisible();
  });

  test('protected endpoint blocks without cookie', async ({ request }) => {
    const r = await request.post(`${SITE}/api/layout/reset`);
    expect(r.status()).toBeGreaterThanOrEqual(400);
  });
});
```

**Run locally** (dev server on port 5174):
```bash
PW_APP=portfolio ADMIN_TEST_EMAIL=leoklemet.pa@gmail.com pnpm exec playwright test tests/e2e/admin.auth.spec.ts --project=chromium
```

**Run against staging/prod** (no dev server):
```bash
PW_SITE="https://assistant.ledger-mind.org" ADMIN_TEST_EMAIL=leoklemet.pa@gmail.com \
  pnpm exec playwright test tests/e2e/admin.auth.spec.ts --project=chromium
```

**Note**: If portfolio & API are on different subdomains, ensure the cookie has `Domain=.ledger-mind.org; SameSite=None; Secure` so the browser sends it to the portfolio origin. Your backend should already do this.

---

## A5. CI Hook (GitHub Actions)

**Only run when secret is available** — add to `.github/workflows/portfolio.yml`:

```yaml
env:
  ADMIN_TEST_EMAIL: leoklemet.pa@gmail.com
  PW_APP: portfolio

jobs:
  e2e-admin:
    if: ${{ secrets.ADMIN_HMAC_SECRET != '' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - run: pnpm install --frozen-lockfile
      
      # Start your staging URL or hit an already deployed env:
      - name: E2E admin auth (staging)
        env:
          PW_SITE: https://assistant.ledger-mind.org
        run: pnpm exec playwright test tests/e2e/admin.auth.spec.ts --project=chromium
```

**Why the `if` condition?**
- Prevents test failures in forks/PRs where `ADMIN_HMAC_SECRET` isn't available
- Only runs when secret exists (main repo, after backend deployment)

---

## A6. What "Passing" Looks Like

**Backend**:
- ✅ `curl /api/auth/me` with cookie returns `{"is_admin":true, ...}`
- ✅ `POST /api/layout/reset` and `/autotune`:
  - **200** with admin cookie
  - **401/403** without cookie
- ✅ Logout deletes cookie (Set-Cookie with `Max-Age=0`)

**Frontend**:
- ✅ On homepage, **Autotune** and **Reset** buttons visible **without** `?admin=1` (because authenticated)
- ✅ Admin badge (green pill) visible
- ✅ Dev override `?admin=1` **disabled** in production (requires real auth)

**SSE** (Optional):
- ✅ `/agent/events` HEAD/GET returns 200 and streams
- ✅ Cookie forwarded through nginx to backend

---

## B. Authentication & Roles (Legacy)

### 1. Check Auth Endpoint

```bash
# Replace YOUR_COOKIE_HERE with actual session cookie
curl -s -b "YOUR_COOKIE_HERE" https://assistant.ledger-mind.org/api/auth/me | jq

# Expected response for admin user:
{
  "user": {
    "id": "...",
    "email": "admin@example.com",
    "roles": ["admin"],
    "is_admin": true
  }
}

# Expected response for non-admin:
{
  "user": {
    "id": "...",
    "email": "user@example.com",
    "roles": ["user"],
    "is_admin": false
  }
}

# Expected response for unauthenticated:
# HTTP 401 or empty response
```

### 2. Extract Cookie from Browser

**Chrome/Edge DevTools**:
1. Open DevTools (F12)
2. Application tab → Cookies → `https://assistant.ledger-mind.org`
3. Find session cookie (e.g., `session`, `auth_token`)
4. Copy value

**Firefox**:
1. Open DevTools (F12)
2. Storage tab → Cookies → `https://assistant.ledger-mind.org`
3. Find session cookie
4. Copy value

**PowerShell Script** (automated):
```powershell
# After signing in, run this in browser console:
document.cookie.split(';').find(c => c.includes('session'))

# Then use in curl:
$cookie = "session=<paste-value-here>"
curl -s -b $cookie https://assistant.ledger-mind.org/api/auth/me | jq
```

---

## B. Admin UI Visibility

### 1. Signed-Out User (Should Hide Admin Controls)

1. Open incognito/private window
2. Navigate to `https://assistant.ledger-mind.org/`
3. **Verify**:
   - ✅ Assistant panel visible
   - ❌ NO "admin" badge
   - ❌ NO "Autotune" button
   - ❌ NO "Reset" button
   - ✅ "Hide" button present

### 2. Admin User (Should Show Admin Controls)

1. Sign in as admin
2. Navigate to `https://assistant.ledger-mind.org/`
3. **Verify**:
   - ✅ Assistant panel visible
   - ✅ "admin" badge visible (green pill)
   - ✅ "Autotune" button visible
   - ✅ "Reset" button visible
   - ✅ "Hide" button present

### 3. Dev Override Disabled in Production

1. Navigate to `https://assistant.ledger-mind.org/?admin=1`
2. Open DevTools → Application → Local Storage
3. **Verify**:
   - ❌ `admin:enabled` NOT set (or ignored)
   - ❌ Admin controls NOT visible (unless really admin)

**Expected Behavior**: Dev override should NOT work in production (requires real auth).

---

## C. CSP & Nonces

### 1. Check CSP Header

```bash
# Fetch CSP header from production
curl -sI https://assistant.ledger-mind.org/ | grep -i content-security-policy

# Expected output (truncated):
# content-security-policy: default-src 'self'; script-src 'self' 'nonce-...' ...
```

### 2. Verify Nonce in HTML

```bash
# Fetch HTML and extract nonce
resp=$(curl -s https://assistant.ledger-mind.org/)
nonce=$(echo "$resp" | grep -o 'nonce="[a-f0-9]\{32\}"' | head -n1 | cut -d'"' -f2)
echo "HTML nonce: $nonce"

# Verify all <script> tags have nonces
echo "$resp" | grep -E '<script[^>]*>' | grep -v 'nonce='
# Expected: No output (all scripts should have nonces)
```

### 3. Check Browser Console

1. Open DevTools → Console
2. **Verify**:
   - ❌ NO CSP violations
   - ❌ NO "Refused to execute inline script" errors
   - ✅ No security warnings

---

## D. SSE Endpoints (Streaming)

### 1. Agent Events

```bash
# Test agent SSE endpoint
curl -i https://assistant.ledger-mind.org/agent/events | head -n 10

# Expected:
# HTTP/1.1 200 OK
# Content-Type: text/event-stream
# Transfer-Encoding: chunked
#
# event: ping
# data: {"timestamp": ...}
```

### 2. Chat Streaming

```bash
# Test chat stream endpoint
curl -i https://assistant.ledger-mind.org/chat/stream?channel=smoke | head -n 10

# Expected:
# HTTP/1.1 200 OK
# Content-Type: text/event-stream
# Transfer-Encoding: chunked
```

### 3. Verify No Buffering

**Check nginx config**:
```bash
# If using Docker
docker exec -it portfolio-ui cat /etc/nginx/nginx.conf | grep -A 5 "location.*chat/stream"

# Expected:
# proxy_buffering off;
# proxy_cache off;
# chunked_transfer_encoding on;
```

---

## E. Admin Endpoints (Server-Side Auth)

### 1. Test with HMAC Cookie (Recommended)

```bash
# First, login and get admin cookie (from Section A)
ADMIN_COOKIE=$(curl -i -X POST "https://assistant.ledger-mind.org/api/auth/admin/login?email=you@yourdomain.com" 2>&1 | grep -i 'set-cookie: admin_auth' | sed 's/.*admin_auth=\([^;]*\).*/admin_auth=\1/')

# Test autotune WITH admin cookie → 200
curl -i -H "Cookie: $ADMIN_COOKIE" -X POST "https://assistant.ledger-mind.org/api/layout/autotune"

# Expected:
# HTTP/1.1 200 OK
# {"ok": true, "message": "Layout autotuned"}

# Test reset WITH admin cookie → 200
curl -i -H "Cookie: $ADMIN_COOKIE" -X POST "https://assistant.ledger-mind.org/api/layout/reset"

# Expected:
# HTTP/1.1 200 OK
# {"ok": true, "message": "Layout reset to default"}
```

### 2. Test WITHOUT Auth → 401

```bash
# Autotune without cookie → 401
curl -i -X POST "https://assistant.ledger-mind.org/api/layout/autotune"

# Expected:
# HTTP/1.1 401 Unauthorized
# {"detail": "Authentication required"}

# Reset without cookie → 401
curl -i -X POST "https://assistant.ledger-mind.org/api/layout/reset"

# Expected:
# HTTP/1.1 401 Unauthorized
# {"detail": "Authentication required"}
```

### 3. Test with INVALID Cookie → 403

```bash
# Invalid/expired cookie → 403
curl -i -H "Cookie: admin_auth=invalid_token" -X POST "https://assistant.ledger-mind.org/api/layout/autotune"

# Expected:
# HTTP/1.1 403 Forbidden
# {"detail": "Admin privileges required"}
```

### 4. Full Workflow Test

```bash
# Complete admin workflow
echo "=== Admin Login ==="
curl -i -X POST "https://assistant.ledger-mind.org/api/auth/admin/login?email=you@yourdomain.com"

echo -e "\n=== Check Auth Status ==="
curl -s -H "Cookie: $ADMIN_COOKIE" "https://assistant.ledger-mind.org/api/auth/me" | jq

echo -e "\n=== Test Autotune ==="
curl -i -H "Cookie: $ADMIN_COOKIE" -X POST "https://assistant.ledger-mind.org/api/layout/autotune"

echo -e "\n=== Test Reset ==="
curl -i -H "Cookie: $ADMIN_COOKIE" -X POST "https://assistant.ledger-mind.org/api/layout/reset"

echo -e "\n=== Admin Logout ==="
curl -i -H "Cookie: $ADMIN_COOKIE" -X POST "https://assistant.ledger-mind.org/api/auth/admin/logout"

echo -e "\n=== Verify Logout (should fail) ==="
curl -i -H "Cookie: $ADMIN_COOKIE" -X POST "https://assistant.ledger-mind.org/api/layout/autotune"
```

---

## F. Resume Endpoints

### 1. Generate Markdown

```bash
curl -I https://assistant.ledger-mind.org/resume/generate.md

# Expected:
# HTTP/1.1 200 OK
# Content-Type: text/markdown
```

### 2. Generate PDF

```bash
curl -I https://assistant.ledger-mind.org/resume/generate.pdf

# Expected:
# HTTP/1.1 200 OK
# Content-Type: application/pdf
```

### 3. Copy Text

```bash
curl -I https://assistant.ledger-mind.org/resume/copy.txt

# Expected:
# HTTP/1.1 200 OK
# Content-Type: text/plain
```

### 4. Batch Check (All Resume Endpoints)

```bash
# PowerShell
foreach ($u in @('/resume/generate.md', '/resume/generate.pdf', '/resume/copy.txt')) {
  Write-Host "Checking: $u"
  curl -I "https://assistant.ledger-mind.org$u" | Select-String "HTTP|Content-Type"
}

# Bash
for u in /resume/generate.md /resume/generate.pdf /resume/copy.txt; do
  echo "Checking: $u"
  curl -I "https://assistant.ledger-mind.org$u" 2>&1 | grep -E "HTTP|Content-Type"
done
```

---

## G. SEO & Metadata

### 1. JSON-LD Person Schema

```bash
# Check for Person schema
curl -s https://assistant.ledger-mind.org/ | grep -A 20 'application/ld+json'

# Expected: Should include Person type with name, url, jobTitle, etc.
```

### 2. OG Image

```bash
# Check OG meta tags
curl -s https://assistant.ledger-mind.org/ | grep 'og:image'

# Expected:
# <meta property="og:image" content="https://assistant.ledger-mind.org/og.png">
```

### 3. Verify OG Image Exists

```bash
# Check if og.png is accessible
curl -I https://assistant.ledger-mind.org/og.png

# Expected:
# HTTP/1.1 200 OK
# Content-Type: image/png
```

---

## H. Health Checks

### 1. nginx Health

```bash
curl -i https://assistant.ledger-mind.org/healthz

# Expected:
# HTTP/1.1 200 OK
# ok
```

### 2. Backend Ready

```bash
curl -i https://assistant.ledger-mind.org/ready

# Expected:
# HTTP/1.1 200 OK
# { "status": "ready" }
```

### 3. Backend Status Summary

```bash
curl -s https://assistant.ledger-mind.org/status/summary | jq

# Expected:
# {
#   "status": "healthy",
#   "services": { ... },
#   "timestamp": "..."
# }
```

---

## I. Local Development Quickies

### 1. Enable Admin Mode

```
http://127.0.0.1:5174/?admin=1
```

**Verify**:
- Open browser console
- Run: `localStorage.getItem('admin:enabled')`
- Expected: `"1"`

### 2. Disable Admin Mode

```
http://127.0.0.1:5174/?admin=0
```

**Verify**:
- Open browser console
- Run: `localStorage.getItem('admin:enabled')`
- Expected: `"0"`

### 3. Run Admin E2E Tests

```bash
# All admin tests
pnpm run e2e:portfolio -- tests/e2e/admin.panel.spec.ts

# Expected: 4 passed
```

---

## J. Backend Guard Verification

### 1. Check Backend Implementation

**Required**: `/api/layout/autotune` and `/api/layout/reset` endpoints MUST:

- [ ] Validate session cookie
- [ ] Check `user.is_admin` or `user.roles`
- [ ] Return `401` for missing auth
- [ ] Return `403` for insufficient privileges

**Example Implementation** (FastAPI):

```python
from fastapi import Depends, HTTPException, status

async def require_admin(user = Depends(get_current_user)):
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    if not user.is_admin and "admin" not in user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return user

@app.post("/api/layout/autotune")
async def autotune_layout(admin_user = Depends(require_admin)):
    # ... admin-only logic
    return {"status": "success"}

@app.post("/api/layout/reset")
async def reset_layout(admin_user = Depends(require_admin)):
    # ... admin-only logic
    return {"status": "success"}
```

### 2. Verify `/api/auth/me` Endpoint

**Required Response Format**:

```json
{
  "user": {
    "id": "string",
    "email": "string",
    "roles": ["array", "of", "strings"],
    "is_admin": true
  }
}
```

**Test**:
```bash
# Should return user info with roles
curl -s -b "YOUR_COOKIE_HERE" https://assistant.ledger-mind.org/api/auth/me | jq

# Should return 401 without auth
curl -i https://assistant.ledger-mind.org/api/auth/me
```

---

## K. Quick Checklist

Print this and check off during deployment:

**Pre-Deployment**:
- [ ] `.env.production` has `VITE_ALLOW_DEV_ADMIN=0`
- [ ] All E2E tests passing locally
- [ ] Backend admin guards implemented
- [ ] nginx config has Cookie forwarding

**Post-Deployment (Staging)**:
- [ ] `/api/auth/me` returns correct roles
- [ ] Admin UI hidden for signed-out users
- [ ] Admin UI visible for admin users
- [ ] Dev override (`?admin=1`) does NOT work
- [ ] CSP header present with nonces
- [ ] No CSP violations in browser console
- [ ] SSE endpoints streaming (no buffering)
- [ ] Admin endpoints return 401/403 without auth
- [ ] Admin endpoints return 200 with admin auth
- [ ] Resume endpoints accessible
- [ ] OG image accessible (`/og.png`)
- [ ] Health checks passing

**Post-Deployment (Production)**:
- [ ] All staging checks above
- [ ] Performance: Page load < 2s
- [ ] Lighthouse: Performance > 90
- [ ] No errors in production logs
- [ ] Admin actions logged (if audit logging enabled)

---

## L. Troubleshooting Commands

### Issue: Admin controls not appearing for admin

```bash
# 1. Check auth endpoint
curl -s -b "$COOKIE" https://assistant.ledger-mind.org/api/auth/me | jq

# 2. Check if roles include "admin"
curl -s -b "$COOKIE" https://assistant.ledger-mind.org/api/auth/me | jq '.user.roles'

# 3. Check if is_admin flag set
curl -s -b "$COOKIE" https://assistant.ledger-mind.org/api/auth/me | jq '.user.is_admin'

# 4. Check nginx logs
docker logs portfolio-ui 2>&1 | grep "/api/auth/me"

# 5. Check backend logs
docker logs backend 2>&1 | grep "auth"
```

### Issue: CSP violations in console

```bash
# 1. Check CSP header syntax
curl -sI https://assistant.ledger-mind.org/ | grep -i content-security-policy

# 2. Check for missing nonces
curl -s https://assistant.ledger-mind.org/ | grep -E '<script[^>]*>' | grep -v 'nonce='

# 3. Check nginx config
docker exec -it portfolio-ui cat /etc/nginx/nginx.conf | grep -A 10 "Content-Security-Policy"
```

### Issue: SSE not streaming

```bash
# 1. Check nginx buffering
docker exec -it portfolio-ui cat /etc/nginx/nginx.conf | grep -A 5 "location.*chat/stream"

# 2. Test direct backend connection
curl -i http://localhost:8001/chat/stream?channel=test

# 3. Check nginx error logs
docker logs portfolio-ui 2>&1 | grep "error"
```

---

## M. Automated Smoke Test Script

Save as `verify-deployment.sh`:

```bash
#!/bin/bash

DOMAIN="https://assistant.ledger-mind.org"
COOKIE="${1:-}"  # Pass cookie as first argument

echo "🚀 Deployment Verification for: $DOMAIN"
echo ""

# 1. Health check
echo "1️⃣ Health check..."
curl -sf "$DOMAIN/healthz" > /dev/null && echo "✅ Pass" || echo "❌ Fail"

# 2. OG image
echo "2️⃣ OG image..."
curl -sfI "$DOMAIN/og.png" | grep -q "200 OK" && echo "✅ Pass" || echo "❌ Fail"

# 3. Resume endpoints
echo "3️⃣ Resume endpoints..."
for u in /resume/generate.md /resume/generate.pdf /resume/copy.txt; do
  curl -sfI "$DOMAIN$u" | grep -q "200 OK" && echo "  ✅ $u" || echo "  ❌ $u"
done

# 4. CSP header
echo "4️⃣ CSP header..."
curl -sI "$DOMAIN/" | grep -q "content-security-policy" && echo "✅ Pass" || echo "❌ Fail"

# 5. Auth endpoint (if cookie provided)
if [ -n "$COOKIE" ]; then
  echo "5️⃣ Auth endpoint..."
  curl -sf -b "$COOKIE" "$DOMAIN/api/auth/me" | jq -e '.user' > /dev/null && echo "✅ Pass" || echo "❌ Fail"
fi

# 6. Admin endpoints (should fail without auth)
echo "6️⃣ Admin endpoints (should be protected)..."
curl -sf -X POST "$DOMAIN/api/layout/autotune" > /dev/null 2>&1 && echo "❌ NOT PROTECTED!" || echo "✅ Protected"

echo ""
echo "✅ Verification complete"
```

**Usage**:
```bash
# Without auth
bash verify-deployment.sh

# With admin cookie
bash verify-deployment.sh "session=abc123..."
```

---

**Last Updated**: October 13, 2025
**Status**: Ready for deployment verification
