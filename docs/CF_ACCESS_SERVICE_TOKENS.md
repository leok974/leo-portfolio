# Cloudflare Access Service Tokens - Setup Guide

## Overview

Service tokens enable **non-interactive authentication** for automated workflows (CI/CD, scripts, bots) without requiring SSO login. Cloudflare injects the JWT automatically when you provide `CF-Access-Client-Id` and `CF-Access-Client-Secret` headers.

## Benefits

✅ **No interactive login** - Perfect for automation
✅ **No OTP prompts** - Works in headless environments
✅ **Separate credentials** - Different from user SSO
✅ **Revocable** - Disable tokens without affecting user access
✅ **Auditable** - Track service vs user access separately

## Creating a Service Token

### 1. Create Token in Cloudflare Dashboard

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. Navigate to **Access** → **Service Auth** → **Service Tokens**
3. Click **Create Service Token**
4. **Name:** `portfolio-admin-smoke` (or your preferred name)
5. Click **Generate token**
6. **Copy credentials immediately** (secret shown only once!):
   - Client ID: `1234567890abcdef.access`
   - Client Secret: `abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890`

### 2. Add Token to Application Policy

1. Navigate to **Access** → **Applications**
2. Find your application (e.g., "Assistant API")
3. Click **Edit**
4. Go to **Policies** tab
5. Edit your policy or create a new one
6. Under **Include**, add:
   - **Selector:** Service Auth
   - **Value:** Select your service token (`portfolio-admin-smoke`)
7. Save policy

### 3. Configure Backend

Add to your `.env` or production environment:

```bash
# Existing config
CF_ACCESS_TEAM_DOMAIN=ledgermind.cloudflareaccess.com
CF_ACCESS_AUD=f34cb2b8f9a670c4f4df57f5c90b2cf45f31e27c1ec3ce83b5f75e2ce774f35c
ACCESS_ALLOWED_EMAILS=leoklemet.pa@gmail.com

# NEW: Allow service token by name (subject claim)
ACCESS_ALLOWED_SERVICE_SUBS=portfolio-admin-smoke
```

**Note:** Cloudflare sets the JWT `sub` claim to the service token's **name** (not the client ID). If you prefer to validate by client ID, adjust the verifier accordingly.

## Usage Examples

### PowerShell

```powershell
# Set credentials (do this once per session)
$env:CF_ACCESS_CLIENT_ID = "1234567890abcdef.access"
$env:CF_ACCESS_CLIENT_SECRET = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"

# Test whoami
curl -H "CF-Access-Client-Id: $env:CF_ACCESS_CLIENT_ID" `
     -H "CF-Access-Client-Secret: $env:CF_ACCESS_CLIENT_SECRET" `
     https://assistant.ledger-mind.org/api/admin/whoami

# Expected: {"ok":true,"principal":"portfolio-admin-smoke"}

# Upload file
curl -X POST `
  -H "CF-Access-Client-Id: $env:CF_ACCESS_CLIENT_ID" `
  -H "CF-Access-Client-Secret: $env:CF_ACCESS_CLIENT_SECRET" `
  -F "file=@image.png" `
  -F "make_card=true" `
  -F "title=My Image" `
  https://assistant.ledger-mind.org/api/admin/uploads

# Add gallery item
$body = @{
  title = "Project Demo"
  type = "youtube"
  src = "dQw4w9WgXcQ"
  description = "Demo video"
} | ConvertTo-Json

curl -X POST `
  -H "CF-Access-Client-Id: $env:CF_ACCESS_CLIENT_ID" `
  -H "CF-Access-Client-Secret: $env:CF_ACCESS_CLIENT_SECRET" `
  -H "Content-Type: application/json" `
  -d $body `
  https://assistant.ledger-mind.org/api/admin/gallery/add
```

### Bash

```bash
# Set credentials
export CF_ACCESS_CLIENT_ID="1234567890abcdef.access"
export CF_ACCESS_CLIENT_SECRET="abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"

# Test whoami
curl -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
     -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
     https://assistant.ledger-mind.org/api/admin/whoami

# Upload file
curl -X POST \
  -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
  -F "file=@image.png" \
  -F "make_card=true" \
  https://assistant.ledger-mind.org/api/admin/uploads
```

### Python

```python
import os
import requests

CLIENT_ID = os.getenv("CF_ACCESS_CLIENT_ID")
CLIENT_SECRET = os.getenv("CF_ACCESS_CLIENT_SECRET")

headers = {
    "CF-Access-Client-Id": CLIENT_ID,
    "CF-Access-Client-Secret": CLIENT_SECRET,
}

# Test whoami
response = requests.get(
    "https://assistant.ledger-mind.org/api/admin/whoami",
    headers=headers
)
print(response.json())  # {"ok": true, "principal": "portfolio-admin-smoke"}

# Upload file
with open("image.png", "rb") as f:
    files = {"file": f}
    data = {"make_card": "true", "title": "My Image"}
    response = requests.post(
        "https://assistant.ledger-mind.org/api/admin/uploads",
        headers=headers,
        files=files,
        data=data
    )
    print(response.json())
