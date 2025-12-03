# Privileged Metrics Dashboard Security - Complete ✅

## Summary
Successfully implemented server-side access control for the behavior analytics dashboard. The dashboard is now protected by token authentication with optional localhost bypass for development convenience.

## Commit
- **37166f0**: feat(security): add privileged dashboard access control

## Implementation Overview

### 1. Settings Configuration ✅
Added 2 new environment variables (`assistant_api/settings.py`):
```python
"METRICS_DEV_TOKEN": os.getenv("METRICS_DEV_TOKEN"),  # Long random string for auth
"METRICS_ALLOW_LOCALHOST": os.getenv("METRICS_ALLOW_LOCALHOST", "1") in {"1", "true", ...},  # Default: true
```

### 2. Security Module ✅
Created `assistant_api/security/dev_access.py` with `ensure_dev_access()` function:

**Features**:
- **Localhost Bypass**: Automatically allows `127.0.0.1` when `METRICS_ALLOW_LOCALHOST=true`
- **IP Detection**: Checks `X-Forwarded-For` header for proxied requests
- **Multi-Source Auth**: Accepts token from 4 sources (checked in order):
  1. `Authorization: Bearer <token>` header
  2. `X-Dev-Token: <token>` header
  3. `?dev=<token>` query parameter
  4. `dev_token=<token>` cookie

**Error Handling**:
- Returns 403 with `"metrics_dev_token_not_set"` if no token configured
- Returns 403 with `"forbidden_dev_panel"` if token invalid/missing

### 3. Guarded Dashboard Endpoint ✅
Added `GET /agent/metrics/dashboard` to `assistant_api/routers/agent_metrics.py`:

**Behavior**:
- Calls `ensure_dev_access()` before serving content
- Looks for dashboard HTML in this order:
  1. `admin_assets/metrics.html` (preferred - private location)
  2. `public/metrics.html` (fallback for compatibility)
- Returns helpful error message if files missing
- Content-Type: `text/html; charset=utf-8`

**File Structure**:
```
leo-portfolio/
├── admin_assets/
│   └── metrics.html       # Private dashboard copy
├── public/
│   └── metrics.html       # Public copy (can be removed later)
└── assistant_api/
    ├── security/
    │   ├── __init__.py
    │   └── dev_access.py
    └── routers/
        └── agent_metrics.py  # +45 lines (new endpoint)
```

### 4. Frontend Integration ✅
Updated `src/components/BehaviorMetricsPanel.tsx`:

**Changes**:
- New `GuardedIframe` component with React hooks
- On mount, checks `localStorage["dev:token"]`
- If token exists, appends `?dev=<token>` to iframe src
- Falls back to `/agent/metrics/dashboard` (localhost bypass)

**User Flow**:
1. User enables privileged mode (existing dev unlock flow)
2. `BehaviorMetricsPanel` renders if `isPrivilegedUIEnabled()` returns true
3. `GuardedIframe` loads dashboard with token from localStorage
4. Backend validates token and serves HTML

### 5. Documentation ✅
Updated `docs/DEVELOPMENT.md` with comprehensive guide:

**Sections Added**:
- "Locking the Dashboard (server-enforced)"
- Configuration instructions (env vars)
- Authentication methods (4 sources)
- Frontend integration details
- Localhost bypass explanation

**Example Commands**:
```bash
# Generate secure token
export METRICS_DEV_TOKEN="dev-$(openssl rand -hex 24)"
export METRICS_ALLOW_LOCALHOST=true

# Set in localStorage for frontend
localStorage.setItem("dev:token", "your-token-here");
```

### 6. E2E Testing ✅
Created `tests/e2e/metrics-lock.spec.ts` with 5 test cases:

1. **Localhost Access** (default config):
   - ✅ Expects 200 + HTML from localhost
   - ✅ Or 403 if `METRICS_ALLOW_LOCALHOST=false`

2. **External Blocking**:
   - ✅ Simulates external IP via `X-Forwarded-For`
   - ✅ Expects 403 with appropriate error detail

3. **Query Token Auth**:
   - ✅ Tests `?dev=<token>` parameter
   - ✅ Expects 200 + HTML with valid token

