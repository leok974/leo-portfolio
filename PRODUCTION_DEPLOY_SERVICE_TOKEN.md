# ✅ Service Token Authentication Working - Deploy Required

## Test Results

**Service Token Test:** ✅ **WORKING!**

```powershell
# Test command
Invoke-WebRequest -Uri "https://assistant.ledger-mind.org/api/admin/whoami" `
  -Headers @{
    "CF-Access-Client-Id"=$env:CF_ACCESS_CLIENT_ID
    "CF-Access-Client-Secret"=$env:CF_ACCESS_CLIENT_SECRET
  }

# Result: 404 Not Found (NOT login page!)
```

**Analysis:**
- ✅ Service token credentials valid
- ✅ Service token added to CF Access policy
- ✅ Cloudflare injecting JWT (no login redirect)
- ❌ Production backend missing `/api/admin/*` endpoints

**Comparison:**
- **Before:** Returned HTML login page (401/403)
- **After:** Returns 404 Not Found
- **Meaning:** Authentication working, endpoint missing

## What's Missing

**Production backend is running OLD version:**
- Has: `/ready`, `/chat`, `/api/rag/query`
- Missing: `/api/admin/*` endpoints (uploads, gallery, whoami)

**Local backend HAS the admin router:**
```python
# assistant_api/main.py (line 115-116)
from assistant_api.routers import admin
app.include_router(admin.router)
```

## Deploy to Production

### Option 1: Docker Compose (Recommended)

```bash
# SSH to production server
ssh user@your-server

# Navigate to project
cd /path/to/leo-portfolio

# Pull latest code
git pull origin polish

# Update environment variables
nano assistant_api/.env
# Add: ACCESS_ALLOWED_SERVICE_SUBS=portfolio-admin-smoke

# Rebuild and restart
docker-compose down
docker-compose build assistant-api
docker-compose up -d

# Wait 30 seconds
sleep 30

# Verify
curl -H "CF-Access-Client-Id: bcf632e4a22f6a8007d47039038904b7.access" \
     -H "CF-Access-Client-Secret: ed3822142602d252acc657dc1922e2647224f394ecfd7dab683f31b72ffee35a" \
     https://assistant.ledger-mind.org/api/admin/whoami
```

### Option 2: Manual Deploy

```bash
# Pull latest code
git pull origin polish

# Update .env
echo "ACCESS_ALLOWED_SERVICE_SUBS=portfolio-admin-smoke" >> assistant_api/.env

# Restart backend service
systemctl restart assistant-api
# OR
pm2 restart assistant-api
# OR
pkill -f "uvicorn assistant_api.main:app"
uvicorn assistant_api.main:app --host 0.0.0.0 --port 8001 &
```

## Verify After Deploy

### 1. Test Whoami Endpoint
```powershell
$env:CF_ACCESS_CLIENT_ID = "bcf632e4a22f6a8007d47039038904b7.access"
$env:CF_ACCESS_CLIENT_SECRET = "ed3822142602d252acc657dc1922e2647224f394ecfd7dab683f31b72ffee35a"

.\test-service-token.ps1
```

**Expected:**
```json
{
  "ok": true,
  "principal": "portfolio-admin-smoke"
}
```

### 2. Test Full Admin API
```powershell
# Test uploads endpoint (should return 405 Method Not Allowed)
curl -X GET -H "CF-Access-Client-Id: $env:CF_ACCESS_CLIENT_ID" `
     -H "CF-Access-Client-Secret: $env:CF_ACCESS_CLIENT_SECRET" `
     https://assistant.ledger-mind.org/api/admin/uploads

# Expected: 405 (GET not allowed, need POST)
```

### 3. Test Gallery Endpoint
```powershell
# Test gallery endpoint (should return 405 Method Not Allowed)
curl -X GET -H "CF-Access-Client-Id: $env:CF_ACCESS_CLIENT_ID" `
     -H "CF-Access-Client-Secret: $env:CF_ACCESS_CLIENT_SECRET" `
     https://assistant.ledger-mind.org/api/admin/gallery

# Expected: 405 (GET not allowed, need POST)
```

## Production Environment Variables

Ensure these are set in production `.env`:

```bash
# Cloudflare Access (existing)
CF_ACCESS_TEAM_DOMAIN=ledgermind.cloudflareaccess.com
CF_ACCESS_AUD=f34cb2b8f9a670c4f4df57f5c90b2cf45f31e27c1ec3ce83b5f75e2ce774f35c
ACCESS_ALLOWED_EMAILS=leoklemet.pa@gmail.com

# Service Token (NEW - add this)
ACCESS_ALLOWED_SERVICE_SUBS=portfolio-admin-smoke
```

## Next Steps

1. **Deploy latest code to production** (with admin router)
2. **Add `ACCESS_ALLOWED_SERVICE_SUBS` to production .env**
3. **Restart production backend**
4. **Test service token authentication**
5. **Set up CI/CD pipeline** to use service token for automated uploads

## CI/CD Integration

Once deployed, you can use service tokens in GitHub Actions:

```yaml
# .github/workflows/upload-gallery.yml
name: Upload Gallery Item

on:
  workflow_dispatch:
    inputs:
      title:
        required: true
      image_path:
        required: true

jobs:
  upload:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Upload to Gallery
        env:
          CF_ACCESS_CLIENT_ID: ${{ secrets.CF_ACCESS_CLIENT_ID }}
          CF_ACCESS_CLIENT_SECRET: ${{ secrets.CF_ACCESS_CLIENT_SECRET }}
        run: |
          curl -X POST \
            -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
            -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
            -F "image=@${{ inputs.image_path }}" \
            -F "title=${{ inputs.title }}" \
            https://assistant.ledger-mind.org/api/admin/uploads
```

## Summary

**Current Status:**
- ✅ Service token created in Cloudflare
- ✅ Service token added to CF Access policy
- ✅ Service token authentication WORKING
- ✅ Backend code has admin router
- ✅ Local backend configured
- ❌ Production backend running old version

**Action Required:**
1. Deploy latest code to production
2. Add `ACCESS_ALLOWED_SERVICE_SUBS` to production .env
3. Restart production backend
4. Test with `.\test-service-token.ps1`

**After deployment:**
- Non-interactive authentication for CI/CD ✅
- Automated gallery uploads ✅
- GitHub Actions integration ✅
- No human intervention required ✅
