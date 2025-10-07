# Upload Security: Cloudflare Access Authentication

**Date:** October 6, 2025
**Status:** Migrated from feature flags to Cloudflare Access JWT verification

## 🔐 Current Implementation: Cloudflare Access

**The upload system now uses Cloudflare Access for authentication instead of feature flags.**

### Why Cloudflare Access?

- ✅ **Enterprise-grade auth** without managing passwords or sessions
- ✅ **Zero Trust security** - Identity verification at the edge
- ✅ **JWT signature verification** prevents header spoofing
- ✅ **Multiple identity providers** (Google, GitHub, email OTP, etc.)
- ✅ **Centralized access control** in Cloudflare dashboard
- ✅ **Audit logs** of all authentication attempts
- ✅ **No CSRF needed** - Cloudflare Tunnel prevents direct origin access

### How It Works

1. **Cloudflare Tunnel** proxies requests to backend
2. **Cloudflare Access** intercepts unauthenticated requests → login page
3. After authentication, **CF Access adds `Cf-Access-Jwt-Assertion` header** with signed JWT
4. **Backend verifies JWT signature** using Cloudflare's JWKS (cached 10 min)
5. Optional **email allowlist** provides additional filtering

### Backend Verification

**File:** `assistant_api/utils/cf_access.py` (113 lines)

```python
def require_cf_access(request: Request) -> str:
    """
    Verifies Cf-Access-Jwt-Assertion header against Cloudflare's JWKS.

    Returns:
        str: User's email address from verified JWT
    """
    token = request.headers.get("Cf-Access-Jwt-Assertion")
    if not token:
        raise HTTPException(403, "Cloudflare Access required")

    # Verify JWT signature with Cloudflare's public keys
    unverified = jwt.get_unverified_header(token)
    key = _get_key_for_kid(unverified.get("kid", ""))

    claims = jwt.decode(token, key=key, algorithms=["RS256", "ES256"])

    email = claims.get("email", "").lower()
    if ALLOWED_EMAILS and email not in ALLOWED_EMAILS:
        raise HTTPException(403, "Not allowed")

    return email
```

### Router Protection

Both upload routers use `require_cf_access` dependency:

```python
# assistant_api/routers/uploads.py
router = APIRouter(
    prefix="/api/uploads",
    dependencies=[Depends(require_cf_access)]
)

# assistant_api/routers/gallery.py
router = APIRouter(
    prefix="/api/gallery",
    dependencies=[Depends(require_cf_access)]
)
```

### Configuration

**Required environment variables:**
```bash
CF_ACCESS_TEAM_DOMAIN=yourteam.cloudflareaccess.com
CF_ACCESS_AUD=your-application-audience-tag-here
ACCESS_ALLOWED_EMAILS=admin@example.com,user@example.com  # Optional
```

**Finding your values:**
1. **Team Domain:** Cloudflare Zero Trust → Settings → Custom Pages URL
2. **AUD Tag:** Cloudflare Access → Applications → Your App → Application Audience (AUD) Tag
3. **Allowed Emails:** Optional comma-separated list for extra filtering

---

## 📜 Previous Implementation: Feature Flags (DEPRECATED)

*This section documents the previous feature flag system for reference.*

**Note:** Feature flags have been replaced by Cloudflare Access authentication.
The following is kept for historical context only.

---

# Feature Gating Implementation Summary (DEPRECATED)

**Date:** October 6, 2025
**Feature:** Upload Feature Gating & Security Hardening
**Status:** REPLACED BY CLOUDFLARE ACCESS

## ✅ Completed Implementation

### 1. Backend Feature Gate (`assistant_api/utils/features.py`)

**New File:** 58 lines

**Functions:**
- `is_dev()` - Checks if running in development mode
- `uploads_enabled_env()` - Checks if uploads feature flag is set
- `require_uploads_enabled()` - FastAPI dependency for gating endpoints

**Access Control Logic:**
1. ✅ **Admin Always Allowed:** Users with admin role bypass all restrictions
2. ✅ **Feature Flag:** `FEATURE_UPLOADS=1` enables for all users
3. ✅ **Dev Mode:** `ALLOW_TOOLS=1` or `ENV=dev` auto-enables
4. ❌ **Default:** Disabled in production (returns 403)

### 2. Router Updates

**Modified Files:**
- `assistant_api/routers/uploads.py` (added 40+ lines)
- `assistant_api/routers/gallery.py` (added 3 lines)

**Changes:**
- Added `dependencies=[Depends(require_uploads_enabled)]` to both routers
- Added size validation (configurable via env vars)
- Added MIME type validation for images
- Returns proper HTTP status codes:
  - `403 Forbidden` - Feature disabled
  - `413 Payload Too Large` - File exceeds size limit
  - `415 Unsupported Media Type` - Invalid file type

