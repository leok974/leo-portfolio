#!/usr/bin/env pwsh
# Deploy portfolio to production server
# Usage: .\deploy-to-server.ps1 -ServerHost <hostname-or-ip>

param(
    [Parameter(Mandatory=$true)]
    [string]$ServerHost,

    [Parameter(Mandatory=$false)]
    [string]$ServerUser = "root",

    [Parameter(Mandatory=$false)]
    [int]$ServerPort = 22
)

Write-Host "🚀 Deploying portfolio to $ServerHost..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Ensure infra_net exists
Write-Host "📡 Step 1/5: Checking network..." -ForegroundColor Yellow
$networkCmd = "docker network ls | grep -q infra_net || docker network create infra_net"
ssh -p $ServerPort "$ServerUser@$ServerHost" $networkCmd
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to create/verify network" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Network ready" -ForegroundColor Green
Write-Host ""

# Step 2: Create directory and download compose
Write-Host "📥 Step 2/5: Downloading compose file..." -ForegroundColor Yellow
$setupCmd = "mkdir -p ~/leo-portfolio && cd ~/leo-portfolio && curl -fsSLO https://raw.githubusercontent.com/leok974/leo-portfolio/portfolio-polish/deploy/docker-compose.portfolio-ui.yml"
ssh -p $ServerPort "$ServerUser@$ServerHost" $setupCmd
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to download compose file" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Compose file downloaded" -ForegroundColor Green
Write-Host ""

# Step 3: Start containers
Write-Host "🐳 Step 3/5: Starting containers..." -ForegroundColor Yellow
$startCmd = "cd ~/leo-portfolio && docker compose -f docker-compose.portfolio-ui.yml up -d"
ssh -p $ServerPort "$ServerUser@$ServerHost" $startCmd
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start containers" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Containers started" -ForegroundColor Green
Write-Host ""

# Step 4: Verify containers
Write-Host "🔍 Step 4/5: Verifying deployment..." -ForegroundColor Yellow
$verifyCmd = "docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep -E 'portfolio-ui|watchtower'"
Write-Host ""
ssh -p $ServerPort "$ServerUser@$ServerHost" $verifyCmd
Write-Host ""

# Step 5: Test nginx routing
Write-Host "🌐 Step 5/5: Testing nginx routing..." -ForegroundColor Yellow
$nginxTestCmd = "docker exec applylens-nginx-prod curl -sI http://portfolio-ui | head -5"
ssh -p $ServerPort "$ServerUser@$ServerHost" $nginxTestCmd
Write-Host ""

# Check hash
Write-Host "🔎 Checking deployed hash..." -ForegroundColor Yellow
$hashCmd = "docker exec applylens-nginx-prod curl -s http://portfolio-ui/ | grep -oE 'main-[A-Za-z0-9_-]+\.js' | head -1"
$deployedHash = ssh -p $ServerPort "$ServerUser@$ServerHost" $hashCmd
Write-Host "Deployed hash: $deployedHash" -ForegroundColor Cyan
Write-Host ""

Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Check live site: curl -s https://leoklemet.com/ | grep -oE 'main-[A-Za-z0-9_-]+\.js'"
Write-Host "2. If old hash, purge Cloudflare cache (see DEPLOY_LEOKLEMET_NOW.md)"
Write-Host "3. Verify: https://leoklemet.com/"
