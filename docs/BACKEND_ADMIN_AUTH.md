# Backend Admin Authentication Implementation

**Generated**: October 13, 2025
**Purpose**: HMAC-signed admin authentication for portfolio backend.

---

## Overview

Implements secure admin authentication using HMAC-signed cookies:
- **No database required**: Self-contained JWT-like tokens
- **Stateless**: Cookie contains signed payload with expiry
- **Secure**: HMAC-SHA256 signature prevents tampering
- **7-day expiry**: Auto-logout after 1 week
- **Email allowlist**: Only authorized emails can get admin tokens

---

## Architecture

### HMAC Token Structure

```
<base64url(payload)>.<base64url(hmac_signature)>
```

**Payload**:
```json
{
  "email": "you@yourdomain.com",
  "role": "admin",
  "exp": 1728825600
}
```

**Signature**: HMAC-SHA256 of payload using `ADMIN_HMAC_SECRET`

### Cookie Attributes

- **Name**: `admin_auth`
- **HttpOnly**: Yes (prevents JavaScript access)
- **Secure**: Yes (HTTPS only)
- **SameSite**: `None` (cross-subdomain support)
- **Domain**: `.ledger-mind.org` (works on all subdomains)
- **Max-Age**: 604800 (7 days)
- **Path**: `/` (all routes)

---

## Implementation

### 1. Create Auth Module

**File**: `assistant_api/auth_admin.py`

```python
"""
HMAC-signed admin authentication for portfolio assistant.
No database required - self-contained stateless tokens.
"""
import hmac
import hashlib
import base64
import json
import time
import os
from typing import Dict, Any, Optional
from fastapi import APIRouter, Response, Request, HTTPException
from fastapi.responses import JSONResponse

# Configuration
ADMIN_SECRET = os.environ.get("ADMIN_HMAC_SECRET", "change-me-in-production")
COOKIE_NAME = "admin_auth"
COOKIE_MAX_AGE = 60 * 60 * 24 * 7  # 7 days
ADMIN_EMAILS = os.environ.get("ADMIN_EMAILS", "you@yourdomain.com").split(",")
COOKIE_DOMAIN = os.environ.get("COOKIE_DOMAIN", ".ledger-mind.org")

# Token helpers
def _b64url(b: bytes) -> str:
    """Base64url encode (no padding)"""
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()

def _b64url_decode(s: str) -> bytes:
    """Base64url decode (add padding if needed)"""
    padding = "=" * (4 - len(s) % 4)
    return base64.urlsafe_b64decode(s + padding)

def _sign(obj: Dict[str, Any]) -> str:
    """
    Sign a payload with HMAC-SHA256.
    Returns: base64url(payload).base64url(signature)
    """
    body = _b64url(json.dumps(obj, separators=(",", ":")).encode())
    sig = hmac.new(ADMIN_SECRET.encode(), body.encode(), hashlib.sha256).digest()
    return f"{body}.{_b64url(sig)}"

def _verify(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify HMAC signature and expiry.
    Returns payload if valid, None otherwise.
    """
    try:
        body, sig = token.split(".", 1)

        # Verify signature
        want = hmac.new(ADMIN_SECRET.encode(), body.encode(), hashlib.sha256).digest()
        got = _b64url_decode(sig)
        if not hmac.compare_digest(want, got):
            return None

        # Decode payload
        data = json.loads(_b64url_decode(body))

        # Check expiry (with 5-minute buffer for clock skew)
        if data.get("exp", 0) < int(time.time()) - 300:
            return None

        return data
    except Exception:
        return None

# Router
router = APIRouter(prefix="/api/auth")

@router.get("/me")
def get_current_user(request: Request):
    """
    Get current user authentication status.
    Frontend calls this to check admin status.

    Returns:
        {
            "user": {"email": "..."},
            "roles": ["admin"],
            "is_admin": true
        }
    """
    token = request.cookies.get(COOKIE_NAME)
    data = _verify(token) if token else None

    if data and data.get("role") == "admin":
        user = {"email": data.get("email")}
        roles = ["admin"]
        is_admin = True
    else:
        user = None
        roles = []
        is_admin = False

    return JSONResponse({
        "user": user,
        "roles": roles,
        "is_admin": is_admin
    })

@router.post("/admin/login")
def admin_login(response: Response, email: str):
    """
    Admin login endpoint (allowlist-based).
    Sets HMAC-signed cookie with 7-day expiry.

    Args:
        email: Email address to authenticate

    Returns:
        {"ok": true} with Set-Cookie header

    Raises:
        403: Email not in allowlist
    """
    # Check allowlist
    email_lower = email.lower().strip()
    if email_lower not in [e.strip().lower() for e in ADMIN_EMAILS]:
        raise HTTPException(
            status_code=403,
            detail=f"Email {email} not in admin allowlist"
        )

    # Create signed payload
    payload = {
        "email": email_lower,
        "role": "admin",
        "exp": int(time.time()) + COOKIE_MAX_AGE
    }
    token = _sign(payload)

    # Set cookie
    response = JSONResponse({"ok": True, "email": email_lower})
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=COOKIE_MAX_AGE,
        path="/",
        httponly=True,
        secure=True,
        samesite="none",
        domain=COOKIE_DOMAIN
    )

    return response

@router.post("/admin/logout")
def admin_logout(response: Response):
    """
    Admin logout endpoint.
    Deletes admin_auth cookie.

    Returns:
        {"ok": true} with cookie deletion
    """
    response = JSONResponse({"ok": True})
    response.delete_cookie(
        COOKIE_NAME,
        path="/",
        domain=COOKIE_DOMAIN
    )
    return response

# Dependency for protected endpoints
def require_admin(request: Request) -> Dict[str, Any]:
    """
    FastAPI dependency that enforces admin auth.
    Use with: @app.post("/api/admin/action", dependencies=[Depends(require_admin)])

    Returns:
        User data dict if admin

    Raises:
        401: No auth cookie
        403: Invalid or expired token
    """
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )

    data = _verify(token)
    if not data or data.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin privileges required"
        )

    return data
```

