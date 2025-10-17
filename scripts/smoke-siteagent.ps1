#!/usr/bin/env pwsh
# SiteAgent Smoke Tests
# Run this script to verify all agent features are working

$ErrorActionPreference = "Continue"
$baseUrl = "https://assistant.ledger-mind.org"

Write-Host "`n=== SiteAgent Smoke Tests ===" -ForegroundColor Cyan
Write-Host "Base URL: $baseUrl`n" -ForegroundColor Gray

# Test 0: Dev Overlay Enable
Write-Host "[0] Dev overlay enable..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/agent/dev/enable" `
        -Headers @{ "Authorization" = "Bearer dev" } `
        -UseBasicParsing -SkipHttpErrorCheck

    if ($response.StatusCode -lt 400) {
        $cookie = $response.Headers['Set-Cookie']
        if ($cookie -match 'sa_dev') {
            Write-Host "✅ Dev overlay cookie set: $($cookie -replace ';.*')" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Response OK but no sa_dev cookie found" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ Failed: HTTP $($response.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}

Start-Sleep -Milliseconds 500

# Test 1: Orchestrator Status
Write-Host "`n[1] Orchestrator status..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/agent/status" -Method Get
    Write-Host "✅ Status: $($response | ConvertTo-Json -Compress)" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed: $_" -ForegroundColor Red
}

Start-Sleep -Milliseconds 500

# Test 2: Dry-run task list
Write-Host "`n[2] Dry-run task list (projects.sync, links.suggest, og.generate)..." -ForegroundColor Yellow
try {
    $body = @{
        tasks = @('projects.sync', 'links.suggest', 'og.generate')
        dry_run = $true
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/agent/run" `
        -Method Post `
        -ContentType 'application/json' `
        -Body $body

    Write-Host "✅ Run result: $($response | ConvertTo-Json -Compress -Depth 3)" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed: $_" -ForegroundColor Red
}

Start-Sleep -Milliseconds 500

# Test 3: SEO Intelligence
Write-Host "`n[3] SEO tune (dry-run)..." -ForegroundColor Yellow
try {
    $body = @{ dry_run = $true } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/agent/seo.tune" `
        -Method Post `
        -ContentType 'application/json' `
        -Body $body

    Write-Host "✅ SEO tune result: $($response | ConvertTo-Json -Compress -Depth 3)" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed: $_" -ForegroundColor Red
}

Start-Sleep -Milliseconds 500

# Test 4: Artifacts
Write-Host "`n[4] Artifacts list..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/agent/artifacts" -Method Get
    if ($response -is [string]) {
        $preview = $response.Substring(0, [Math]::Min(200, $response.Length))
        Write-Host "✅ Artifacts (first 200 chars):" -ForegroundColor Green
        Write-Host $preview -ForegroundColor Gray
    } else {
        Write-Host "✅ Artifacts: $($response | ConvertTo-Json -Compress -Depth 2)" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Failed: $_" -ForegroundColor Red
}

Start-Sleep -Milliseconds 500

# Test 5: Events stream (SSE)
Write-Host "`n[5] Events stream (SSE) - 3 second sample..." -ForegroundColor Yellow
try {
    $job = Start-Job -ScriptBlock {
        param($url)
        try {
            $response = Invoke-WebRequest -Uri "$url/agent/events?level=info" `
                -TimeoutSec 3 `
                -UseBasicParsing
            $response.Content
        } catch {
            "Timeout or error: $_"
        }
    } -ArgumentList $baseUrl

    $result = Wait-Job $job -Timeout 4 | Receive-Job
    Remove-Job $job -Force

    if ($result -match 'event:') {
        Write-Host "✅ SSE stream active (sample):" -ForegroundColor Green
        Write-Host ($result.Substring(0, [Math]::Min(150, $result.Length))) -ForegroundColor Gray
    } else {
        Write-Host "⚠️  No 'event:' lines found in response" -ForegroundColor Yellow
        Write-Host $result -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Failed: $_" -ForegroundColor Red
}

# Summary
Write-Host "`n=== Smoke Tests Complete ===" -ForegroundColor Cyan
Write-Host "If all tests show ✅, your SiteAgent infrastructure is ready!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "  1. Run Playwright E2E: pnpm exec playwright test agent-orchestrator.spec.ts" -ForegroundColor Gray
Write-Host "  2. Enable nightly automation: Edit .github/workflows/nightly-siteagent.yml" -ForegroundColor Gray
Write-Host "  3. Configure Cloudflare cache bypass for /agent/* endpoints" -ForegroundColor Gray
