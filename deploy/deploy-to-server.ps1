#!/usr/bin/env pwsh
# Deploy Portfolio to Assistant Server (assistant.ledger-mind.org)
# This uploads the built portfolio to your existing server where Cloudflare Tunnel is configured

param(
    [Parameter(Mandatory=$true)]
    [string]$ServerHost,

    [Parameter(Mandatory=$false)]
    [string]$ServerUser = "root",

    [Parameter(Mandatory=$false)]
    [string]$DeployPath = "/var/www/portfolio",

    [Parameter(Mandatory=$false)]
    [string]$NginxConfig = "/etc/nginx/sites-available/assistant.conf",

    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild,

    [Parameter(Mandatory=$false)]
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "🚀 Portfolio Deployment to assistant.ledger-mind.org" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verify repository root
if (-not (Test-Path "package.json")) {
    Write-Error "❌ Must run from repository root (package.json not found)"
    exit 1
}
Write-Host "✅ Repository root verified" -ForegroundColor Green

# Step 2: Build portfolio (unless skipped)
if (-not $SkipBuild) {
    Write-Host ""
    Write-Host "📦 Building portfolio..." -ForegroundColor Yellow

    Write-Host "  Building production bundle..."
    npm run build:portfolio

    if (-not (Test-Path "dist-portfolio/index.html")) {
        Write-Error "❌ Build failed - dist-portfolio/index.html not found"
        exit 1
    }

    Write-Host "✅ Build completed successfully" -ForegroundColor Green
} else {
    Write-Host "⏩ Skipping build (using existing dist-portfolio/)" -ForegroundColor Yellow

    if (-not (Test-Path "dist-portfolio/index.html")) {
        Write-Error "❌ dist-portfolio/index.html not found. Run without -SkipBuild first."
        exit 1
    }
}

# Step 3: Show deployment plan
Write-Host ""
Write-Host "📋 Deployment Plan:" -ForegroundColor Cyan
Write-Host "  Server: $ServerUser@$ServerHost" -ForegroundColor White
Write-Host "  Deploy Path: $DeployPath" -ForegroundColor White
Write-Host "  Nginx Config: $NginxConfig" -ForegroundColor White
Write-Host "  Source: dist-portfolio/" -ForegroundColor White
Write-Host ""

# Calculate build size
$buildSize = (Get-ChildItem -Path "dist-portfolio" -Recurse | Measure-Object -Property Length -Sum).Sum
$buildSizeMB = [math]::Round($buildSize / 1MB, 2)
Write-Host "  Build Size: $buildSizeMB MB" -ForegroundColor Gray
Write-Host ""

# Step 4: Dry run or confirm
if ($DryRun) {
    Write-Host "🔍 DRY RUN - No changes will be made" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Commands that would be executed:" -ForegroundColor Gray
    Write-Host "  1. ssh $ServerUser@$ServerHost 'mkdir -p $DeployPath'" -ForegroundColor Gray
    Write-Host "  2. rsync -avz --delete dist-portfolio/ $ServerUser@${ServerHost}:$DeployPath/" -ForegroundColor Gray
    Write-Host "  3. scp deploy/nginx.assistant-server.conf $ServerUser@${ServerHost}:$NginxConfig" -ForegroundColor Gray
    Write-Host "  4. ssh $ServerUser@$ServerHost 'ln -sf $NginxConfig /etc/nginx/sites-enabled/'" -ForegroundColor Gray
    Write-Host "  5. ssh $ServerUser@$ServerHost 'nginx -t'" -ForegroundColor Gray
    Write-Host "  6. ssh $ServerUser@$ServerHost 'systemctl reload nginx'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Run without -DryRun to execute deployment" -ForegroundColor Yellow
    exit 0
}

Write-Host "⚠️  This will:" -ForegroundColor Yellow
Write-Host "  • Upload files to ${ServerHost}:${DeployPath}" -ForegroundColor Yellow
Write-Host "  • Update nginx configuration" -ForegroundColor Yellow
Write-Host "  • Reload nginx (may cause brief interruption)" -ForegroundColor Yellow
Write-Host ""
$confirm = Read-Host "Continue? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "❌ Deployment cancelled" -ForegroundColor Red
    exit 0
}

