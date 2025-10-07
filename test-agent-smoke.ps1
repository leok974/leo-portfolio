#!/usr/bin/env pwsh
# SiteAgent Smoke Test
# Tests all agent endpoints with service token authentication

param(
    [string]$BaseUrl = "https://assistant.ledger-mind.org",
    [switch]$Verbose
)

# Service token credentials
$env:CF_ACCESS_CLIENT_ID = "bcf632e4a22f6a8007d47039038904b7.access"
$env:CF_ACCESS_CLIENT_SECRET = "1532e93c9599937c3155af61945d2c814168c6a5fa809f554d6e3257289268b6"

$Headers = @{
    "CF-Access-Client-Id" = $env:CF_ACCESS_CLIENT_ID
    "CF-Access-Client-Secret" = $env:CF_ACCESS_CLIENT_SECRET
}

$TestsPassed = 0
$TestsFailed = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Uri,
        [hashtable]$Headers,
        [string]$Body = $null,
        [scriptblock]$Validator
    )

    Write-Host "`n🧪 TEST: $Name" -ForegroundColor Cyan
    Write-Host "   Method: $Method $Uri" -ForegroundColor Gray

    try {
        $params = @{
            Uri = $Uri
            Method = $Method
            Headers = $Headers
        }
        if ($Body) {
            $params.Body = $Body
            $params.ContentType = "application/json"
        }

        $response = Invoke-WebRequest @params
        $content = $response.Content | ConvertFrom-Json

        if ($Verbose) {
            Write-Host "   Response:" -ForegroundColor Gray
            Write-Host "   $($content | ConvertTo-Json -Depth 5)" -ForegroundColor Gray
        }

        # Run custom validator
        $validationResult = & $Validator $response $content

        if ($validationResult) {
            Write-Host "   ✅ PASS: $validationResult" -ForegroundColor Green
            $script:TestsPassed++
        } else {
            Write-Host "   ❌ FAIL: Validation failed" -ForegroundColor Red
            $script:TestsFailed++
        }
    } catch {
        Write-Host "   ❌ FAIL: $($_.Exception.Message)" -ForegroundColor Red
        $script:TestsFailed++
    }
}

Write-Host "`n════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host "   SiteAgent Smoke Test Suite" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════`n" -ForegroundColor Yellow
Write-Host "Base URL: $BaseUrl" -ForegroundColor Cyan
Write-Host "Client ID: $env:CF_ACCESS_CLIENT_ID" -ForegroundColor Cyan

# Test 1: List Tasks
Test-Endpoint `
    -Name "List Available Tasks" `
    -Method "GET" `
    -Uri "$BaseUrl/api/admin/agent/tasks" `
    -Headers $Headers `
    -Validator {
        param($response, $content)
        if ($response.StatusCode -eq 200 -and
            $content.tasks -and
            $content.default -and
            $content.tasks.Count -gt 0) {
            return "Found $($content.tasks.Count) tasks: $($content.tasks -join ', ')"
        }
        return $null
    }

# Test 2: Run Agent with Single Task
$runId = $null
Test-Endpoint `
    -Name "Run Agent (status.write)" `
    -Method "POST" `
    -Uri "$BaseUrl/api/admin/agent/run" `
    -Headers $Headers `
    -Body '{"plan":["status.write"]}' `
    -Validator {
        param($response, $content)
        if ($response.StatusCode -eq 200 -and
            $content.run_id -and
            $content.tasks -contains "status.write") {
            $script:runId = $content.run_id
            return "Run ID: $($content.run_id)"
        }
        return $null
    }

# Wait for task to complete
Write-Host "`n⏳ Waiting 3 seconds for task completion..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Test 3: Check Agent Status
Test-Endpoint `
    -Name "Check Agent Status" `
    -Method "GET" `
    -Uri "$BaseUrl/api/admin/agent/status" `
    -Headers $Headers `
    -Validator {
        param($response, $content)
        if ($response.StatusCode -eq 200 -and
            $content.recent -and
            $content.recent.Count -gt 0) {
            $latest = $content.recent[0]
            $status = if ($latest.errors -eq 0) { "✅ SUCCESS" } else { "❌ FAILED" }
            return "Latest run: $status (ok=$($latest.ok), errors=$($latest.errors))"
        }
        return $null
    }

# Test 4: Verify Run ID Matches
if ($runId) {
    Test-Endpoint `
        -Name "Verify Run ID in History" `
        -Method "GET" `
        -Uri "$BaseUrl/api/admin/agent/status" `
        -Headers $Headers `
        -Validator {
            param($response, $content)
            $found = $content.recent | Where-Object { $_.run_id -eq $script:runId }
            if ($found) {
                return "Run $runId found in history"
            }
            return $null
        }
}

