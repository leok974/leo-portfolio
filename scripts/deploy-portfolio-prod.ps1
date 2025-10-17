#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Deploy portfolio to production at https://assistant.ledger-mind.org

.DESCRIPTION
    Builds portfolio frontend locally and deploys to production server.

.PARAMETER Server
    Production server hostname or IP (default: from environment)

.PARAMETER SshUser
    SSH username (default: current user or from environment)

.PARAMETER DeployPath
    Path on server where project is located (default: /opt/leo-portfolio)

.PARAMETER SkipBuild
    Skip local build step (use existing dist-portfolio/)

.PARAMETER SkipBackup
    Skip creating backup of current deployment

.EXAMPLE
    ./scripts/deploy-portfolio-prod.ps1

.EXAMPLE
    ./scripts/deploy-portfolio-prod.ps1 -Server assistant.ledger-mind.org -SshUser deploy

.EXAMPLE
    ./scripts/deploy-portfolio-prod.ps1 -SkipBuild -DeployPath /home/user/portfolio
#>

param(
    [string]$Server = $env:PROD_SERVER,
    [string]$SshUser = $env:PROD_SSH_USER,
    [string]$DeployPath = "/opt/leo-portfolio",
    [switch]$SkipBuild,
    [switch]$SkipBackup
)

$ErrorActionPreference = "Stop"

# Colors
function Write-Step { Write-Host "▶ " -ForegroundColor Cyan -NoNewline; Write-Host $args }
function Write-Success { Write-Host "✓ " -ForegroundColor Green -NoNewline; Write-Host $args }
function Write-Warning { Write-Host "⚠ " -ForegroundColor Yellow -NoNewline; Write-Host $args }
function Write-Error { Write-Host "✗ " -ForegroundColor Red -NoNewline; Write-Host $args }

Write-Host "`n🚀 Portfolio Production Deployment" -ForegroundColor Magenta
Write-Host "═══════════════════════════════════`n" -ForegroundColor Magenta

# Validate parameters
if (-not $Server) {
    Write-Error "Server not specified. Set `$env:PROD_SERVER or use -Server parameter"
    Write-Host "`nExample: `$env:PROD_SERVER = 'your-server.com'"
    exit 1
}

if (-not $SshUser) {
    $SshUser = $env:USER
    if (-not $SshUser) { $SshUser = $env:USERNAME }
    if (-not $SshUser) {
        Write-Error "SSH user not specified. Set `$env:PROD_SSH_USER or use -SshUser parameter"
        exit 1
    }
}

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Server:      $Server"
Write-Host "  SSH User:    $SshUser"
Write-Host "  Deploy Path: $DeployPath"
Write-Host ""

# Step 1: Build frontend
if (-not $SkipBuild) {
    Write-Step "Building portfolio frontend..."

    if (-not (Test-Path "package.json")) {
        Write-Error "Not in project root directory"
        exit 1
    }

    try {
        npm run build:portfolio
        Write-Success "Portfolio build complete"
    } catch {
        Write-Error "Build failed: $_"
        exit 1
    }

    # Verify build output
    if (-not (Test-Path "dist-portfolio/index.html")) {
        Write-Error "Build output missing: dist-portfolio/index.html not found"
        exit 1
    }

    Write-Success "Build verified: dist-portfolio/index.html exists"
} else {
    Write-Warning "Skipping build (using existing dist-portfolio/)"

    if (-not (Test-Path "dist-portfolio/index.html")) {
        Write-Error "dist-portfolio/index.html not found. Run without -SkipBuild"
        exit 1
    }
}

# Step 2: Test SSH connection
Write-Step "Testing SSH connection to $Server..."

try {
    $testResult = ssh -o ConnectTimeout=10 "$SshUser@$Server" "echo ok" 2>&1
    if ($testResult -ne "ok") {
        Write-Error "SSH test failed: $testResult"
        exit 1
    }
    Write-Success "SSH connection successful"
} catch {
    Write-Error "Cannot connect to $Server: $_"
    Write-Host "`nMake sure:"
    Write-Host "  1. Server is reachable"
    Write-Host "  2. SSH keys are configured"
    Write-Host "  3. User $SshUser has access"
    exit 1
}

