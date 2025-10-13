---
title: BACKEND QUICKSTART
---

# Backend Implementation Quick Start

**Purpose**: Minimal steps to implement HMAC-signed admin authentication.
**Time**: 15 minutes
**Admin Email**: leoklemet.pa@gmail.com

---

## 0) Pre-requisites (One Time)

**Requirements**:
- Python 3.11+
- uvicorn, fastapi

**Installation**:
```bash
pip install fastapi uvicorn "python-multipart"  # multipart not strictly required, but handy
```

**Origins**:
- Dev: http://127.0.0.1:5174 (portfolio frontend)
- Prod: https://assistant.ledger-mind.org

---

---

## Step 1: Create Auth Module (5 min)

**File**: `assistant_api/auth_admin.py`

```python
import hmac, hashlib, base64, json, time, os
from fastapi import APIRouter, Response, Request, HTTPException, Depends
from fastapi.responses import JSONResponse
from typing import Dict, Any, Optional

ADMIN_SECRET   = os.environ.get("ADMIN_HMAC_SECRET", "change-me")
ADMIN_EMAILS   = [e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "leoklemet.pa@gmail.com").split(",")]
COOKIE_NAME    = "admin_auth"
COOKIE_MAX_AGE = 60 * 60 * 24 * 7  # 7 days
COOKIE_DOMAIN  = os.environ.get("COOKIE_DOMAIN", None)  # e.g. ".ledger-mind.org" in prod

def _b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()

def _b64url_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (4 - len(s) % 4))

def _sign(obj: Dict[str, Any]) -> str:
    body = _b64url(json.dumps(obj, separators=(",", ":")).encode())
    sig  = hmac.new(ADMIN_SECRET.encode(), body.encode(), hashlib.sha256).digest()
    return f"{body}.{_b64url(sig)}"

def _verify(token: str) -> Optional[Dict[str, Any]]:
    try:
        body, sig = token.split(".", 1)
        want = hmac.new(ADMIN_SECRET.encode(), body.encode(), hashlib.sha256).digest()
        got  = _b64url_decode(sig)
        if not hmac.compare_digest(want, got): return None
        data = json.loads(_b64url_decode(body))
        # 5 min clock skew tolerance
        if data.get("exp", 0) < int(time.time()) - 300: return None
        return data
    except Exception:
        return None

router = APIRouter(prefix="/api/auth")

@router.get("/me")
def me(request: Request):
    tok = request.cookies.get(COOKIE_NAME)
    data = _verify(tok) if tok else None
    if data and data.get("role") == "admin":
        return {"user": {"email": data.get("email")}, "roles": ["admin"], "is_admin": True}
    return {"user": None, "roles": [], "is_admin": False}

@router.post("/admin/login")
def admin_login(response: Response, email: str):
    email = email.strip().lower()
    if email not in ADMIN_EMAILS:
        raise HTTPException(403, "not in admin allowlist")
    payload = {"email": email, "role": "admin", "exp": int(time.time()) + COOKIE_MAX_AGE}
    token = _sign(payload)
    rsp = JSONResponse({"ok": True, "email": email})
    # SameSite/Domain: local dev vs prod
    cookie_kwargs = dict(max_age=COOKIE_MAX_AGE, path="/", httponly=True)
    if COOKIE_DOMAIN:  # prod / subdomain scenario
        cookie_kwargs.update(secure=True, samesite="none", domain=COOKIE_DOMAIN)
    else:  # same-origin local dev
        cookie_kwargs.update(samesite="lax")
    rsp.set_cookie(COOKIE_NAME, token, **cookie_kwargs)
    return rsp

@router.post("/admin/logout")
def admin_logout(response: Response):
    rsp = JSONResponse({"ok": True})
    if COOKIE_DOMAIN:
        rsp.delete_cookie(COOKIE_NAME, path="/", domain=COOKIE_DOMAIN)
    else:
        rsp.delete_cookie(COOKIE_NAME, path="/")
    return rsp

def require_admin(request: Request) -> Dict[str, Any]:
    tok = request.cookies.get(COOKIE_NAME)
    if not tok:
        raise HTTPException(401, "auth required")
    data = _verify(tok)
    if not data or data.get("role") != "admin":
        raise HTTPException(403, "admin required")
    return data
```

