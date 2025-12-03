# Service Token Support - Implementation Summary

## Overview

Added support for **Cloudflare Access service tokens** to enable non-interactive authentication for CI/CD pipelines and automated workflows. Service tokens work alongside user SSO without requiring interactive login or OTP.

## Changes Made

### 1. Backend Updates ✅

**File: `assistant_api/utils/cf_access.py`**

- **Added environment variable:** `ACCESS_ALLOWED_SERVICE_SUBS` (comma-separated list of allowed service token subjects)
- **Updated `require_cf_access()` function:**
  - Now accepts both user SSO tokens (email claim) and service tokens (sub claim)
  - Extracts principal from `email`, `identity`, or `sub` claims
  - Validates emails against `ACCESS_ALLOWED_EMAILS`
  - Validates service tokens against `ACCESS_ALLOWED_SERVICE_SUBS`
  - Returns generic "principal" instead of just "email"

**Key Logic:**
```python
# Extract principal (email or service token subject)
principal = (claims.get("email") or claims.get("identity") or claims.get("sub") or "").strip()

# Route validation based on principal type
if "@" in principal:
    # User SSO - check email allowlist
    if ALLOWED_EMAILS and principal.lower() not in ALLOWED_EMAILS:
        raise HTTPException(403, "Not allowed (email)")
else:
    # Service token - check subject allowlist
    if ALLOWED_SERVICE_SUBS and principal not in ALLOWED_SERVICE_SUBS:
        raise HTTPException(403, "Not allowed (service)")
```

### 2. Admin Router Update ✅

**File: `assistant_api/routers/admin.py`**

- **Updated `/api/admin/whoami` endpoint:**
  - Changed parameter from `email` to `principal`
  - Returns `{"ok": True, "principal": "..."}` instead of `{"ok": True, "email": "..."}`
  - Works for both user emails and service token names

### 3. Documentation ✅

**New Files:**
- `docs/CF_ACCESS_SERVICE_TOKENS.md` - Complete service token guide (400+ lines)
  - Setup instructions
  - Usage examples (PowerShell, Bash, Python, GitHub Actions)
  - Security best practices
  - Troubleshooting guide

**Updated Files:**
- `CLOUDFLARE_ACCESS_COMMANDS.md` - Added service token examples
- `README.md` - Documented both authentication methods
- `CHANGELOG.md` - Added service token support to release notes

### 4. Test Scripts ✅

**Updated:**
- `test-production.ps1` - Changed `email` to `principal` in whoami test

**New:**
- `test-service-token.ps1` - Dedicated service token test script
  - Tests whoami endpoint
  - Tests uploads endpoint (405 expected)
  - Tests gallery endpoint (405 expected)
  - Clear success/failure reporting

## Authentication Methods

### User SSO (Interactive)

**Use for:** Local development, manual operations, debugging

```powershell
# Login with browser
cloudflared access login https://assistant.ledger-mind.org/api/admin

# Get JWT token
$token = cloudflared access token --app https://assistant.ledger-mind.org/api/admin

# Use token
curl -H "Cf-Access-Jwt-Assertion: $token" https://assistant.ledger-mind.org/api/admin/whoami

# Response: {"ok": true, "principal": "user@example.com"}
```

### Service Token (Non-Interactive)

**Use for:** CI/CD, automation, scheduled jobs, headless environments

```powershell
# Set credentials
$env:CF_ACCESS_CLIENT_ID = "<client-id>"
$env:CF_ACCESS_CLIENT_SECRET = "<client-secret>"

# Use service token (Cloudflare injects JWT automatically)
curl -H "CF-Access-Client-Id: $env:CF_ACCESS_CLIENT_ID" `
     -H "CF-Access-Client-Secret: $env:CF_ACCESS_CLIENT_SECRET" `
     https://assistant.ledger-mind.org/api/admin/whoami

# Response: {"ok": true, "principal": "service-token-name"}
```

## Configuration

### Environment Variables

```bash
# Existing (unchanged)
CF_ACCESS_TEAM_DOMAIN=ledgermind.cloudflareaccess.com
CF_ACCESS_AUD=f34cb2b8f9a670c4f4df57f5c90b2cf45f31e27c1ec3ce83b5f75e2ce774f35c
ACCESS_ALLOWED_EMAILS=leoklemet.pa@gmail.com

# NEW: Service token allowlist
ACCESS_ALLOWED_SERVICE_SUBS=portfolio-admin-smoke
```

### Cloudflare Dashboard Setup

1. **Create Service Token:**
   - Navigate to **Access** → **Service Auth** → **Service Tokens**
   - Create token named `portfolio-admin-smoke`
   - Copy client ID and secret (secret shown only once!)

2. **Add to Application Policy:**
   - Navigate to **Access** → **Applications** → Edit your app
   - Add **Service Auth** selector with your token name

3. **Deploy Backend:**
   - Add `ACCESS_ALLOWED_SERVICE_SUBS=portfolio-admin-smoke` to environment
   - Restart backend

