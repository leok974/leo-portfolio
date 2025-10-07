# Service Token Test - Checklist

## Your Configuration

**Service Token Credentials:**
- Client ID: `bcf632e4a22f6a8007d47039038904b7.access`
- Client Secret: `ed3822142602d252acc657dc1922e2647224f394ecfd7dab683f31b72ffee35a`

**Backend Configuration (.env):**
```bash
ACCESS_ALLOWED_SERVICE_SUBS=portfolio-admin-smoke
```

## Required Steps

### 1. ✅ Create Service Token in Cloudflare Dashboard
- Go to: https://one.dash.cloudflare.com/
- Navigate to: **Access** → **Service Auth** → **Service Tokens**
- Token created with credentials above

**❓ IMPORTANT: What is the NAME of this service token?**
- The name must match what's in `ACCESS_ALLOWED_SERVICE_SUBS`
- Cloudflare puts the token NAME in the JWT `sub` claim
- If the token name is NOT "portfolio-admin-smoke", update `.env`:
  ```bash
  ACCESS_ALLOWED_SERVICE_SUBS=<your-actual-token-name>
  ```

### 2. ❓ Add Service Token to Application Policy
- Go to: **Access** → **Applications** → Find "Assistant API"
- Click **Edit** → **Policies** tab
- Check if there's a policy that includes:
  - **Selector:** Service Auth
  - **Value:** Your service token name

**If not added:**
1. Edit your existing policy OR create new policy
2. Under **Include**, add:
   - Selector: **Service Auth**
   - Value: Select your service token
3. Save policy

### 3. ❓ Deploy Backend with Service Token Config
```bash
# Ensure this is in production environment
ACCESS_ALLOWED_SERVICE_SUBS=portfolio-admin-smoke
```

**Check deployment:**
- Is the backend deployed to production?
- Does production have the updated .env?
- Has the backend been restarted after adding the config?

### 4. ⚠️ SSL Certificate Issue
Current error:
```
curl: (35) schannel: next InitializeSecurityContext failed: CRYPT_E_NO_REVOCATION_CHECK
```

**Workarounds:**
```powershell
# Option 1: Skip SSL verification (testing only!)
curl -k -H "CF-Access-Client-Id: $env:CF_ACCESS_CLIENT_ID" `
     -H "CF-Access-Client-Secret: $env:CF_ACCESS_CLIENT_SECRET" `
     https://assistant.ledger-mind.org/api/admin/whoami

# Option 2: Use Invoke-WebRequest with SkipCertificateCheck
Invoke-WebRequest -Uri "https://assistant.ledger-mind.org/api/admin/whoami" `
  -Headers @{
    "CF-Access-Client-Id" = $env:CF_ACCESS_CLIENT_ID
    "CF-Access-Client-Secret" = $env:CF_ACCESS_CLIENT_SECRET
  } `
  -SkipCertificateCheck

# Option 3: Fix certificate store (proper solution)
# Update Windows certificates or check if antivirus is interfering
```

## Testing Flow

### Expected Flow:
1. **Client** sends request with `CF-Access-Client-Id` and `CF-Access-Client-Secret` headers
2. **Cloudflare** validates service token credentials
3. **Cloudflare** injects `Cf-Access-Jwt-Assertion` header with signed JWT
4. **Backend** extracts `sub` claim from JWT (contains token name)
5. **Backend** checks if `sub` is in `ACCESS_ALLOWED_SERVICE_SUBS`
6. **Backend** returns `{"ok": true, "principal": "portfolio-admin-smoke"}`

### Common Issues:

**403 Forbidden (Not allowed - service):**
- Token name doesn't match `ACCESS_ALLOWED_SERVICE_SUBS`
- Fix: Update `.env` with actual token name

**403 Forbidden (Cloudflare Access required):**
- Request not going through Cloudflare
- Service token not added to application policy
- Fix: Add token to CF Access policy

**401 Invalid Access token:**
- JWT signature verification failed
- Wrong `CF_ACCESS_TEAM_DOMAIN` or `CF_ACCESS_AUD`
- Fix: Verify backend configuration matches CF dashboard

**SSL/TLS Error:**
- Certificate revocation check failing
- Fix: Use `-k` flag for testing or fix certificate store

## Next Steps

1. **Verify token name** in Cloudflare dashboard
2. **Update .env** if token name differs from "portfolio-admin-smoke"
3. **Add token to CF Access policy** if not already added
4. **Deploy backend** with updated configuration
5. **Test with SSL workaround:**
   ```powershell
   curl -k -H "CF-Access-Client-Id: $env:CF_ACCESS_CLIENT_ID" `
        -H "CF-Access-Client-Secret: $env:CF_ACCESS_CLIENT_SECRET" `
        https://assistant.ledger-mind.org/api/admin/whoami
   ```

## Verification Commands

```powershell
# 1. Check if credentials are set
Write-Host "Client ID: $($env:CF_ACCESS_CLIENT_ID.Substring(0,20))..."
Write-Host "Secret: $($env:CF_ACCESS_CLIENT_SECRET.Substring(0,20))..."

# 2. Check backend configuration
Get-Content .env | Select-String "ACCESS_ALLOWED"

# 3. Test whoami (skip SSL check)
curl -k -H "CF-Access-Client-Id: $env:CF_ACCESS_CLIENT_ID" `
     -H "CF-Access-Client-Secret: $env:CF_ACCESS_CLIENT_SECRET" `
     https://assistant.ledger-mind.org/api/admin/whoami

# 4. Expected response:
# {"ok":true,"principal":"portfolio-admin-smoke"}
```

## Questions to Answer

1. ❓ What is the exact NAME of your service token in Cloudflare dashboard?
2. ❓ Has the token been added to the application policy?
3. ❓ Is the production backend deployed with `ACCESS_ALLOWED_SERVICE_SUBS`?
4. ❓ Can you test with `-k` flag to bypass SSL check?
