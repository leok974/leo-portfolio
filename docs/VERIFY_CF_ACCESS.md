# Manual Cloudflare Access Verification

## Prerequisites

### Install cloudflared CLI

**Option 1 - Chocolatey:**
```powershell
choco install cloudflared
```

**Option 2 - winget:**
```powershell
winget install cloudflare.cloudflared
```

**Option 3 - Direct Download:**
Download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/

### Authenticate with Cloudflare Access

**Before testing, you must authenticate:**

```powershell
# Quick way - Use the helper script
.\cf-access-login.ps1

# Or manually:
cloudflared access login https://ledgermind.cloudflareaccess.com
```

This will:
1. Open your browser
2. Redirect to Cloudflare Access
3. Ask you to sign in with `leoklemet.pa@gmail.com`
4. Save the authentication token locally

**The token is saved to:** `C:\Users\<username>\.cloudflared\`

## Step 1: Get Access Token

Run this command to get a token for your protected endpoint:

```powershell
$token = cloudflared access token --app https://assistant.ledger-mind.org/api/uploads
echo $token
```

**Note:** You need `cloudflared` CLI installed. If not installed:
```powershell
# Download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
# Or via chocolatey:
choco install cloudflared
```

## Step 2: Decode JWT Payload

```powershell
# Decode the JWT to see claims
$parts = $token.Split('.')
$pad = ('=' * ((4 - ($parts[1].Length % 4)) % 4))
$payloadJson = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($parts[1] + $pad))
$payload = $payloadJson | ConvertFrom-Json

# Display audience and email
Write-Host "Audience (aud): $($payload.aud)"
Write-Host "Email:          $($payload.email)"
```

**Expected values:**
- **aud**: `f34cb2b8f9a670c4f4df57f5c90b2cf45f31e27c1ec3ce83b5f75e2ce774f35c`
- **email**: `leoklemet.pa@gmail.com`

## Step 3: Verify JWKS Endpoint

Check that the public keys are accessible:

```powershell
$jwksUrl = "https://ledgermind.cloudflareaccess.com/cdn-cgi/access/certs"
$response = Invoke-WebRequest -Uri $jwksUrl -UseBasicParsing
$jwks = $response.Content | ConvertFrom-Json
$jwks.keys | Format-Table kid, alg
```

**Expected:** Should return a list of keys with `kid` and `alg` (RS256 or ES256)

## Step 4: Test Backend Verification

Start the backend if not running:

```powershell
python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001
```

Then test with the token:

```powershell
# Test with JWT header
$headers = @{
    "Cf-Access-Jwt-Assertion" = $token
}

Invoke-WebRequest -Uri "http://127.0.0.1:8001/api/uploads" `
                  -Headers $headers `
                  -Method GET
```

**Expected responses:**
- ✅ **405 Method Not Allowed**: JWT verification passed! (GET on POST-only endpoint)
- ❌ **403 Forbidden**: JWT header missing or verification failed
- ❌ **401 Unauthorized**: JWT signature invalid

## Step 5: Test Without Token

```powershell
# Should fail with 403
Invoke-WebRequest -Uri "http://127.0.0.1:8001/api/uploads" -Method GET
```

**Expected:** `403 Forbidden` with message "Cloudflare Access required"

## Quick Verification Script

Or just run the automated script:

```powershell
.\verify-cf-access.ps1
```

This will check:
1. ✓ Token retrieval
2. ✓ JWT decoding and claim verification
3. ✓ JWKS endpoint accessibility
4. ✓ Backend JWT verification

## Troubleshooting

### "Unable to find token for provided application"

You need to authenticate first:

```powershell
# Use the helper script (recommended)
.\cf-access-login.ps1

# Or manually
cloudflared access login https://ledgermind.cloudflareaccess.com
```

After authentication, the token will be saved and you can proceed with testing.

### "cloudflared: command not found"
Install cloudflared CLI:
- Download: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
- Or: `choco install cloudflared`

### "Failed to get token"
Make sure you're authenticated:
```powershell
cloudflared access login https://ledgermind.cloudflareaccess.com
```

### "AUD mismatch"
The token's `aud` claim doesn't match `CF_ACCESS_AUD` in `.env`:
- Verify AUD tag in Cloudflare Access application settings
- Update `.env` file with correct AUD

### "Email mismatch"
The token's `email` claim doesn't match `ACCESS_ALLOWED_EMAILS`:
- Check CF Access policy includes your email
- Update `.env` file if needed

### "JWKS endpoint not accessible"
Check team domain is correct:
- Should be: `https://ledgermind.cloudflareaccess.com/cdn-cgi/access/certs`
- Verify in Cloudflare Zero Trust → Settings → Custom Pages

### "Backend returns 403 with token"
Check backend logs:
```powershell
# Look for JWT verification errors
Get-Content .\assistant_api\logs\*.log -Tail 50
```

Common issues:
- `CF_ACCESS_TEAM_DOMAIN` not set in `.env`
- `CF_ACCESS_AUD` doesn't match token
- `pyjwt` not installed: `pip install pyjwt[crypto]`

### "Backend returns 401 with token"
JWT signature verification failed:
- Check JWKS endpoint is reachable from backend
- Verify token hasn't expired (check `exp` claim)
- System clock might be out of sync

## Configuration Files

Current configuration (from `.env`):

```bash
CF_ACCESS_TEAM_DOMAIN=ledgermind.cloudflareaccess.com
CF_ACCESS_AUD=f34cb2b8f9a670c4f4df57f5c90b2cf45f31e27c1ec3ce83b5f75e2ce774f35c
ACCESS_ALLOWED_EMAILS=leoklemet.pa@gmail.com
```

## Next Steps

After verification passes:
1. Test upload in browser (will redirect to CF Access login)
2. Deploy to production with same configuration
3. Monitor CF Access logs in Cloudflare dashboard
4. Set up backend logging for user emails
