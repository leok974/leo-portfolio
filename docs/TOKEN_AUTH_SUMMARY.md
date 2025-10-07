# Token Authentication Implementation Summary

## Overview
Enhanced the RAG projects admin authentication system from dev-only (`ALLOW_TOOLS=1`) to production-ready token-based authentication using the `X-Admin-Token` HTTP header.

## Implementation Date
January 2025 (Phase 6 of RAG integration)

## Changes Made

### 1. New Authentication Module
**File:** `assistant_api/utils/auth.py`

Created centralized authentication helper with two-path authentication:

```python
def get_current_user(request: Request):
    """
    Returns user dict if authenticated, None otherwise.

    Path 1: Dev override with ALLOW_TOOLS=1
    Path 2: Production token via X-Admin-Token header
    """
    # Dev mode
    if os.environ.get("ALLOW_TOOLS", "0") == "1":
        return {"role": "admin", "email": "local@dev"}

    # Production token
    admin_token = os.environ.get("ADMIN_TOKEN", "")
    if not admin_token:
        return None

    token = request.headers.get("X-Admin-Token") or ""
    if token and token == admin_token:
        return {"role": "admin", "email": "token@admin"}
    return None

def _require_admin(user=Depends(get_current_user)):
    """FastAPI dependency that enforces admin authentication."""
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin required")
    return user
```

### 2. Updated Router
**File:** `assistant_api/routers/rag_projects.py`

- **Removed:** Old `require_admin()` function with simple env check
- **Added:** Import from `assistant_api.utils.auth`
- **Updated:** All 3 routes to use parameter injection: `user=Depends(_require_admin)`
- **Enhanced:** All responses now include `"by": user.get("email")` for audit tracking

**Protected Endpoints:**
- `POST /api/rag/ingest/projects`
- `POST /api/rag/projects/update`
- `POST /api/rag/projects/update_nl`

### 3. Backend Tests
**File:** `tests/test_rag_projects_auth.py`

Added `test_admin_token_header_allows_access()`:
- Sets `ADMIN_TOKEN=secret-xyz` and `ALLOW_TOOLS=0`
- Tests all 3 endpoints with `X-Admin-Token: secret-xyz` header
- Verifies 200 responses and `"by": "token@admin"` in response

**Test Count:** 5 tests (4 existing + 1 new)

### 4. E2E Tests
**File:** `tests/e2e/api-rag-admin-gate.spec.ts`

Added token authentication test:
- Conditional skip if `ADMIN_TOKEN` not set in environment
- Tests all 3 endpoints with `X-Admin-Token` header
- Verifies responses include `"by": "token@admin"`

**Test Count:** 5 tests (4 existing + 1 new)

### 5. Documentation Updates

#### RAG_AUTH_TESTS.md
- Added "Authentication System" section with two-path flow
- Added usage examples for dev and production modes
- Updated test lists to include token test
- Added token test running instructions
- Updated expected outputs to show 5 passed tests

#### RAG_PROJECTS_INTEGRATION.md
- Replaced "Future Production Auth" with "Token Authentication Implemented!"
- Added complete authentication system documentation
- Added production usage examples with `X-Admin-Token` header
- Added security behavior matrix
- Updated security test verification list

## Authentication Modes

### Development Mode
```powershell
# Set environment variable
$env:ALLOW_TOOLS = "1"

# Start backend
python -m uvicorn assistant_api.main:app --port 8023

# Make request (no header needed)
curl -X POST http://localhost:8023/api/rag/ingest/projects

# Response includes: "by": "local@dev"
```

### Production Mode
```powershell
# Set admin token
$env:ADMIN_TOKEN = "your-secret-token-here"

# Start backend (ALLOW_TOOLS not set)
python -m uvicorn assistant_api.main:app --port 8023

# Make request with token
curl -X POST http://localhost:8023/api/rag/ingest/projects `
  -H "X-Admin-Token: your-secret-token-here"

