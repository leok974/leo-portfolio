# Cloudflare Access - Production Deployment (Updated for /api/admin/*)

## ⚠️ BREAKING CHANGE: Centralized Admin Router

All privileged operations are now under `/api/admin/*`. Update your CF Access application configuration!

## ✅ Configuration Ready

Your production configuration is correct:

```bash
CF_ACCESS_TEAM_DOMAIN=ledgermind.cloudflareaccess.com
CF_ACCESS_AUD=f34cb2b8f9a670c4f4df57f5c90b2cf45f31e27c1ec3ce83b5f75e2ce774f35c
ACCESS_ALLOWED_EMAILS=leoklemet.pa@gmail.com
```

## 🚀 Deployment Steps

### 1. Update Cloudflare Access Application

**⚠️ REQUIRED: Update application path**

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. Navigate to **Access** → **Applications**
3. Find your application (e.g., "Assistant API")
4. Update configuration:
   - **Old:** `assistant.ledger-mind.org/api/uploads`
   - **New:** `assistant.ledger-mind.org/api/admin`
5. **Path:** `/api/admin` (covers all admin endpoints)

### 2. Deploy Backend to Production

Make sure these environment variables are set on your production backend:

```bash
CF_ACCESS_TEAM_DOMAIN=ledgermind.cloudflareaccess.com
CF_ACCESS_AUD=f34cb2b8f9a670c4f4df57f5c90b2cf45f31e27c1ec3ce83b5f75e2ce774f35c
ACCESS_ALLOWED_EMAILS=leoklemet.pa@gmail.com
MAX_IMAGE_MB=30
MAX_VIDEO_MB=200
```

**Docker Compose:**
```bash
# Deploy with production override
docker-compose -f deploy/docker-compose.yml \
               -f deploy/docker-compose.prod.override.yml \
               up -d --build backend
```

**Verify backend picked up the config:**
```bash
# Check logs for startup
docker-compose logs backend | grep -i "cf_access\|team_domain\|aud"
```

### 3. Authenticate from Your Machine

Use the **new application URL** (with /api/admin path):

```powershell
# Authenticate (opens browser for SSO)
cloudflared access login https://assistant.ledger-mind.org/api/admin
```

This will:
- Open browser to Cloudflare Access
- Prompt you to sign in with `leoklemet.pa@gmail.com`
- Save authentication token locally

### 4. Get JWT Token

```powershell
# Get a short-lived JWT for the application
$token = cloudflared access token --app https://assistant.ledger-mind.org/api/admin
```

The token is valid for ~24 hours (based on your CF Access session duration).

### 5. Quick Smoke Test - Whoami Endpoint

```powershell
# Test whoami endpoint (simplest test - returns your email)
curl -H "Cf-Access-Jwt-Assertion: $token" https://assistant.ledger-mind.org/api/admin/whoami
```

**Expected Result:**
```json
{"ok":true,"email":"leoklemet.pa@gmail.com"}
```

If this works, JWT verification is working correctly! ✅

### 6. Test Upload Endpoint

```powershell
# Test uploads (expect NOT 403)
$headers = @{ "Cf-Access-Jwt-Assertion" = $token }
try {
    Invoke-WebRequest -Uri "https://assistant.ledger-mind.org/api/admin/uploads" `
                      -Headers $headers `
                      -Method GET `
                      -UseBasicParsing
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "Status: $statusCode"
}
```

**Expected Results:**
- ✅ **405 Method Not Allowed** - JWT verified, but GET not allowed on POST endpoint (SUCCESS!)
- ❌ **403 Forbidden** - JWT verification failed (check config)

### 7. Test Gallery Endpoint

```powershell
# Test gallery (expect NOT 403)
try {
    Invoke-WebRequest -Uri "https://assistant.ledger-mind.org/api/admin/gallery/add" `
                      -Headers $headers `
                      -Method GET `
                      -UseBasicParsing
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "Status: $statusCode"
}
```

**Expected Results:**
- ✅ **405 Method Not Allowed** - JWT verified!
- ❌ **403 Forbidden** - JWT verification failed

### 8. Test Without JWT (Should Fail)

```powershell
# Test WITHOUT JWT header (should be blocked)
try {
    Invoke-WebRequest -Uri "https://assistant.ledger-mind.org/api/admin/whoami" `
                      -Method GET `
                      -UseBasicParsing
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "Status: $statusCode (expected 403)"
}
```

**Expected Result:**
- ✅ **403 Forbidden** - CF Access correctly blocking unauthenticated requests!

## 🎯 Success Checklist

After deployment, verify:

1. ✅ CF Access application uses `/api/admin` path
2. ✅ `/api/admin/whoami` returns your email with JWT
3. ✅ `/api/admin/uploads` with JWT returns **405** (not 403)
4. ✅ `/api/admin/gallery/add` with JWT returns **405** (not 403)
5. ✅ `/api/admin/whoami` without JWT returns **403**

## 📝 Automated Smoke Test

Run the full production test:

```powershell
.\test-production.ps1
```

This tests:
1. Authentication with cloudflared
2. JWT token retrieval
3. Whoami endpoint (simple smoke test)
4. Uploads endpoint (with JWT)
5. Gallery endpoint (with JWT)
6. Uploads endpoint (without JWT - should fail)
7. JWT claims verification

## 🔍 Troubleshooting

### "403 Forbidden" on all endpoints

**Cause:** CF Access application path not updated to `/api/admin`

**Fix:**
1. Update CF Access app to use `/api/admin` path
2. Re-run authentication: `cloudflared access login https://assistant.ledger-mind.org/api/admin`
3. Get new token: `$token = cloudflared access token --app https://assistant.ledger-mind.org/api/admin`

### "404 Not Found" on /api/admin/*

**Cause:** Backend not deployed with new admin router

**Fix:**
```bash
# Rebuild and redeploy backend
docker-compose -f deploy/docker-compose.yml up -d --build backend
```

### Token command fails

**Old command (deprecated):**
```powershell
cloudflared access token --app https://assistant.ledger-mind.org/api/uploads  # ❌
```

**New command:**
```powershell
cloudflared access token --app https://assistant.ledger-mind.org/api/admin  # ✅
```

### "Invalid AUD" in backend logs

**Cause:** Token was issued for old application path

**Fix:**
1. Update CF Access application to use `/api/admin`
2. Re-authenticate and get new token
3. Use new token for testing

## 🔐 Security Benefits

The new `/api/admin/*` structure provides:

1. **Single Guard:** One CF Access check protects all privileged operations
2. **Impossible to Forget:** Router-level dependency applies automatically
3. **Clear Intent:** `/api/admin/*` signals "privileged operation"
4. **Easy Auditing:** CI test ensures all admin routes are guarded
5. **Simple Testing:** One token works for all admin endpoints

## 📚 References

- **Migration Guide:** `docs/ADMIN_ROUTER_MIGRATION.md`
- **Command Reference:** `CLOUDFLARE_ACCESS_COMMANDS.md`
- **Test Script:** `test-production.ps1`
- **CI Guard Test:** `tests/test_admin_guard.py`

## 🎬 Quick Commands

```powershell
# Full workflow
cloudflared access login https://assistant.ledger-mind.org/api/admin
$token = cloudflared access token --app https://assistant.ledger-mind.org/api/admin
curl -H "Cf-Access-Jwt-Assertion: $token" https://assistant.ledger-mind.org/api/admin/whoami

# Run full test
.\test-production.ps1

# Verify CI guard
pytest tests/test_admin_guard.py -v
```
