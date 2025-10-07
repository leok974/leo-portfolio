#!/usr/bin/env pwsh
# Quick production deployment for service token support
# This script helps deploy backend changes to your production server

param(
    [switch]$Help
)

$ErrorActionPreference = "Stop"

if ($Help) {
    Write-Host @"
Quick Production Deployment - Service Token Support

USAGE:
  ./quick-deploy-backend.ps1

This script will:
1. Guide you through SSH connection setup
2. Help pull latest code
3. Rebuild and restart backend
4. Test service token authentication

REQUIREMENTS:
- SSH access to your production server
- Docker Compose on production server
- Project deployed at /opt/leo-portfolio (or similar)

"@
    exit 0
}

Write-Host "`n🚀 Production Backend Deployment" -ForegroundColor Cyan
Write-Host ("=" * 70) -ForegroundColor Cyan

# Step 1: Get server details
Write-Host "`n📋 Server Configuration" -ForegroundColor Yellow
Write-Host "We need your production server details:" -ForegroundColor White
Write-Host ""

$Server = Read-Host "Enter server hostname or IP (e.g., your-server.com or 123.45.67.89)"
if ([string]::IsNullOrWhiteSpace($Server)) {
    Write-Host "❌ Server hostname is required" -ForegroundColor Red
    exit 1
}

$SshUser = Read-Host "Enter SSH username (default: root)"
if ([string]::IsNullOrWhiteSpace($SshUser)) {
    $SshUser = "root"
}

$DeployPath = Read-Host "Enter deployment path (default: /opt/leo-portfolio)"
if ([string]::IsNullOrWhiteSpace($DeployPath)) {
    $DeployPath = "/opt/leo-portfolio"
}

Write-Host "`n✓ Configuration:" -ForegroundColor Green
Write-Host "  Server: $Server" -ForegroundColor White
Write-Host "  User: $SshUser" -ForegroundColor White
Write-Host "  Path: $DeployPath" -ForegroundColor White

# Step 2: Test SSH connection
Write-Host "`n🔐 Testing SSH connection..." -ForegroundColor Yellow
$testCmd = "exit 0"
try {
    ssh "$SshUser@$Server" $testCmd 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "SSH connection failed"
    }
    Write-Host "✓ SSH connection successful" -ForegroundColor Green
} catch {
    Write-Host "❌ Cannot connect to server" -ForegroundColor Red
    Write-Host "Please ensure:" -ForegroundColor Yellow
    Write-Host "  1. Server is accessible" -ForegroundColor White
    Write-Host "  2. SSH key is configured" -ForegroundColor White
    Write-Host "  3. User has proper permissions" -ForegroundColor White
    Write-Host "`nTo set up SSH key:" -ForegroundColor Yellow
    Write-Host "  ssh-copy-id $SshUser@$Server" -ForegroundColor White
    exit 1
}

# Step 3: Check if project exists
Write-Host "`n📂 Checking project directory..." -ForegroundColor Yellow
$checkPath = "test -d $DeployPath && echo 'exists' || echo 'missing'"
$pathCheck = ssh "$SshUser@$Server" $checkPath 2>&1

if ($pathCheck -like "*missing*") {
    Write-Host "❌ Project directory not found: $DeployPath" -ForegroundColor Red
    Write-Host "Please deploy the project first or specify correct path" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ Project directory found" -ForegroundColor Green

# Step 4: Pull latest code
Write-Host "`n📥 Pulling latest code..." -ForegroundColor Yellow
$pullCmd = "cd $DeployPath && git fetch && git pull origin polish 2>&1"
$pullResult = ssh "$SshUser@$Server" $pullCmd

Write-Host $pullResult -ForegroundColor Gray

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to pull code" -ForegroundColor Red
    Write-Host "You may need to:" -ForegroundColor Yellow
    Write-Host "  1. SSH to server manually: ssh $SshUser@$Server" -ForegroundColor White
    Write-Host "  2. Navigate to project: cd $DeployPath" -ForegroundColor White
    Write-Host "  3. Check git status: git status" -ForegroundColor White
    Write-Host "  4. Pull manually: git pull origin polish" -ForegroundColor White
    exit 1
}
Write-Host "✓ Code updated" -ForegroundColor Green