```

### GitHub Actions

```yaml
name: Upload Asset
on: workflow_dispatch

jobs:
  upload:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Upload to gallery
        env:
          CF_ACCESS_CLIENT_ID: ${{ secrets.CF_ACCESS_CLIENT_ID }}
          CF_ACCESS_CLIENT_SECRET: ${{ secrets.CF_ACCESS_CLIENT_SECRET }}
        run: |
          curl -X POST \
            -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
            -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
            -F "file=@assets/demo.png" \
            -F "make_card=true" \
            -F "title=Automated Upload" \
            https://assistant.ledger-mind.org/api/admin/uploads
```

## How It Works

1. **Client sends headers:**
   ```
   CF-Access-Client-Id: <client-id>
   CF-Access-Client-Secret: <client-secret>
   ```

2. **Cloudflare validates credentials:**
   - Checks service token is valid
   - Checks token is allowed by application policy
   - Injects `Cf-Access-Jwt-Assertion` header with signed JWT

3. **Backend verifies JWT:**
   - Validates signature using JWKS
   - Extracts `sub` claim (contains token name)
   - Checks if `sub` is in `ACCESS_ALLOWED_SERVICE_SUBS`

4. **Request succeeds:**
   - Returns principal (e.g., "portfolio-admin-smoke")

## Security Best Practices

### 1. Store Credentials Securely

**❌ Don't:**
```bash
# Hardcoded in scripts
curl -H "CF-Access-Client-Id: 1234567890abcdef.access" ...
```

**✅ Do:**
```bash
# Environment variables
export CF_ACCESS_CLIENT_ID="..."
curl -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" ...

# Or use secret manager
aws secretsmanager get-secret-value --secret-id cf-access-token
```

### 2. Rotate Regularly

- Generate new service tokens every 90 days
- Update `ACCESS_ALLOWED_SERVICE_SUBS` when rotating
- Revoke old tokens after rotation

### 3. Use Separate Tokens per Purpose

```bash
# Good: Separate tokens for different workflows
ACCESS_ALLOWED_SERVICE_SUBS=ci-upload,admin-scripts,monitoring-bot

# Bad: One token for everything
ACCESS_ALLOWED_SERVICE_SUBS=admin-token
```

### 4. Monitor Usage

- Check Cloudflare Access logs for service token usage
- Alert on unexpected access patterns
- Revoke tokens if compromised

## Troubleshooting

### 403 Forbidden (Not allowed - service)

**Cause:** Service token name not in `ACCESS_ALLOWED_SERVICE_SUBS`

**Fix:**
1. Check token name in Cloudflare dashboard
2. Add to backend config: `ACCESS_ALLOWED_SERVICE_SUBS=your-token-name`
3. Restart backend

### 403 Forbidden (Cloudflare Access required)

**Cause:** Cloudflare not injecting JWT (request not going through CF)

**Fix:**
- Ensure request goes to public hostname (not localhost)
- Check application policy includes the service token

### 401 Invalid Access token

**Cause:** JWT signature verification failed

**Fix:**
- Verify `CF_ACCESS_TEAM_DOMAIN` matches your team
- Check `CF_ACCESS_AUD` matches application AUD
- Ensure backend can reach `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`

## Comparison: User SSO vs Service Token

| Feature | User SSO | Service Token |
|---------|----------|---------------|
| **Interactive login** | ✅ Required | ❌ Not needed |
| **OTP/2FA** | ✅ Supported | ❌ N/A |
| **Browser required** | ✅ Yes | ❌ No |
| **CI/CD friendly** | ❌ No | ✅ Yes |
| **Credential format** | Email + password/SSO | Client ID + Secret |
| **JWT claim** | `email` | `sub` |
| **Audit trail** | User identity | Token name |
| **Revocation** | Disable user | Revoke token |

## Migration from User SSO

If you have existing scripts using `cloudflared access token`:

**Before (User SSO):**
```powershell
cloudflared access login https://assistant.ledger-mind.org/api/admin
$token = cloudflared access token --app https://assistant.ledger-mind.org/api/admin
curl -H "Cf-Access-Jwt-Assertion: $token" https://assistant.ledger-mind.org/api/admin/whoami
```

**After (Service Token):**
```powershell
$env:CF_ACCESS_CLIENT_ID = "<client-id>"
$env:CF_ACCESS_CLIENT_SECRET = "<client-secret>"
curl -H "CF-Access-Client-Id: $env:CF_ACCESS_CLIENT_ID" `
     -H "CF-Access-Client-Secret: $env:CF_ACCESS_CLIENT_SECRET" `
     https://assistant.ledger-mind.org/api/admin/whoami
```

**Both work!** User SSO and service tokens can coexist. Choose based on use case:
- **User SSO:** Manual operations, debugging, local development
- **Service Token:** Automation, CI/CD, scheduled jobs

## References

- **Cloudflare Docs:** [Service Tokens](https://developers.cloudflare.com/cloudflare-one/identity/service-tokens/)
- **Backend Implementation:** `assistant_api/utils/cf_access.py`
- **Test Script:** `test-production.ps1`
- **Command Reference:** `CLOUDFLARE_ACCESS_COMMANDS.md`
