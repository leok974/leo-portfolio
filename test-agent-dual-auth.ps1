#!/usr/bin/env pwsh
# Test dual authentication (CF Access OR HMAC) for siteAgent public endpoints

param(
    [string]$BaseUrl = "https://assistant.ledger-mind.org",
    [string]$HmacSecret = $env:SITEAGENT_HMAC_SECRET,
    [string]$CfClientId = $env:CF_ACCESS_CLIENT_ID,
    [string]$CfClientSecret = $env:CF_ACCESS_CLIENT_SECRET,
    [switch]$Verbose
)

Write-Host "`n════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host "   SiteAgent Dual Authentication Test" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════`n" -ForegroundColor Yellow

Write-Host "Base URL: $BaseUrl" -ForegroundColor Cyan
Write-Host "CF Access: $(if ($CfClientId) { 'Available ✅' } else { 'Not configured ⚠️' })" -ForegroundColor Cyan
Write-Host "HMAC: $(if ($HmacSecret) { 'Available ✅' } else { 'Not configured ⚠️' })" -ForegroundColor Cyan

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
        [hashtable]$Headers = @{},
        [scriptblock]$Validator,
        [int]$ExpectedStatus = 200
    )

    Write-Host "`n🧪 TEST: $Name" -ForegroundColor Cyan
    Write-Host "   Method: $Method $Uri" -ForegroundColor Gray
    if ($Headers.Count -gt 0) {
        Write-Host "   Headers: $($Headers.Keys -join ', ')" -ForegroundColor Gray
    }

    try {
        $params = @{
            Uri = $Uri
            Method = $Method
            Headers = $Headers
            ContentType = "application/json"
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
            if ($Verbose) {
                Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
            }
            $script:TestsFailed++
        }
    }
}

$Body = '{"plan": null, "params": {}}'

# Test Group 1: CF Access Authentication
if ($CfClientId -and $CfClientSecret) {
    Write-Host "`n╔════════════════════════════════════════════════════╗" -ForegroundColor Magenta
    Write-Host "║  Test Group 1: CF Access Authentication           ║" -ForegroundColor Magenta
    Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Magenta

    $CfHeaders = @{
        "CF-Access-Client-Id" = $CfClientId
        "CF-Access-Client-Secret" = $CfClientSecret
    }

    Test-Endpoint `
        -Name "Run Agent (CF Access service token)" `
        -Method "POST" `
        -Uri "$BaseUrl/agent/run" `
        -Body $Body `
        -Headers $CfHeaders `
        -Validator {
            param($response, $content)
            if ($content.run_id -and $content.tasks) {
                return "CF Access succeeded - Run ID: $($content.run_id)"
            }
            return $null
        }
} else {
    Write-Host "`n⚠️  CF Access credentials not set - skipping CF Access tests" -ForegroundColor Yellow
}

# Test Group 2: HMAC Authentication
if ($HmacSecret) {
    Write-Host "`n╔════════════════════════════════════════════════════╗" -ForegroundColor Magenta
    Write-Host "║  Test Group 2: HMAC Authentication                ║" -ForegroundColor Magenta
    Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Magenta

    $Signature = Compute-HmacSignature -Body $Body -Secret $HmacSecret
    $HmacHeaders = @{
        "X-SiteAgent-Signature" = $Signature
    }

    Test-Endpoint `
        -Name "Run Agent (valid HMAC signature)" `
        -Method "POST" `
        -Uri "$BaseUrl/agent/run" `
        -Body $Body `
        -Headers $HmacHeaders `
        -Validator {
            param($response, $content)
            if ($content.run_id -and $content.tasks) {
                return "HMAC succeeded - Run ID: $($content.run_id)"
            }
            return $null
        }

    Test-Endpoint `
        -Name "Run Agent (invalid HMAC - should fail 401)" `
        -Method "POST" `
        -Uri "$BaseUrl/agent/run" `
        -Body $Body `
        -Headers @{"X-SiteAgent-Signature" = "sha256=invalid0000000000000000000000000000000000000000000000000000000000"} `
        -ExpectedStatus 401 `
        -Validator { return $true }

} else {
    Write-Host "`n⚠️  HMAC secret not set - skipping HMAC tests" -ForegroundColor Yellow
}

# Test Group 3: Dual Auth Priority
if ($CfClientId -and $CfClientSecret -and $HmacSecret) {
    Write-Host "`n╔════════════════════════════════════════════════════╗" -ForegroundColor Magenta
    Write-Host "║  Test Group 3: Dual Auth Priority (CF First)      ║" -ForegroundColor Magenta
    Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Magenta

    # Valid CF Access + Invalid HMAC → Should succeed (CF has priority)
    $InvalidSig = "sha256=invalid0000000000000000000000000000000000000000000000000000000000"
    $BothHeaders = @{
        "CF-Access-Client-Id" = $CfClientId
        "CF-Access-Client-Secret" = $CfClientSecret
        "X-SiteAgent-Signature" = $InvalidSig
    }

    Test-Endpoint `
        -Name "Valid CF + Invalid HMAC (CF should win)" `
        -Method "POST" `
        -Uri "$BaseUrl/agent/run" `
        -Body $Body `
        -Headers $BothHeaders `
        -Validator {
            param($response, $content)
            if ($content.run_id) {
                return "CF Access prioritized correctly ✅"
            }
            return $null
        }

    # Invalid CF Access + Valid HMAC → Should succeed (HMAC fallback)
    $ValidSig = Compute-HmacSignature -Body $Body -Secret $HmacSecret
    $InvalidCfHeaders = @{
        "CF-Access-Client-Id" = "invalid"
        "CF-Access-Client-Secret" = "invalid"
        "X-SiteAgent-Signature" = $ValidSig
    }

    Test-Endpoint `
        -Name "Invalid CF + Valid HMAC (HMAC fallback)" `
        -Method "POST" `
        -Uri "$BaseUrl/agent/run" `
        -Body $Body `
        -Headers $InvalidCfHeaders `
        -Validator {
            param($response, $content)
            if ($content.run_id) {
                return "HMAC fallback worked correctly ✅"
            }
            return $null
        }
}

# Test Group 4: No Authentication (should fail if any auth is configured)
Write-Host "`n╔════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║  Test Group 4: No Authentication                  ║" -ForegroundColor Magenta
Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Magenta

if ($HmacSecret -or $CfClientId) {
    Test-Endpoint `
        -Name "No credentials (should fail 401)" `
        -Method "POST" `
        -Uri "$BaseUrl/agent/run" `
        -Body $Body `
        -ExpectedStatus 401 `
        -Validator { return $true }
} else {
    Write-Host "`n⚠️  No auth configured - this would succeed in open access mode" -ForegroundColor Yellow
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
    Write-Host "`n✅ Dual authentication is working correctly:" -ForegroundColor Green
    if ($CfClientId) { Write-Host "   • CF Access authentication verified" -ForegroundColor Green }
    if ($HmacSecret) { Write-Host "   • HMAC authentication verified" -ForegroundColor Green }
    if ($CfClientId -and $HmacSecret) { Write-Host "   • Priority logic verified (CF first, HMAC fallback)" -ForegroundColor Green }
    exit 0
} else {
    Write-Host "❌ SOME TESTS FAILED" -ForegroundColor Red
    exit 1
}