---

### 2. Mount Router in Main App

**File**: `assistant_api/main.py`

```python
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from .auth_admin import router as auth_router, require_admin

app = FastAPI(title="Portfolio Assistant API")

# CORS (adjust origins for your domains)
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

# Example: Protected admin endpoint
@app.post("/api/layout/reset")
def layout_reset(_: dict = Depends(require_admin)):
    """
    Reset layout to default state.
    Requires admin auth.
    """
    # TODO: Implement layout reset logic
    return {"ok": True, "message": "Layout reset to default"}

@app.post("/api/layout/autotune")
def layout_autotune(_: dict = Depends(require_admin)):
    """
    Auto-optimize layout based on usage patterns.
    Requires admin auth.
    """
    # TODO: Implement autotune logic
    return {"ok": True, "message": "Layout autotuned"}
```

---

### 3. Environment Variables

**File**: `.env` or docker-compose.yml

```env
# Admin Authentication
ADMIN_HMAC_SECRET=<generate-32-byte-random-string>
ADMIN_EMAILS=you@yourdomain.com,admin@yourdomain.com
COOKIE_DOMAIN=.ledger-mind.org

# Generate secret with:
# python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Docker Compose**:
```yaml
services:
  backend:
    image: your-backend:latest
    environment:
      ADMIN_HMAC_SECRET: ${ADMIN_HMAC_SECRET}
      ADMIN_EMAILS: ${ADMIN_EMAILS}
      COOKIE_DOMAIN: .ledger-mind.org
```

**⚠️ Critical**: Use the **same** `ADMIN_HMAC_SECRET` across all backend replicas!

---

## Security Considerations

### 1. Secret Generation

```bash
# Generate secure secret (32 bytes)
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Example output:
# xK9mP2vR8sT3uW5yZ7bN4cQ6dF1gH0jL8mN3pQ5rS9tU2vX4wY6zA1bC3dE5fG7h
```

### 2. Cookie Attributes (Cross-Subdomain)

If portfolio and API are on different subdomains:

```python
response.set_cookie(
    "admin_auth",
    token,
    domain=".ledger-mind.org",  # Works on all subdomains
    samesite="none",             # Required for cross-site
    secure=True,                 # HTTPS only
    httponly=True                # JavaScript can't access
)
```

### 3. Cookie Attributes (Same-Origin)

If portfolio and API are on the same domain:

```python
response.set_cookie(
    "admin_auth",
    token,
    # domain omitted (defaults to current domain)
    samesite="lax",   # Stricter (no cross-site)
    secure=True,
    httponly=True
)
```

### 4. Email Allowlist

**Production**: Only allow specific admin emails
```env
ADMIN_EMAILS=you@yourdomain.com,admin2@yourdomain.com
```

**Development**: Allow any email for testing
```env
ADMIN_EMAILS=*
```

Then update code:
```python
# In admin_login()
if ADMIN_EMAILS[0] != "*" and email_lower not in [e.strip().lower() for e in ADMIN_EMAILS]:
    raise HTTPException(status_code=403, detail="Not authorized")