# Test 5: Verify Output File (Docker)
Write-Host "`n🧪 TEST: Verify Output File" -ForegroundColor Cyan
Write-Host "   Checking: /app/assets/data/siteAgent.json" -ForegroundColor Gray
try {
    $output = docker exec portfolio-backend-1 cat /app/assets/data/siteAgent.json 2>$null
    if ($output) {
        $json = $output | ConvertFrom-Json
        if ($json.ts -and $json.last_run_id) {
            Write-Host "   ✅ PASS: Output file exists with valid JSON" -ForegroundColor Green
            if ($Verbose) {
                Write-Host "   Last run: $($json.last_run_id)" -ForegroundColor Gray
                Write-Host "   Timestamp: $($json.ts)" -ForegroundColor Gray
            }
            $TestsPassed++
        } else {
            Write-Host "   ❌ FAIL: Output file missing required fields" -ForegroundColor Red
            $TestsFailed++
        }
    } else {
        Write-Host "   ❌ FAIL: Output file not found" -ForegroundColor Red
        $TestsFailed++
    }
} catch {
    Write-Host "   ❌ FAIL: $($_.Exception.Message)" -ForegroundColor Red
    $TestsFailed++
}

# Test 6: Verify Database Events
Write-Host "`n🧪 TEST: Verify Database Events" -ForegroundColor Cyan
Write-Host "   Checking: agent_events table" -ForegroundColor Gray
try {
    # Copy check script if not already present
    $null = docker cp check-agent-events.py portfolio-backend-1:/tmp/check.py 2>$null

    if ($runId) {
        $events = docker exec portfolio-backend-1 python /tmp/check.py $runId 2>$null
        if ($events -match "run.start" -and $events -match "run.end") {
            Write-Host "   ✅ PASS: Database events logged correctly" -ForegroundColor Green
            if ($Verbose) {
                Write-Host "   Events:" -ForegroundColor Gray
                $events | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
            }
            $TestsPassed++
        } else {
            Write-Host "   ❌ FAIL: Missing expected events" -ForegroundColor Red
            $TestsFailed++
        }
    } else {
        Write-Host "   ⚠️  SKIP: No run_id available" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ FAIL: $($_.Exception.Message)" -ForegroundColor Red
    $TestsFailed++
}

# Test 7: Authentication Failure (Invalid Credentials)
Write-Host "`n🧪 TEST: Authentication Failure (Invalid Credentials)" -ForegroundColor Cyan
Write-Host "   Testing: Invalid service token" -ForegroundColor Gray
try {
    $BadHeaders = @{
        "CF-Access-Client-Id" = "invalid"
        "CF-Access-Client-Secret" = "invalid"
    }
    $response = Invoke-WebRequest `
        -Uri "$BaseUrl/api/admin/agent/tasks" `
        -Headers $BadHeaders `
        -ErrorAction Stop

    Write-Host "   ❌ FAIL: Should have returned 401/403, got $($response.StatusCode)" -ForegroundColor Red
    $TestsFailed++
} catch {
    if ($_.Exception.Response.StatusCode -in @(401, 403)) {
        Write-Host "   ✅ PASS: Correctly rejected invalid credentials" -ForegroundColor Green
        $TestsPassed++
    } else {
        Write-Host "   ❌ FAIL: Unexpected error: $($_.Exception.Message)" -ForegroundColor Red
        $TestsFailed++
    }
}

# Test 8: Run Agent with Default Plan
Test-Endpoint `
    -Name "Run Agent (Default Plan)" `
    -Method "POST" `
    -Uri "$BaseUrl/api/admin/agent/run" `
    -Headers $Headers `
    -Body '{}' `
    -Validator {
        param($response, $content)
        if ($response.StatusCode -eq 200 -and
            $content.run_id -and
            $content.tasks.Count -eq 4) {
            return "Executed $($content.tasks.Count) tasks: $($content.tasks -join ', ')"
        }
        return $null
    }

# Summary
Write-Host "`n════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host "   Test Results" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host "   ✅ Passed: $TestsPassed" -ForegroundColor Green
Write-Host "   ❌ Failed: $TestsFailed" -ForegroundColor Red
Write-Host "   Total:   $($TestsPassed + $TestsFailed)" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════`n" -ForegroundColor Yellow

if ($TestsFailed -eq 0) {
    Write-Host "🎉 ALL TESTS PASSED! 🎉" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ SOME TESTS FAILED" -ForegroundColor Red
    exit 1
}