4. **Bearer Header Auth**:
   - ✅ Tests `Authorization: Bearer <token>`
   - ✅ Expects 200 + HTML with valid token

5. **Invalid Token**:
   - ✅ Tests with wrong token
   - ✅ Expects 403 with `"forbidden_dev_panel"`

**Test Execution**:
```bash
npx playwright test tests/e2e/metrics-lock.spec.ts
```

## Manual Testing Results ✅

### Test 1: Localhost Access (Default Config)
```bash
curl "http://127.0.0.1:8001/agent/metrics/dashboard"
```
**Result**: ✅ Returns full HTML dashboard
**Output**: `<!doctype html><html lang="en"><head>...Metrics Dashboard...`

### Test 2: External IP Simulation
```bash
curl -H "X-Forwarded-For: 203.0.113.1" "http://127.0.0.1:8001/agent/metrics/dashboard"
```
**Result**: ✅ Blocked with 403
**Output**: `{"detail": "metrics_dev_token_not_set"}`

### Test 3: With Valid Token (Future)
```bash
export METRICS_DEV_TOKEN="dev-abc123..."
curl -H "X-Forwarded-For: 203.0.113.1" "http://127.0.0.1:8001/agent/metrics/dashboard?dev=dev-abc123..."
```
**Expected**: ✅ Returns HTML dashboard

## Architecture Diagram

```
┌─────────────────────┐
│   Frontend          │
│   Admin Panel       │
│   (privileged mode) │
└──────────┬──────────┘
           │
           │ GET /agent/metrics/dashboard?dev=<token>
           │ (from localStorage["dev:token"])
           ▼
┌─────────────────────┐
│   Backend           │
│   /agent/metrics/   │
│   dashboard         │
└──────────┬──────────┘
           │
           │ ensure_dev_access(request, settings)
           ▼
┌─────────────────────┐     ┌──────────────┐
│  Check localhost?   │────▶│ 127.0.0.1?   │
│  ALLOW_LOCALHOST    │     │ → Allow      │
└──────────┬──────────┘     └──────────────┘
           │ No
           │ Check token from:
           ├─ Authorization: Bearer
           ├─ X-Dev-Token header
           ├─ ?dev= query param
           └─ dev_token cookie
           │
           ▼
    ┌─────────────┐      ┌──────────┐
    │ Token valid?│─Yes─▶│ Serve    │
    │             │      │ HTML     │
    └──────┬──────┘      └──────────┘
           │ No
           ▼
    ┌─────────────┐
    │ Return 403  │
    │ forbidden   │
    └─────────────┘
```

## Security Features

### 1. IP Anonymization
- Supports both direct connections and proxied requests
- Checks `X-Forwarded-For` header for real client IP
- Uses `ipaddress.ip_address().is_loopback` for localhost detection

### 2. Token Storage
**Backend**: Environment variable (never logged or exposed)
**Frontend**: localStorage (secure origin only - HTTPS in prod)

### 3. Multiple Auth Methods
Provides flexibility for different deployment scenarios:
- **Bearer Token**: Standard OAuth2-style auth
- **Custom Header**: For API clients or scripts
- **Query Parameter**: Easy URL sharing (dev only)
- **Cookie**: Persistent browser sessions

### 4. Localhost Bypass (Configurable)
- **Dev Convenience**: Allows localhost access without token
- **Production**: Can be disabled with `METRICS_ALLOW_LOCALHOST=false`
- **Default**: Enabled (true) for developer productivity

## Deployment Checklist

### Development Setup
- [x] Code implemented and tested
- [x] Localhost bypass working (default config)
- [x] External blocking verified
- [x] E2E tests passing
- [x] Documentation complete

### Production Deployment
- [ ] Generate secure token:
  ```bash
  openssl rand -hex 32  # 64-char hex string
  ```
- [ ] Set environment variables:
  ```bash
  export METRICS_DEV_TOKEN="<generated-token>"
  export METRICS_ALLOW_LOCALHOST=false  # Strict mode
  ```
- [ ] Update frontend localStorage after deployment:
  ```javascript
  // In browser console after deploying:
  localStorage.setItem("dev:token", "<same-token>");
  ```
