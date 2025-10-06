#!/usr/bin/env pwsh
# Deploy backend to assistant.ledger-mind.org
# This script builds and pushes the backend Docker image

param(
    [string]$Tag = "latest",
    [switch]$SkipTests,
    [switch]$Push
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Building backend Docker image..." -ForegroundColor Cyan

# Build the image
$ImageName = "ghcr.io/leok974/leo-portfolio/backend"
docker buildx build `
    --platform linux/amd64 `
    -f deploy/Dockerfile.backend `
    -t "${ImageName}:${Tag}" `
    -t "${ImageName}:main" `
    .

if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Docker build failed"
    exit 1
}

Write-Host "✅ Build successful!" -ForegroundColor Green

if ($Push) {
    Write-Host "📤 Pushing to GHCR..." -ForegroundColor Cyan
    docker push "${ImageName}:${Tag}"
    docker push "${ImageName}:main"

    if ($LASTEXITCODE -ne 0) {
        Write-Error "❌ Docker push failed"
        exit 1
    }

    Write-Host "✅ Pushed to GHCR!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 Next steps on your server:" -ForegroundColor Yellow
    Write-Host "  1. SSH into assistant.ledger-mind.org"
    Write-Host "  2. cd /path/to/deploy"
    Write-Host "  3. docker compose pull backend"
    Write-Host "  4. docker compose up -d backend"
    Write-Host "  5. curl https://assistant.ledger-mind.org/api/ready"
} else {
    Write-Host ""
    Write-Host "📦 Image built locally. To push to GHCR:" -ForegroundColor Yellow
    Write-Host "  ./deploy-backend.ps1 -Push"
}
