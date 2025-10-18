#!/usr/bin/env pwsh
<#
.SYNOPSIS
Deploy latest portfolio Docker image to production

.DESCRIPTION
Pulls the latest portfolio image from GHCR and restarts the production container.
Includes OG images and latest content from CI/CD build.

.EXAMPLE
.\deploy-portfolio-latest.ps1

.NOTES
Requires:
- Docker installed and running
- Access to ghcr.io/leok974/leo-portfolio/portfolio
- Proper GHCR authentication (gh auth login or docker login ghcr.io)
#>

[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$SkipPull
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Portfolio Production Deployment" -ForegroundColor Cyan
Write-Host ""

# Configuration
$IMAGE = "ghcr.io/leok974/leo-portfolio/portfolio:latest"
$CONTAINER_NAME = "portfolio-frontend"
$PORT = "8082"  # Adjust based on your setup
$SITE_URL = "https://www.leoklemet.com"

# Step 1: Authenticate with GHCR
Write-Host "📦 Checking GHCR authentication..." -ForegroundColor Yellow
if (-not $DryRun) {
    try {
        # Try to pull a manifest to test auth
        docker manifest inspect $IMAGE | Out-Null
        Write-Host "✅ GHCR authentication OK" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ GHCR authentication failed. Running: gh auth login" -ForegroundColor Red
        gh auth login
        docker login ghcr.io -u $env:GITHUB_USER --password-stdin
    }
}

# Step 2: Pull latest image
if (-not $SkipPull) {
    Write-Host ""
    Write-Host "🔄 Pulling latest image: $IMAGE" -ForegroundColor Yellow
    if ($DryRun) {
        Write-Host "[DRY RUN] docker pull $IMAGE" -ForegroundColor Gray
    }
    else {
        docker pull $IMAGE
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Failed to pull image" -ForegroundColor Red
            exit 1
        }
        Write-Host "✅ Image pulled successfully" -ForegroundColor Green
    }
}
else {
    Write-Host "⏭️  Skipping image pull" -ForegroundColor Yellow
}

# Step 3: Stop and remove existing container
Write-Host ""
Write-Host "🛑 Stopping existing container..." -ForegroundColor Yellow
if ($DryRun) {
    Write-Host "[DRY RUN] docker stop $CONTAINER_NAME" -ForegroundColor Gray
    Write-Host "[DRY RUN] docker rm $CONTAINER_NAME" -ForegroundColor Gray
}
else {
    docker stop $CONTAINER_NAME 2>$null
    docker rm $CONTAINER_NAME 2>$null
    Write-Host "✅ Old container removed" -ForegroundColor Green
}

# Step 4: Start new container
Write-Host ""
Write-Host "🚀 Starting new container..." -ForegroundColor Yellow
if ($DryRun) {
    Write-Host "[DRY RUN] docker run -d --name $CONTAINER_NAME -p $PORT:80 $IMAGE" -ForegroundColor Gray
}
else {
    docker run -d `
        --name $CONTAINER_NAME `
        -p "${PORT}:80" `
        --restart unless-stopped `
        --health-cmd="wget --quiet --tries=1 --spider http://localhost:80/ || exit 1" `
        --health-interval=30s `
        --health-timeout=3s `
        --health-retries=3 `
        $IMAGE

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to start container" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Container started: $CONTAINER_NAME" -ForegroundColor Green
}

# Step 5: Wait for health check
Write-Host ""
Write-Host "🏥 Waiting for health check..." -ForegroundColor Yellow
if (-not $DryRun) {
    $maxWait = 30
    $waited = 0
    while ($waited -lt $maxWait) {
        $health = docker inspect --format='{{.State.Health.Status}}' $CONTAINER_NAME 2>$null
        if ($health -eq "healthy") {
            Write-Host "✅ Container is healthy" -ForegroundColor Green
            break
        }
        Write-Host "⏳ Waiting... ($waited/$maxWait seconds)" -ForegroundColor Gray
        Start-Sleep -Seconds 2
        $waited += 2
    }

    if ($waited -ge $maxWait) {
        Write-Host "⚠️  Health check timeout - container may still be starting" -ForegroundColor Yellow
    }
}

# Step 6: Verify deployment
Write-Host ""
Write-Host "🔍 Verifying deployment..." -ForegroundColor Yellow
if (-not $DryRun) {
    # Check container logs
    Write-Host ""
    Write-Host "📋 Recent container logs:" -ForegroundColor Cyan
    docker logs --tail 20 $CONTAINER_NAME

    # Test local endpoint
    Write-Host ""
    Write-Host "🌐 Testing local endpoint..." -ForegroundColor Yellow
    try {
        $response = curl.exe -s -o $null -w "%{http_code}" "http://localhost:$PORT/"
        if ($response -eq "200") {
            Write-Host "✅ Local endpoint responding: http://localhost:$PORT/" -ForegroundColor Green
        }
        else {
            Write-Host "⚠️  Local endpoint returned: $response" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "⚠️  Could not test local endpoint" -ForegroundColor Yellow
    }
}

# Step 7: Summary
Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "✅ Deployment Complete" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""
Write-Host "📦 Image: $IMAGE" -ForegroundColor White
Write-Host "🐳 Container: $CONTAINER_NAME" -ForegroundColor White
Write-Host "🔌 Port: $PORT" -ForegroundColor White
Write-Host "🌐 Local URL: http://localhost:$PORT/" -ForegroundColor White
Write-Host "🌍 Production URL: $SITE_URL" -ForegroundColor White
Write-Host ""

# Step 8: Next steps
Write-Host "📝 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Verify OG images:" -ForegroundColor White
Write-Host "   curl -I $SITE_URL/og/og.png" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Check production site:" -ForegroundColor White
Write-Host "   Start-Process '$SITE_URL'" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Purge Cloudflare cache (if needed):" -ForegroundColor White
Write-Host "   cf-cache-purge.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Monitor logs:" -ForegroundColor White
Write-Host "   docker logs -f $CONTAINER_NAME" -ForegroundColor Gray
Write-Host ""

if ($DryRun) {
    Write-Host ""
    Write-Host "⚠️  DRY RUN MODE - No changes were made" -ForegroundColor Yellow
}
