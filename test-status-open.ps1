# Test script for status open endpoint
# Sets ALLOW_DEV_ROUTES=1 and runs backend, then tests endpoints

Write-Host "🚀 Starting backend with ALLOW_DEV_ROUTES=1..." -ForegroundColor Cyan

# Set environment variable
$env:ALLOW_DEV_ROUTES = "1"

# Start backend in background
$job = Start-Job -ScriptBlock {
    param($envVar)
    $env:ALLOW_DEV_ROUTES = $envVar
    Set-Location "D:\leo-portfolio"
    uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001
} -ArgumentList "1"

Write-Host "⏳ Waiting for backend to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Test metadata endpoint
Write-Host "`n📋 Testing metadata endpoint..." -ForegroundColor Cyan
curl -s "http://127.0.0.1:8001/agent/status/open?path=/index.html" | jq

# Test raw endpoint
Write-Host "`n📄 Testing raw endpoint (first 200 chars)..." -ForegroundColor Cyan
$raw = curl -s "http://127.0.0.1:8001/agent/status/open?path=/index.html&raw=1"
$raw.Substring(0, [Math]::Min(200, $raw.Length))

Write-Host "`n✅ Tests complete. Stopping backend..." -ForegroundColor Green
Stop-Job $job
Remove-Job $job
