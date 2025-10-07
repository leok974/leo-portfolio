# ⚠️ Cloudflare Access Application Not Configured

## Issue

The authentication failed with:
```
failed to find Access application at https://ledgermind.cloudflareaccess.com
```

This means **you need to create a Cloudflare Access application first**.

## Solution: Create Cloudflare Access Application

### Step 1: Access Cloudflare Zero Trust Dashboard

1. Go to https://one.dash.cloudflare.com/
2. Select your account
3. Navigate to **Zero Trust** (formerly Cloudflare for Teams)

### Step 2: Create Access Application

1. In the left sidebar, click **Access** → **Applications**
2. Click **Add an application**
3. Select **Self-hosted**

### Step 3: Configure Application

Fill in these details:

#### Application Configuration
```
Application name: Assistant API
Session Duration: 24 hours
Application domain: assistant.ledger-mind.org
Path: /api/uploads
      /api/gallery
```

**Note:** Add both paths to protect upload and gallery endpoints.

#### Identity Providers

Make sure you have at least one identity provider enabled:
- Google (recommended for leoklemet.pa@gmail.com)
- Or GitHub, Email OTP, etc.

To enable Google:
1. Go to **Settings** → **Authentication**
2. Enable **Google** if not already enabled

### Step 4: Create Access Policy

1. In the application configuration, under **Add a policy**:

```
Policy name: Allow Specific Users
Action: Allow
Include: Emails
Emails: leoklemet.pa@gmail.com
```

2. Click **Save policy**
3. Click **Save application**

### Step 5: Get Application Details

After creating the application:

1. Click on your **Assistant API** application
2. Go to the **Overview** tab
3. Find and copy the **Application Audience (AUD) Tag**

**Expected AUD (should match your current config):**
```
f34cb2b8f9a670c4f4df57f5c90b2cf45f31e27c1ec3ce83b5f75e2ce774f35c
```

If different, update `.env` file:
```bash
CF_ACCESS_AUD=your-actual-aud-tag
```

### Step 6: Verify Team Domain

1. In Zero Trust dashboard, go to **Settings** → **Custom Pages**
2. Your team domain should be: `ledgermind.cloudflareaccess.com`
3. If different, update `.env` file:
```bash
CF_ACCESS_TEAM_DOMAIN=your-actual-team-domain
```

### Step 7: Test Authentication Again

After creating the application, run:

```powershell
.\cf-access-login.ps1
```

This time it should:
1. Open browser
2. Show Cloudflare Access login
3. Let you sign in with leoklemet.pa@gmail.com
4. Save token successfully

## Alternative: Use Existing AUD from Different Application

If you already have a Cloudflare Access application configured (maybe with a different name or path), you can:

1. Find the existing application in **Access** → **Applications**
2. Get its AUD tag
3. Update `.env` with that AUD
4. Make sure the application includes `/api/uploads` and `/api/gallery` paths

## Checklist

Before authentication will work:

- [ ] Cloudflare Access application created for `assistant.ledger-mind.org`
- [ ] Application includes paths `/api/uploads` and `/api/gallery`
- [ ] Access policy includes email `leoklemet.pa@gmail.com`
- [ ] Google (or another) identity provider enabled
- [ ] AUD tag matches `.env` configuration
- [ ] Team domain matches `.env` configuration

## Next Steps

1. **Create CF Access application** (follow steps above)
2. **Run authentication**: `.\cf-access-login.ps1`
3. **Verify setup**: `.\verify-cf-access.ps1`
4. **Start backend**: `.\start-backend.ps1`

## If You Don't Want to Use Cloudflare Access

If you want to test locally without CF Access, you can temporarily disable it:

### Option 1: Mock the JWT Header (for testing only)

Create a simple test without CF Access verification:

```powershell
# Start backend without CF Access (not secure, only for local testing)
# Remove CF Access dependency from routers temporarily
```

### Option 2: Use the Old Feature Flag System

Revert to the previous feature flag authentication:
- Restore `require_uploads_enabled` instead of `require_cf_access`
- Use `FEATURE_UPLOADS=1` and admin tokens

**Note:** This is not recommended for production. CF Access provides much better security.

## Current Configuration

Your `.env` file expects:
```bash
CF_ACCESS_TEAM_DOMAIN=ledgermind.cloudflareaccess.com
CF_ACCESS_AUD=f34cb2b8f9a670c4f4df57f5c90b2cf45f31e27c1ec3ce83b5f75e2ce774f35c
ACCESS_ALLOWED_EMAILS=leoklemet.pa@gmail.com
```

**Make sure the Cloudflare Access application matches these values.**

## Troubleshooting

### "failed to find Access application"
- CF Access application not created yet → **Create it** (see Step 2 above)
- Application name/domain mismatch → Verify application includes `assistant.ledger-mind.org`

### "AUD doesn't match"
- Get AUD from CF Access application → Update `.env` file

### "Email not authorized"
- Add email to Access policy → Go to application → Edit policy → Add email

## Documentation

- Full setup guide: `docs/CF_ACCESS_QUICKSTART.md`
- Testing guide: `docs/CF_ACCESS_TESTING.md`
- Complete docs: `docs/CF_ACCESS.md`
