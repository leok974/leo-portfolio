# Backend Implementation Quick Start

**Purpose**: Minimal steps to implement HMAC-signed admin authentication.  
**Time**: 15 minutes

---

## Step 1: Create Auth Module (5 min)

**File**: `assistant_api/auth_admin.py`

```bash
# Create the file
touch assistant_api/auth_admin.py
```

**Copy/paste this code**: See `docs/BACKEND_ADMIN_AUTH.md` (lines 60-200)

Or use this minimal version:

```python
import hmac, hashlib, base64, json, time, os
from fastapi import APIRouter, Response, Request, HTTPException
from fastapi.responses import JSONResponse
from typing import Dict, Any, Optional

ADMIN_SECRET = os.environ.get("ADMIN_HMAC_SECRET", "change-me")
COOKIE_NAME = "admin_auth"
COOKIE_MAX_AGE = 604800  # 7 days
ADMIN_EMAILS = os.environ.get("ADMIN_EMAILS", "you@yourdomain.com").split(",")
COOKIE_DOMAIN = os.environ.get("COOKIE_DOMAIN", ".ledger-mind.org")

def _b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()

def _b64url_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (4 - len(s) % 4))

def _sign(obj: Dict[str, Any]) -> str:
    body = _b64url(json.dumps(obj, separators=(",", ":")).encode())
    sig = hmac.new(ADMIN_SECRET.encode(), body.encode(), hashlib.sha256).digest()
    return f"{body}.{_b64url(sig)}"

def _verify(token: str) -> Optional[Dict[str, Any]]:
    try:
        body, sig = token.split(".", 1)
        want = hmac.new(ADMIN_SECRET.encode(), body.encode(), hashlib.sha256).digest()
        got = _b64url_decode(sig)
        if not hmac.compare_digest(want, got): return None
        data = json.loads(_b64url_decode(body))
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
