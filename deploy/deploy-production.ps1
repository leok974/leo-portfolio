#!/usr/bin/env pwsh
# Production Deployment Script for Portfolio
# Usage: ./deploy-production.ps1 [server-host]

param(
    [Parameter(Mandatory=$false)]
    [string]$ServerHost = "your-server-hostname",

    [Parameter(Mandatory=$false)]
    [string]$DeployPath = "/var/www/portfolio",

    [Parameter(Mandatory=$false)]
    [string]$NginxConfig = "/etc/nginx/sites-available/portfolio.conf",

    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild,

    [Parameter(Mandatory=$false)]
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Portfolio Production Deployment" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verify we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Error "Error: Must run from repository root (package.json not found)"
    exit 1
}

Write-Host "✓ Repository root verified" -ForegroundColor Green

# Step 2: Build portfolio (unless skipped)
if (-not $SkipBuild) {
    Write-Host ""
    Write-Host "📦 Building portfolio..." -ForegroundColor Yellow

    # Clean install dependencies
    Write-Host "  Installing dependencies..."
    npm ci

    # Build
    Write-Host "  Building production bundle..."
    npm run build:portfolio

    if (-not (Test-Path "dist-portfolio/index.html")) {
        Write-Error "Error: Build failed - dist-portfolio/index.html not found"
        exit 1
    }

    Write-Host "✓ Build completed successfully" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⏭️  Skipping build (using existing dist-portfolio/)" -ForegroundColor Yellow
}

# Step 3: Create deployment archive
Write-Host ""
Write-Host "📦 Creating deployment archive..." -ForegroundColor Yellow

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$archiveName = "portfolio-$timestamp.tar.gz"

# Use tar (available in Windows 10+)
tar -czf $archiveName -C dist-portfolio .

if (-not (Test-Path $archiveName)) {
    Write-Error "Error: Failed to create archive"
    exit 1
}

$archiveSize = (Get-Item $archiveName).Length / 1KB
Write-Host "✓ Archive created: $archiveName ($([math]::Round($archiveSize, 2)) KB)" -ForegroundColor Green

# Step 4: Display deployment plan
Write-Host ""
Write-Host "📋 Deployment Plan:" -ForegroundColor Cyan
Write-Host "  Server: $ServerHost" -ForegroundColor White
Write-Host "  Deploy Path: $DeployPath" -ForegroundColor White
Write-Host "  Nginx Config: $NginxConfig" -ForegroundColor White
Write-Host "  Archive: $archiveName" -ForegroundColor White

if ($DryRun) {
    Write-Host ""
    Write-Host "🔍 DRY RUN - No changes will be made" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "Commands that would be executed:" -ForegroundColor Yellow
    Write-Host "  1. scp $archiveName ${ServerHost}:/tmp/" -ForegroundColor Gray
    Write-Host "  2. ssh $ServerHost 'sudo mkdir -p $DeployPath'" -ForegroundColor Gray
    Write-Host "  3. ssh $ServerHost 'sudo tar -xzf /tmp/$archiveName -C $DeployPath/'" -ForegroundColor Gray
    Write-Host "  4. scp deploy/nginx.portfolio.conf ${ServerHost}:$NginxConfig" -ForegroundColor Gray
    Write-Host "  5. ssh $ServerHost 'sudo nginx -t'" -ForegroundColor Gray
    Write-Host "  6. ssh $ServerHost 'sudo systemctl reload nginx'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Run without -DryRun to execute deployment" -ForegroundColor Yellow

    # Cleanup
    Remove-Item $archiveName -Force
    exit 0
}

# Step 5: Confirm deployment
Write-Host ""
$confirm = Read-Host "Deploy to $ServerHost? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Deployment cancelled" -ForegroundColor Yellow
    Remove-Item $archiveName -Force
    exit 0
}

# Step 6: Deploy archive to server
Write-Host ""
Write-Host "📤 Uploading archive to server..." -ForegroundColor Yellow

scp $archiveName "${ServerHost}:/tmp/"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Error: Failed to upload archive"
    Remove-Item $archiveName -Force
    exit 1
}

Write-Host "✓ Archive uploaded" -ForegroundColor Green

# Step 7: Backup existing deployment
Write-Host ""
Write-Host "💾 Creating backup of existing deployment..." -ForegroundColor Yellow

ssh $ServerHost "sudo tar -czf /var/backups/portfolio-backup-$timestamp.tar.gz -C $DeployPath . 2>/dev/null || true"
Write-Host "✓ Backup created: /var/backups/portfolio-backup-$timestamp.tar.gz" -ForegroundColor Green

