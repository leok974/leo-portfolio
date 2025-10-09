#!/usr/bin/env pwsh
# Phase 50.4 Testing Script - AlertDialog and Copy PR Link
# Tests SEO tune endpoints and PR workflow

Write-Host "`n=== Phase 50.4 Testing Suite ===" -ForegroundColor Cyan
Write-Host "Testing: AlertDialog confirmation & Copy PR link toast action`n" -ForegroundColor Gray

# Test 1: Backend Health
Write-Host "[1/6] Backend Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8001/ready" -Method GET
    if ($health.ok) {
        Write-Host "✅ Backend is healthy" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Backend health check failed" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Backend not responding on port 8001" -ForegroundColor Red
    Write-Host "   Run: python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001" -ForegroundColor Gray
    exit 1
}

# Test 2: Enable Dev Overlay
Write-Host "`n[2/6] Enabling dev overlay..." -ForegroundColor Yellow
try {
    python scripts/enable-dev-overlay.py | Out-Null
    Write-Host "✅ Dev overlay enabled" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Could not enable dev overlay" -ForegroundColor Red
}

# Test 3: SEO Tune - Dry Run
Write-Host "`n[3/6] Testing SEO Tune (dry run)..." -ForegroundColor Yellow
try {
    $dryRun = Invoke-RestMethod -Uri "http://localhost:8001/agent/seo/tune?dry_run=true" -Method POST -ContentType "application/json"
    if ($dryRun.ok) {
        Write-Host "✅ Dry run completed successfully" -ForegroundColor Green
        if ($dryRun.diff_path) {
            Write-Host "   Diff available at: $($dryRun.diff_path)" -ForegroundColor Gray
        }
    } else {
        Write-Host "⚠️  Dry run returned error: $($dryRun.detail)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Dry run failed: $_" -ForegroundColor Red
}

# Test 4: Get Diff Artifact
Write-Host "`n[4/6] Fetching diff artifact..." -ForegroundColor Yellow
try {
    $diff = Invoke-RestMethod -Uri "http://localhost:8001/agent/seo/artifacts/diff" -Method GET
    if ($diff.Length -gt 0) {
        $lines = ($diff -split "`n").Count
        Write-Host "✅ Diff artifact retrieved ($lines lines)" -ForegroundColor Green
        Write-Host "   Preview:" -ForegroundColor Gray
        Write-Host "   $($diff.Substring(0, [Math]::Min(150, $diff.Length)))" -ForegroundColor DarkGray
    } else {
        Write-Host "⚠️  Diff artifact is empty" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Could not fetch diff: $_" -ForegroundColor Yellow
}

# Test 5: Get Log Artifact
Write-Host "`n[5/6] Fetching log artifact..." -ForegroundColor Yellow
try {
    $log = Invoke-RestMethod -Uri "http://localhost:8001/agent/seo/artifacts/log" -Method GET
    if ($log.Length -gt 0) {
        $lines = ($log -split "`n").Count
        Write-Host "✅ Log artifact retrieved ($lines lines)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Log artifact is empty" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Could not fetch log: $_" -ForegroundColor Yellow
}

# Test 6: SEO Act Endpoint (PR creation - will fail without GITHUB_TOKEN)
Write-Host "`n[6/6] Testing PR creation endpoint..." -ForegroundColor Yellow
try {
    $pr = Invoke-RestMethod -Uri "http://localhost:8001/agent/seo/act?action=seo.pr" -Method POST -ContentType "application/json"
    if ($pr.ok) {
        Write-Host "✅ PR creation successful!" -ForegroundColor Green
        if ($pr.pr) {
            Write-Host "   PR: $($pr.pr)" -ForegroundColor Gray
        }
    } else {
        $detail = $pr.detail
        if ($detail -match "GITHUB_TOKEN") {
            Write-Host "⚠️  GITHUB_TOKEN not set (expected for testing)" -ForegroundColor Yellow
            Write-Host "   This is normal - the endpoint is working correctly" -ForegroundColor Gray
        } else {
            Write-Host "⚠️  PR creation returned: $detail" -ForegroundColor Yellow
        }
    }
} catch {
    $errorMsg = $_.Exception.Message
    if ($errorMsg -match "GITHUB_TOKEN") {
        Write-Host "⚠️  GITHUB_TOKEN not set (expected for testing)" -ForegroundColor Yellow
    } else {
        Write-Host "⚠️  PR endpoint error: $errorMsg" -ForegroundColor Yellow
    }
}

Write-Host "`n=== Phase 50.4 Backend Tests Complete ===" -ForegroundColor Cyan
Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. Start frontend: npm run preview" -ForegroundColor Gray
Write-Host "2. Open: http://localhost:4173/tools.html" -ForegroundColor Gray
Write-Host "3. Test AlertDialog:" -ForegroundColor Gray
Write-Host "   - Click 'Dry Run' and wait for diff" -ForegroundColor DarkGray
Write-Host "   - Click 'Run & Save' button" -ForegroundColor DarkGray
Write-Host "   - Verify AlertDialog modal appears" -ForegroundColor DarkGray
Write-Host "   - Test Cancel and Confirm buttons" -ForegroundColor DarkGray
Write-Host "4. Test Copy PR link:" -ForegroundColor Gray
Write-Host "   - Click 'Approve → PR'" -ForegroundColor DarkGray
Write-Host "   - Look for toast with 'Copy link' button" -ForegroundColor DarkGray
Write-Host "   - Click 'Copy link' and verify clipboard" -ForegroundColor DarkGray
Write-Host ""