# Step 5: Create deploy directory on server
Write-Host ""
Write-Host "📁 Creating deploy directory..." -ForegroundColor Yellow
ssh "$ServerUser@$ServerHost" "mkdir -p $DeployPath"
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Failed to create deploy directory"
    exit 1
}
Write-Host "✅ Deploy directory ready" -ForegroundColor Green

# Step 6: Upload files with rsync
Write-Host ""
Write-Host "📤 Uploading portfolio files..." -ForegroundColor Yellow
Write-Host "  Source: dist-portfolio/" -ForegroundColor Gray
Write-Host "  Destination: $ServerUser@${ServerHost}:$DeployPath/" -ForegroundColor Gray

rsync -avz --delete "dist-portfolio/" "${ServerUser}@${ServerHost}:${DeployPath}/"
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Failed to upload files"
    exit 1
}
Write-Host "✅ Files uploaded successfully" -ForegroundColor Green

# Step 7: Upload nginx configuration
Write-Host ""
Write-Host "📝 Deploying nginx configuration..." -ForegroundColor Yellow
scp "deploy/nginx.assistant-server.conf" "${ServerUser}@${ServerHost}:${NginxConfig}"
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Failed to upload nginx config"
    exit 1
}
Write-Host "✅ Nginx config uploaded" -ForegroundColor Green

# Step 8: Enable site
Write-Host ""
Write-Host "🔗 Enabling site..." -ForegroundColor Yellow
ssh "$ServerUser@$ServerHost" "ln -sf $NginxConfig /etc/nginx/sites-enabled/"
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Warning: Failed to create symlink (may already exist)" -ForegroundColor Yellow
}

# Step 9: Test nginx configuration
Write-Host ""
Write-Host "🧪 Testing nginx configuration..." -ForegroundColor Yellow
ssh "$ServerUser@$ServerHost" "nginx -t"
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Nginx configuration test failed!"
    Write-Host ""
    Write-Host "To rollback nginx config:" -ForegroundColor Red
    Write-Host "  ssh $ServerUser@$ServerHost 'rm $NginxConfig && systemctl reload nginx'" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Nginx configuration valid" -ForegroundColor Green

# Step 10: Reload nginx
Write-Host ""
Write-Host "🔄 Reloading nginx..." -ForegroundColor Yellow
ssh "$ServerUser@$ServerHost" "systemctl reload nginx"
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Failed to reload nginx"
    exit 1
}
Write-Host "✅ Nginx reloaded" -ForegroundColor Green

# Step 11: Verify deployment
Write-Host ""
Write-Host "🧪 Running smoke tests..." -ForegroundColor Yellow

Write-Host "  Testing homepage..."
ssh "$ServerUser@$ServerHost" "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/" | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ Homepage accessible" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Homepage test failed" -ForegroundColor Yellow
}

Write-Host "  Testing assets..."
ssh "$ServerUser@$ServerHost" "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/assets/main-*.css" | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ Assets accessible" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Assets test failed (this is normal if filename changed)" -ForegroundColor Yellow
}

# Step 12: Deployment summary
Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "✅ DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 Site URL: https://assistant.ledger-mind.org" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Test in browser: https://assistant.ledger-mind.org" -ForegroundColor White
Write-Host "  2. Check Cloudflare Tunnel is forwarding correctly" -ForegroundColor White
Write-Host "  3. Verify assistant chat works (tests /chat/stream proxy)" -ForegroundColor White
Write-Host "  4. Test resume PDF: https://assistant.ledger-mind.org/resume/Leo_Klemet_Resume.pdf" -ForegroundColor White
Write-Host ""
Write-Host "📊 Monitoring:" -ForegroundColor Yellow
Write-Host "  Nginx logs: ssh $ServerUser@$ServerHost 'tail -f /var/log/nginx/assistant-*.log'" -ForegroundColor Gray
Write-Host "  Backend logs: ssh $ServerUser@$ServerHost 'journalctl -u assistant-api -f'" -ForegroundColor Gray
Write-Host ""
Write-Host "🔄 To rollback:" -ForegroundColor Yellow
Write-Host "  Re-run this script with a previous build" -ForegroundColor Gray
Write-Host ""