---

## Step 2: Mount Router + Protect Endpoints (2 min)

**File**: `assistant_api/main.py`

```python
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from .auth_admin import router as auth_router, require_admin

app = FastAPI(title="Portfolio Assistant API")

# CORS — for cookies, allow_credentials **must** be True and origins explicit
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5174",          # dev portfolio
        "https://assistant.ledger-mind.org",  # prod portfolio
        "https://ledger-mind.org",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)

@app.post("/api/layout/reset")
def layout_reset(_: dict = Depends(require_admin)):
    # TODO: implement your reset logic
    return {"ok": True, "message": "Layout reset"}

@app.post("/api/layout/autotune")
def layout_autotune(_: dict = Depends(require_admin)):
    # TODO: implement your autotune logic
    return {"ok": True, "message": "Layout autotuned"}
```

---

## Step 3: Environment Variables (3 min)

### Generate Secret

**PowerShell**:
```powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Bash**:
```bash
python3 - <<'PY'
import secrets; print(secrets.token_urlsafe(32))
PY
```

### Local Dev

**PowerShell**:
```powershell
# Set environment variables
$env:ADMIN_HMAC_SECRET = "<paste-generated-secret>"
$env:ADMIN_EMAILS = "leoklemet.pa@gmail.com"
# Local dev uses same-origin, so omit domain
Remove-Item Env:COOKIE_DOMAIN -ErrorAction SilentlyContinue
```

**Bash**:
```bash
export ADMIN_HMAC_SECRET="<paste-generated-secret>"
export ADMIN_EMAILS="leoklemet.pa@gmail.com"
unset COOKIE_DOMAIN   # local dev uses same-origin
```

### Production

**.env / docker-compose.yml / k8s**:
```env
ADMIN_HMAC_SECRET=<same secret on all replicas>
ADMIN_EMAILS=leoklemet.pa@gmail.com
COOKIE_DOMAIN=.ledger-mind.org
```

**Critical**: All backend replicas MUST share the same `ADMIN_HMAC_SECRET`.

---

## Step 4: Run Locally and Verify (5 min)

### Start Backend

```bash
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001 --reload
```

### Quick Smoke Test (curl)

```bash
# 1) Login
curl -i -X POST "http://127.0.0.1:8001/api/auth/admin/login?email=leoklemet.pa@gmail.com"

# 2) Copy admin_auth cookie value (after admin_auth=... up to ';')
C="<paste_cookie_value>"

# 3) Check /api/auth/me
curl -s -H "Cookie: admin_auth=$C" http://127.0.0.1:8001/api/auth/me | jq
# Expected: {"user": {"email": "leoklemet.pa@gmail.com"}, "roles": ["admin"], "is_admin": true}

# 4) Protected endpoint (with cookie → 200)
curl -i -H "Cookie: admin_auth=$C" -X POST http://127.0.0.1:8001/api/layout/autotune | sed -n '1,2p'
# Expected: HTTP/1.1 200 OK

# 5) Protected endpoint (without cookie → 401/403)
curl -i -X POST http://127.0.0.1:8001/api/layout/autotune | sed -n '1,2p'
# Expected: HTTP/1.1 401 Unauthorized or 403 Forbidden
```

---

## Step 5: Wire Prod Proxy (nginx)

**File**: `deploy/nginx.portfolio.conf`

```nginx
# API (cookies must pass through)
location /api/ {
  proxy_pass http://backend:8001;
  proxy_set_header Cookie $http_cookie;
  proxy_http_version 1.1;
}

