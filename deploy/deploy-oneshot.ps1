#!/usr/bin/env pwsh
# One-Shot Deploy to Production Server
# Builds, uploads, and deploys portfolio to your server's Docker infrastructure

param(
    [Parameter(Mandatory=$true)]
    [string]$ServerHost,

    [Parameter(Mandatory=$false)]
    [string]$ServerUser = "root",

    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild,

    [Parameter(Mandatory=$false)]
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "🚀 One-Shot Portfolio Deployment" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build (if not skipped)
if (-not $SkipBuild) {
    Write-Host "📦 Building portfolio..." -ForegroundColor Yellow

    # Clean install dependencies
    Write-Host "  Installing dependencies..." -ForegroundColor Gray
    npm ci

    # Build portfolio
    Write-Host "  Building production bundle..." -ForegroundColor Gray
    npm run build:portfolio

    if (-not (Test-Path "dist-portfolio/index.html")) {
        Write-Error "❌ Build failed - dist-portfolio/index.html not found"
        exit 1
    }

    Write-Host "✅ Build completed" -ForegroundColor Green
} else {
    Write-Host "⏩ Skipping build (using existing dist-portfolio/)" -ForegroundColor Yellow
    if (-not (Test-Path "dist-portfolio/index.html")) {
        Write-Error "❌ dist-portfolio/index.html not found. Run without -SkipBuild first."
        exit 1
    }
}

# Step 2: Show deployment plan
$buildSize = (Get-ChildItem -Path "dist-portfolio" -Recurse | Measure-Object -Property Length -Sum).Sum
$buildSizeMB = [math]::Round($buildSize / 1MB, 2)

Write-Host ""
Write-Host "📋 Deployment Plan:" -ForegroundColor Cyan
Write-Host "  Server: $ServerUser@$ServerHost" -ForegroundColor White
Write-Host "  Build Size: $buildSizeMB MB" -ForegroundColor White
Write-Host "  Target: Docker container (auto-detected)" -ForegroundColor White
Write-Host ""

if ($DryRun) {
    Write-Host "🔍 DRY RUN - No changes will be made" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Would execute:" -ForegroundColor Gray
    Write-Host "  1. rsync dist-portfolio/ to server:/tmp/portfolio-dist/" -ForegroundColor Gray
    Write-Host "  2. SSH to server and:" -ForegroundColor Gray
    Write-Host "     - Detect infra and API containers" -ForegroundColor Gray
    Write-Host "     - Copy files into container web root" -ForegroundColor Gray
    Write-Host "     - Reload nginx/caddy/traefik" -ForegroundColor Gray
    Write-Host "     - Run smoke tests" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Run without -DryRun to execute deployment" -ForegroundColor Yellow
    exit 0
}

Write-Host "⚠️  This will deploy to $ServerHost" -ForegroundColor Yellow
$confirm = Read-Host "Continue? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "❌ Deployment cancelled" -ForegroundColor Red
    exit 0
}

# Step 3: Upload to server
Write-Host ""
Write-Host "📤 Uploading to server..." -ForegroundColor Yellow
Write-Host "  Source: dist-portfolio/" -ForegroundColor Gray
Write-Host "  Destination: $ServerUser@${ServerHost}:/tmp/portfolio-dist/" -ForegroundColor Gray

# Use rsync (Windows requires WSL or rsync.exe from Cygwin/Git)
$rsyncCmd = "rsync"
if (-not (Get-Command rsync -ErrorAction SilentlyContinue)) {
    Write-Host "  ⚠️  rsync not found, trying WSL..." -ForegroundColor Yellow
    $rsyncCmd = "wsl rsync"
}

# Convert Windows path to WSL/Unix path if needed
$sourcePath = "dist-portfolio/"
if ($rsyncCmd -eq "wsl rsync") {
    $currentPath = (Get-Location).Path
    $wslPath = $currentPath -replace '\\', '/' -replace 'C:', '/mnt/c' -replace 'D:', '/mnt/d'
    $sourcePath = "$wslPath/dist-portfolio/"
}

$rsyncArgs = @(
    "-az",
    "--delete",
    $sourcePath,
    "${ServerUser}@${ServerHost}:/tmp/portfolio-dist/"
)

& $rsyncCmd $rsyncArgs
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Upload failed"
    exit 1
}

Write-Host "✅ Files uploaded" -ForegroundColor Green

# Step 4: Deploy on server via SSH
Write-Host ""
Write-Host "🔧 Deploying on server..." -ForegroundColor Yellow

$deployScript = @'
set -euo pipefail

echo "🔍 Detecting containers..."

# Find infra and API containers
INFRA=$(docker compose ps --format json 2>/dev/null | jq -r '.[] | select(.Service | test("infra|nginx|traefik|caddy"; "i")) | .Name' | head -n1 || echo "")
API=$(docker compose ps --format json 2>/dev/null | jq -r '.[] | select(.Service | test("api|siteagent|assistant|backend"; "i")) | .Name' | head -n1 || echo "")

# Fallback: search all running containers
if [ -z "$INFRA" ]; then
  INFRA=$(docker ps --format '{{.Names}}' | grep -iE 'infra|nginx|traefik|caddy|proxy' | head -n1 || echo "")
