# Cloudflare Access Testing - Quick Start

## TL;DR

```powershell
# 1. Authenticate with Cloudflare Access
.\cf-access-login.ps1

# 2. Verify setup
.\verify-cf-access.ps1

# 3. Start backend
.\start-backend.ps1
```

## Step-by-Step Instructions

### 1. Install cloudflared (if not already installed)

**Option A - Chocolatey:**
```powershell
choco install cloudflared
```

**Option B - winget:**
```powershell
winget install cloudflare.cloudflared
```

**Option C - Manual Download:**
https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/

### 2. Authenticate with Cloudflare Access

Run the login helper:
```powershell
.\cf-access-login.ps1
```

This will:
- Check if cloudflared is installed
- Open your browser for authentication
- Save the token locally
- Verify the token works

**Important:** Sign in with `leoklemet.pa@gmail.com`

### 3. Verify Complete Setup

Run the verification script:
```powershell
.\verify-cf-access.ps1
```

This checks:
- ✓ Token retrieval
- ✓ JWT decoding (AUD, email)
- ✓ JWKS endpoint accessibility
- ✓ Backend JWT verification

### 4. Start Backend

Run the backend startup script:
```powershell
.\start-backend.ps1
```

This will:
- Load environment variables from `.env`
- Verify configuration
- Start uvicorn on port 8001
- Enable auto-reload for development

### 5. Test Upload

**Option A - Manual curl:**
```powershell
# Get a fresh token
$token = cloudflared access token --app https://assistant.ledger-mind.org/api/uploads

# Test with the token
$headers = @{ "Cf-Access-Jwt-Assertion" = $token }
Invoke-WebRequest -Uri "http://127.0.0.1:8001/api/uploads" -Headers $headers -Method GET
```

**Expected:** `405 Method Not Allowed` (means JWT verification passed!)

**Option B - Browser:**
1. Open `http://localhost:8001/docs` (FastAPI Swagger UI)
2. Try the `/api/uploads` endpoint
3. Should see authentication enforced

## Configuration

Your setup (from `.env`):

```bash
CF_ACCESS_TEAM_DOMAIN=ledgermind.cloudflareaccess.com
CF_ACCESS_AUD=f34cb2b8f9a670c4f4df57f5c90b2cf45f31e27c1ec3ce83b5f75e2ce774f35c
ACCESS_ALLOWED_EMAILS=leoklemet.pa@gmail.com
MAX_IMAGE_MB=30
MAX_VIDEO_MB=200
```

## Troubleshooting

### "Unable to find token for provided application"

**Cause:** Not authenticated yet.

**Fix:** Run authentication:
```powershell
.\cf-access-login.ps1
```

### "Failed to decode JWT: null-valued expression"

**Cause:** Token retrieval failed (probably needs authentication).

**Fix:** Same as above - run `.\cf-access-login.ps1`

### "cloudflared: command not found"

**Cause:** cloudflared CLI not installed.

**Fix:** Install via chocolatey or download from Cloudflare.

### Backend returns 403 with valid token

**Cause:** Environment variables not loaded.

**Fix:** Use `.\start-backend.ps1` which loads `.env` automatically.

Or manually:
```powershell
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.+)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
    }
}
```

### JWKS endpoint not accessible

**Cause:** Team domain incorrect.

**Fix:** Verify in Cloudflare Zero Trust dashboard → Settings → Custom Pages.
Should be: `ledgermind.cloudflareaccess.com`

## Scripts Reference

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `cf-access-login.ps1` | Authenticate with CF Access | First time, or after token expires |
| `verify-cf-access.ps1` | Verify complete setup | After authentication, before deployment |
| `start-backend.ps1` | Start backend with config | Local development and testing |

## Expected Test Results

### Authentication (cf-access-login.ps1)
```
✓ cloudflared found
✓ Token saved successfully!
```

### Verification (verify-cf-access.ps1)
```
✓ Token retrieved successfully
✓ JWT decoded successfully
  Audience (aud): f34cb2b8f9a670c4f4df57f5c90b2cf45f31e27c1ec3ce83b5f75e2ce774f35c
  Email:          leoklemet.pa@gmail.com
✓ AUD matches expected value
✓ Email matches expected value
✓ JWKS endpoint accessible
  Keys available: 2
✓ Backend accepted JWT (405 Method Not Allowed is expected for GET)
```

### Backend Startup (start-backend.ps1)
```
✓ Set CF_ACCESS_TEAM_DOMAIN
✓ Set CF_ACCESS_AUD
✓ Set ACCESS_ALLOWED_EMAILS
Starting uvicorn on port 8001...
INFO:     Uvicorn running on http://127.0.0.1:8001
```

## Next Steps

After local testing passes:

1. **Deploy to production** with same configuration
2. **Configure Cloudflare Tunnel** to proxy requests
3. **Test through production URL** (https://assistant.ledger-mind.org)
4. **Monitor CF Access logs** in Cloudflare dashboard

## Documentation

- **Complete Setup**: `docs/CF_ACCESS.md`
- **Quick Reference**: `docs/CF_ACCESS_QUICKSTART.md`
- **Verification Steps**: `docs/VERIFY_CF_ACCESS.md`
- **This Guide**: `docs/CF_ACCESS_TESTING.md`

## Support

If you encounter issues:
1. Check scripts output for specific errors
2. Review troubleshooting section above
3. Check backend logs for JWT verification errors
4. Verify CF Access configuration in Cloudflare dashboard