# Step 3: Backup current deployment (on server)
if (-not $SkipBackup) {
    Write-Step "Creating backup on server..."

    $backupName = "dist-portfolio-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

    ssh "$SshUser@$Server" @"
cd $DeployPath
if [ -d dist-portfolio ]; then
    cp -r dist-portfolio $backupName
    echo 'Backup created: $backupName'
else
    echo 'No existing dist-portfolio to backup'
fi
"@

    Write-Success "Backup complete (if previous deployment existed)"
} else {
    Write-Warning "Skipping backup"
}

# Step 4: Upload frontend build
Write-Step "Uploading portfolio build to server..."

try {
    # Create remote directory if needed
    ssh "$SshUser@$Server" "mkdir -p $DeployPath/dist-portfolio"

    # Sync dist-portfolio
    Write-Host "  Syncing files..."
    rsync -avz --delete `
        --progress `
        --exclude='.DS_Store' `
        --exclude='*.map' `
        dist-portfolio/ "$SshUser@${Server}:$DeployPath/dist-portfolio/"

    Write-Success "Upload complete"
} catch {
    Write-Error "Upload failed: $_"
    exit 1
}

# Step 5: Verify uploaded files
Write-Step "Verifying uploaded files on server..."

ssh "$SshUser@$Server" @"
cd $DeployPath/dist-portfolio
if [ ! -f index.html ]; then
    echo 'ERROR: index.html not found'
    exit 1
fi
if [ ! -d assets ]; then
    echo 'ERROR: assets/ directory not found'
    exit 1
fi
echo 'Files verified: index.html and assets/ present'
"@

Write-Success "Files verified on server"

# Step 6: Restart services
Write-Step "Restarting portfolio services on server..."

ssh "$SshUser@$Server" @"
cd $DeployPath/deploy

echo 'Pulling latest backend image...'
docker compose pull backend

echo 'Restarting services...'
docker compose -f docker-compose.yml -f docker-compose.portfolio-prod.yml down nginx backend
docker compose -f docker-compose.yml -f docker-compose.portfolio-prod.yml up -d

echo 'Waiting for services to start...'
sleep 10

echo 'Checking health...'
docker compose ps
"@

Write-Success "Services restarted"

# Step 7: Verify deployment
Write-Step "Verifying deployment..."

Start-Sleep -Seconds 5

try {
    # Test local server health
    $healthCheck = ssh "$SshUser@$Server" "curl -s http://localhost/healthz"
    if ($healthCheck -ne "ok") {
        Write-Warning "Health check returned: $healthCheck (expected 'ok')"
    } else {
        Write-Success "Local health check passed"
    }

    # Test public URL
    Write-Host "`n  Testing public URL: https://assistant.ledger-mind.org"

    try {
        $response = Invoke-WebRequest -Uri "https://assistant.ledger-mind.org/healthz" -TimeoutSec 10
        if ($response.Content -match "ok") {
            Write-Success "Public URL health check passed"
        } else {
            Write-Warning "Public URL returned unexpected response"
        }
    } catch {
        Write-Warning "Could not reach public URL (may need Cloudflare Tunnel restart): $_"
    }

} catch {
    Write-Warning "Verification had issues: $_"
}

# Step 8: Summary
Write-Host "`n═══════════════════════════════════" -ForegroundColor Magenta
Write-Host "🎉 Deployment Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════`n" -ForegroundColor Magenta

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Visit: https://assistant.ledger-mind.org"
Write-Host "  2. Test key features (nav, projects, assistant)"
Write-Host "  3. Check browser console for errors"
Write-Host "  4. Verify CSP and security headers"
Write-Host ""

Write-Host "Monitor logs:" -ForegroundColor Yellow
Write-Host "  ssh $SshUser@$Server 'cd $DeployPath/deploy && docker compose logs -f nginx --tail=50'"
Write-Host "  ssh $SshUser@$Server 'cd $DeployPath/deploy && docker compose logs -f backend --tail=50'"
Write-Host ""

Write-Host "Rollback (if needed):" -ForegroundColor Yellow
Write-Host "  ssh $SshUser@$Server 'cd $DeployPath && mv dist-portfolio dist-portfolio-broken && mv $backupName dist-portfolio'"
Write-Host "  ssh $SshUser@$Server 'cd $DeployPath/deploy && docker compose restart nginx'"
Write-Host ""

Write-Success "All done!`n"