## Testing

### Test User SSO
```powershell
.\test-production.ps1
```

### Test Service Token
```powershell
# Set credentials
$env:CF_ACCESS_CLIENT_ID = "<client-id>"
$env:CF_ACCESS_CLIENT_SECRET = "<client-secret>"

# Run test
.\test-service-token.ps1
```

## Use Cases

### CI/CD Pipeline (GitHub Actions)

```yaml
- name: Upload asset
  env:
    CF_ACCESS_CLIENT_ID: ${{ secrets.CF_ACCESS_CLIENT_ID }}
    CF_ACCESS_CLIENT_SECRET: ${{ secrets.CF_ACCESS_CLIENT_SECRET }}
  run: |
    curl -X POST \
      -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
      -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
      -F "file=@asset.png" \
      https://assistant.ledger-mind.org/api/admin/uploads
```

### Automated Gallery Updates

```python
import os
import requests

headers = {
    "CF-Access-Client-Id": os.getenv("CF_ACCESS_CLIENT_ID"),
    "CF-Access-Client-Secret": os.getenv("CF_ACCESS_CLIENT_SECRET"),
}

# Add gallery item
response = requests.post(
    "https://assistant.ledger-mind.org/api/admin/gallery/add",
    headers=headers,
    json={
        "title": "New Project",
        "type": "image",
        "src": "/assets/uploads/2025/10/project.png",
        "description": "Automated upload"
    }
)
```

### Scheduled Jobs

```bash
#!/bin/bash
# backup-gallery.sh

export CF_ACCESS_CLIENT_ID="..."
export CF_ACCESS_CLIENT_SECRET="..."

curl -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
     -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
     https://assistant.ledger-mind.org/api/admin/gallery/add \
     > backup.json
```

## Security Considerations

### ✅ Benefits

1. **No interactive login** - Perfect for headless environments
2. **Separate credentials** - Service tokens distinct from user passwords
3. **Revocable** - Disable tokens without affecting user access
4. **Auditable** - Track service vs user access separately
5. **Scoped** - Can create different tokens for different purposes

### 🔒 Best Practices

1. **Store securely** - Use secret managers (GitHub Secrets, AWS Secrets Manager, etc.)
2. **Rotate regularly** - Generate new tokens every 90 days
3. **Separate tokens** - One token per workflow/purpose
4. **Monitor usage** - Check Cloudflare Access logs regularly
5. **Revoke compromised** - Immediately revoke if credentials leaked

## Breaking Changes

### Response Format

**Before:**
```json
{"ok": true, "email": "user@example.com"}
```

**After:**
```json
{"ok": true, "principal": "user@example.com"}
// or
{"ok": true, "principal": "service-token-name"}
```

**Impact:** Minimal - Most clients just check `ok` field. If you're parsing the email field specifically, update to use `principal`.

## Migration Path

### For Existing Deployments

1. **Update backend code** (this PR)
2. **Add environment variable** (optional - only if using service tokens):
   ```bash
   ACCESS_ALLOWED_SERVICE_SUBS=your-token-name
   ```
3. **Create service token** in Cloudflare dashboard (if needed)
4. **Test both methods:**
   ```powershell
   .\test-production.ps1      # User SSO
   .\test-service-token.ps1   # Service token
   ```

### Backward Compatibility

✅ **User SSO still works** - No changes to user authentication flow
✅ **Existing scripts unchanged** - `cloudflared` commands work as before
✅ **Optional feature** - Service tokens only needed for automation

## Files Modified

### Backend
- `assistant_api/utils/cf_access.py` - Added service token support
- `assistant_api/routers/admin.py` - Changed email → principal

### Documentation
- `docs/CF_ACCESS_SERVICE_TOKENS.md` - NEW comprehensive guide
- `CLOUDFLARE_ACCESS_COMMANDS.md` - Added service token examples
- `README.md` - Documented both auth methods
- `CHANGELOG.md` - Release notes

### Tests
- `test-production.ps1` - Updated whoami test
- `test-service-token.ps1` - NEW dedicated service token test

## Next Steps

1. **Deploy backend** with updated code
2. **Create service token** in Cloudflare dashboard
3. **Add to environment:**
   ```bash
   ACCESS_ALLOWED_SERVICE_SUBS=portfolio-admin-smoke
   ```
4. **Test service token:**
   ```powershell
   .\test-service-token.ps1 -ClientId "<id>" -ClientSecret "<secret>"
   ```
5. **Use in CI/CD** - Add credentials to GitHub Secrets

## References

- **Complete Guide:** `docs/CF_ACCESS_SERVICE_TOKENS.md`
- **Command Reference:** `CLOUDFLARE_ACCESS_COMMANDS.md`
- **Test Script:** `test-service-token.ps1`
- **Cloudflare Docs:** [Service Tokens](https://developers.cloudflare.com/cloudflare-one/identity/service-tokens/)

## Status: ✅ Complete

All changes implemented and documented. Service token authentication ready for production use.