# SSE (already configured): keep cookie forwarding + buffering off
location ~ ^/(agent/events|chat/stream) {
  proxy_pass http://backend:8001;
  proxy_set_header Cookie $http_cookie;
  proxy_http_version 1.1;
  proxy_set_header Connection "";
  proxy_buffering off;
  proxy_cache off;
  proxy_read_timeout 3600s;
  chunked_transfer_encoding on;
}
```

**Note**: Ensure your CSP `connect-src` allows the backend origin (already configured).

---

## Step 6: Verify in Staging/Prod

```bash
SITE="https://assistant.ledger-mind.org"
EMAIL="leoklemet.pa@gmail.com"

# 1) Login → Set-Cookie
curl -i -X POST "$SITE/api/auth/admin/login?email=$EMAIL" | sed -n '1,5p'

# 2) Extract admin_auth cookie value into $C
C="<paste_cookie_value>"

# 3) Check /api/auth/me
curl -s -H "Cookie: admin_auth=$C" "$SITE/api/auth/me" | jq
# Expected: {"user": {"email": "leoklemet.pa@gmail.com"}, "roles": ["admin"], "is_admin": true}

# 4) Protected endpoints
curl -i -H "Cookie: admin_auth=$C" -X POST "$SITE/api/layout/reset"    | sed -n '1,2p'
curl -i -H "Cookie: admin_auth=$C" -X POST "$SITE/api/layout/autotune" | sed -n '1,2p'
# Expected: HTTP/1.1 200 OK

# 5) Without cookie (should fail)
curl -i -X POST "$SITE/api/layout/reset" | sed -n '1,2p'
# Expected: HTTP/1.1 401 Unauthorized or 403 Forbidden
```

---

## Step 7: Optional Playwright E2E (API + UI)

**File**: `tests/e2e/admin.auth.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

const SITE  = process.env.PW_SITE  || 'http://127.0.0.1:5174';
const API   = process.env.PW_API   || SITE; // same-origin in prod
const EMAIL = process.env.ADMIN_TEST_EMAIL || 'leoklemet.pa@gmail.com';

test('admin login → /me → protected → UI', async ({ page, context }) => {
  const rlogin = await page.request.post(`${API}/api/auth/admin/login?email=${encodeURIComponent(EMAIL)}`);
  expect(rlogin.ok()).toBeTruthy();

  const setCookie = rlogin.headers()['set-cookie'] || '';
  const cookieVal = /admin_auth=([^;]+)/.exec(setCookie)?.[1];
  expect(cookieVal).toBeTruthy();

  await context.addCookies([{
    name: 'admin_auth',
    value: cookieVal!,
    url: SITE,
    httpOnly: true,
    secure: SITE.startsWith('https'),
    sameSite: 'None'
  }]);

  const rme = await page.request.get(`${API}/api/auth/me`);
  const me = await rme.json();
  expect(me.is_admin).toBe(true);

  const r1 = await page.request.post(`${API}/api/layout/reset`);
  expect(r1.ok()).toBeTruthy();

  const r2 = await page.request.post(`${API}/api/layout/autotune`);
  expect(r2.ok()).toBeTruthy();

  await page.goto(`${SITE}/`);
  await expect(page.getByTestId('assistant-panel')).toBeVisible();
  await expect(page.getByTestId('btn-autotune')).toBeVisible();
  await expect(page.getByTestId('btn-reset')).toBeVisible();
});