**Size Limits:**
```python
MAX_IMAGE_MB = int(os.getenv("MAX_IMAGE_MB", "30"))   # Default: 30MB
MAX_VID_MB = int(os.getenv("MAX_VIDEO_MB", "200"))    # Default: 200MB
```

**Allowed MIME Types:**
- Images: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif`, `.svg`
- Videos: `.mp4`, `.mov`, `.webm`, `.mkv`, `.m4v`

### 3. Frontend Feature Gate

**Modified Files:**
- `public/assets/js/attachment-button.js` (added `isEnabled()` method)
- `src/assistant-dock.ts` (added feature check before initialization)
- `src/vite-env.d.ts` (TypeScript types for env vars)

**Feature Check Logic:**
```javascript
isEnabled() {
  const envFlag = window.__VITE_FEATURE_AGENT_UPLOADS__ === true;
  const devUnlocked = window.__DEV_UNLOCKED__ === true;
  const isAdmin = window.__USER_ROLE__ === 'admin';
  return envFlag || devUnlocked || isAdmin;
}
```

**Initialization:**
- Only loads attachment button script if feature is enabled
- Button self-checks feature flag before rendering
- Logs clearly when feature is disabled

### 4. Environment Configuration

**Created Files:**
- `.env.development` - Dev settings (feature enabled)
- `.env.production` - Production settings (feature disabled)

**Development (.env.development):**
```bash
VITE_FEATURE_AGENT_UPLOADS=1   # Frontend: show button
FEATURE_UPLOADS=1              # Backend: allow uploads
ALLOW_TOOLS=1                  # Dev mode (auto-enables everything)
MAX_IMAGE_MB=30
MAX_VIDEO_MB=200
```

**Production (.env.production):**
```bash
# Leave unset or explicitly disable:
# VITE_FEATURE_AGENT_UPLOADS=0
# FEATURE_UPLOADS=0

# Require admin token for uploads:
ADMIN_TOKEN=<secure-random-token>

# Size limits (optional, defaults shown):
MAX_IMAGE_MB=30
MAX_VIDEO_MB=200
```

### 5. E2E Tests (`tests/e2e/upload-feature-gate.spec.ts`)

**New File:** 220 lines
**Test Count:** 9 tests

**Coverage:**
1. ✅ Upload button hidden when feature disabled
2. ✅ API returns 403 when feature disabled (non-admin)
3. ✅ Gallery API returns 403 when feature disabled
4. ✅ Upload API rejects oversized images (413)
5. ✅ Upload API rejects unsupported file types (415)
6. ✅ Admin can upload even when feature disabled
7. ✅ Upload button visible when feature enabled
8. ✅ Dev mode enables uploads
9. ✅ Admin role enables uploads

**Note:** API tests require backend running. Frontend tests work standalone.

### 6. Documentation Updates

**Modified File:** `docs/UPLOADS.md`

**New Sections:**
- Security > Feature Gating
- Security > File Validation
- Configuration > Environment Variables

**Complete Coverage:**
- Feature flag usage
- Size limits configuration
- MIME type validation
- Admin access patterns
- Dev vs production defaults

## 🔒 Security Features

### Multi-Layer Protection

**Layer 1: Feature Flag**
- Uploads disabled by default in production
- Requires explicit `FEATURE_UPLOADS=1`

**Layer 2: Authentication**
- All routes require authentication
- Admin token checked via `X-Admin-Token` header
- CSRF protection (existing)

**Layer 3: File Validation**
- Size limits enforced (30MB images, 200MB videos)
- MIME type whitelist (no executables, scripts, etc.)
- Extension-based type detection

**Layer 4: Path Safety**
- Slugified filenames (existing)
- Timestamped directories (existing)
- No directory traversal allowed (existing)

### Admin Privileges

**Admin Can:**
- Upload files even when `FEATURE_UPLOADS=0`
- Bypass size limits (NO - limits still apply)
- Access upload API directly

**Admin Authentication:**
1. Dev: `ALLOW_TOOLS=1` auto-grants admin
2. Prod: `X-Admin-Token` header must match `ADMIN_TOKEN` env var

## 📊 Configuration Matrix

| Environment | VITE_FEATURE_AGENT_UPLOADS | FEATURE_UPLOADS | ALLOW_TOOLS | Button Visible? | API Access? |
|-------------|---------------------------|-----------------|-------------|----------------|-------------|
| **Dev (default)** | 1 | - | 1 | ✅ Yes | ✅ Yes (admin) |
| **Dev (explicit)** | 1 | 1 | 0 | ✅ Yes | ✅ Yes (all users) |
| **Prod (disabled)** | 0 | 0 | 0 | ❌ No | ❌ No (403) |
| **Prod (enabled)** | 1 | 1 | 0 | ✅ Yes | ✅ Yes (all users) |
| **Prod (admin only)** | 0 | 0 | 0 + token | ❌ No | ✅ Yes (admin with token) |

## 🧪 Testing Strategy

### Unit Tests (Backend)
```python
# Test feature gate logic
def test_uploads_disabled_returns_403():
    response = client.post('/api/uploads', files={'file': ...})
    assert response.status_code == 403