# Response includes: "by": "token@admin"
```

### Default (Denied)
```powershell
# Neither ALLOW_TOOLS nor ADMIN_TOKEN set
python -m uvicorn assistant_api.main:app --port 8023

# Any request returns:
# 403 {"detail": "Admin required"}
```

## Security Characteristics

### Secure by Default
- Default behavior is to deny (403)
- No implicit admin access
- Explicit configuration required for any access

### Two Independent Paths
- Dev override (`ALLOW_TOOLS=1`) - for local development only
- Production token (`X-Admin-Token` + `ADMIN_TOKEN` env) - for production

### Audit Trail
- All successful requests include `"by": "user@email"` in response
- Dev mode: `"by": "local@dev"`
- Production: `"by": "token@admin"`

### Token Requirements
- Production token must be set in `ADMIN_TOKEN` environment variable
- Client must send exact token in `X-Admin-Token` header
- Any mismatch or missing token → 403

## Testing

### Run Backend Tests
```powershell
# Basic auth tests (4 tests)
pytest tests/test_rag_projects_auth.py -v

# With token test (5 tests)
$env:ADMIN_TOKEN = "secret-xyz"
pytest tests/test_rag_projects_auth.py -v
```

### Run E2E Tests
```powershell
# Start backend
$env:ADMIN_TOKEN = "secret-xyz"
python -m uvicorn assistant_api.main:app --port 8023

# Run tests
$env:ADMIN_TOKEN = "secret-xyz"
npx playwright test tests/e2e/api-rag-admin-gate.spec.ts
```

### Expected Results
- **Backend:** 5 passed (including token test)
- **E2E:** 4 passed, 1 skipped (dev override test)
  - If `ALLOW_TOOLS=1` set: all 5 pass
  - If `ADMIN_TOKEN` set: token test passes

## Files Modified

### Created
1. `assistant_api/utils/auth.py` - New auth module (50 lines)
2. `docs/TOKEN_AUTH_SUMMARY.md` - This file

### Modified
1. `assistant_api/routers/rag_projects.py` - Updated to use new auth (7 changes)
2. `tests/test_rag_projects_auth.py` - Added token test (+35 lines)
3. `tests/e2e/api-rag-admin-gate.spec.ts` - Added token test (+30 lines)
4. `docs/RAG_AUTH_TESTS.md` - Enhanced with token auth docs (~80 lines updated)
5. `docs/RAG_PROJECTS_INTEGRATION.md` - Updated security section (~50 lines updated)

## Migration Path

### For Development
No changes needed - `ALLOW_TOOLS=1` still works.

### For Production
1. Generate secure random token:
   ```powershell
   [System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
   ```
2. Set `ADMIN_TOKEN` environment variable
3. Update client code to include `X-Admin-Token` header
4. Remove or set `ALLOW_TOOLS=0`

## Future Enhancements

### Potential Improvements
1. **Multiple Tokens:** Support multiple admin tokens with different permissions
2. **Token Rotation:** Implement token expiration and rotation
3. **Rate Limiting:** Add rate limits per token
4. **Logging:** Enhanced audit logging with timestamps and IPs
5. **Token Hashing:** Hash tokens in environment for additional security

### Alternative Auth Methods
- OAuth2/OIDC integration
- JWT tokens with claims
- Session-based authentication
- API key management system

## Related Documentation
- `docs/RAG_AUTH_TESTS.md` - Complete testing guide
- `docs/RAG_PROJECTS_INTEGRATION.md` - RAG system overview
- `docs/RAG_AUTH_IMPLEMENTATION_SUMMARY.md` - Phase 5 basic auth
- `assistant_api/routers/rag_projects.py` - Implementation
- `assistant_api/utils/auth.py` - Auth module

## Status
✅ **COMPLETE** - Production-ready token authentication implemented and tested.

All endpoints secured, tests passing, documentation updated.