```

### 5. Clock Skew Buffer

Token expiry check includes 5-minute buffer:
```python
if data.get("exp", 0) < int(time.time()) - 300:  # 5 min buffer
    return None
```

Prevents false failures if server clocks differ slightly.

---

## Testing

### 1. Admin Login (Set Cookie)

```bash
# Staging
curl -i -X POST "https://assistant.ledger-mind.org/api/auth/admin/login?email=you@yourdomain.com"

# Expected response:
# HTTP/1.1 200 OK
# Set-Cookie: admin_auth=<token>; Max-Age=604800; Path=/; Domain=.ledger-mind.org; HttpOnly; Secure; SameSite=None
#
# {"ok": true, "email": "you@yourdomain.com"}
```

### 2. Check Auth Status

```bash
# Extract cookie from previous response
COOKIE="admin_auth=<paste-token-here>"

# Check /api/auth/me
curl -s -H "Cookie: $COOKIE" "https://assistant.ledger-mind.org/api/auth/me" | jq

# Expected response:
# {
#   "user": {
#     "email": "you@yourdomain.com"
#   },
#   "roles": ["admin"],
#   "is_admin": true
# }
```

### 3. Test Protected Endpoints

```bash
# Without cookie → 401
curl -i -X POST "https://assistant.ledger-mind.org/api/layout/reset"
# Expected: HTTP/1.1 401 Unauthorized

# With cookie → 200
curl -i -H "Cookie: $COOKIE" -X POST "https://assistant.ledger-mind.org/api/layout/reset"
# Expected: HTTP/1.1 200 OK
# {"ok": true, "message": "Layout reset to default"}
```

### 4. Admin Logout

```bash
curl -i -H "Cookie: $COOKIE" -X POST "https://assistant.ledger-mind.org/api/auth/admin/logout"

# Expected:
# HTTP/1.1 200 OK
# Set-Cookie: admin_auth=; Max-Age=0; Path=/; Domain=.ledger-mind.org
# {"ok": true}
```

---

## Troubleshooting

### Issue: Cookie not sent to frontend

**Symptoms**:
- `/api/auth/me` returns `{user: null, roles: [], is_admin: false}`
- Browser doesn't send cookie in requests

**Causes**:
1. **Wrong domain**: Cookie domain doesn't match request domain
2. **Missing SameSite=None**: Required for cross-subdomain
3. **Not HTTPS**: `Secure` flag requires HTTPS
4. **CORS credentials**: Frontend must use `credentials: 'include'`

**Solutions**:

**Check cookie in DevTools**:
1. Open DevTools → Application → Cookies
2. Look for `admin_auth` cookie
3. Verify Domain, Secure, SameSite attributes

**Fix domain**:
```python
# If portfolio is on assistant.ledger-mind.org and API is on api.ledger-mind.org:
domain=".ledger-mind.org"  # Note the leading dot

# If same origin:
# domain omitted (defaults to current domain)
```

**Fix CORS**:
```python
# Backend CORS config
allow_credentials=True  # Required for cookies
```

**Fix frontend fetch**:
```typescript
// Frontend must include credentials
fetch('/api/auth/me', { credentials: 'include' })
```

---

### Issue: 403 on protected endpoints

**Symptoms**:
- Cookie is set
- `/api/auth/me` works
- `/api/layout/reset` returns 403

**Causes**:
1. **Different secrets**: ADMIN_HMAC_SECRET differs between pods
2. **Token expired**: Check `exp` field in payload
3. **Clock skew**: Server clocks out of sync

**Solutions**:

**Verify secret is shared**:
```bash
# Check all pods have same secret
kubectl get pods -l app=backend -o json | jq '.items[].spec.containers[].env[] | select(.name=="ADMIN_HMAC_SECRET")'

