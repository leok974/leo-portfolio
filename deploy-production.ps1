#!/usr/bin/env pwsh
# Deploy to production: assistant.ledger-mind.org
# This deploys BOTH frontend (SPA) and backend (API)

param(
    [string]$Server = "your-server-hostname",
    [string]$DeployPath = "/opt/leo-portfolio",
    [string]$SshUser = "your-username",
    [switch]$BuildOnly,
    [switch]$SkipBuild,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

if ($Help) {
    Write-Host @"
Deploy to assistant.ledger-mind.org

USAGE:
  ./deploy-production.ps1 -Server your-server -DeployPath /opt/leo-portfolio -SshUser your-user

OPTIONS:
  -Server       SSH hostname or IP of your production server
  -DeployPath   Deployment directory on server (default: /opt/leo-portfolio)
  -SshUser      SSH username (default: your-username)
  -BuildOnly    Build locally but don't deploy
  -SkipBuild    Deploy without rebuilding (use existing dist/)
  -Help         Show this help

EXAMPLES:
  # Full deployment (build + deploy)
  ./deploy-production.ps1 -Server prod.example.com -SshUser deploy -DeployPath /opt/portfolio

  # Just build (for testing)
  ./deploy-production.ps1 -BuildOnly

  # Deploy without rebuilding
  ./deploy-production.ps1 -Server prod.example.com -SkipBuild
"@
    exit 0
}

# ============================================================================
# STEP 1: Build Frontend
# ============================================================================
if (-not $SkipBuild) {
    Write-Host "`n🏗️  Building frontend..." -ForegroundColor Cyan

    if (-not (Test-Path "package.json")) {
        Write-Error "❌ package.json not found. Run from repo root."
        exit 1
    }

    # Build production bundle
    npm run build

    if ($LASTEXITCODE -ne 0) {
        Write-Error "❌ Frontend build failed"
        exit 1
    }

    Write-Host "✅ Frontend built successfully!" -ForegroundColor Green

    # Show bundle stats
    Write-Host "`n📦 Bundle contents:" -ForegroundColor Yellow
    Get-ChildItem -Path dist -Recurse -File |
        Select-Object Name, @{Name="Size (KB)";Expression={[math]::Round($_.Length/1KB, 2)}} |
        Sort-Object "Size (KB)" -Descending |
        Select-Object -First 10 |
        Format-Table -AutoSize
}

if ($BuildOnly) {
    Write-Host "`n✅ Build complete. Skipping deployment." -ForegroundColor Green
    exit 0
}

# ============================================================================
# STEP 2: Deploy to Production Server
# ============================================================================
Write-Host "`n🚀 Deploying to assistant.ledger-mind.org..." -ForegroundColor Cyan

# Validate SSH connection
Write-Host "📡 Testing SSH connection to $Server..." -ForegroundColor Yellow
$testSsh = ssh -o ConnectTimeout=10 -o BatchMode=yes "$SshUser@$Server" "echo ok" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Cannot connect to $Server as $SshUser. Check SSH keys and hostname."
    exit 1
}
Write-Host "✅ SSH connection successful" -ForegroundColor Green

# Create deployment tarball
Write-Host "`n📦 Creating deployment package..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$tarball = "deploy-$timestamp.tar.gz"

# Package frontend dist
tar -czf $tarball -C dist .

if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Failed to create tarball"
    exit 1
}

Write-Host "✅ Package created: $tarball" -ForegroundColor Green

# Upload tarball
Write-Host "`n📤 Uploading to server..." -ForegroundColor Yellow
scp $tarball "$SshUser@${Server}:$DeployPath/"

if ($LASTEXITCODE -ne 0) {
    Remove-Item $tarball -ErrorAction SilentlyContinue
    Write-Error "❌ Upload failed"
    exit 1
}

Write-Host "✅ Upload complete" -ForegroundColor Green

# Clean up local tarball
Remove-Item $tarball

# Deploy on server
Write-Host "`n🔄 Deploying on server..." -ForegroundColor Yellow

$deployCommands = @(
    "cd $DeployPath",
    "echo '📦 Extracting frontend...'",
    "mkdir -p dist-new",
    "tar -xzf $tarball -C dist-new",
    "echo '🔄 Backing up current deployment...'",
    "if [ -d dist ]; then mv dist dist-backup-$timestamp; fi",
    "mv dist-new dist",
    "echo '🐳 Pulling latest backend image...'",
    "cd deploy",
    "docker compose pull backend",
    "echo '🔄 Restarting services...'",
    "docker compose up -d backend nginx",
    "echo '🧹 Cleaning up...'",
    "cd ..",
    "rm -f $tarball",
    "ls -dt dist-backup-* 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true",
    "echo '✅ Deployment complete!'"
)

ssh "$SshUser@$Server" $($deployCommands -join ' && ')

if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Deployment failed on server"
    exit 1
}

# ============================================================================
# STEP 3: Verify Deployment
# ============================================================================
Write-Host "`n🔍 Verifying deployment..." -ForegroundColor Cyan

Start-Sleep -Seconds 3

# Test health endpoints
$healthUrl = "https://assistant.ledger-mind.org/api/ready"
Write-Host "Testing: $healthUrl"

try {
    $response = Invoke-WebRequest -Uri $healthUrl -Method GET -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Backend is ready!" -ForegroundColor Green
    }
} catch {
    Write-Warning "⚠️  Backend health check failed: $_"
}

# Test status endpoint
$statusUrl = "https://assistant.ledger-mind.org/api/status/summary"
Write-Host "Testing: $statusUrl"

try {
    $response = Invoke-RestMethod -Uri $statusUrl -Method GET -TimeoutSec 10
    Write-Host "✅ Status endpoint working!" -ForegroundColor Green
    Write-Host "   Served by: $($response.meta.served_by)" -ForegroundColor Gray
} catch {
    Write-Warning "⚠️  Status check failed: $_"
}

# Test frontend
$frontendUrl = "https://assistant.ledger-mind.org"
Write-Host "Testing: $frontendUrl"

try {
    $response = Invoke-WebRequest -Uri $frontendUrl -Method GET -TimeoutSec 10
    if ($response.StatusCode -eq 200 -and $response.Content -match "<!DOCTYPE html>") {
        Write-Host "✅ Frontend is live!" -ForegroundColor Green
    }
} catch {
    Write-Warning "⚠️  Frontend check failed: $_"
}

# ============================================================================
# Summary
# ============================================================================
Write-Host "`n" + ("="*80) -ForegroundColor Cyan
Write-Host "🎉 DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host ("="*80) -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 Production URL: https://assistant.ledger-mind.org" -ForegroundColor White
Write-Host "📊 Status page:   https://assistant.ledger-mind.org/api/status/summary" -ForegroundColor White
Write-Host "💚 Health check:  https://assistant.ledger-mind.org/api/ready" -ForegroundColor White
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "  1. Test the website in your browser"
Write-Host "  2. Check smooth scrolling (Lenis)"
Write-Host "  3. Verify Lucide icons in CTAs"
Write-Host "  4. Test assistant chat functionality"
Write-Host "  5. Run smoke tests: ./scripts/smoke-public.ps1"
Write-Host ""
Write-Host "📝 View logs:" -ForegroundColor Yellow
Write-Host "  ssh $SshUser@$Server 'cd $DeployPath/deploy && docker compose logs -f --tail=50'"
Write-Host ""