# Step 5: Rebuild backend
Write-Host "`n🔨 Rebuilding backend..." -ForegroundColor Yellow
Write-Host "This may take 2-3 minutes..." -ForegroundColor Gray

$buildCmd = "cd $DeployPath/deploy && docker compose build backend 2>&1"
Write-Host "Running: docker compose build backend" -ForegroundColor Gray

$buildResult = ssh "$SshUser@$Server" $buildCmd

# Show last few lines of output
$buildLines = $buildResult -split "`n"
$buildLines | Select-Object -Last 10 | ForEach-Object { Write-Host $_ -ForegroundColor Gray }

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    Write-Host "Check the output above for errors" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ Backend built successfully" -ForegroundColor Green

# Step 6: Restart backend
Write-Host "`n🔄 Restarting backend..." -ForegroundColor Yellow
$restartCmd = "cd $DeployPath/deploy && docker compose up -d backend 2>&1"
$restartResult = ssh "$SshUser@$Server" $restartCmd

Write-Host $restartResult -ForegroundColor Gray

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Restart may have issues" -ForegroundColor Yellow
} else {
    Write-Host "✓ Backend restarted" -ForegroundColor Green
}

# Step 7: Wait for health check
Write-Host "`n⏳ Waiting for backend to be ready (30 seconds)..." -ForegroundColor Yellow
for ($i = 30; $i -gt 0; $i--) {
    Write-Host -NoNewline "`r  $i seconds remaining... "
    Start-Sleep -Seconds 1
}
Write-Host "`r  ✓ Wait complete                  " -ForegroundColor Green

# Step 8: Test readiness
Write-Host "`n🏥 Checking backend health..." -ForegroundColor Yellow
try {
    $readyTest = Invoke-WebRequest -Uri "https://assistant.ledger-mind.org/ready" -UseBasicParsing -SkipCertificateCheck -TimeoutSec 10
    if ($readyTest.StatusCode -eq 200) {
        Write-Host "✓ Backend is healthy" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Backend may still be starting up" -ForegroundColor Yellow
    Write-Host "Wait another 30 seconds and try testing manually" -ForegroundColor Gray
}

# Step 9: Test service token
Write-Host "`n🔐 Testing service token authentication..." -ForegroundColor Yellow

if (-not $env:CF_ACCESS_CLIENT_ID -or -not $env:CF_ACCESS_CLIENT_SECRET) {
    Write-Host "⚠️  Service token credentials not set in environment" -ForegroundColor Yellow
    Write-Host "`nTo test service token, run:" -ForegroundColor White
    Write-Host '  $env:CF_ACCESS_CLIENT_ID = "bcf632e4a22f6a8007d47039038904b7.access"' -ForegroundColor Gray
    Write-Host '  $env:CF_ACCESS_CLIENT_SECRET = "ed3822142602d252acc657dc1922e2647224f394ecfd7dab683f31b72ffee35a"' -ForegroundColor Gray
    Write-Host "  .\test-service-token.ps1" -ForegroundColor Gray
} else {
    Write-Host "Running service token test..." -ForegroundColor Gray
    & .\test-service-token.ps1
}

# Summary
Write-Host "`n" -NoNewline
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host "✅ DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host ("=" * 70) -ForegroundColor Cyan

Write-Host "`nNEXT STEPS:" -ForegroundColor Yellow
Write-Host "  1. Test service token authentication:" -ForegroundColor White
Write-Host '     $env:CF_ACCESS_CLIENT_ID = "bcf632e4a22f6a8007d47039038904b7.access"' -ForegroundColor Gray
Write-Host '     $env:CF_ACCESS_CLIENT_SECRET = "ed3822142602d252acc657dc1922e2647224f394ecfd7dab683f31b72ffee35a"' -ForegroundColor Gray
Write-Host "     .\test-service-token.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Set up GitHub Actions secrets:" -ForegroundColor White
Write-Host "     https://github.com/leok974/leo-portfolio/settings/secrets/actions" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Create automated upload workflow" -ForegroundColor White
Write-Host "     See: docs/CF_ACCESS_SERVICE_TOKENS.md" -ForegroundColor Gray
Write-Host ""

Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host ""
