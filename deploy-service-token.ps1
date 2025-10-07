#!/usr/bin/env pwsh
# Quick deployment script for service token support
# This commits the changes and provides deployment instructions

param(
    [switch]$CommitOnly,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

if ($Help) {
    Write-Host @"
Deploy Service Token Support

USAGE:
  ./deploy-service-token.ps1           # Interactive deployment
  ./deploy-service-token.ps1 -CommitOnly  # Just commit, don't deploy

WHAT THIS DOES:
1. Commits Cloudflare Access service token configuration
2. Pushes to GitHub
3. Provides production deployment instructions

"@
    exit 0
}

Write-Host "`n🔐 Service Token Deployment" -ForegroundColor Cyan
Write-Host "=" * 60

# Step 1: Check git status
Write-Host "`n📋 Checking changes..." -ForegroundColor Yellow
$status = git status --porcelain

if (-not $status) {
    Write-Host "✅ No changes to commit" -ForegroundColor Green
} else {
    Write-Host "`nChanges to commit:" -ForegroundColor Cyan
    git status --short

    # Step 2: Stage files
    Write-Host "`n📝 Staging files..." -ForegroundColor Yellow
    git add assistant_api/.env.prod
    git add PRODUCTION_DEPLOY_SERVICE_TOKEN.md
    git add SERVICE_TOKEN_FIX_REQUIRED.md
    git add SERVICE_TOKEN_TEST_CHECKLIST.md
    git add SERVICE_TOKEN_IMPLEMENTATION.md
    git add docs/CF_ACCESS_SERVICE_TOKENS.md
    git add test-service-token.ps1
    git add assistant_api/utils/cf_access.py
    git add assistant_api/routers/admin.py
    git add README.md
    git add CHANGELOG.md

    # Step 3: Commit
    Write-Host "`n💾 Committing..." -ForegroundColor Yellow
    $commitMsg = @"
feat: Add Cloudflare Access service token support

- Dual authentication: User SSO + Service tokens
- Non-interactive authentication for CI/CD
- Backend accepts CF-Access-Client-Id/Secret headers
- Admin router supports both email and service token principals
- Production .env.prod configured with ACCESS_ALLOWED_SERVICE_SUBS
- Comprehensive documentation and test scripts

Service token authentication enables:
- Automated gallery uploads from CI/CD pipelines
- GitHub Actions integration
- Scheduled jobs without human intervention
- Bot-based content management

Tested and verified:
✅ Service token created in Cloudflare
✅ Token added to CF Access policy
✅ Authentication working (404 confirms JWT injection)
❌ Production needs redeployment with latest code

Related docs:
- PRODUCTION_DEPLOY_SERVICE_TOKEN.md
- docs/CF_ACCESS_SERVICE_TOKENS.md
- SERVICE_TOKEN_IMPLEMENTATION.md
"@

    git commit -m $commitMsg

    Write-Host "✅ Changes committed" -ForegroundColor Green

    # Step 4: Push
    Write-Host "`n📤 Pushing to GitHub..." -ForegroundColor Yellow
    git push origin polish

    Write-Host "✅ Pushed to origin/polish" -ForegroundColor Green
}

if ($CommitOnly) {
    Write-Host "`n✅ Commit complete (skipping deployment)" -ForegroundColor Green
    exit 0
}

# Step 5: Deployment instructions
Write-Host "`n" + ("=" * 60)
Write-Host "🚀 PRODUCTION DEPLOYMENT REQUIRED" -ForegroundColor Cyan
Write-Host ("=" * 60)

Write-Host @"

The service token authentication is WORKING! ✅
You just need to deploy the latest code to production.

CURRENT STATUS:
  ✅ Service token created in Cloudflare
  ✅ Service token added to CF Access policy
  ✅ Service token authentication working (JWT injection confirmed)
  ✅ Backend code has admin router
  ✅ Production .env.prod configured
  ❌ Production backend running old version (no /api/admin/* endpoints)

DEPLOYMENT OPTIONS:
────────────────────────────────────────────────────────────

Option 1: SSH to Production Server (Recommended)
─────────────────────────────────────────────────

  # SSH to your server
  ssh your-user@your-server

  # Navigate to project directory
  cd /opt/leo-portfolio  # or wherever you deployed

  # Pull latest changes
  git pull origin polish

  # Rebuild backend (picks up new code + .env.prod)
  cd deploy
  docker compose build backend

  # Restart services
  docker compose up -d backend

  # Wait for backend to be ready (30-60 seconds)
  sleep 30

  # Test service token
  curl -H "CF-Access-Client-Id: bcf632e4a22f6a8007d47039038904b7.access" \
       -H "CF-Access-Client-Secret: ed3822142602d252acc657dc1922e2647224f394ecfd7dab683f31b72ffee35a" \
       https://assistant.ledger-mind.org/api/admin/whoami

  # Expected: {"ok":true,"principal":"portfolio-admin-smoke"}

─────────────────────────────────────────────────────────────

Option 2: Use Deploy Script (from local machine)
─────────────────────────────────────────────────

  # Configure your server details
  ./deploy-production.ps1 -Server your-server -SshUser your-user -DeployPath /opt/leo-portfolio

  # Then SSH and rebuild backend
  ssh your-user@your-server "cd /opt/leo-portfolio/deploy && docker compose build backend && docker compose up -d backend"

─────────────────────────────────────────────────────────────

Option 3: Manual Python Deployment (if not using Docker)
─────────────────────────────────────────────────────────

  # SSH to server
  ssh your-user@your-server

  # Navigate to project
  cd /opt/leo-portfolio

  # Pull changes
  git pull origin polish

  # Activate venv and install dependencies
  source venv/bin/activate  # or wherever your venv is
  pip install -r requirements.txt

  # Restart backend service
  systemctl restart assistant-api  # or however you run it
  # OR
  pm2 restart assistant-api
  # OR
  pkill -f uvicorn
  nohup uvicorn assistant_api.main:app --host 0.0.0.0 --port 8001 &

─────────────────────────────────────────────────────────────

VERIFICATION:
─────────────

After deployment, run from your local machine:

  # Test service token authentication
  `$env:CF_ACCESS_CLIENT_ID = "bcf632e4a22f6a8007d47039038904b7.access"
  `$env:CF_ACCESS_CLIENT_SECRET = "ed3822142602d252acc657dc1922e2647224f394ecfd7dab683f31b72ffee35a"

  .\test-service-token.ps1

Expected output:
  ✓ Test 1: GET /api/admin/whoami
    Status: 200
    Response: {"ok":true,"principal":"portfolio-admin-smoke"}

─────────────────────────────────────────────────────────────

NEXT STEPS AFTER DEPLOYMENT:
────────────────────────────

1. Set up GitHub Actions secrets:
   - Go to: https://github.com/leok974/leo-portfolio/settings/secrets/actions
   - Add: CF_ACCESS_CLIENT_ID
   - Add: CF_ACCESS_CLIENT_SECRET

2. Create automated upload workflow (example in docs/CF_ACCESS_SERVICE_TOKENS.md)

3. Test automated gallery uploads

4. Enjoy fully automated portfolio management! 🎉

─────────────────────────────────────────────────────────────

"@ -ForegroundColor White

Write-Host "`n✅ Ready to deploy! Follow the instructions above." -ForegroundColor Green
Write-Host ""
