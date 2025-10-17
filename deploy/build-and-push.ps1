#!/usr/bin/env pwsh
# Build and Push Portfolio Docker Image to GHCR
# Usage: .\deploy\build-and-push.ps1 [-Tag prod-abc123] [-NoPush] [-Latest]

param(
    [Parameter(Mandatory=$false)]
    [string]$Tag = "prod-$(git rev-parse --short HEAD 2>$null)",

    [Parameter(Mandatory=$false)]
    [string]$Registry = "ghcr.io",

    [Parameter(Mandatory=$false)]
    [string]$Organization = "leok974",

    [Parameter(Mandatory=$false)]
    [string]$Repository = "leo-portfolio",

    [Parameter(Mandatory=$false)]
    [switch]$NoPush,

    [Parameter(Mandatory=$false)]
    [switch]$SkipLatest
)

$ErrorActionPreference = "Stop"

# Default: tag latest unless SkipLatest is set
$TagLatest = -not $SkipLatest

Write-Host ""
Write-Host "🐳 Portfolio Docker Build & Push" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Construct image name
$IMAGE = "$Registry/$Organization/$Repository/portfolio"

Write-Host "📦 Configuration:" -ForegroundColor Cyan
Write-Host "  Registry: $Registry" -ForegroundColor White
Write-Host "  Organization: $Organization" -ForegroundColor White
Write-Host "  Repository: $Repository" -ForegroundColor White
Write-Host "  Image: $IMAGE" -ForegroundColor White
Write-Host "  Tag: $Tag" -ForegroundColor White
Write-Host "  Also tag 'latest': $(-not $SkipLatest)" -ForegroundColor White
Write-Host ""

# Step 1: Verify we're in repo root
if (-not (Test-Path "package.json")) {
    Write-Error "❌ Must run from repository root (package.json not found)"
    exit 1
}
Write-Host "✅ Repository root verified" -ForegroundColor Green

# Step 2: Check if Dockerfile exists
if (-not (Test-Path "Dockerfile.portfolio")) {
    Write-Error "❌ Dockerfile.portfolio not found"
    exit 1
}
Write-Host "✅ Dockerfile found" -ForegroundColor Green

# Step 3: Check Docker is running
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Error "❌ Docker is not running or not accessible"
    exit 1
}

# Step 4: Build the image
Write-Host ""
Write-Host "🏗️  Building Docker image..." -ForegroundColor Yellow
Write-Host "  Command: docker build -f Dockerfile.portfolio -t ${IMAGE}:${Tag} ." -ForegroundColor Gray
Write-Host ""

docker build -f Dockerfile.portfolio -t "${IMAGE}:${Tag}" .
if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Docker build failed"
    exit 1
}

Write-Host ""
Write-Host "✅ Image built successfully: ${IMAGE}:${Tag}" -ForegroundColor Green

# Step 5: Tag as 'latest' if requested
if (-not $SkipLatest) {
    Write-Host ""
    Write-Host "🏷️  Tagging as 'latest'..." -ForegroundColor Yellow
    docker tag "${IMAGE}:${Tag}" "${IMAGE}:latest"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "❌ Failed to tag as latest"
        exit 1
    }
    Write-Host "✅ Tagged as ${IMAGE}:latest" -ForegroundColor Green
}

# Step 6: Show image info
Write-Host ""
Write-Host "📊 Image Information:" -ForegroundColor Cyan
docker images --filter "reference=${IMAGE}" --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

# Step 7: Push (if not disabled)
if ($NoPush) {
    Write-Host ""
    Write-Host "⏩ Skipping push (NoPush flag set)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To push manually:" -ForegroundColor Cyan
    Write-Host "  docker login $Registry -u <username>" -ForegroundColor Gray
    Write-Host "  docker push ${IMAGE}:${Tag}" -ForegroundColor Gray
    if (-not $SkipLatest) {
        Write-Host "  docker push ${IMAGE}:latest" -ForegroundColor Gray
    }
} else {
    Write-Host ""
    Write-Host "🔐 Logging into $Registry..." -ForegroundColor Yellow
    Write-Host "  (Use GitHub username and PAT with packages:write scope)" -ForegroundColor Gray

    # Check if already logged in
    $needLogin = $false
    try {
        docker pull "${IMAGE}:latest" 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            $needLogin = $true
        }
    } catch {
        $needLogin = $true
    }

    if ($needLogin) {
        Write-Host "  Please login when prompted..." -ForegroundColor Gray
        docker login $Registry
        if ($LASTEXITCODE -ne 0) {
            Write-Error "❌ Docker login failed"
            exit 1
        }
    } else {
        Write-Host "  ✅ Already logged in" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "📤 Pushing image..." -ForegroundColor Yellow
    Write-Host "  Pushing ${IMAGE}:${Tag}..." -ForegroundColor Gray
    docker push "${IMAGE}:${Tag}"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "❌ Failed to push ${IMAGE}:${Tag}"
        exit 1
    }
    Write-Host "  ✅ Pushed ${IMAGE}:${Tag}" -ForegroundColor Green

    if (-not $SkipLatest) {
        Write-Host "  Pushing ${IMAGE}:latest..." -ForegroundColor Gray
        docker push "${IMAGE}:latest"
        if ($LASTEXITCODE -ne 0) {
            Write-Error "❌ Failed to push ${IMAGE}:latest"
            exit 1
        }
        Write-Host "  ✅ Pushed ${IMAGE}:latest" -ForegroundColor Green
    }
}

# Step 8: Summary
Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "✅ BUILD & PUSH COMPLETE!" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""
Write-Host "📦 Images:" -ForegroundColor Cyan
Write-Host "  ${IMAGE}:${Tag}" -ForegroundColor Green
if (-not $SkipLatest) {
    Write-Host "  ${IMAGE}:latest" -ForegroundColor Green
}
Write-Host ""

if (-not $NoPush) {
    Write-Host "🚀 Deploy on Server:" -ForegroundColor Cyan
    Write-Host "  1. Pull image:" -ForegroundColor White
    Write-Host "     docker pull ${IMAGE}:latest" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  2. Update compose and restart:" -ForegroundColor White
    Write-Host "     docker compose pull portfolio" -ForegroundColor Gray
    Write-Host "     docker compose up -d portfolio" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  3. Or use Watchtower for auto-updates:" -ForegroundColor White
    Write-Host "     Watchtower will auto-pull :latest and restart" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "📖 See: DEPLOY_IMAGE.md for full deployment guide" -ForegroundColor Cyan
Write-Host ""
