# Service Token Test Results - Oct 7, 2025

## 🎉 MAJOR BREAKTHROUGH

### Status: 401 Unauthorized (Previously: HTML login page)

We've made **significant progress**! Cloudflare is now recognizing the service token and forwarding JWTs to the backend.

## What Changed

| Before | After |
|--------|-------|
| Status: 200 | Status: 401 |
| Content: HTML login page | Content: Error response |
| Meaning: CF not recognizing token | Meaning: CF forwarding JWT, backend rejecting |

## Current Flow

```
Client → Cloudflare Edge
         ✅ Validates service token
         ✅ Generates JWT with claims
         ✅ Injects Cf-Access-Jwt-Assertion header
         ↓
      Backend
         ✅ Receives JWT
         ❌ Rejects JWT (401)
```

## Next Step: Debug JWT Claims

We need to see what's in the JWT to understand why it's being rejected.

### Add Debug Logging

Edit `assistant_api/utils/cf_access.py` around line 75:

```python
def require_cf_access(request: Request) -> str:
    token = request.headers.get("Cf-Access-Jwt-Assertion")
    if not token:
        raise HTTPException(403, "Cloudflare Access required")

    # DEBUG: Log JWT claims without verification
    try:
        import logging
        logger = logging.getLogger(__name__)
        unverified = jwt.decode(token, options={"verify_signature": False})
        logger.info(f"JWT claims: sub={unverified.get('sub')}, aud={unverified.get('aud')}, iss={unverified.get('iss')}")
    except Exception as e:
        logger.warning(f"Could not decode JWT: {e}")

    # Continue with normal validation...
    unverified_header = jwt.get_unverified_header(token)
    # ... rest of code
```

Then rebuild and test:
```powershell
docker compose build backend
docker compose up -d
Start-Sleep -Seconds 20
.\test-service-token-local.ps1
docker compose logs backend --tail 30
```

This will show exactly what Cloudflare is sending and why the backend is rejecting it.

## Possible Issues

1. **Token name mismatch**: CF token might not be named exactly `portfolio-admin-smoke`
2. **AUD mismatch**: JWT `aud` claim might not match backend's `CF_ACCESS_AUD`
3. **Signature validation**: Backend might not be able to verify CF's JWT signature
4. **Environment variable**: `ACCESS_ALLOWED_SERVICE_SUBS` might not include the token name

## Test Command

```powershell
$env:CF_ACCESS_CLIENT_ID = "bcf632e4a22f6a8007d47039038904b7.access"
$env:CF_ACCESS_CLIENT_SECRET = "1532e93c9599937c3155af61945d2c814168c6a5fa809f554d6e3257289268b6"

Invoke-WebRequest -Uri "https://assistant.ledger-mind.org/api/admin/whoami" `
  -Headers @{
    "CF-Access-Client-Id"=$env:CF_ACCESS_CLIENT_ID
    "CF-Access-Client-Secret"=$env:CF_ACCESS_CLIENT_SECRET
  }
```

## Expected Result (when working)

```json
{
  "ok": true,
  "principal": "portfolio-admin-smoke"
}
```