# All should show same value
```

**Check token expiry**:
```bash
# Decode token payload (first part before dot)
TOKEN="<paste-token-here>"
PAYLOAD=$(echo "$TOKEN" | cut -d'.' -f1)
echo "$PAYLOAD" | base64 -d | jq

# Check exp field:
# {
#   "email": "...",
#   "role": "admin",
#   "exp": 1728825600  # Unix timestamp
# }

# Compare with current time:
date +%s
```

**Fix clock skew**:
```python
# Increase buffer in _verify()
if data.get("exp", 0) < int(time.time()) - 600:  # 10 min buffer
    return None
```

---

### Issue: HMAC verification fails

**Symptoms**:
- Login works (cookie set)
- All subsequent requests fail auth

**Causes**:
1. **Secret mismatch**: Different secret between login and verify
2. **Secret not URL-safe**: Contains characters that break base64url

**Solutions**:

**Test locally**:
```python
# Test token generation and verification
from auth_admin import _sign, _verify
import time

payload = {"email": "test@example.com", "role": "admin", "exp": int(time.time()) + 3600}
token = _sign(payload)
print(f"Token: {token}")

verified = _verify(token)
print(f"Verified: {verified}")
# Should print the original payload
```

**Generate safe secret**:
```bash
# Use only URL-safe characters
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## Deployment Checklist

**Pre-Deploy**:
- [ ] Generated secure `ADMIN_HMAC_SECRET` (32+ bytes)
- [ ] Set `ADMIN_EMAILS` to authorized emails only
- [ ] Set `COOKIE_DOMAIN` correctly (`.ledger-mind.org` for subdomains)
- [ ] Verified CORS allows credentials (`allow_credentials=True`)
- [ ] All backend replicas use same secret

**Post-Deploy**:
- [ ] Admin login works (returns `Set-Cookie`)
- [ ] `/api/auth/me` returns admin status with cookie
- [ ] Protected endpoints return 401 without cookie
- [ ] Protected endpoints return 200 with admin cookie
- [ ] Cookie visible in browser DevTools
- [ ] Cookie has correct Domain, Secure, SameSite attributes
- [ ] Frontend admin UI appears for authenticated admins
- [ ] Frontend admin UI hidden for non-admins

---

## Production Best Practices

### 1. Rotate Secrets Regularly

```bash
# Generate new secret
NEW_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")

# Update all pods with new secret
kubectl set env deployment/backend ADMIN_HMAC_SECRET=$NEW_SECRET

# All existing tokens will be invalidated
# Users must re-login
```

### 2. Monitor Failed Auth Attempts

```python
import logging

logger = logging.getLogger(__name__)

def _verify(token: str) -> Optional[Dict[str, Any]]:
    try:
        # ... existing verification logic
        if not hmac.compare_digest(want, got):
            logger.warning(f"Invalid HMAC signature: {token[:20]}...")
            return None

        if data.get("exp", 0) < int(time.time()) - 300:
            logger.info(f"Expired token: {data.get('email')}")
            return None

        return data
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        return None
```

### 3. Rate Limit Login Endpoint

```python
from fastapi_limiter.depends import RateLimiter

@router.post("/admin/login", dependencies=[Depends(RateLimiter(times=5, seconds=60))])
def admin_login(...):
    # Max 5 login attempts per minute
    ...
```

### 4. Audit Log Admin Actions

```python
@app.post("/api/layout/reset")
def layout_reset(user: dict = Depends(require_admin)):
    logger.info(f"Admin action: layout_reset by {user['email']}")
    # ... perform reset
    return {"ok": True}
```

---

## Related Documentation

- **Frontend**: `docs/ADMIN_CONTROLS.md`
- **Deployment**: `docs/DEPLOYMENT_VERIFICATION.md`
- **Security**: `docs/SECURITY.md`

---

**Last Updated**: October 13, 2025
**Status**: Production-ready implementation guide