test('blocked without cookie', async ({ request }) => {
  const r = await request.post(`${API}/api/layout/reset`);
  expect(r.status()).toBeGreaterThanOrEqual(400);
});
```

### Run Locally (Dev Server)

```bash
PW_APP=portfolio \
PW_SITE="http://127.0.0.1:5174" \
PW_API="http://127.0.0.1:8001" \
ADMIN_TEST_EMAIL="leoklemet.pa@gmail.com" \
pnpm exec playwright test tests/e2e/admin.auth.spec.ts --project=chromium
```

### Run Against Staging/Prod

```bash
PW_SITE="https://assistant.ledger-mind.org" \
PW_API="https://assistant.ledger-mind.org" \
ADMIN_TEST_EMAIL="leoklemet.pa@gmail.com" \
pnpm exec playwright test tests/e2e/admin.auth.spec.ts --project=chromium
```

---

## Step 8: Common Gotchas (Quick Fixes)

### Issue 1: Cookie Not Sent to Frontend
**Problem**: Cookie not forwarded in browser requests
**Cause**: CORS misconfiguration
**Fix**: CORS must use `allow_credentials=True` and NO wildcard origins (`*`)

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5174", "https://assistant.ledger-mind.org"],  # explicit
    allow_credentials=True,  # REQUIRED for cookies
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Issue 2: Cookie Not Usable Across Subdomains
**Problem**: Cookie not shared between `assistant.ledger-mind.org` and `api.ledger-mind.org`
**Cause**: Missing domain attribute or wrong SameSite
**Fix**: Set `COOKIE_DOMAIN=.ledger-mind.org` (leading dot) and use `Secure; SameSite=None`

```python
COOKIE_DOMAIN = ".ledger-mind.org"  # Leading dot for subdomains
# In set_cookie:
cookie_kwargs.update(secure=True, samesite="none", domain=COOKIE_DOMAIN)
```

### Issue 3: 403 Everywhere
**Problem**: All admin requests return 403 Forbidden
**Cause**: Different `ADMIN_HMAC_SECRET` on each backend replica
**Fix**: All pods/replicas MUST share the SAME secret

```env
# Same value everywhere
ADMIN_HMAC_SECRET=<shared-secret-32-chars>
```

### Issue 4: Token Instantly "Expired"
**Problem**: Tokens expire immediately even though just created
**Cause**: Server clock skew
**Fix**: Already handled with 5-minute grace period in `_verify()`

```python
# 5 min clock skew tolerance
if data.get("exp", 0) < int(time.time()) - 300: return None
```

---

## Verification Checklist

- [ ] `assistant_api/auth_admin.py` created
- [ ] Router mounted in `main.py`
- [ ] CORS configured with `allow_credentials=True`
- [ ] Environment variables set (ADMIN_HMAC_SECRET, ADMIN_EMAILS)
- [ ] Backend running on port 8001
- [ ] Login returns Set-Cookie header
- [ ] `/api/auth/me` returns `is_admin: true` with cookie
- [ ] Protected endpoints return 200 with cookie
- [ ] Protected endpoints return 401/403 without cookie
- [ ] Frontend admin badge visible
- [ ] Autotune/Reset buttons visible
- [ ] E2E tests passing

---

## Next Steps

1. **Deploy to Staging**: Test with real environment
2. **Run Full E2E Suite**: `pnpm exec playwright test tests/e2e/admin.auth.spec.ts`
3. **Smoke Test Production**: Follow Step 6 with production URL
4. **Monitor Logs**: Watch for failed auth attempts
5. **Set Up Alerts**: Monitor 401/403 rates

---

## Related Documentation

- **Complete Implementation**: `docs/BACKEND_ADMIN_AUTH.md` (900+ lines)
- **Deployment Verification**: `docs/DEPLOYMENT_VERIFICATION.md` (900+ lines)
- **Frontend Admin Guide**: `docs/ADMIN_CONTROLS.md` (500+ lines)
- **Testing Status**: `E2E_TESTING_STATUS.md`

---

**Estimated Time**: 15 minutes
**Difficulty**: Low
**Admin Email**: leoklemet.pa@gmail.com
        if data.get("exp", 0) < int(time.time()) - 300: return None  # 5min buffer
        return data
    except: return None

router = APIRouter(prefix="/api/auth")

@router.get("/me")
def get_current_user(request: Request):
    token = request.cookies.get(COOKIE_NAME)
    data = _verify(token) if token else None
    if data and data.get("role") == "admin":
        return JSONResponse({"user": {"email": data.get("email")}, "roles": ["admin"], "is_admin": True})
    return JSONResponse({"user": None, "roles": [], "is_admin": False})

@router.post("/admin/login")
def admin_login(response: Response, email: str):
    if email.lower() not in [e.strip().lower() for e in ADMIN_EMAILS]:
        raise HTTPException(403, f"Email {email} not in admin allowlist")
    payload = {"email": email.lower(), "role": "admin", "exp": int(time.time()) + COOKIE_MAX_AGE}
    token = _sign(payload)
    response = JSONResponse({"ok": True, "email": email.lower()})
    response.set_cookie(COOKIE_NAME, token, max_age=COOKIE_MAX_AGE, path="/",
                       httponly=True, secure=True, samesite="none", domain=COOKIE_DOMAIN)
    return response

@router.post("/admin/logout")
def admin_logout(response: Response):
    response = JSONResponse({"ok": True})
    response.delete_cookie(COOKIE_NAME, path="/", domain=COOKIE_DOMAIN)
    return response

def require_admin(request: Request) -> Dict[str, Any]:
    token = request.cookies.get(COOKIE_NAME)
    if not token: raise HTTPException(401, "Authentication required")
    data = _verify(token)
    if not data or data.get("role") != "admin": raise HTTPException(403, "Admin privileges required")
    return data
```

