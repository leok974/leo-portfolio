#!/usr/bin/env pwsh
# Restore nginx assistant.conf to running nginx container
# Usage: .\restore-nginx-config.ps1

Write-Host "`n📋 Restoring nginx configuration for assistant.ledger-mind.org...`n" -ForegroundColor Cyan

# Check if assistant.conf exists
if (-not (Test-Path "./deploy/nginx.assistant.conf")) {
    Write-Host "❌ Error: deploy/nginx.assistant.conf not found" -ForegroundColor Red
    exit 1
}

# Check if nginx container is running
$nginxRunning = docker ps --filter name=applylens-nginx-prod --format "{{.Names}}"
if (-not $nginxRunning) {
    Write-Host "❌ Error: applylens-nginx-prod container not running" -ForegroundColor Red
    exit 1
}

# Copy config to container
Write-Host "📦 Copying assistant.conf to nginx container..." -ForegroundColor Yellow
docker cp ./deploy/nginx.assistant.conf applylens-nginx-prod:/etc/nginx/conf.d/assistant.conf

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to copy config file" -ForegroundColor Red
    exit 1
}

# Test nginx configuration
Write-Host "🧪 Testing nginx configuration..." -ForegroundColor Yellow
docker exec applylens-nginx-prod nginx -t

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Nginx configuration test failed" -ForegroundColor Red
    exit 1
}

# Reload nginx
Write-Host "🔄 Reloading nginx..." -ForegroundColor Yellow
docker exec applylens-nginx-prod nginx -s reload

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to reload nginx" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Nginx configuration restored successfully!`n" -ForegroundColor Green
Write-Host "Verify: curl.exe --ssl-no-revoke -I https://assistant.ledger-mind.org" -ForegroundColor Cyan
