#!/usr/bin/env pwsh
# Dev Overlay Verification Script
# Tests the complete dev overlay flow: status, enable, disable

$ErrorActionPreference = "Continue"
$baseUrl = "https://assistant.ledger-mind.org"

Write-Host "`n=== Dev Overlay Verification ===" -ForegroundColor Cyan
Write-Host "Base URL: $baseUrl`n" -ForegroundColor Gray

# Test 1: Status (should be disabled initially if no cookie)
Write-Host "[1] Check status (should show enabled=false)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/agent/dev/status" -Method Get
    Write-Host "✅ Status: $($response | ConvertTo-Json -Compress)" -ForegroundColor Green

    if ($response.enabled -eq $false) {
        Write-Host "   ✓ Correctly shows disabled (no cookie)" -ForegroundColor Gray
    } else {
        Write-Host "   ⚠️  Already enabled (cookie present from previous test)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed: $_" -ForegroundColor Red
}

Start-Sleep -Milliseconds 500

# Test 2: Enable with Authorization header
Write-Host "`n[2] Enable dev overlay (Authorization: Bearer dev)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/agent/dev/enable" `
        -Headers @{ "Authorization" = "Bearer dev" } `
        -UseBasicParsing -SkipHttpErrorCheck

    if ($response.StatusCode -lt 400) {
        $cookie = $response.Headers['Set-Cookie']
        if ($cookie -match 'sa_dev') {
            Write-Host "✅ Enable successful" -ForegroundColor Green
            Write-Host "   Cookie: $($cookie[0] -replace ';.*')" -ForegroundColor Gray

            # Parse cookie details
            if ($cookie -match 'Domain=([^;]+)') {
                Write-Host "   Domain: $($matches[1])" -ForegroundColor Gray
            }
            if ($cookie -match 'Max-Age=([^;]+)') {
                $days = [math]::Round([int]$matches[1] / 86400, 1)
                Write-Host "   Expires: in $days days" -ForegroundColor Gray
            }
        } else {
            Write-Host "⚠️  Response OK but no sa_dev cookie in Set-Cookie header" -ForegroundColor Yellow
        }

        $body = $response.Content | ConvertFrom-Json
        Write-Host "   Response: $($body | ConvertTo-Json -Compress)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Failed: HTTP $($response.StatusCode)" -ForegroundColor Red
        Write-Host "   $($response.Content)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}

Start-Sleep -Milliseconds 500

# Test 3: Status (should now show enabled)
Write-Host "`n[3] Check status again (should show enabled=true)..." -ForegroundColor Yellow
try {
    # Create a session to preserve cookies
    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

    # First enable to set the cookie
    $null = Invoke-WebRequest -Uri "$baseUrl/agent/dev/enable" `
        -Headers @{ "Authorization" = "Bearer dev" } `
        -WebSession $session -UseBasicParsing -SkipHttpErrorCheck

    # Then check status with the same session (cookie preserved)
    $response = Invoke-RestMethod -Uri "$baseUrl/agent/dev/status" -Method Get -WebSession $session
    Write-Host "✅ Status: $($response | ConvertTo-Json -Compress)" -ForegroundColor Green

    if ($response.enabled -eq $true) {
        Write-Host "   ✓ Correctly shows enabled" -ForegroundColor Gray
    } else {
        Write-Host "   ⚠️  Still shows disabled (cookie not working?)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed: $_" -ForegroundColor Red
}

Start-Sleep -Milliseconds 500

# Test 4: Disable
Write-Host "`n[4] Disable dev overlay..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/agent/dev/disable" -Method Get
    Write-Host "✅ Disable successful: $($response | ConvertTo-Json -Compress)" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed: $_" -ForegroundColor Red
}

Start-Sleep -Milliseconds 500

# Test 5: Status (should be disabled again)
Write-Host "`n[5] Check status after disable (should show enabled=false)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/agent/dev/status" -Method Get
    Write-Host "✅ Status: $($response | ConvertTo-Json -Compress)" -ForegroundColor Green

    if ($response.enabled -eq $false) {
        Write-Host "   ✓ Correctly shows disabled" -ForegroundColor Gray
    } else {
        Write-Host "   ⚠️  Still shows enabled (cookie not cleared?)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed: $_" -ForegroundColor Red
}

# Test 6: Enable without authorization (should fail)
Write-Host "`n[6] Try enable without authorization (should fail)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/agent/dev/enable" `
        -UseBasicParsing -SkipHttpErrorCheck

    if ($response.StatusCode -eq 401) {
        Write-Host "✅ Correctly rejected (401 Unauthorized)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Unexpected status: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}

Start-Sleep -Milliseconds 500

# Test 7: Enable with wrong token (should fail)
Write-Host "`n[7] Try enable with wrong token (should fail)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/agent/dev/enable" `
        -Headers @{ "Authorization" = "Bearer wrong-token" } `
        -UseBasicParsing -SkipHttpErrorCheck

    if ($response.StatusCode -eq 403) {
        Write-Host "✅ Correctly rejected (403 Forbidden)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Unexpected status: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}

# Test 8: Direct nginx test (bypass Cloudflare)
Write-Host "`n[8] Test via nginx directly (bypass Cloudflare cache)..." -ForegroundColor Yellow
try {
    $response = docker exec applylens-nginx-prod curl -s http://localhost/agent/dev/status 2>$null
    if ($response) {
        Write-Host "✅ nginx routing works: $response" -ForegroundColor Green
    } else {
        Write-Host "⚠️  No response from nginx" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed: $_" -ForegroundColor Red
}

# Summary
Write-Host "`n=== Verification Complete ===" -ForegroundColor Cyan
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "  1. Test in browser: Visit $baseUrl" -ForegroundColor Gray
Write-Host "  2. Enable overlay: curl -H 'Authorization: Bearer dev' $baseUrl/agent/dev/enable" -ForegroundColor Gray
Write-Host "  3. Reload page - should see DEV badge in bottom-right" -ForegroundColor Gray
Write-Host "  4. Run Playwright: pnpm exec playwright test dev-overlay.spec.ts" -ForegroundColor Gray
Write-Host "  5. Configure Cloudflare cache bypass for /agent/*" -ForegroundColor Gray