---

## Step 2: Mount Router (2 min)

**File**: `assistant_api/main.py`

```python
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from .auth_admin import router as auth_router, require_admin

app = FastAPI(title="Portfolio Assistant API")

# CORS - CRITICAL: allow_credentials=True for cookies!
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://assistant.ledger-mind.org",
        "https://ledger-mind.org",
        "http://127.0.0.1:5174",  # dev
    ],
    allow_credentials=True,  # Required for cookies
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount auth router
app.include_router(auth_router)

# Protected endpoints
@app.post("/api/layout/reset")
def layout_reset(_: dict = Depends(require_admin)):
    # TODO: Implement reset logic
    return {"ok": True, "message": "Layout reset to default"}

@app.post("/api/layout/autotune")
def layout_autotune(_: dict = Depends(require_admin)):
    # TODO: Implement autotune logic
    return {"ok": True, "message": "Layout autotuned"}
```

---

## Step 3: Environment Variables (3 min)

**Generate secret**:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
# Example output: xK9mP2vR8sT3uW5yZ7bN4cQ6dF1gH0jL
```

**Set environment variables**:

```bash
# .env file
ADMIN_HMAC_SECRET=xK9mP2vR8sT3uW5yZ7bN4cQ6dF1gH0jL
ADMIN_EMAILS=you@yourdomain.com,admin@yourdomain.com
COOKIE_DOMAIN=.ledger-mind.org
```

**Docker Compose**:
```yaml
services:
  backend:
    environment:
      ADMIN_HMAC_SECRET: ${ADMIN_HMAC_SECRET}
      ADMIN_EMAILS: ${ADMIN_EMAILS}
      COOKIE_DOMAIN: .ledger-mind.org
```

**Kubernetes**:
```bash
kubectl create secret generic admin-auth \
  --from-literal=ADMIN_HMAC_SECRET=xK9mP2vR8sT3uW5yZ7bN4cQ6dF1gH0jL \
  --from-literal=ADMIN_EMAILS=you@yourdomain.com \
  --from-literal=COOKIE_DOMAIN=.ledger-mind.org
```

---

## Step 4: Test Locally (5 min)

**Start backend**:
```bash
# Make sure env vars are set
export ADMIN_HMAC_SECRET=xK9mP2vR8sT3uW5yZ7bN4cQ6dF1gH0jL
export ADMIN_EMAILS=you@yourdomain.com
export COOKIE_DOMAIN=localhost

# Run backend
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001 --reload
```

**Test endpoints**:
```bash
# 1. Login
curl -i -X POST "http://127.0.0.1:8001/api/auth/admin/login?email=you@yourdomain.com"

# 2. Extract cookie from response
COOKIE="admin_auth=<paste-token-here>"

# 3. Check auth
curl -s -H "Cookie: $COOKIE" "http://127.0.0.1:8001/api/auth/me" | jq

# 4. Test protected endpoint
curl -i -H "Cookie: $COOKIE" -X POST "http://127.0.0.1:8001/api/layout/autotune"

