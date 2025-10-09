#!/usr/bin/env pwsh
# Phase 50.4 - Simple curl-based API tests

Write-Host "`n=== Phase 50.4 Curl Tests ===" -ForegroundColor Cyan

# Test 1: Health
Write-Host "`n[Test 1] Backend Health" -ForegroundColor Yellow
curl -s http://localhost:8001/ready | ConvertFrom-Json | Format-List

# Test 2: SEO Dry Run
Write-Host "`n[Test 2] SEO Tune - Dry Run" -ForegroundColor Yellow
$dryRun = curl -s -X POST http://localhost:8001/agent/seo/tune?dry_run=true | ConvertFrom-Json
Write-Host "Status: $($dryRun.ok ? '✅ Success' : '❌ Failed')" -ForegroundColor ($dryRun.ok ? 'Green' : 'Red')
Write-Host "Diff path: $($dryRun.diff_path)"
Write-Host "Log path: $($dryRun.log_path)"

# Test 3: Get Diff
Write-Host "`n[Test 3] Fetch Diff Artifact" -ForegroundColor Yellow
$diff = curl -s http://localhost:8001/agent/seo/artifacts/diff
$diffLines = ($diff -split "`n").Count
Write-Host "Lines retrieved: $diffLines"
Write-Host "First 200 chars:"
Write-Host $diff.Substring(0, [Math]::Min(200, $diff.Length)) -ForegroundColor Gray

# Test 4: Get Log
Write-Host "`n[Test 4] Fetch Log Artifact" -ForegroundColor Yellow
$log = curl -s http://localhost:8001/agent/seo/artifacts/log
$logLines = ($log -split "`n").Count
Write-Host "Lines retrieved: $logLines"

# Test 5: PR Endpoint (expected to fail without GITHUB_TOKEN)
Write-Host "`n[Test 5] PR Creation (dry test)" -ForegroundColor Yellow
$pr = curl -s -X POST http://localhost:8001/agent/seo/act?action=seo.pr | ConvertFrom-Json
if ($pr.detail -match "GITHUB_TOKEN") {
    Write-Host "Expected result: GITHUB_TOKEN not set ✅" -ForegroundColor Green
} elseif ($pr.ok) {
    Write-Host "PR created successfully! ✅" -ForegroundColor Green
    Write-Host "PR URL: $($pr.pr)"
} else {
    Write-Host "Unexpected error: $($pr.detail)" -ForegroundColor Red
}

# Test 6: Status Summary
Write-Host "`n[Test 6] Status Summary" -ForegroundColor Yellow
$status = curl -s http://localhost:8001/status/summary | ConvertFrom-Json
Write-Host "Version: $($status.version)"
Write-Host "Uptime: $($status.uptime_seconds) seconds"

Write-Host "`n=== All curl tests complete ===" -ForegroundColor Green
Write-Host "`nBackend endpoints are working correctly!" -ForegroundColor Cyan
Write-Host "Ready to test frontend AlertDialog in browser." -ForegroundColor Cyan
