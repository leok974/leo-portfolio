# RAG Projects Authentication Tests

## Overview
Security tests for the RAG projects admin endpoints to ensure proper authentication gates are enforced.

## Authentication System

### Two-Path Authentication
The system supports two authentication modes:

1. **Development Mode** (`ALLOW_TOOLS=1`)
   - Environment variable override for local development
   - Returns user: `{"role": "admin", "email": "local@dev"}`
   - Bypasses token checks entirely

2. **Production Mode** (`X-Admin-Token` header)
   - Token-based authentication using `X-Admin-Token` HTTP header
   - Compares header value against `ADMIN_TOKEN` environment variable
   - Returns user: `{"role": "admin", "email": "token@admin"}`
   - If no token or mismatch → 403 "Admin required"

### Usage Examples

#### Development Mode
```powershell
# Set environment variable
$env:ALLOW_TOOLS = "1"

# Run backend
python -m uvicorn assistant_api.main:app --port 8023

# Make request (no header needed)
curl -X POST http://localhost:8023/api/rag/ingest/projects
```

#### Production Mode
```powershell
# Set admin token
$env:ADMIN_TOKEN = "your-secret-token-here"

# Run backend
python -m uvicorn assistant_api.main:app --port 8023

# Make request with header
curl -X POST http://localhost:8023/api/rag/ingest/projects `
  -H "X-Admin-Token: your-secret-token-here"
```

### Authentication Flow
```python
# assistant_api/utils/auth.py
def get_current_user(request: Request):
    # Path 1: Dev override
    if os.environ.get("ALLOW_TOOLS", "0") == "1":
        return {"role": "admin", "email": "local@dev"}

    # Path 2: Production token
    admin_token = os.environ.get("ADMIN_TOKEN", "")
    if not admin_token:
        return None

    token = request.headers.get("X-Admin-Token") or ""
    if token and token == admin_token:
        return {"role": "admin", "email": "token@admin"}
    return None

def _require_admin(user=Depends(get_current_user)):
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin required")
    return user
```

## Test Files Created

### Backend Tests (Python/pytest)
**File:** `tests/test_rag_projects_auth.py`

Tests the FastAPI admin authentication dependency at the application layer.

**Tests:**
1. `test_ingest_requires_admin` - Verifies `/api/rag/ingest/projects` returns 403 without admin
2. `test_update_requires_admin` - Verifies `/api/rag/projects/update` returns 403 without admin
3. `test_update_nl_requires_admin` - Verifies `/api/rag/projects/update_nl` returns 403 without admin
4. `test_allow_tools_override_enables_admin` - Verifies `ALLOW_TOOLS=1` env var bypasses admin check
5. `test_admin_token_header_allows_access` - Verifies `X-Admin-Token` header with `ADMIN_TOKEN` env allows access

### E2E Tests (TypeScript/Playwright)
**File:** `tests/e2e/api-rag-admin-gate.spec.ts`

Tests the API endpoints directly via HTTP requests (no DOM/browser required).

**Tests:**
1. `POST /api/rag/ingest/projects → 403 without admin` - API-level gate check
2. `POST /api/rag/projects/update → 403 without admin` - Structured update gate check
3. `POST /api/rag/projects/update_nl → 403 without admin` - NL update gate check
4. `ALLOW_TOOLS=1 allows in dev` - Verifies dev override (skipped if env not set)
5. `X-Admin-Token header allows admin access` - Verifies token authentication (skipped if `ADMIN_TOKEN` not set)

## Security Implementation

### Authentication Guard
**File:** `assistant_api/routers/rag_projects.py`

```python
def require_admin():
    """
    Guard for admin-only routes.
    Raises 403 unless ALLOW_TOOLS=1 (dev override).
    In production, add cookie/token checks here.
    """
    allow_tools = os.environ.get("ALLOW_TOOLS", "0")
    if allow_tools != "1":
        raise HTTPException(status_code=403, detail="Admin required")
    return True
```

### Protected Endpoints
All mutation endpoints now use `dependencies=[Depends(require_admin)]`:
- `POST /api/rag/ingest/projects`
- `POST /api/rag/projects/update`
- `POST /api/rag/projects/update_nl`

## Running the Tests

### Backend Tests (pytest)

#### Prerequisites
```powershell
# Activate your Python virtual environment
.\.venv\Scripts\Activate.ps1

# Ensure pytest is installed
pip install pytest
```

#### Run Tests
```powershell
# Run just the auth tests
pytest tests/test_rag_projects_auth.py -v

# Run with more detail
pytest tests/test_rag_projects_auth.py -vv

# Run all RAG project tests
pytest tests/test_rag_projects*.py -v
```

#### Expected Output
```
tests/test_rag_projects_auth.py::test_ingest_requires_admin PASSED
tests/test_rag_projects_auth.py::test_update_requires_admin PASSED
tests/test_rag_projects_auth.py::test_update_nl_requires_admin PASSED
tests/test_rag_projects_auth.py::test_allow_tools_override_enables_admin PASSED
tests/test_rag_projects_auth.py::test_admin_token_header_allows_access PASSED

====== 5 passed in 0.45s ======
```

#### Test Token Authentication
```powershell
# Set admin token for token auth test
$env:ADMIN_TOKEN = "secret-xyz"

# Run tests (token test will now run)
pytest tests/test_rag_projects_auth.py -v

# Verify token test passed
# Should see: test_admin_token_header_allows_access PASSED
```

### E2E Tests (Playwright)

#### Prerequisites
```powershell
# Ensure Playwright is installed
npm install