# 5. Test without cookie (should fail)
curl -i -X POST "http://127.0.0.1:8001/api/layout/autotune"
```

**Expected results**:
- Login: `{"ok": true, "email": "you@yourdomain.com"}` + `Set-Cookie` header
- Auth check: `{"user": {...}, "roles": ["admin"], "is_admin": true}`
- With cookie: `200 OK {"ok": true, ...}`
- Without cookie: `401 Unauthorized`

---

## Step 5: Deploy & Verify (5 min)

**Deploy backend**:
```bash
# Build and push
docker build -t your-registry/portfolio-backend:latest .
docker push your-registry/portfolio-backend:latest

# Deploy (k8s example)
kubectl set image deployment/backend backend=your-registry/portfolio-backend:latest
kubectl rollout status deployment/backend
```

**Verify in production**:
```bash
# 1. Login (staging/prod)
curl -i -X POST "https://assistant.ledger-mind.org/api/auth/admin/login?email=you@yourdomain.com"

# 2. Extract cookie
COOKIE="admin_auth=<paste-token>"

# 3. Check auth
curl -s -H "Cookie: $COOKIE" "https://assistant.ledger-mind.org/api/auth/me" | jq

# 4. Test UI
# Open https://assistant.ledger-mind.org/ in browser
# Admin controls should appear automatically (no ?admin=1 needed)
```

---

## Common Pitfalls

### ❌ Cookie not sent to frontend

**Cause**: Wrong CORS config
**Fix**:
```python
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,  # CRITICAL!
    allow_origins=["https://your-domain.com"],  # No wildcards with credentials
)
```

---

### ❌ Cookie set but not visible

**Cause**: Domain mismatch
**Fix**:
```python
# If portfolio is on assistant.ledger-mind.org:
COOKIE_DOMAIN = ".ledger-mind.org"  # Note the leading dot

# If same origin:
COOKIE_DOMAIN = None  # Omit domain attribute
```

---

### ❌ 403 on all requests

**Cause**: Different secrets between pods
**Fix**: Ensure **all** backend replicas use same `ADMIN_HMAC_SECRET`

```bash
# Kubernetes - verify all pods have same secret
kubectl get pods -l app=backend -o json | \
  jq '.items[].spec.containers[].env[] | select(.name=="ADMIN_HMAC_SECRET")'
```

---

### ❌ Token expires immediately

**Cause**: Clock skew between servers
**Fix**: Add buffer in `_verify()`:
```python
if data.get("exp", 0) < int(time.time()) - 300:  # 5 min buffer
    return None
```

---

## Verification Checklist

- [ ] Backend has `auth_admin.py` module
- [ ] Router mounted in `main.py`
- [ ] CORS allows credentials (`allow_credentials=True`)
- [ ] `ADMIN_HMAC_SECRET` set (32+ bytes, URL-safe)
- [ ] `ADMIN_EMAILS` set to authorized emails
- [ ] `COOKIE_DOMAIN` matches your domain (`.ledger-mind.org`)
- [ ] All backend replicas use same secret
- [ ] Local test: Login works, auth check works
- [ ] Local test: Protected endpoints work with cookie
- [ ] Local test: Protected endpoints fail without cookie
- [ ] Production test: Login works
- [ ] Production test: Cookie visible in DevTools
- [ ] Production test: Admin UI appears in browser
- [ ] Production test: `/api/layout/autotune` works
- [ ] Production test: `/api/layout/reset` works

---

## Next Steps

1. **Test thoroughly**: Use `docs/DEPLOYMENT_VERIFICATION.md`
2. **Monitor**: Add logging for failed auth attempts
3. **Audit**: Log all admin actions
4. **Rotate**: Plan secret rotation schedule
5. **Rate limit**: Add rate limiting to login endpoint

---

## Related Documentation

- **Full implementation**: `docs/BACKEND_ADMIN_AUTH.md`
- **Verification**: `docs/DEPLOYMENT_VERIFICATION.md`
- **Frontend**: `docs/ADMIN_CONTROLS.md`

---

**Last Updated**: October 13, 2025
**Estimated Time**: 15 minutes for basic implementation
