# 🔍 Service Token Troubleshooting Checklist

## Current Status
- ✅ Backend deployed with admin router and CF Access
- ✅ PyJWT installed
- ✅ Environment variables configured correctly:
  - `CF_ACCESS_TEAM_DOMAIN=ledgermind.cloudflareaccess.com`
  - `CF_ACCESS_AUD=f34cb2b8f9a670c4f4df57f5c90b2cf45f31e27c1ec3ce83b5f75e2ce774f35c`
  - `ACCESS_ALLOWED_EMAILS=leoklemet.pa@gmail.com`
  - `ACCESS_ALLOWED_SERVICE_SUBS=portfolio-admin-smoke`
- ✅ `/api/admin/whoami` endpoint exists
- ✅ Requests reaching backend through Cloudflare Tunnel
- ❌ Cloudflare returning 403 Forbidden for service token

## What's Happening

```
You → Cloudflare (with service token headers)
     ↓
Cloudflare validates service token
     ↓
❌ 403 Forbidden (Cloudflare rejects before injecting JWT)
```

The backend never even sees the JWT because Cloudflare rejects the request first.

## Things to Check in Cloudflare Dashboard

### 1. Service Token Still Exists
Go to: https://one.dash.cloudflare.com/
- **Zero Trust** → **Access** → **Service Auth** → **Service Tokens**
- Confirm token with ID `bcf632e4a22f6a8007d47039038904b7.access` exists
- Check if it's expired or revoked

### 2. Service Token in Application Policy
Go to: **Zero Trust** → **Access** → **Applications**
- Find application covering `assistant.ledger-mind.org`
- Click **Edit** → **Policies** tab
- **CRITICAL:** Check if service token is in the **Include** rules
- The token name in CF should be: `portfolio-admin-smoke`

### 3. Application Path Configuration
- Check if the application path includes `/api/admin/*` or `/api/*`
- If the path is too specific (e.g., only `/api/rag/*`), it won't cover `/api/admin/`

### 4. Policy Order
- Service token policy should not be blocked by a higher-priority deny rule
- Check policy order and ensure service token policy can match

### 5. Token Rotation
- If you recently rotated or regenerated the service token, the old ID/secret won't work
- You'd need the NEW credentials from Cloudflare

## Quick Tests

### Test 1: Verify Token Credentials
```powershell
# Current credentials
Write-Host "Client ID: bcf632e4a22f6a8007d47039038904b7.access"
Write-Host "Client Secret: ed3822142602d252acc657dc1922e2647224f394ecfd7dab683f31b72ffee35a"
```

If these don't match what's in Cloudflare dashboard, that's the problem!

### Test 2: Try User SSO Instead
```powershell
# If service token doesn't work, test with user email auth
# This proves the endpoint and CF Access are working in general

# Open browser and login via CF Access
Start-Process "https://assistant.ledger-mind.org/api/admin/whoami"
```

If user SSO works but service token doesn't → service token policy issue
If neither works → broader CF Access configuration issue

### Test 3: Test Against a Different Endpoint
```powershell
# Test if service token works for ANY endpoint
try {
    $response = Invoke-WebRequest -Uri "https://assistant.ledger-mind.org/ready" `
        -Headers @{
            "CF-Access-Client-Id"=$env:CF_ACCESS_CLIENT_ID
            "CF-Access-Client-Secret"=$env:CF_ACCESS_CLIENT_SECRET
        } -SkipCertificateCheck -UseBasicParsing
    Write-Host "ready endpoint: $($response.StatusCode)"
} catch {
    Write-Host "ready endpoint: $($_.Exception.Response.StatusCode.value__)"
}
```

If `/ready` also returns 403 → service token not working at all
If `/ready` works → path-specific policy issue

## Most Likely Causes

### 1. Service Token Not in Policy ⭐ (Most Common)
**Symptom:** 403 Forbidden from Cloudflare
**Fix:** Add service token to application policy Include rules

### 2. Wrong Token Name
**Symptom:** Token in policy but still 403
**Fix:** Ensure token name matches: `portfolio-admin-smoke`

### 3. Token Expired/Revoked
**Symptom:** Was working, now 403
**Fix:** Check token status in dashboard, regenerate if needed

### 4. Application Path Mismatch
**Symptom:** Some endpoints work, `/api/admin/*` doesn't
**Fix:** Update application to cover `/api/admin/*` or `/api/*` or `/*`

### 5. Policy Order Issue
**Symptom:** Token in policy but a deny rule blocks it
**Fix:** Reorder policies or update deny rule to exclude service auth

## Recommended Next Steps

1. **Screenshot the CF Access Application Policy** showing:
   - Application URL/path configuration
   - All policy rules (especially Include rules)
   - Service token status

2. **Verify Token Name:**
   - Go to Service Tokens page
   - Find the token with ID `bcf632e4a22f6a8007d47039038904b7.access`
   - Confirm its name is exactly: `portfolio-admin-smoke`

3. **Test User SSO:**
   - Open `https://assistant.ledger-mind.org/api/admin/whoami` in browser
   - Login with `leoklemet.pa@gmail.com`
   - If this works, problem is service-token-specific

4. **Check CF Access Logs:**
   - Zero Trust → Logs → Access
   - Look for recent requests to `assistant.ledger-mind.org`
   - Check why service token requests are being denied

## Working Fallback: User SSO

While debugging service tokens, you can use user SSO:

```powershell
# Option 1: Browser-based (manual)
Start-Process "https://assistant.ledger-mind.org/api/admin/whoami"

# Option 2: cloudflared access (automated)
# Install: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
cloudflared access login ledgermind.cloudflareaccess.com
cloudflared access curl https://assistant.ledger-mind.org/api/admin/whoami
```

---

**Bottom line:** The backend is 100% ready. The issue is Cloudflare Access configuration for the service token.