- [ ] Test access from external IP
- [ ] Verify 403 without token
- [ ] Verify 200 with token
- [ ] Remove `/public/metrics.html` if desired (optional)

## Configuration Reference

### Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `METRICS_DEV_TOKEN` | string | `None` | Auth token for dashboard access (required in prod) |
| `METRICS_ALLOW_LOCALHOST` | bool | `true` | Allow 127.0.0.1 without token |

### Frontend Storage

| Key | Type | Usage |
|-----|------|-------|
| `localStorage["dev:token"]` | string | Token appended to iframe src as query param |

### Dashboard File Locations (Priority Order)

1. `admin_assets/metrics.html` ← **Preferred** (private)
2. `public/metrics.html` ← Fallback (public - can remove)

## Usage Examples

### Local Development
```bash
# No token needed - localhost bypass active
http://127.0.0.1:8001/agent/metrics/dashboard
```

### Production Access
```bash
# Set token in env
export METRICS_DEV_TOKEN="prod-abc123def456..."

# Access with token
curl -H "Authorization: Bearer prod-abc123def456..." \
  https://api.example.com/agent/metrics/dashboard

# Or via query param (HTTPS only!)
https://api.example.com/agent/metrics/dashboard?dev=prod-abc123...
```

### Browser Integration
```javascript
// Store token (one-time setup)
localStorage.setItem("dev:token", "prod-abc123def456...");

// Frontend automatically loads:
// <iframe src="/agent/metrics/dashboard?dev=prod-abc123..."></iframe>
```

## Files Modified/Created

### New Files (4)
1. `assistant_api/security/__init__.py` - Security module exports
2. `assistant_api/security/dev_access.py` - Auth enforcement (66 lines)
3. `admin_assets/metrics.html` - Private dashboard copy (294 lines)
4. `tests/e2e/metrics-lock.spec.ts` - E2E security tests (103 lines)

### Modified Files (4)
5. `assistant_api/settings.py` - +2 settings (METRICS_DEV_TOKEN, METRICS_ALLOW_LOCALHOST)
6. `assistant_api/routers/agent_metrics.py` - +45 lines (new endpoint)
7. `src/components/BehaviorMetricsPanel.tsx` - +21 lines (GuardedIframe component)
8. `docs/DEVELOPMENT.md` - +33 lines (security documentation)

**Total Changes**: 8 files, ~568 insertions

## Success Criteria ✅

All requirements met:

1. ✅ **Settings** - Dev token + localhost bypass flag
2. ✅ **Security Module** - Multi-source auth with IP detection
3. ✅ **Guarded Endpoint** - `/agent/metrics/dashboard` with `ensure_dev_access()`
4. ✅ **Private Dashboard** - `admin_assets/metrics.html` served by backend
5. ✅ **Frontend Integration** - Token from localStorage appended to iframe
6. ✅ **Documentation** - DEVELOPMENT.md with comprehensive guide
7. ✅ **E2E Tests** - 5 test cases covering all scenarios
8. ✅ **Manual Testing** - Localhost ✅, External blocked ✅

**Status**: 🎉 **COMPLETE** - Dashboard now has server-side security!

## Next Steps (Optional)

1. **Generate Production Token**:
   ```bash
   openssl rand -hex 32 > .metrics-token
   export METRICS_DEV_TOKEN=$(cat .metrics-token)
   ```

2. **Remove Public Dashboard** (optional):
   ```bash
   git rm public/metrics.html
   # Update fallback in agent_metrics.py if needed
   ```

3. **Add Token Rotation** (future enhancement):
   - Store hashed tokens in database
   - Support multiple valid tokens
   - Add expiration timestamps
   - Log access attempts

4. **Enhanced Security** (future):
   - Rate limiting (e.g., max 10 failed attempts/hour)
   - IP whitelisting for production
   - Audit logging for dashboard access
   - CSRF protection for POST endpoints

## Related Documentation

- **Main Guide**: `ADVANCED_ANALYTICS_COMPLETE.md` (analytics features)
- **Quick Reference**: `ADVANCED_ANALYTICS_QUICKREF.md` (API endpoints)
- **Dev Setup**: `docs/DEVELOPMENT.md` (token configuration)
- **E2E Tests**: `tests/e2e/metrics-lock.spec.ts` (security validation)
