#!/usr/bin/env pwsh
# Test HMAC authentication for siteAgent public endpoints

param(
    [string]$BaseUrl = "http://127.0.0.1:8000",
    [string]$HmacSecret = $env:SITEAGENT_HMAC_SECRET,
    [switch]$Verbose
)

Write-Host "`n════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host "   SiteAgent HMAC Authentication Test" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════`n" -ForegroundColor Yellow

Write-Host "Base URL: $BaseUrl" -ForegroundColor Cyan
if ($HmacSecret) {
    Write-Host "HMAC Secret: $($HmacSecret.Substring(0, [Math]::Min(8, $HmacSecret.Length)))... (${HmacSecret.Length} chars)" -ForegroundColor Cyan
} else {
    Write-Host "HMAC Secret: Not set (open access)" -ForegroundColor Yellow
}

$TestsPassed = 0
$TestsFailed = 0

function Compute-HmacSignature {
    param([string]$Body, [string]$Secret)

    if (-not $Secret) {
        return $null
    }

    $BodyBytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
    $SecretBytes = [System.Text.Encoding]::UTF8.GetBytes($Secret)
    $Hmac = New-Object System.Security.Cryptography.HMACSHA256
    $Hmac.Key = $SecretBytes
    $Hash = $Hmac.ComputeHash($BodyBytes)
    $Signature = "sha256=" + ($Hash | ForEach-Object { $_.ToString("x2") }) -join ""
    return $Signature
}

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Uri,
        [string]$Body = $null,
        [string]$Signature = $null,
        [scriptblock]$Validator,
        [int]$ExpectedStatus = 200
    )

    Write-Host "`n🧪 TEST: $Name" -ForegroundColor Cyan
    Write-Host "   Method: $Method $Uri" -ForegroundColor Gray

    try {
        $params = @{
            Uri = $Uri
            Method = $Method
            Headers = @{
                "Content-Type" = "application/json"
            }
        }

        if ($Signature) {
            $params.Headers["X-SiteAgent-Signature"] = $Signature
            Write-Host "   Signature: $($Signature.Substring(0, 20))..." -ForegroundColor Gray
        }

        if ($Body) {
            $params.Body = $Body
        }

        $response = Invoke-WebRequest @params -ErrorAction Stop
        $content = $response.Content | ConvertFrom-Json

        if ($Verbose) {
            Write-Host "   Response:" -ForegroundColor Gray
            Write-Host "   $($content | ConvertTo-Json -Depth 5)" -ForegroundColor Gray
        }

        if ($response.StatusCode -eq $ExpectedStatus) {
            # Run custom validator
            $validationResult = & $Validator $response $content

            if ($validationResult) {
                Write-Host "   ✅ PASS: $validationResult" -ForegroundColor Green
                $script:TestsPassed++
            } else {
                Write-Host "   ❌ FAIL: Validation failed" -ForegroundColor Red
                $script:TestsFailed++
            }
        } else {
            Write-Host "   ❌ FAIL: Expected $ExpectedStatus, got $($response.StatusCode)" -ForegroundColor Red
            $script:TestsFailed++
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq $ExpectedStatus) {
            Write-Host "   ✅ PASS: Got expected status $ExpectedStatus" -ForegroundColor Green
            $script:TestsPassed++
        } else {
            Write-Host "   ❌ FAIL: Expected $ExpectedStatus, got $statusCode" -ForegroundColor Red
            Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
            $script:TestsFailed++
        }
    }
}

# Test 1: List Tasks (no auth required for GET)
Test-Endpoint `
    -Name "List Tasks (no signature)" `
    -Method "GET" `
    -Uri "$BaseUrl/agent/tasks" `
    -Validator {
        param($response, $content)
        if ($content.tasks -and $content.default) {
            return "Found $($content.tasks.Count) tasks: $($content.tasks -join ', ')"
        }
        return $null
    }

# Test 2: Run Agent with valid signature (if secret is set)
if ($HmacSecret) {
    $Body = '{"plan": null, "params": {}}'
    $Signature = Compute-HmacSignature -Body $Body -Secret $HmacSecret

    Test-Endpoint `
        -Name "Run Agent (valid HMAC signature)" `
        -Method "POST" `
        -Uri "$BaseUrl/agent/run" `
        -Body $Body `
        -Signature $Signature `
        -Validator {
            param($response, $content)
            if ($content.run_id -and $content.tasks) {
                return "Run ID: $($content.run_id)"
            }
            return $null
        }

    # Test 3: Run Agent with invalid signature (should fail)
    Test-Endpoint `
        -Name "Run Agent (invalid signature - should fail 401)" `
        -Method "POST" `
        -Uri "$BaseUrl/agent/run" `
        -Body $Body `
        -Signature "sha256=invalid0000000000000000000000000000000000000000000000000000000000" `
        -ExpectedStatus 401 `
        -Validator { return $true }

    # Test 4: Run Agent with missing signature (should fail)
    Test-Endpoint `
        -Name "Run Agent (missing signature - should fail 401)" `
        -Method "POST" `
        -Uri "$BaseUrl/agent/run" `
        -Body $Body `
        -ExpectedStatus 401 `
        -Validator { return $true }

    # Test 5: Run Agent with malformed signature header (should fail)
    Test-Endpoint `
        -Name "Run Agent (malformed signature - should fail 401)" `
        -Method "POST" `
        -Uri "$BaseUrl/agent/run" `
        -Body $Body `
        -Signature "invalid-format" `
        -ExpectedStatus 401 `
        -Validator { return $true }

} else {
    Write-Host "`n⚠️  HMAC Secret not set - skipping authentication tests" -ForegroundColor Yellow
    Write-Host "   Set `$env:SITEAGENT_HMAC_SECRET to enable HMAC tests" -ForegroundColor Yellow

    # Test without HMAC (open access)
    $Body = '{"plan": ["status.write"], "params": {}}'

    Test-Endpoint `
        -Name "Run Agent (no signature - open access mode)" `
        -Method "POST" `
        -Uri "$BaseUrl/agent/run" `
        -Body $Body `
        -Validator {
            param($response, $content)
            if ($content.run_id -and $content.tasks) {
                return "Run ID: $($content.run_id) (open access)"
            }
            return $null
        }
}

# Test 6: Check Agent Status
Test-Endpoint `
    -Name "Check Agent Status" `
    -Method "GET" `
    -Uri "$BaseUrl/agent/status" `
    -Validator {
        param($response, $content)
        if ($content.recent) {
            return "Found $($content.recent.Count) recent runs"
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

    if ($HmacSecret) {
        Write-Host "`n✅ HMAC authentication is working correctly" -ForegroundColor Green
    } else {
        Write-Host "`n⚠️  Running in open access mode (no HMAC secret)" -ForegroundColor Yellow
        Write-Host "   Set SITEAGENT_HMAC_SECRET to enable authentication" -ForegroundColor Yellow
    }

    exit 0
} else {
    Write-Host "❌ SOME TESTS FAILED" -ForegroundColor Red
    exit 1
}