# Step 8: Extract archive on server
Write-Host ""
Write-Host "📂 Extracting archive on server..." -ForegroundColor Yellow

ssh $ServerHost "sudo mkdir -p $DeployPath && sudo tar -xzf /tmp/$archiveName -C $DeployPath/"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Error: Failed to extract archive"
    Write-Host "To rollback: ssh $ServerHost 'sudo tar -xzf /var/backups/portfolio-backup-$timestamp.tar.gz -C $DeployPath/'" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Archive extracted" -ForegroundColor Green

# Step 9: Deploy nginx configuration
Write-Host ""
Write-Host "⚙️  Deploying nginx configuration..." -ForegroundColor Yellow

scp deploy/nginx.portfolio.conf "${ServerHost}:$NginxConfig"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Error: Failed to upload nginx config"
    exit 1
}

Write-Host "✓ Nginx config deployed" -ForegroundColor Green

# Step 10: Test nginx configuration
Write-Host ""
Write-Host "🔍 Testing nginx configuration..." -ForegroundColor Yellow

ssh $ServerHost "sudo nginx -t"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Error: Nginx configuration test failed"
    Write-Host "To rollback config: ssh $ServerHost 'sudo cp $NginxConfig.bak $NginxConfig'" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Nginx configuration valid" -ForegroundColor Green

# Step 11: Reload nginx
Write-Host ""
Write-Host "🔄 Reloading nginx..." -ForegroundColor Yellow

ssh $ServerHost "sudo systemctl reload nginx"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Error: Failed to reload nginx"
    exit 1
}

Write-Host "✓ Nginx reloaded" -ForegroundColor Green

# Step 12: Cleanup
Write-Host ""
Write-Host "🧹 Cleaning up..." -ForegroundColor Yellow

Remove-Item $archiveName -Force
ssh $ServerHost "rm -f /tmp/$archiveName"

Write-Host "✓ Cleanup complete" -ForegroundColor Green

# Step 13: Run smoke tests
Write-Host ""
Write-Host "🧪 Running smoke tests..." -ForegroundColor Yellow

$domain = "https://assistant.ledger-mind.org"

# Test 1: Health check
Write-Host "  Testing health endpoint..."
$healthResponse = Invoke-WebRequest -Uri "$domain/healthz" -UseBasicParsing -ErrorAction SilentlyContinue
if ($healthResponse.StatusCode -eq 200) {
    Write-Host "    ✓ Health check passed" -ForegroundColor Green
} else {
    Write-Host "    ✗ Health check failed (status: $($healthResponse.StatusCode))" -ForegroundColor Red
}

# Test 2: Index page
Write-Host "  Testing index page..."
$indexResponse = Invoke-WebRequest -Uri $domain -UseBasicParsing -ErrorAction SilentlyContinue
if ($indexResponse.StatusCode -eq 200 -and $indexResponse.Content -like "*Leo Klemet*") {
    Write-Host "    ✓ Index page loaded" -ForegroundColor Green
} else {
    Write-Host "    ✗ Index page failed" -ForegroundColor Red
}

# Test 3: Resume PDF
Write-Host "  Testing resume PDF..."
$resumeResponse = Invoke-WebRequest -Uri "$domain/resume/Leo_Klemet_Resume.pdf" -Method Head -UseBasicParsing -ErrorAction SilentlyContinue
if ($resumeResponse.StatusCode -eq 200) {
    Write-Host "    ✓ Resume PDF accessible" -ForegroundColor Green
} else {
    Write-Host "    ✗ Resume PDF not accessible (status: $($resumeResponse.StatusCode))" -ForegroundColor Red
}

# Step 14: Deployment summary
Write-Host ""
Write-Host "✅ Deployment Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Summary:" -ForegroundColor Cyan
Write-Host "  Domain: $domain" -ForegroundColor White
Write-Host "  Timestamp: $timestamp" -ForegroundColor White
Write-Host "  Backup: /var/backups/portfolio-backup-$timestamp.tar.gz" -ForegroundColor White
Write-Host ""
Write-Host "🔗 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Open $domain in browser" -ForegroundColor White
Write-Host "  2. Test assistant chat functionality" -ForegroundColor White
Write-Host "  3. Verify Calendly widget displays correctly" -ForegroundColor White
Write-Host "  4. Test resume download and copy buttons" -ForegroundColor White
Write-Host ""
Write-Host "📜 To rollback:" -ForegroundColor Yellow
Write-Host "  ssh $ServerHost 'sudo tar -xzf /var/backups/portfolio-backup-$timestamp.tar.gz -C $DeployPath/'" -ForegroundColor Gray
Write-Host "  ssh $ServerHost 'sudo systemctl reload nginx'" -ForegroundColor Gray
