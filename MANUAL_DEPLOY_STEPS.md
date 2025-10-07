# Manual Production Deployment Steps

## Your Setup
- **Production URL:** https://assistant.ledger-mind.org
- **Deployment:** Cloudflare Tunnel → Local Docker stack
- **Project Path:** Check where your `deploy` folder is located

## Step 1: Navigate to Project Directory

```powershell
# Find where your project is deployed
# Common locations:
cd D:\leo-portfolio              # If running locally
# OR
cd C:\projects\leo-portfolio     # Alternative path
# OR
cd ~\leo-portfolio              # User directory
```

## Step 2: Pull Latest Code

```powershell
# Make sure you're on polish branch
git status
git checkout polish

# Pull latest changes
git pull origin polish
```

## Step 3: Rebuild Backend

```powershell
# Navigate to deploy directory
cd deploy

# Rebuild backend service
docker compose build backend

# This will take 2-3 minutes
# You'll see: "Building backend", "Successfully built", etc.
```

## Step 4: Restart Backend

```powershell
# Restart the backend service
docker compose up -d backend

# Wait for backend to be ready
Start-Sleep -Seconds 30
```

## Step 5: Check Backend Health

```powershell
# Test if backend is responsive
Invoke-WebRequest -Uri "https://assistant.ledger-mind.org/ready" -UseBasicParsing -SkipCertificateCheck
```

**Expected:** Status code 200, JSON response `{"ok":true,...}`

## Step 6: Test Service Token

```powershell
# Navigate back to project root
cd ..

# Set service token credentials (if not already set)
$env:CF_ACCESS_CLIENT_ID = "bcf632e4a22f6a8007d47039038904b7.access"
$env:CF_ACCESS_CLIENT_SECRET = "ed3822142602d252acc657dc1922e2647224f394ecfd7dab683f31b72ffee35a"

# Run test script
.\test-service-token.ps1
```

**Expected Output:**
```
=== Service Token Authentication Test ===
Testing: https://assistant.ledger-mind.org
✓ Credentials provided

Test 1: GET /api/admin/whoami
  ✓ Status: 200
  Response: {"ok":true,"principal":"portfolio-admin-smoke"}

Test 2: GET /api/admin/uploads (expect 405)
  ✓ Status: 405 (Method Not Allowed - correct!)

Test 3: GET /api/admin/gallery (expect 405)
  ✓ Status: 405 (Method Not Allowed - correct!)

✅ All tests passed!
```

## Troubleshooting

### If Project Not Found
```powershell
# Search for the project
Get-ChildItem -Path C:\ -Filter "leo-portfolio" -Directory -Recurse -Depth 3 -ErrorAction SilentlyContinue | Select-Object FullName
```

### If Backend Won't Start
```powershell
# Check logs
cd deploy
docker compose logs backend --tail=50
```

### If Service Token Returns 404
- The backend is running old code
- Repeat steps 2-4 (pull, rebuild, restart)

### If Service Token Returns Login Page
- Token not added to CF Access policy
- See `SERVICE_TOKEN_FIX_REQUIRED.md`

## Quick Command Summary

```powershell
# All in one (from project root)
git checkout polish && git pull origin polish && cd deploy && docker compose build backend && docker compose up -d backend && Start-Sleep 30 && cd .. && $env:CF_ACCESS_CLIENT_ID="bcf632e4a22f6a8007d47039038904b7.access" && $env:CF_ACCESS_CLIENT_SECRET="ed3822142602d252acc657dc1922e2647224f394ecfd7dab683f31b72ffee35a" && .\test-service-token.ps1
```

## Next Steps After Success

1. **Set up GitHub Actions secrets:**
   - Go to: https://github.com/leok974/leo-portfolio/settings/secrets/actions
   - Add: `CF_ACCESS_CLIENT_ID` = `bcf632e4a22f6a8007d47039038904b7.access`
   - Add: `CF_ACCESS_CLIENT_SECRET` = `ed3822142602d252acc657dc1922e2647224f394ecfd7dab683f31b72ffee35a`

2. **Create automated upload workflow**
   - See: `docs/CF_ACCESS_SERVICE_TOKENS.md` for examples

3. **Test automated uploads**
   - Run GitHub Action to upload gallery items

🎉 **Done!** You now have fully automated portfolio management!
