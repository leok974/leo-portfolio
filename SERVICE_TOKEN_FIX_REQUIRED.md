# ⚠️ Service Token Not Working - Fix Required

## Problem
Service token authentication returns **Cloudflare Access login page** instead of authenticating.

```powershell
# This command returns HTML login page instead of JSON:
Invoke-WebRequest -Uri "https://assistant.ledger-mind.org/api/admin/whoami" `
  -Headers @{
    "CF-Access-Client-Id"=$env:CF_ACCESS_CLIENT_ID
    "CF-Access-Client-Secret"=$env:CF_ACCESS_CLIENT_SECRET
  }
```

## Root Cause
**Service token NOT added to Cloudflare Access application policy!**

Cloudflare checks:
1. Are these valid service token credentials? ✅ YES
2. Is this token authorized for this application? ❌ NO

Result: Redirects to login page instead of injecting JWT.

## Fix Required

### Step 1: Open Cloudflare Dashboard
1. Go to: https://one.dash.cloudflare.com/
2. Select your account
3. Go to: **Zero Trust** → **Access** → **Applications**

### Step 2: Find Your Application
- Look for application covering `assistant.ledger-mind.org`
- Likely named something like:
  - "leo.portfolio"
  - "Assistant API"
  - "Portfolio Backend"
  - Or similar

### Step 3: Edit Application Policy
1. Click **Edit** on the application
2. Go to **Policies** tab
3. You should see existing policy for your email

**Option A: Add to Existing Policy (Recommended)**
1. Click **Edit** on your existing policy
2. Under **Include** section, click **Add include**
3. Select:
   - Selector: **Service Auth**
   - Value: Select your service token from dropdown
4. Click **Save**

**Option B: Create New Policy for Service Token**
1. Click **Add a policy**
2. Name: "Service Token - Admin Access"
3. Action: **Allow**
4. Under **Include**:
   - Selector: **Service Auth**
   - Value: Select your service token
5. Click **Save**

### Step 4: Wait for Propagation
- Changes take **1-2 minutes** to propagate
- Wait before testing again

### Step 5: Test Again
```powershell
# Set credentials if not already set
$env:CF_ACCESS_CLIENT_ID = "bcf632e4a22f6a8007d47039038904b7.access"
$env:CF_ACCESS_CLIENT_SECRET = "ed3822142602d252acc657dc1922e2647224f394ecfd7dab683f31b72ffee35a"

# Test (should now return JSON instead of HTML)
Invoke-WebRequest -Uri "https://assistant.ledger-mind.org/api/admin/whoami" `
  -Headers @{
    "CF-Access-Client-Id"=$env:CF_ACCESS_CLIENT_ID
    "CF-Access-Client-Secret"=$env:CF_ACCESS_CLIENT_SECRET
  } -SkipCertificateCheck -UseBasicParsing | Select-Object -ExpandProperty Content

# Expected: {"ok":true,"principal":"<your-service-token-name>"}
```

## Important: Service Token Name

**❓ What is the NAME of your service token in Cloudflare dashboard?**

After adding to policy, verify token name matches backend configuration:

**Backend expects:** `ACCESS_ALLOWED_SERVICE_SUBS=portfolio-admin-smoke`

**If your token has a different name:**
1. Update `.env`:
   ```bash
   ACCESS_ALLOWED_SERVICE_SUBS=your-actual-token-name
   ```
2. Restart backend:
   ```powershell
   # Stop current backend (Ctrl+C in terminal)
   # Restart
   D:\leo-portfolio\.venv\Scripts\python.exe -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001
   ```

## Verification Steps

After adding service token to policy:

1. **Test whoami endpoint:**
   ```powershell
   .\test-service-token.ps1
   ```

2. **Check response:**
   - ✅ Should return JSON: `{"ok": true, "principal": "..."}`
   - ❌ Should NOT return HTML login page

3. **Verify token name in response:**
   - The `principal` value should match token name in CF dashboard
   - Update `ACCESS_ALLOWED_SERVICE_SUBS` if different

## Summary

**Current Status:**
- Service token created ✅
- Backend configured ✅
- Service token credentials working ✅
- **Service token NOT in application policy** ❌ ← FIX THIS

**After fix:**
- Service tokens can authenticate non-interactively
- CI/CD pipelines can use service tokens
- Automated gallery uploads will work
- GitHub Actions can update portfolio

**Once working, deploy to production:**
1. Update production `.env` with `ACCESS_ALLOWED_SERVICE_SUBS`
2. Restart production backend
3. Test with production URL
