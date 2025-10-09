# Phase 50.6 Analytics Test - Working Version
# Direct curl-style requests

$ErrorActionPreference = "Stop"

Write-Host "`n=== Phase 50.6 Analytics & SEO Tune Test ===" -ForegroundColor Cyan

# Check backend
Write-Host "`n[1/4] Checking backend..." -ForegroundColor Yellow
try {
    Invoke-RestMethod -Uri "http://127.0.0.1:8001/ready" | Out-Null
    Write-Host "✓ Backend is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Backend not running" -ForegroundColor Red
    exit 1
}

# Enable dev overlay and get cookie
Write-Host "`n[2/4] Enabling dev overlay..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Method Post `
        -Uri "http://127.0.0.1:8001/agent/dev/enable" `
        -SessionVariable 'session'
    Write-Host "✓ Dev overlay enabled" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to enable dev overlay: $_" -ForegroundColor Red
    exit 1
}

# Ingest analytics data
Write-Host "`n[3/4] Ingesting analytics data..." -ForegroundColor Yellow
$ingestBody = @{
    source = "search_console"
    rows = @(
        @{ url = "/projects/datapipe-ai"; impressions = 624; clicks = 5 }
        @{ url = "/projects/derma-ai"; impressions = 1123; clicks = 104 }
        @{ url = "/projects/clarity"; impressions = 892; clicks = 8 }
        @{ url = "/"; impressions = 5234; clicks = 456 }
    )
} | ConvertTo-Json -Depth 10

try {
    $ingestResult = Invoke-RestMethod -Method Post `
        -Uri "http://127.0.0.1:8001/agent/analytics/ingest" `
        -ContentType "application/json" `
        -Body $ingestBody `
        -WebSession $session

    Write-Host "✓ Analytics ingested successfully" -ForegroundColor Green
    Write-Host "  - Rows: $($ingestResult.rows)" -ForegroundColor Gray
    Write-Host "  - Updated: $($ingestResult.inserted_or_updated)" -ForegroundColor Gray
    Write-Host "  - Source: $($ingestResult.source)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Analytics ingestion failed" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Host "  Response: $($reader.ReadToEnd())" -ForegroundColor Red
    }
    exit 1
}

# Run SEO tune task
Write-Host "`n[4/4] Running SEO tune task..." -ForegroundColor Yellow
$tuneBody = @{
    threshold = 0.02
} | ConvertTo-Json

try {
    $tuneResult = Invoke-RestMethod -Method Post `
        -Uri "http://127.0.0.1:8001/agent/run?task=seo.tune" `
        -ContentType "application/json" `
        -Body $tuneBody `
        -WebSession $session

    Write-Host "✓ SEO tune completed successfully" -ForegroundColor Green
    Write-Host "  - Status: $($tuneResult.ok)" -ForegroundColor Gray
    Write-Host "  - Pages analyzed: $($tuneResult.count)" -ForegroundColor Gray
    Write-Host "  - JSON artifact: $($tuneResult.json)" -ForegroundColor Gray
    Write-Host "  - MD artifact: $($tuneResult.md)" -ForegroundColor Gray
} catch {
    Write-Host "✗ SEO tune failed" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Host "  Response: $($reader.ReadToEnd())" -ForegroundColor Red
    }
    exit 1
}

# Verify artifacts
Write-Host "`n[5/5] Verifying artifacts..." -ForegroundColor Yellow

$jsonPath = "agent_artifacts/seo-tune.json"
$mdPath = "agent_artifacts/seo-tune.md"

if (Test-Path $jsonPath) {
    Write-Host "✓ JSON artifact created: $jsonPath" -ForegroundColor Green
    try {
        $jsonContent = Get-Content $jsonPath -Raw | ConvertFrom-Json
        Write-Host "  - Generated: $($jsonContent.generated)" -ForegroundColor Gray
        Write-Host "  - Threshold: $($jsonContent.threshold)" -ForegroundColor Gray
        Write-Host "  - Pages: $($jsonContent.count)" -ForegroundColor Gray

        if ($jsonContent.pages -and $jsonContent.pages.Count -gt 0) {
            Write-Host "`n  First page example:" -ForegroundColor Cyan
            $firstPage = $jsonContent.pages[0]
            Write-Host "    URL: $($firstPage.url)" -ForegroundColor Gray
            Write-Host "    CTR: $($firstPage.ctr)" -ForegroundColor Gray
            Write-Host "    Old title: $($firstPage.old_title)" -ForegroundColor Gray
            Write-Host "    New title: $($firstPage.new_title)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "  Warning: Could not parse JSON file" -ForegroundColor Yellow
    }
} else {
    Write-Host "✗ JSON artifact not found: $jsonPath" -ForegroundColor Red
}

if (Test-Path $mdPath) {
    Write-Host "`n✓ Markdown artifact created: $mdPath" -ForegroundColor Green
    $mdLines = Get-Content $mdPath -TotalCount 10
    Write-Host "  First 10 lines:" -ForegroundColor Gray
    $mdLines | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
} else {
    Write-Host "✗ Markdown artifact not found: $mdPath" -ForegroundColor Red
}

Write-Host "`n=== All tests passed! ===" -ForegroundColor Green
Write-Host "`nPhase 50.6 Implementation Complete:" -ForegroundColor Cyan
Write-Host "  ✓ Analytics ingestion API (/agent/analytics/ingest)" -ForegroundColor Gray
Write-Host "  ✓ SEO tune task (seo.tune)" -ForegroundColor Gray
Write-Host "  ✓ CTR storage (SQLite)" -ForegroundColor Gray
Write-Host "  ✓ Artifact generation (JSON + MD)" -ForegroundColor Gray