def test_admin_bypasses_feature_gate():
    response = client.post(
        '/api/uploads',
        headers={'X-Admin-Token': ADMIN_TOKEN},
        files={'file': ...}
    )
    assert response.status_code != 403
```

### E2E Tests (Playwright)
```typescript
// Test frontend gating
test('button hidden when disabled', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('attachment-button')).toHaveCount(0);
});

// Test API gating
test('API returns 403 when disabled', async ({ request }) => {
  const res = await request.post('/api/uploads', ...);
  expect(res.status()).toBe(403);
});
```

### Manual Testing

**Test Feature Disabled:**
```bash
# Backend
unset FEATURE_UPLOADS
unset ALLOW_TOOLS

# Frontend
unset VITE_FEATURE_AGENT_UPLOADS

# Result: Button hidden, API returns 403
```

**Test Feature Enabled:**
```bash
# Backend
export FEATURE_UPLOADS=1

# Frontend
export VITE_FEATURE_AGENT_UPLOADS=1

# Result: Button visible, API accepts uploads
```

**Test Admin Access:**
```bash
# Backend
export ADMIN_TOKEN="secure-token-123"
unset FEATURE_UPLOADS

# Request with admin token:
curl -X POST http://localhost:8001/api/uploads \
  -H "X-Admin-Token: secure-token-123" \
  -F "file=@test.png"

# Result: Upload succeeds despite feature disabled
```

## 🚀 Deployment Checklist

### Development Setup
- [x] Set `VITE_FEATURE_AGENT_UPLOADS=1` in `.env.development`
- [x] Set `ALLOW_TOOLS=1` for backend (enables dev mode)
- [x] Verify button visible in chat
- [x] Test upload flow end-to-end

### Production Deployment
- [ ] **DO NOT** set `ALLOW_TOOLS=1` (security risk)
- [ ] **DO NOT** set `FEATURE_UPLOADS=1` (unless intentionally enabling)
- [ ] Set `ADMIN_TOKEN` to secure random value
- [ ] Configure `MAX_IMAGE_MB` and `MAX_VIDEO_MB` if needed
- [ ] Test that non-admin users get 403
- [ ] Test that admin with token can upload
- [ ] Monitor upload attempts (check for abuse)

### Gradual Rollout (Optional)
1. **Phase 1:** Admin-only (default state)
2. **Phase 2:** Beta users (add feature flag + auth)
3. **Phase 3:** All authenticated users (`FEATURE_UPLOADS=1`)
4. **Phase 4:** Public (consider rate limiting)

## 📋 Environment Variables Reference

### Backend Variables
| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `FEATURE_UPLOADS` | 0\|1 | 0 | Enable uploads for all users |
| `ALLOW_TOOLS` | 0\|1 | 0 | Dev mode (auto-enables uploads) |
| `ADMIN_TOKEN` | string | - | Token for admin authentication |
| `MAX_IMAGE_MB` | int | 30 | Max image file size in MB |
| `MAX_VIDEO_MB` | int | 200 | Max video file size in MB |
| `ENV` | string | - | Environment name (dev/prod) |

### Frontend Variables
| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `VITE_FEATURE_AGENT_UPLOADS` | 0\|1 | 0 | Show attachment button |

### Window Variables (Runtime)
| Variable | Type | Description |
|----------|------|-------------|
| `__VITE_FEATURE_AGENT_UPLOADS__` | boolean | Feature flag from env |
| `__DEV_UNLOCKED__` | boolean | Dev mode unlocked by user |
| `__USER_ROLE__` | string | User role ('admin' bypasses gates) |

## 🎯 Summary

**Added:**
- ✅ Feature gating system (backend + frontend)
- ✅ File size validation (configurable limits)
- ✅ MIME type validation (whitelist approach)
- ✅ Admin bypass mechanism
- ✅ Environment-specific defaults
- ✅ Comprehensive E2E tests
- ✅ Updated documentation

**Security Posture:**
- ✅ Disabled by default in production
- ✅ Admin can always upload
- ✅ Size limits prevent abuse
- ✅ MIME validation prevents dangerous files
- ✅ Clear error messages (no info leakage)

**Status:** ✅ Production-ready with safe defaults
