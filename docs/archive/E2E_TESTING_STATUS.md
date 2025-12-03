# E2E Testing & Verification - Current Status

**Date**: October 13, 2025
**Status**: ⚠️ Tests Ready, Backend Implementation Pending

---

## Current Situation

### ✅ What's Complete

1. **E2E Test Suite** (`tests/e2e/admin.auth.spec.ts`)
   - 6 comprehensive test cases
   - Tests login, auth, protected endpoints, UI visibility
   - Ready to run once backend is implemented

2. **PowerShell Verification Script** (`scripts/Test-PortfolioAdmin.ps1`)
   - Complete verification tool
   - Tests all admin auth flows
   - Ready to run once backend is implemented

3. **Documentation** (3 comprehensive guides)
   - `docs/BACKEND_ADMIN_AUTH.md` (900+ lines) - Complete implementation guide
   - `docs/BACKEND_QUICKSTART.md` (350+ lines) - 15-minute quickstart
   - `docs/DEPLOYMENT_VERIFICATION.md` (900+ lines) - Verification playbook

4. **Frontend Implementation**
   - Admin gating logic (`apps/portfolio-ui/src/admin.ts`)
   - UI integration with admin controls
   - Dev override functionality
   - 10s caching for performance

### ⏳ What's Pending

1. **Backend Implementation** (15 minutes)
   - Create `assistant_api/auth_admin.py` (not yet created)
   - Mount auth router in `assistant_api/main.py`
   - Add environment variables
   - Implement protected endpoints

2. **Required Backend Endpoints** (Missing)
   - `POST /api/auth/admin/login` - Generate HMAC cookie
   - `GET /api/auth/me` - Check auth status
   - `POST /api/auth/admin/logout` - Delete cookie
   - `POST /api/layout/reset` - Protected endpoint
   - `POST /api/layout/autotune` - Protected endpoint

---

## Why Tests Can't Run Yet

The E2E tests expect these backend endpoints:

```typescript
// Test expects this to work:
const loginResp = await page.request.post(
  `${SITE}/api/auth/admin/login?email=${EMAIL}`
);
// Expected: 200 OK with Set-Cookie: admin_auth=<token>

// Currently returns: 404 Not Found (endpoint doesn't exist)
```

**Error Example**:
```
✗ Admin HMAC Authentication > full workflow
  Expected loginResp.ok() to be true
  Received: false (HTTP 404)

  POST http://127.0.0.1:8001/api/auth/admin/login
  → 404 Not Found (endpoint not implemented)
```

---

## Implementation Options

### Option 1: Quick Backend Implementation (15 min)

Follow `docs/BACKEND_QUICKSTART.md`:

**Step 1: Create auth module** (5 min)
```bash
# Create the file
New-Item -Path "assistant_api/auth_admin.py" -ItemType File

# Copy code from docs/BACKEND_ADMIN_AUTH.md (lines 60-260)
# Or use minimal version from docs/BACKEND_QUICKSTART.md
```

**Step 2: Mount router** (2 min)
```python
# assistant_api/main.py
from .auth_admin import router as auth_router, require_admin

app.include_router(auth_router)

# Add protected endpoints
@app.post("/api/layout/reset")
def layout_reset(_: dict = Depends(require_admin)):
    return {"ok": True, "message": "Layout reset to default"}

@app.post("/api/layout/autotune")
def layout_autotune(_: dict = Depends(require_admin)):
    return {"ok": True, "message": "Layout autotuned"}
```

**Step 3: Set environment variables** (3 min)
```powershell
# Generate secret
$secret = python -c "import secrets; print(secrets.token_urlsafe(32))"

# Add to .env or set in terminal
$env:ADMIN_HMAC_SECRET = $secret
$env:ADMIN_EMAILS = "leoklemet.pa@gmail.com"
$env:COOKIE_DOMAIN = ".ledger-mind.org"
```

**Step 4: Test locally** (5 min)
```powershell
# Start backend
D:leo-portfolio\.venv\Scripts\python.exe -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001

# In new terminal, run verification
.\scripts\Test-PortfolioAdmin.ps1 -Site "http://127.0.0.1:8001" -Email "leoklemet.pa@gmail.com"
```

---

### Option 2: Mock Backend for Testing (10 min)

Create a minimal mock server just to validate the test suite works:

```python
# assistant_api/auth_admin_mock.py (temporary)
from fastapi import APIRouter, Response
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/auth")

@router.post("/admin/login")
def mock_login(response: Response, email: str):
    # Mock HMAC token (just for testing)
    token = "mock_token_12345"
    response = JSONResponse({"ok": True, "email": email})
    response.set_cookie(
        "admin_auth", token,
        max_age=604800, path="/",
        httponly=True, secure=False, samesite="lax"
    )
    return response

@router.get("/me")
def mock_me(request: Request):
    cookie = request.cookies.get("admin_auth")
    if cookie == "mock_token_12345":
        return {"user": {"email": "test@example.com"}, "roles": ["admin"], "is_admin": True}
    return {"user": None, "roles": [], "is_admin": False}

@router.post("/admin/logout")
def mock_logout(response: Response):
    response = JSONResponse({"ok": True})
    response.set_cookie("admin_auth", "", max_age=0, path="/")
    return response

# Mount in main.py
from .auth_admin_mock import router as auth_router
app.include_router(auth_router)

@app.post("/api/layout/reset")
def mock_reset():
    return {"ok": True, "message": "Layout reset (mock)"}

@app.post("/api/layout/autotune")
def mock_autotune():
    return {"ok": True, "message": "Layout autotuned (mock)"}
```

---

### Option 3: Test Frontend Only (5 min)

Test the frontend admin panel E2E tests (don't require backend changes):

```powershell
# These tests work now (no backend auth needed)
pnpm exec playwright test tests/e2e/admin.panel.spec.ts --project=chromium
```

These tests verify:
- ✅ Admin controls hidden by default
- ✅ Dev override `?admin=1` works
- ✅ Admin badge styling
- ✅ Button visibility gating

---

## Recommended Action Plan

### Immediate (Now)

Run the **frontend-only tests** to verify the UI gating works:

```powershell
# Test admin panel visibility (no backend needed)
pnpm exec playwright test tests/e2e/admin.panel.spec.ts --project=chromium --headed
```

**Expected Result**: All tests should pass ✅

---

### Short Term (Next 15 min)

Implement the backend following `docs/BACKEND_QUICKSTART.md`:

1. Create `assistant_api/auth_admin.py` (copy from docs)
2. Mount router in `main.py`
3. Set environment variables
4. Test locally with PowerShell script

**Expected Result**: Full E2E suite passes ✅

---

### Medium Term (After backend works)

Run full verification suite:

```powershell
# 1. PowerShell verifier
.\scripts\Test-PortfolioAdmin.ps1 -Site "http://127.0.0.1:8001" -Email "leoklemet.pa@gmail.com"

# 2. E2E tests (backend + frontend)
$env:PW_APP = "portfolio"
$env:ADMIN_TEST_EMAIL = "leoklemet.pa@gmail.com"
pnpm exec playwright test tests/e2e/admin.auth.spec.ts --project=chromium
```

**Expected Result**: All tests pass, verification complete ✅

---

## Test Files Overview

### Frontend Tests (Work Now)
- `tests/e2e/admin.panel.spec.ts` - ✅ Ready to run
  * Hidden by default
  * Dev override works
  * Admin badge styling
  * Button visibility

### Backend Integration Tests (Need Backend)
- `tests/e2e/admin.auth.spec.ts` - ⏳ Need backend implementation
  * Login flow
  * Cookie validation
  * Protected endpoints
  * UI + API integration

### Verification Tools (Need Backend)
- `scripts/Test-PortfolioAdmin.ps1` - ⏳ Need backend implementation
  * One-shot admin auth test
  * All endpoints verification
  * Clear pass/fail output

---

## Next Command to Run

```powershell
# Test what works now (frontend only)
pnpm exec playwright test tests/e2e/admin.panel.spec.ts --project=chromium --headed
```

This will show you the test infrastructure is working, just waiting for the backend implementation.

---

## Files Ready for Implementation

All these files exist and are ready:
- ✅ `tests/e2e/admin.auth.spec.ts` (220 lines)
- ✅ `scripts/Test-PortfolioAdmin.ps1` (180 lines)
- ✅ `docs/BACKEND_ADMIN_AUTH.md` (900+ lines)
- ✅ `docs/BACKEND_QUICKSTART.md` (350+ lines)
- ✅ `docs/DEPLOYMENT_VERIFICATION.md` (900+ lines)

Missing:
- ⏳ `assistant_api/auth_admin.py` (needs to be created)
- ⏳ Environment variables (ADMIN_HMAC_SECRET, ADMIN_EMAILS)
- ⏳ Protected endpoints in main.py

**Total implementation time**: 15 minutes following the quickstart guide.
