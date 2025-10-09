#!/usr/bin/env pwsh
<#
.SYNOPSIS
Test Grafana API access with token

.DESCRIPTION
This script tests Grafana API connectivity and validates your API token.
Use it to verify your token before proceeding with dashboard setup.

.PARAMETER Token
The Grafana API token to test

.PARAMETER GrafanaUrl
The Grafana instance URL (default: http://localhost:3000)

.EXAMPLE
.\test-grafana-token.ps1 -Token "eyJrIjoiWW91ckFQSVRva2VuIiwibj..."

.EXAMPLE
.\test-grafana-token.ps1 -Token "glsa_YourServiceAccountToken..." -GrafanaUrl "https://grafana.example.com"
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$Token = $env:GRAFANA_TOKEN,

    [Parameter(Mandatory=$false)]
    [string]$GrafanaUrl = "http://localhost:3000"
)

Write-Host "`n=== Grafana API Token Tester ===`n" -ForegroundColor Cyan

if (-not $Token) {
    Write-Host "❌ No token provided!" -ForegroundColor Red
    Write-Host "`nUsage:" -ForegroundColor Yellow
    Write-Host "  .\test-grafana-token.ps1 -Token 'your-token-here'`n" -ForegroundColor Green
    Write-Host "Or set environment variable:" -ForegroundColor Yellow
    Write-Host "  `$env:GRAFANA_TOKEN = 'your-token-here'" -ForegroundColor Green
    Write-Host "  .\test-grafana-token.ps1`n" -ForegroundColor Green
    exit 1
}

Write-Host "Grafana URL: $GrafanaUrl" -ForegroundColor Gray
Write-Host "Token: $($Token.Substring(0, [Math]::Min(20, $Token.Length)))..." -ForegroundColor Gray
Write-Host ""

# Test 1: Health Check
Write-Host "Test 1: Health Check" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$GrafanaUrl/api/health" -Method Get -UseBasicParsing
    Write-Host "  ✅ Grafana is healthy" -ForegroundColor Green
    Write-Host "     Version: $($health.version)" -ForegroundColor Gray
    Write-Host "     Database: $($health.database)" -ForegroundColor Gray
} catch {
    Write-Host "  ❌ Failed to connect to Grafana" -ForegroundColor Red
    Write-Host "     Error: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 2: API Token Authentication
Write-Host "Test 2: API Token Authentication" -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $Token"
        "Content-Type" = "application/json"
    }
    $org = Invoke-RestMethod -Uri "$GrafanaUrl/api/org" -Headers $headers -Method Get -UseBasicParsing
    Write-Host "  ✅ Token is valid!" -ForegroundColor Green
    Write-Host "     Organization: $($org.name)" -ForegroundColor Gray
    Write-Host "     Org ID: $($org.id)" -ForegroundColor Gray
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "  ❌ Token is invalid or expired" -ForegroundColor Red
    } else {
        Write-Host "  ❌ Authentication failed" -ForegroundColor Red
    }
    Write-Host "     Error: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 3: Check Datasources
Write-Host "Test 3: Check Datasources" -ForegroundColor Yellow
try {
    $datasources = Invoke-RestMethod -Uri "$GrafanaUrl/api/datasources" -Headers $headers -Method Get -UseBasicParsing
    Write-Host "  ✅ Can access datasources" -ForegroundColor Green
    Write-Host "     Found $($datasources.Count) datasource(s)" -ForegroundColor Gray

    $infinity = $datasources | Where-Object { $_.type -eq "yesoreyeram-infinity-datasource" }
    if ($infinity) {
        Write-Host "     ✅ Infinity datasource found: '$($infinity.name)'" -ForegroundColor Green
    } else {
        Write-Host "     ⚠️  Infinity datasource not configured yet" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠️  Cannot access datasources (may need higher permissions)" -ForegroundColor Yellow
}
Write-Host ""

# Test 4: Check Dashboards
Write-Host "Test 4: Check Dashboards" -ForegroundColor Yellow
try {
    $dashboards = Invoke-RestMethod -Uri "$GrafanaUrl/api/search?type=dash-db" -Headers $headers -Method Get -UseBasicParsing
    Write-Host "  ✅ Can access dashboards" -ForegroundColor Green
    Write-Host "     Found $($dashboards.Count) dashboard(s)" -ForegroundColor Gray

    $seoDash = $dashboards | Where-Object { $_.title -like "*SEO*" -or $_.title -like "*SiteAgent*" }
    if ($seoDash) {
        Write-Host "     ✅ SEO Meta dashboard found: '$($seoDash.title)'" -ForegroundColor Green
    } else {
        Write-Host "     ℹ️  SEO Meta dashboard not imported yet" -ForegroundColor Cyan
    }
} catch {
    Write-Host "  ⚠️  Cannot access dashboards (may need higher permissions)" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ All tests passed! Token is working correctly.             ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "You can now proceed with dashboard setup!" -ForegroundColor Cyan
Write-Host ""

# Show grafanactl configuration example
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "To use with grafanactl CLI:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Set environment variables:" -ForegroundColor Gray
Write-Host "  `$env:GRAFANA_SERVER = '$GrafanaUrl'" -ForegroundColor Green
Write-Host "  `$env:GRAFANA_ORG_ID = '1'  # Default org id" -ForegroundColor Green
Write-Host "  `$env:GRAFANA_TOKEN = '<your-token>'" -ForegroundColor Green
Write-Host ""
Write-Host "Then verify:" -ForegroundColor Gray
Write-Host "  grafanactl config check" -ForegroundColor Green
Write-Host ""
