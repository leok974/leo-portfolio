#!/usr/bin/env pwsh
# Check if Docker is running, then run E2E tests

Write-Host "🔍 Checking Docker status..." -ForegroundColor Cyan

try {
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Docker is not running or not installed" -ForegroundColor Red
        Write-Host "Please start Docker Desktop and try again" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker check failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🚀 Starting E2E tests with Docker stack..." -ForegroundColor Cyan
Write-Host ""

# Run the e2e:local script
npm run e2e:local

exit $LASTEXITCODE
