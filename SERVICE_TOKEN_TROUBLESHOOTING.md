# Service Token Troubleshooting Guide

## Current Status: NOT WORKING ❌

**Date:** October 7, 2025
**Issue:** Service token authentication failing in Cloudflare Access

## Test Results Summary

| Test | Result | Interpretation |
|------|--------|----------------|
| `/api/admin/whoami` without token | 200 (HTML login) | ✅ CF Access protecting endpoint |
| `/api/admin/whoami` with service token | 200 (HTML login) | ❌ Token NOT recognized |
| `/cdn-cgi/access/authorized` with token | 400 Bad Request | ❌ CF rejecting token |
| `cloudflared access curl` | Opens browser | ❌ Tool ignoring service token |

## Current Configuration

### Service Token Credentials
```
Client ID: bcf632e4a22f6a8007d47039038904b7.access
Client Secret: 1532e93c9599937c3155af61945d2c814168c6a5fa809f554d6e3257289268b6
Token Name: portfolio-admin-smoke
```

### Cloudflare Access Application
```
Application: assistant.ledger-mind.org/api/admin*
Policy Include: Service Auth = portfolio-admin-smoke (CONFIRMED ADDED)
```

### Backend Configuration
```
CF_ACCESS_TEAM_DOMAIN=ledgermind.cloudflareaccess.com
CF_ACCESS_AUD=f34cb2b8f9a670c4f4df57f5c90b2cf45f31e27c1ec3ce83b5f75e2ce774f35c
ACCESS_ALLOWED_SERVICE_SUBS=portfolio-admin-smoke
ACCESS_ALLOWED_EMAILS=leoklemet.pa@gmail.com
```

Backend is ✅ **DEPLOYED AND HEALTHY** - This is NOT a backend issue.

## Problem Analysis

### What We Know:
1. ✅ Service token IS in the policy Include rules
2. ✅ Application path matches (`/api/admin*`)
3. ✅ Backend is deployed with correct configuration
4. ❌ Cloudflare returns 400 Bad Request on `/cdn-cgi/access/authorized`
5. ❌ Cloudflare returns HTML login page instead of validating token

### Possible Root Causes:

#### 1. **Token Name Mismatch**
- The service token in CF dashboard might have a different name
- Check: Does the token name in `Service Auth → Service Tokens` EXACTLY match?
- Case-sensitive, no extra spaces

#### 2. **Token Expired or Inactive**
- Service tokens have a duration setting
- Check: Is the token still valid (not expired)?
- Check: Is the token enabled/active?

#### 3. **Wrong Client ID/Secret**
- The credentials might not match the actual token
- Action: Regenerate the service token and get fresh credentials

#### 4. **Policy Logic Issue**
- Multiple Include rules might be combined with AND instead of OR
- Exclude rules might be blocking the service token
- Check: Policy configuration logic

#### 5. **Application AUD Mismatch**
- The CF Access application might have a different AUD value
- The token might be for a different application
- Check: Application settings → Application Audience (AUD) tag

#### 6. **Cloudflare Access Free Tier Limitation**
- Service tokens might require a paid Cloudflare Zero Trust plan
- Check: Your CF Zero Trust plan level

## Recommended Actions

### Immediate Steps:

1. **Verify Service Token Exists and is Active**
   ```
   CF Dashboard → Zero Trust → Access → Service Auth → Service Tokens

   Check:
   - Name: portfolio-admin-smoke (exact match)
   - Status: Active (not expired)
   - Duration: Valid expiration date
   ```

2. **Regenerate Service Token**
   ```
   1. Delete existing "portfolio-admin-smoke" token
   2. Create new token with same name
   3. Copy NEW Client ID and Client Secret
   4. Update test script with new credentials
   5. Test again
   ```

3. **Verify Application AUD Tag**
   ```
   CF Dashboard → Zero Trust → Access → Applications → assistant.ledger-mind.org

   Click application → Check "Application Audience (AUD) tag"
   Should match: f34cb2b8f9a670c4f4df57f5c90b2cf45f31e27c1ec3ce83b5f75e2ce774f35c
   ```

4. **Check Policy Logic**
   ```
   In the Policy Include section:
   - Is there only ONE Include rule (Service Auth)?
   - Or multiple rules with AND/OR?
   - Are there any Exclude rules?

   Correct configuration:
   Include:
     - Service Auth: portfolio-admin-smoke
     OR
     - Email: leoklemet.pa@gmail.com
   ```

5. **Test with Email Authentication**
   ```
   Browser test: Visit https://assistant.ledger-mind.org/api/admin/whoami
   - Should redirect to login
   - Login with leoklemet.pa@gmail.com
   - Should see: {"ok": true, "principal": "leoklemet.pa@gmail.com"}

   This confirms backend works with email auth.
   ```

### Debugging Commands

```powershell
# Test service token with CF headers
$env:CF_ACCESS_CLIENT_ID = "<CLIENT_ID>"
$env:CF_ACCESS_CLIENT_SECRET = "<CLIENT_SECRET>"

# Test CF's auth endpoint
Invoke-WebRequest -Uri "https://assistant.ledger-mind.org/cdn-cgi/access/authorized" `
  -Headers @{
    "CF-Access-Client-Id"=$env:CF_ACCESS_CLIENT_ID
    "CF-Access-Client-Secret"=$env:CF_ACCESS_CLIENT_SECRET
  } `
  -SkipCertificateCheck -UseBasicParsing -MaximumRedirection 0

# Expected: 204 No Content (authenticated)
# Getting: 400 Bad Request (token invalid/not recognized)
```

## Next Steps

**CRITICAL:** We need to determine if this is a:
1. **Configuration issue** - Token exists but policy/settings wrong
2. **Credential issue** - Wrong Client ID/Secret
3. **Plan limitation** - CF free tier doesn't support service tokens
4. **Bug/timing issue** - Changes not propagated yet

**Action:** Please check the Cloudflare dashboard items above and report back what you see.

---

## Resources

- [Cloudflare Service Tokens Docs](https://developers.cloudflare.com/cloudflare-one/identity/service-tokens/)
- [CF Access Policy Configuration](https://developers.cloudflare.com/cloudflare-one/policies/access/)
- [Service Token Testing Guide](https://developers.cloudflare.com/cloudflare-one/identity/service-tokens/#test-your-service-token)
