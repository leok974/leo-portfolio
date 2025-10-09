# Test script for Phase 50.6 Analytics Ingestion and SEO Tune
# Usage: .\test-analytics-ingest.ps1

$ErrorActionPreference = "Stop"

Write-Host "`n=== Phase 50.6 Analytics & SEO Tune Test ===" -ForegroundColor Cyan

# Check if backend is running
Write-Host "`n[1/4] Checking backend..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:8001/ready" -Method Get
    Write-Host "✓ Backend is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Backend not running. Start with: python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001" -ForegroundColor Red
    exit 1
}

# Enable dev overlay first
Write-Host "`n[2/4] Enabling dev overlay..." -ForegroundColor Yellow
try {
    $enableResult = Invoke-RestMethod -Method Post `
        -Uri "http://127.0.0.1:8001/agent/dev/enable" `
        -Headers @{ "Content-Type" = "application/json" } `
        -Body '{}' `
        -SessionVariable 'session'
    Write-Host "✓ Dev overlay enabled" -ForegroundColor Green
} catch {
    Write-Host "✗ Dev overlay enable failed (continuing anyway): $_" -ForegroundColor Yellow
}

# Test 1: Ingest analytics data
Write-Host "`n[3/4] Testing analytics ingestion..." -ForegroundColor Yellow

$ingestPayload = @{
    source = "search_console"
    rows = @(
        @{ url = "/projects/datapipe-ai"; impressions = 624; clicks = 5 },
        @{ url = "/projects/derma-ai"; impressions = 1123; clicks = 104 },
        @{ url = "/projects/clarity"; impressions = 892; clicks = 8 },
        @{ url = "/"; impressions = 5234; clicks = 456 }
    )
} | ConvertTo-Json -Depth 5

try {
    $ingestResult = Invoke-RestMethod -Method Post `
        -Uri "http://127.0.0.1:8001/agent/analytics/ingest" `
        -Headers @{
            "Content-Type" = "application/json"
        } `
        -Body $ingestPayload `
        -WebSession $session

    Write-Host "✓ Analytics ingested successfully" -ForegroundColor Green
    Write-Host "  - Rows: $($ingestResult.rows)" -ForegroundColor Gray
    Write-Host "  - Updated: $($ingestResult.inserted_or_updated)" -ForegroundColor Gray
    Write-Host "  - Source: $($ingestResult.source)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Analytics ingestion failed: $_" -ForegroundColor Red
    Write-Host $_.Exception.Response.StatusCode -ForegroundColor Red
    exit 1
}

# Test 2: Run SEO tune task
Write-Host "`n[4/4] Running SEO tune task..." -ForegroundColor Yellow

$tunePayload = @{
    threshold = 0.02
} | ConvertTo-Json

try {
    $tuneResult = Invoke-RestMethod -Method Post `
        -Uri "http://127.0.0.1:8001/agent/run?task=seo.tune" `
        -Headers @{
            "Content-Type" = "application/json"
        } `
        -Body $tunePayload `
        -WebSession $session

    Write-Host "✓ SEO tune completed successfully" -ForegroundColor Green
    Write-Host "  - Pages analyzed: $($tuneResult.count)" -ForegroundColor Gray
    Write-Host "  - JSON artifact: $($tuneResult.json)" -ForegroundColor Gray
    Write-Host "  - MD artifact: $($tuneResult.md)" -ForegroundColor Gray
} catch {
    Write-Host "✗ SEO tune failed: $_" -ForegroundColor Red
    exit 1
}

# Test 3: Verify artifacts exist
Write-Host "`n[5/5] Verifying artifacts..." -ForegroundColor Yellow

$jsonPath = "agent_artifacts/seo-tune.json"
$mdPath = "agent_artifacts/seo-tune.md"

if (Test-Path $jsonPath) {
    Write-Host "✓ JSON artifact created: $jsonPath" -ForegroundColor Green
    $jsonContent = Get-Content $jsonPath -Raw | ConvertFrom-Json
    Write-Host "  - Generated: $($jsonContent.generated)" -ForegroundColor Gray
    Write-Host "  - Threshold: $($jsonContent.threshold)" -ForegroundColor Gray
    Write-Host "  - Pages: $($jsonContent.count)" -ForegroundColor Gray

    if ($jsonContent.pages.Count -gt 0) {
        $firstPage = $jsonContent.pages[0]
        Write-Host "`n  First page example:" -ForegroundColor Cyan
        Write-Host "    URL: $($firstPage.url)" -ForegroundColor Gray
        Write-Host "    CTR: $($firstPage.ctr)" -ForegroundColor Gray
        Write-Host "    Old title: $($firstPage.old_title)" -ForegroundColor Gray
        Write-Host "    New title: $($firstPage.new_title)" -ForegroundColor Gray
    }
} else {
    Write-Host "✗ JSON artifact not found: $jsonPath" -ForegroundColor Red
    exit 1
}

if (Test-Path $mdPath) {
    Write-Host "`n✓ Markdown artifact created: $mdPath" -ForegroundColor Green
    $mdLines = (Get-Content $mdPath -TotalCount 10)
    Write-Host "  First 10 lines:" -ForegroundColor Gray
    $mdLines | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
} else {
    Write-Host "✗ Markdown artifact not found: $mdPath" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== All tests passed! ===" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "  - Review artifacts in agent_artifacts/" -ForegroundColor Gray
Write-Host "  - Ingest real GSC data via /agent/analytics/ingest" -ForegroundColor Gray
Write-Host "  - Run pytest tests: pytest tests/test_analytics_ingest.py -v" -ForegroundColor Gray
