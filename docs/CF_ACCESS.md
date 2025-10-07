# Cloudflare Access Integration Summary

**Date:** October 6, 2025
**Migration:** Feature flags → Cloudflare Access JWT verification

## Overview

The upload system has been migrated from feature flag-based access control to **Cloudflare Access JWT verification**. This provides enterprise-grade authentication without managing passwords, sessions, or CSRF tokens.

## Architecture

```
User Request
    ↓
Cloudflare Access (Edge)
    ├─ Not authenticated → Login page (Google/GitHub/Email)
    └─ Authenticated → Add Cf-Access-Jwt-Assertion header
         ↓
Cloudflare Tunnel
    ↓
Backend API
    ├─ Verify JWT signature (JWKS)
    ├─ Check email allowlist (optional)
    └─ Process upload
```

## Implementation

### 1. Backend Verification (`assistant_api/utils/cf_access.py`)

**File:** 113 lines

**Key Functions:**
- `_fetch_jwks()` - Fetch public keys from Cloudflare
- `_get_key_for_kid(kid)` - Get RSA key for JWT verification (10-min cache)
- `require_cf_access(request)` - FastAPI dependency for route protection

**JWT Verification Flow:**
1. Extract `Cf-Access-Jwt-Assertion` header
2. Get kid from JWT header (unverified)
3. Fetch matching public key from Cloudflare JWKS endpoint
4. Verify JWT signature using RS256/ES256 algorithm
5. Validate expiration and audience
6. Extract email claim
7. Check against allowlist (if configured)
8. Return email for logging

**HTTP Status Codes:**
- `403 Forbidden` - Missing JWT header
- `401 Unauthorized` - Invalid JWT signature or expired token
- `403 Forbidden` - Email not in allowlist

**Environment Variables:**
```bash
CF_ACCESS_TEAM_DOMAIN=yourteam.cloudflareaccess.com  # Required
CF_ACCESS_AUD=your-aud-tag-here                       # Required
ACCESS_ALLOWED_EMAILS=user@example.com,admin@example.com  # Optional
```

### 2. Router Protection

**Modified Files:**
- `assistant_api/routers/uploads.py`
- `assistant_api/routers/gallery.py`

**Changes:**
```python
# Before (feature flags):
from assistant_api.utils.features import require_uploads_enabled
router = APIRouter(
    prefix="/api/uploads",
    dependencies=[Depends(require_uploads_enabled)]
)

# After (Cloudflare Access):
from assistant_api.utils.cf_access import require_cf_access
router = APIRouter(
    prefix="/api/uploads",
    dependencies=[Depends(require_cf_access)]
)
```

### 3. Dependencies (`requirements.in`)

**Added:**
```
pyjwt[crypto]>=2.9.0
```

This provides:
- JWT encoding/decoding
- RSA/ES256 signature verification
- Cryptography backend for key operations

### 4. Docker Configuration (`deploy/docker-compose.prod.override.yml`)

**Added environment variables:**
```yaml
services:
  backend:
    environment:
      # Cloudflare Access JWT verification
      - CF_ACCESS_TEAM_DOMAIN=${CF_ACCESS_TEAM_DOMAIN:-}
      - CF_ACCESS_AUD=${CF_ACCESS_AUD:-}
      - ACCESS_ALLOWED_EMAILS=${ACCESS_ALLOWED_EMAILS:-}
      # Upload size limits
      - MAX_IMAGE_MB=${MAX_IMAGE_MB:-30}
      - MAX_VIDEO_MB=${MAX_VIDEO_MB:-200}
```

### 5. Production Configuration (`.env.production`)

**Template:**
```bash
# Cloudflare Access JWT Verification
CF_ACCESS_TEAM_DOMAIN=yourteam.cloudflareaccess.com
CF_ACCESS_AUD=your-application-audience-tag-here
ACCESS_ALLOWED_EMAILS=you@your.email,teammate@their.email  # Optional

# Upload Configuration
MAX_IMAGE_MB=30
MAX_VIDEO_MB=200
```

## Security Benefits

### 1. No Password Management
- Users authenticate via Google, GitHub, email OTP, etc.
- No password storage or reset flows needed
- Identity providers handle 2FA/MFA

### 2. JWT Signature Verification
- Prevents header spoofing
- Cryptographically signed by Cloudflare
- Short-lived tokens (auto-expire)

### 3. Defense in Depth
- Cloudflare Access at edge (first barrier)
- JWT verification in backend (second barrier)
- Email allowlist (optional third barrier)
- File size/MIME validation (fourth barrier)

### 4. Centralized Access Control
- Manage users in Cloudflare dashboard
- No code changes to add/remove users
- Audit logs of all access attempts
- Session management (force logout)

### 5. No CSRF Needed
- Cloudflare Tunnel prevents direct origin access
- No cookies or sessions
- JWT in header (not subject to CSRF)

## Migration from Feature Flags

### What Changed

**Removed:**
- `assistant_api/utils/features.py` - Feature gate module (still exists for other features)
- Feature flag checks in upload routers
- `FEATURE_UPLOADS` environment variable
- `VITE_FEATURE_AGENT_UPLOADS` frontend flag
- Admin token verification
- Dev mode auto-enable

**Added:**
- `assistant_api/utils/cf_access.py` - JWT verification
- `CF_ACCESS_TEAM_DOMAIN` environment variable
- `CF_ACCESS_AUD` environment variable
- `ACCESS_ALLOWED_EMAILS` environment variable (optional)
- `pyjwt[crypto]` dependency

### Why?