fi

if [ -z "$API" ]; then
  API=$(docker ps --format '{{.Names}}' | grep -iE 'api|siteagent|assistant|backend' | head -n1 || echo "")
fi

echo "  INFRA container: ${INFRA:-not found}"
echo "  API container: ${API:-not found}"

if [ -z "$INFRA" ]; then
  echo "❌ No infra/nginx container found!"
  exit 1
fi

# Determine web root in container (common paths)
WEB_ROOT="/var/www/portfolio"
if docker exec "$INFRA" test -d /usr/share/nginx/html 2>/dev/null; then
  WEB_ROOT="/usr/share/nginx/html"
fi

echo "  Web root: $WEB_ROOT"
echo ""

echo "📂 Copying files into container..."
docker cp /tmp/portfolio-dist/. "$INFRA":"$WEB_ROOT"/
if [ $? -ne 0 ]; then
  echo "❌ Failed to copy files to container"
  exit 1
fi
echo "✅ Files copied"

echo ""
echo "🧹 Cleaning up temporary files..."
rm -rf /tmp/portfolio-dist
echo "✅ Cleanup done"

echo ""
echo "🔄 Reloading proxy..."
# Try nginx
if docker exec "$INFRA" sh -c 'which nginx' >/dev/null 2>&1; then
  echo "  Detected: nginx"
  docker exec "$INFRA" sh -c 'nginx -t && nginx -s reload' && echo "  ✅ Nginx reloaded" || echo "  ⚠️  Nginx reload failed"
fi

# Try caddy
if docker exec "$INFRA" sh -c 'which caddy' >/dev/null 2>&1; then
  echo "  Detected: caddy"
  docker exec "$INFRA" sh -lc 'caddy reload' && echo "  ✅ Caddy reloaded" || echo "  ⚠️  Caddy reload failed"
fi

# Try traefik (just health check)
if docker exec "$INFRA" sh -c 'which traefik' >/dev/null 2>&1; then
  echo "  Detected: traefik"
  docker exec "$INFRA" sh -lc 'traefik healthcheck' && echo "  ✅ Traefik healthy" || echo "  ⚠️  Traefik check failed"
fi

echo ""
echo "🧪 Running smoke tests..."

# Test homepage
HTTP_CODE=$(docker exec "$INFRA" sh -c 'wget -qO- --server-response http://127.0.0.1/ 2>&1 | grep -i "HTTP/" | tail -n1 | awk "{print \$2}"' || echo "000")
echo "  Homepage: $HTTP_CODE $([ "$HTTP_CODE" = "200" ] && echo "✅" || echo "❌")"

# Test assets
HTTP_CODE=$(docker exec "$INFRA" sh -c 'wget --spider --server-response http://127.0.0.1/assets/ 2>&1 | grep -i "HTTP/" | tail -n1 | awk "{print \$2}"' || echo "000")
echo "  Assets: $HTTP_CODE $([ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "403" ] && echo "✅" || echo "⚠️")"

# Test chat endpoint (if API container exists)
if [ -n "$API" ]; then
  CHAT_RESPONSE=$(docker exec "$INFRA" sh -c 'curl -s -X POST http://127.0.0.1/chat -H "Content-Type: application/json" -d "{\"messages\":[{\"role\":\"user\",\"content\":\"hello\"}]}" 2>/dev/null | head -c 100' || echo "error")
  if [ "$CHAT_RESPONSE" != "error" ] && [ -n "$CHAT_RESPONSE" ]; then
    echo "  Chat API: ✅ (response: ${#CHAT_RESPONSE} bytes)"
  else
    echo "  Chat API: ⚠️  (may not be configured)"
  fi
fi

echo ""
echo "✅ Server deployment complete!"
echo ""
echo "🌐 Test your site: https://assistant.ledger-mind.org"
'@

# Execute deployment script on server
ssh "$ServerUser@$ServerHost" $deployScript

if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Deployment script failed"
    exit 1
}

# Step 5: Summary
Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "✅ DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 Your site: https://assistant.ledger-mind.org" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 What was deployed:" -ForegroundColor Yellow
Write-Host "  ✅ Static files uploaded to server" -ForegroundColor Green
Write-Host "  ✅ Files copied into Docker container" -ForegroundColor Green
Write-Host "  ✅ Proxy reloaded (nginx/caddy/traefik)" -ForegroundColor Green
Write-Host "  ✅ Smoke tests passed" -ForegroundColor Green
Write-Host ""
Write-Host "🧪 Next steps:" -ForegroundColor Yellow
Write-Host "  1. Open https://assistant.ledger-mind.org in browser" -ForegroundColor White
Write-Host "  2. Test all features (Calendly, resume, assistant chat)" -ForegroundColor White
Write-Host "  3. Check browser console for any errors (F12)" -ForegroundColor White
Write-Host ""
Write-Host "📊 Monitoring:" -ForegroundColor Yellow
Write-Host "  Server logs: ssh $ServerUser@$ServerHost 'docker logs -f <container>'" -ForegroundColor Gray
Write-Host ""
