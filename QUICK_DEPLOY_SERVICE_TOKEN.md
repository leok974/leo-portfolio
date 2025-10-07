# 🚀 Production Deployment - Quick Reference

## Current Status
✅ Service token authentication **WORKING**
✅ Code committed and pushed to GitHub
⏳ **Production needs deployment** (5 minutes)

---

## Quick Deploy (Copy & Paste)

### Step 1: SSH to Production
```bash
ssh your-user@your-production-server
```

### Step 2: Update Code
```bash
cd /opt/leo-portfolio  # or your deployment path
git pull origin polish
```

### Step 3: Rebuild Backend
```bash
cd deploy
docker compose build backend
docker compose up -d backend
```

### Step 4: Wait for Health Check
```bash
sleep 30
```

### Step 5: Test Service Token
```bash
curl -H "CF-Access-Client-Id: bcf632e4a22f6a8007d47039038904b7.access" \
     -H "CF-Access-Client-Secret: ed3822142602d252acc657dc1922e2647224f394ecfd7dab683f31b72ffee35a" \
     https://assistant.ledger-mind.org/api/admin/whoami
```

**Expected:** `{"ok":true,"principal":"portfolio-admin-smoke"}`

---

## Verify from Local Machine

```powershell
# Windows PowerShell
$env:CF_ACCESS_CLIENT_ID = "bcf632e4a22f6a8007d47039038904b7.access"
$env:CF_ACCESS_CLIENT_SECRET = "ed3822142602d252acc657dc1922e2647224f394ecfd7dab683f31b72ffee35a"

.\test-service-token.ps1
```

**Expected:**
```
✓ Test 1: GET /api/admin/whoami
  Status: 200
  Response: {"ok":true,"principal":"portfolio-admin-smoke"}
```

---

## If Using Manual Python Deploy (No Docker)

```bash
# SSH to server
ssh your-user@your-server

# Update code
cd /opt/leo-portfolio
git pull origin polish

# Restart backend
systemctl restart assistant-api
# OR
pm2 restart assistant-api
# OR
pkill -f uvicorn && nohup uvicorn assistant_api.main:app --host 0.0.0.0 --port 8001 &
```

---

## What Changed

**New Environment Variables** (already in `.env.prod`):
```bash
CF_ACCESS_TEAM_DOMAIN=ledgermind.cloudflareaccess.com
CF_ACCESS_AUD=f34cb2b8f9a670c4f4df57f5c90b2cf45f31e27c1ec3ce83b5f75e2ce774f35c
ACCESS_ALLOWED_EMAILS=leoklemet.pa@gmail.com
ACCESS_ALLOWED_SERVICE_SUBS=portfolio-admin-smoke
```

**New Endpoints:**
- `/api/admin/whoami` - Returns authenticated principal
- `/api/admin/uploads` - Gallery uploads (POST only)
- `/api/admin/gallery` - Gallery management (POST only)

---

## After Deployment

### 1. Add GitHub Secrets
https://github.com/leok974/leo-portfolio/settings/secrets/actions

- `CF_ACCESS_CLIENT_ID` = `bcf632e4a22f6a8007d47039038904b7.access`
- `CF_ACCESS_CLIENT_SECRET` = `ed3822142602d252acc657dc1922e2647224f394ecfd7dab683f31b72ffee35a`

### 2. Create GitHub Actions Workflow
```yaml
name: Upload Gallery Item
on: workflow_dispatch

jobs:
  upload:
    runs-on: ubuntu-latest
    steps:
      - name: Upload
        run: |
          curl -X POST \
            -H "CF-Access-Client-Id: ${{ secrets.CF_ACCESS_CLIENT_ID }}" \
            -H "CF-Access-Client-Secret: ${{ secrets.CF_ACCESS_CLIENT_SECRET }}" \
            -F "image=@photo.jpg" \
            https://assistant.ledger-mind.org/api/admin/uploads
```

### 3. Test Automated Upload
Go to: Actions → Upload Gallery Item → Run workflow

---

## Documentation

- **Full Guide:** `docs/CF_ACCESS_SERVICE_TOKENS.md`
- **Implementation:** `SERVICE_TOKEN_IMPLEMENTATION.md`
- **Deployment:** `PRODUCTION_DEPLOY_SERVICE_TOKEN.md`
- **Testing:** `SERVICE_TOKEN_TEST_CHECKLIST.md`
- **Summary:** `SERVICE_TOKEN_COMPLETE_SUMMARY.md`

---

## Support

If deployment fails:
1. Check backend logs: `docker compose logs backend`
2. Verify `.env.prod` has CF Access settings
3. Confirm service token in CF Access policy
4. See `SERVICE_TOKEN_TEST_CHECKLIST.md` for troubleshooting

---

**That's it!** 🎉 Deploy and enjoy automated portfolio management!