# Install Playwright browsers if needed
npx playwright install
```

#### Start Backend Server
```powershell
# In a separate terminal, start the backend
$env:RAG_DB = 'D:/leo-portfolio/data/rag_8023.sqlite'
$env:ALLOW_TOOLS = '0'  # Test auth gates
python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8023
```

#### Run Tests
```powershell
# Set API base URL (default is 127.0.0.1:8023)
$env:API_BASE = 'http://127.0.0.1:8023'

# Run the auth gate tests
npx playwright test tests/e2e/api-rag-admin-gate.spec.ts

# Run with UI
npx playwright test tests/e2e/api-rag-admin-gate.spec.ts --headed

# Run with debug mode
npx playwright test tests/e2e/api-rag-admin-gate.spec.ts --debug
```

#### Test with ALLOW_TOOLS=1 (Dev Override)
```powershell
# Restart backend with ALLOW_TOOLS enabled
$env:ALLOW_TOOLS = '1'
python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8023

# Run tests with override enabled
$env:ALLOW_TOOLS = '1'
npx playwright test tests/e2e/api-rag-admin-gate.spec.ts
```

#### Test with X-Admin-Token (Production Auth)
```powershell
# Restart backend with admin token
$env:ADMIN_TOKEN = 'secret-xyz'
$env:ALLOW_TOOLS = '0'  # Disable dev override
python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8023

# Run tests with token
$env:ADMIN_TOKEN = 'secret-xyz'
npx playwright test tests/e2e/api-rag-admin-gate.spec.ts

# Should see token test pass
```

#### Expected Output
```
Running 5 tests using 1 worker

  ✓  RAG projects admin gates › POST /api/rag/ingest/projects → 403 without admin (142ms)
  ✓  RAG projects admin gates › POST /api/rag/projects/update → 403 without admin (89ms)
  ✓  RAG projects admin gates › POST /api/rag/projects/update_nl → 403 without admin (76ms)
  -  RAG projects admin gates › ALLOW_TOOLS=1 allows in dev (skip if not set) (skipped)
  ✓  RAG projects admin gates › X-Admin-Token header allows admin access (156ms)

  4 passed, 1 skipped (0.7s)
```

## Test Scenarios

### Scenario 1: Default Production Security
**Environment:** `ALLOW_TOOLS` not set or `ALLOW_TOOLS=0`

**Expected:**
- ✅ All mutation endpoints return `403 Forbidden`
- ✅ Error message: `"detail": "Admin required"`
- ✅ Read-only endpoints (like `/api/rag/query`) remain accessible

### Scenario 2: Development Override
**Environment:** `ALLOW_TOOLS=1`

**Expected:**
- ✅ All mutation endpoints return `200 OK`
- ✅ Ingest, update, and NL update operations succeed
- ✅ Useful for local development and testing

### Scenario 3: Future Production Auth
**Environment:** Cookie/token-based authentication implemented

**Required Changes:**
```python
def require_admin(request: Request):
    allow_tools = os.environ.get("ALLOW_TOOLS", "0")
    if allow_tools == "1":
        return True

    # Check for admin cookie/token
    admin_cookie = request.cookies.get("admin")
    if not admin_cookie or not verify_admin_token(admin_cookie):
        raise HTTPException(status_code=403, detail="Admin required")

    return True
```

## Integration with CI/CD

### GitHub Actions Example
```yaml
name: RAG Auth Tests

on: [push, pull_request]

jobs:
  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest
      - name: Run auth tests
        run: pytest tests/test_rag_projects_auth.py -v

  test-e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright
        run: npx playwright install --with-deps
      - name: Start backend
        run: |
          python -m uvicorn assistant_api.main:app --port 8023 &
          sleep 5
        env:
          ALLOW_TOOLS: '0'
      - name: Run E2E auth tests
        run: npx playwright test tests/e2e/api-rag-admin-gate.spec.ts
        env:
          API_BASE: 'http://127.0.0.1:8023'
```

## Security Checklist

### ✅ Completed
- [x] Admin gate implemented for all mutation endpoints
- [x] `ALLOW_TOOLS` dev override for local development
- [x] Backend pytest tests covering all scenarios
- [x] E2E Playwright tests for API-level verification
- [x] Proper 403 error messages
- [x] Tests pass with default (secure) settings

### 🔒 Production Hardening (Future)
- [ ] Implement cookie/token-based authentication
- [ ] Add IP allowlist option
- [ ] Implement rate limiting for auth attempts
- [ ] Add audit logging for admin actions
- [ ] Add admin session management
- [ ] Implement CSRF protection for admin routes
- [ ] Add multi-factor authentication option

## Troubleshooting

### Backend Tests Fail with Import Errors
```powershell
# Ensure PYTHONPATH includes project root
$env:PYTHONPATH = "D:\leo-portfolio"
pytest tests/test_rag_projects_auth.py -v
```

### E2E Tests Can't Connect to Backend
```powershell
# Verify backend is running
curl http://127.0.0.1:8023/ready

# Check firewall/port
netstat -an | Select-String "8023"
```

### Tests Pass But Endpoints Still Accessible
- Verify `ALLOW_TOOLS` is not set in production environment
- Check environment variables: `$env:ALLOW_TOOLS`
- Restart backend after changing env vars

## References

- Main router implementation: `assistant_api/routers/rag_projects.py`
- Authentication guard: `require_admin()` function
- Backend tests: `tests/test_rag_projects_auth.py`
- E2E tests: `tests/e2e/api-rag-admin-gate.spec.ts`
- RAG projects documentation: `docs/RAG_PROJECTS_INTEGRATION.md`
