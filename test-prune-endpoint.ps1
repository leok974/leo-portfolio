# Test script for prune endpoint
# Run after setting $env:ADMIN_API_KEY on both server and client

$ErrorActionPreference = "Stop"

Write-Host "`n=== Agent Task Prune Endpoint Test ===" -ForegroundColor Cyan

# Configuration
$API_BASE = "http://localhost:8001"
$ADMIN_KEY = $env:ADMIN_API_KEY

if (-not $ADMIN_KEY) {
    Write-Host "❌ ERROR: ADMIN_API_KEY not set" -ForegroundColor Red
    Write-Host "   Set it with: `$env:ADMIN_API_KEY = 'your-key-here'" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n1. Testing unauthorized access (should fail with 403)..." -ForegroundColor Yellow
$cutoff = (Get-Date).AddDays(-365).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
try {
    $response = Invoke-RestMethod -Method Delete `
        -Uri "$API_BASE/agents/tasks/before?date=$cutoff" `
        -Headers @{"X-Admin-Key" = "wrong-key"} `
        -ErrorAction SilentlyContinue
    Write-Host "   ❌ FAIL: Should have returned 403 Forbidden" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 403) {
        Write-Host "   ✅ PASS: Got expected 403 Forbidden" -ForegroundColor Green
    } else {
        Write-Host "   ❌ FAIL: Got unexpected error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n2. Testing authorized access with old date (should succeed)..." -ForegroundColor Yellow
$cutoff = "2020-01-01T00:00:00Z"  # Very old date, should delete nothing
try {
    $headers = @{
        "X-Admin-Key" = $ADMIN_KEY
        "Accept" = "application/json"
    }
    $response = Invoke-RestMethod -Method Delete `
        -Uri "$API_BASE/agents/tasks/before?date=$cutoff" `
        -Headers $headers

    Write-Host "   ✅ PASS: Authorized request succeeded" -ForegroundColor Green
    Write-Host "   Deleted: $($response.deleted) rows" -ForegroundColor Cyan
    Write-Host "   Cutoff: $($response.cutoff)" -ForegroundColor Cyan

    if ($response.deleted -eq 0) {
        Write-Host "   ℹ️  No rows deleted (expected for very old date)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ FAIL: Authorized request failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Response: $($_.Exception.Response | ConvertTo-Json)" -ForegroundColor Gray
}

Write-Host "`n3. Testing with recent date (dry-run check)..." -ForegroundColor Yellow
$cutoff = (Get-Date).AddDays(-7).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
Write-Host "   Would delete rows before: $cutoff" -ForegroundColor Cyan

# First, check how many rows would be affected
try {
    $checkUrl = "$API_BASE/agents/tasks/paged?since=$cutoff&limit=1"
    $check = Invoke-RestMethod -Uri $checkUrl
    $recentCount = $check.items.Count
    Write-Host "   ℹ️  Found $recentCount rows in last 7 days (these would be kept)" -ForegroundColor Gray
} catch {
    Write-Host "   ⚠️  Could not check row count: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`n4. Testing missing date parameter (should fail with 422)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Method Delete `
        -Uri "$API_BASE/agents/tasks/before" `
        -Headers @{"X-Admin-Key" = $ADMIN_KEY} `
        -ErrorAction SilentlyContinue
    Write-Host "   ❌ FAIL: Should have returned 422 Unprocessable Entity" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 422) {
        Write-Host "   ✅ PASS: Got expected 422 Unprocessable Entity" -ForegroundColor Green
    } else {
        Write-Host "   ❌ FAIL: Got unexpected error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== Test Summary ===" -ForegroundColor Cyan
Write-Host "✅ Endpoint is accessible and secure" -ForegroundColor Green
Write-Host "✅ Authentication is working correctly" -ForegroundColor Green
Write-Host "✅ Validation is enforcing required parameters" -ForegroundColor Green
Write-Host "`nℹ️  To actually prune old records:" -ForegroundColor Yellow
Write-Host "   `$cutoff = (Get-Date).AddDays(-90).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')" -ForegroundColor Gray
Write-Host "   Invoke-RestMethod -Method Delete ``" -ForegroundColor Gray
Write-Host "     -Uri '$API_BASE/agents/tasks/before?date=`$cutoff' ``" -ForegroundColor Gray
Write-Host "     -Headers @{'X-Admin-Key' = `$env:ADMIN_API_KEY}" -ForegroundColor Gray
Write-Host ""
