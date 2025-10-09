# Phase 50.5 Testing Script
# Run this in a NEW PowerShell terminal (not where backend is running)

Write-Host "=== Phase 50.5 Testing Script ===" -ForegroundColor Cyan
Write-Host ""

# Wait for backend to be ready
Write-Host "[1/6] Waiting for backend to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Check backend health
Write-Host "[2/6] Checking backend health..." -ForegroundColor Yellow
try {
    $health = curl.exe http://localhost:8001/ready 2>&1
    Write-Host "✅ Backend is ready: $health" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend is not responding. Make sure it's running on port 8001" -ForegroundColor Red
    exit 1
}

# Enable dev overlay
Write-Host "[3/6] Enabling dev overlay..." -ForegroundColor Yellow
$body = '{"hours":24}'
$secret = 'local-dev-secret-12345'
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)
$hmac = [System.Security.Cryptography.HMACSHA256]::new([System.Text.Encoding]::UTF8.GetBytes($secret))
$signature = 'sha256=' + [System.BitConverter]::ToString($hmac.ComputeHash($bodyBytes)).Replace('-','').ToLower()

$enableResponse = curl.exe -X POST http://localhost:8001/agent/dev/enable `
    -H "Content-Type: application/json" `
    -H "X-SiteAgent-Signature: $signature" `
    -d $body 2>&1

if ($enableResponse -match "ok") {
    Write-Host "✅ Dev overlay enabled" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to enable dev overlay: $enableResponse" -ForegroundColor Red
}

# Verify dev overlay status
Write-Host "[4/6] Verifying dev overlay..." -ForegroundColor Yellow
$status = curl.exe http://localhost:8001/agent/dev/status 2>&1
Write-Host "Status: $status" -ForegroundColor Cyan

# Test SEO tune endpoint
Write-Host "[5/6] Testing SEO tune endpoint (dry run)..." -ForegroundColor Yellow
Write-Host "This may take a few seconds..." -ForegroundColor Gray
$tuneResponse = curl.exe -X POST "http://localhost:8001/agent/seo/tune?dry_run=true" 2>&1

if ($tuneResponse -match '"ok"') {
    Write-Host "✅ SEO tune completed successfully" -ForegroundColor Green

    # Test artifacts endpoints
    Write-Host "[6/6] Testing artifacts endpoints..." -ForegroundColor Yellow

    $diffResponse = curl.exe "http://localhost:8001/agent/seo/artifacts/diff" 2>&1
    if ($diffResponse -match "diff") {
        Write-Host "✅ Diff artifact retrieved" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Diff artifact: $($diffResponse.Substring(0, [Math]::Min(100, $diffResponse.Length)))" -ForegroundColor Yellow
    }

    $logResponse = curl.exe "http://localhost:8001/agent/seo/artifacts/log" 2>&1
    if ($logResponse -match "SEO") {
        Write-Host "✅ Log artifact retrieved" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Log artifact: $($logResponse.Substring(0, [Math]::Min(100, $logResponse.Length)))" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ SEO tune failed: $($tuneResponse.Substring(0, [Math]::Min(200, $tuneResponse.Length)))" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Start frontend preview: npm run preview" -ForegroundColor White
Write-Host "2. Open tools page: http://localhost:5173/tools.html" -ForegroundColor White
Write-Host "3. Click 'Run SEO Tune (Dry Run)' button" -ForegroundColor White
Write-Host "4. Review Before/After preview cards" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to open tools page in browser..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Start-Process "http://localhost:5173/tools.html"