1. **Simpler Architecture:** No feature flags to manage
2. **Better Security:** Industry-standard JWT verification
3. **Easier User Management:** Cloudflare dashboard instead of code changes
4. **Audit Trail:** Built-in logging of all access attempts
5. **Zero Trust:** Identity verification at the edge

### Backward Compatibility

**Frontend:** No changes needed
- Attachment button still works the same
- Authentication happens transparently via CF Access

**API Clients:** Must include CF Access JWT
- Cloudflare Tunnel ensures this header is present
- Direct origin access is blocked (good security practice)

## Setup Guide

### 1. Configure Cloudflare Access

1. Navigate to **Cloudflare Zero Trust** dashboard
2. Go to **Access → Applications**
3. Create new application:
   - **Application type:** Self-hosted
   - **Name:** Portfolio Upload API
   - **Session duration:** 24 hours (or your preference)
   - **Application domain:** `api.yourdomain.com` (or subdomain)
4. Configure **Access Policy:**
   - **Rule name:** Allow specific users
   - **Action:** Allow
   - **Include:** Emails → `your@email.com`, `teammate@email.com`
5. Note the **Application Audience (AUD) Tag** from Overview tab

### 2. Configure Backend

Add to `.env.production`:
```bash
CF_ACCESS_TEAM_DOMAIN=yourteam.cloudflareaccess.com
CF_ACCESS_AUD=<paste-aud-tag-here>
ACCESS_ALLOWED_EMAILS=your@email.com  # Optional extra filter
```

### 3. Deploy

```bash
# Update dependencies
cd assistant_api
pip install -r requirements.in

# Rebuild Docker image
docker-compose -f deploy/docker-compose.yml \
               -f deploy/docker-compose.prod.override.yml \
               build backend

# Restart with new config
docker-compose -f deploy/docker-compose.yml \
               -f deploy/docker-compose.prod.override.yml \
               up -d backend
```

### 4. Test

```bash
# Should require CF Access login
curl https://api.yourdomain.com/api/uploads

# After authentication, JWT header is added automatically
# Upload should work via browser
```

## Troubleshooting

### "Cloudflare Access required" (403)

**Cause:** Missing `Cf-Access-Jwt-Assertion` header

**Solutions:**
- Ensure request goes through Cloudflare Tunnel (not direct to origin)
- Check CF Access application is configured for the domain
- Verify user is authenticated (check for CF Access cookie)

### "Invalid Access token" (401)

**Cause:** JWT signature verification failed

**Solutions:**
- Check `CF_ACCESS_TEAM_DOMAIN` is correct (should match your team domain)
- Verify token hasn't expired (default: 24 hours)
- Ensure system clock is synchronized (for exp validation)
- Check JWKS endpoint is reachable: `https://{team-domain}/cdn-cgi/access/certs`

### "Not allowed" (403 with valid JWT)

**Cause:** Email not in `ACCESS_ALLOWED_EMAILS` allowlist

**Solutions:**
- Add email to `ACCESS_ALLOWED_EMAILS` environment variable
- Remove `ACCESS_ALLOWED_EMAILS` to disable allowlist (CF Access policy is primary filter)
- Check email claim in JWT matches exactly (case-insensitive)

### "Unable to verify Access token (unknown key)" (401)

**Cause:** JWT kid not found in JWKS

**Solutions:**
- Wait 10 minutes for cache refresh (automatic)
- Restart backend to clear JWKS cache
- Check CF Access hasn't rotated keys recently (rare)

## Monitoring

### Cloudflare Access Logs

View authentication attempts:
1. Cloudflare Zero Trust dashboard
2. **Logs → Access**
3. Filter by application name

Shows:
- User email
- Timestamp
- Allow/deny decision
- Identity provider used
- IP address

### Backend Logs

The `require_cf_access` function returns the user's email:
```python
email = require_cf_access(request)
logger.info(f"Upload by {email}")
```

Add logging to your routes:
```python
@router.post("/api/uploads")
async def upload_file(
    file: UploadFile,
    email: str = Depends(require_cf_access)
):
    logger.info(f"Upload by {email}: {file.filename}")
    # ... process upload
```

## Cost

Cloudflare Access pricing:
- **Free tier:** 50 users
- **Teams Standard:** $7/user/month (unlimited apps)
- **Teams Enterprise:** Custom pricing

**For personal portfolio:** Free tier is sufficient

## Documentation Updates

**Modified files:**
- `docs/UPLOADS.md` - Updated security section with CF Access details
- `docs/FEATURE_GATING.md` - Marked as deprecated, added CF Access migration notes
- `docs/CF_ACCESS.md` - This file (new comprehensive guide)

**Key sections updated:**
- Authentication flow
- Configuration steps
- Environment variables
- Security benefits
- Migration guide

## Summary

✅ **Completed:**
- JWT verification module (113 lines)
- Router updates (2 files)
- Dependency added (`pyjwt[crypto]`)
- Docker configuration
- Environment templates
- Documentation (3 files updated)

🔒 **Security posture:**
- Identity verification at edge (Cloudflare Access)
- JWT signature verification in backend
- Optional email allowlist
- Size limits (30MB images, 200MB videos)
- MIME type validation
- Path safety (slugification)

📊 **Metrics:**
- Code added: ~150 lines (cf_access.py + router updates)
- Dependencies: +1 (pyjwt)
- Configuration: +3 env vars
- Documentation: +3 files updated

🎯 **Next steps:**
1. Configure Cloudflare Access application
2. Deploy backend with new environment variables
3. Test authentication flow
4. Monitor CF Access logs
5. Optional: Add user email logging to uploads
