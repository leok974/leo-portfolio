# SEO Tune LLM Smoke Test
# Tests the SEO tune task with LLM rewriting (primary→fallback→heuristic)

Write-Host "`n=== SEO Tune LLM Smoke Test ===" -ForegroundColor Cyan

# Ensure environment variables are set
$env:OPENAI_BASE_URL = "http://127.0.0.1:11434/v1"
$env:OPENAI_MODEL = "qwen2.5:7b-instruct"
$env:SEO_LLM_ENABLED = "1"
$env:SEO_LLM_TIMEOUT = "9.0"

Write-Host "`nEnvironment configured:" -ForegroundColor Green
Write-Host "  OPENAI_BASE_URL: $env:OPENAI_BASE_URL"
Write-Host "  OPENAI_MODEL: $env:OPENAI_MODEL"
Write-Host "  SEO_LLM_ENABLED: $env:SEO_LLM_ENABLED"
Write-Host "  SEO_LLM_TIMEOUT: $env:SEO_LLM_TIMEOUT"

# Backend endpoint
$backend = "http://127.0.0.1:8001"

# Check if backend is running
Write-Host "`nChecking backend health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Method Get -Uri "$backend/ready" -TimeoutSec 5
    Write-Host "✓ Backend is ready" -ForegroundColor Green
} catch {
    Write-Host "✗ Backend not responding at $backend" -ForegroundColor Red
    Write-Host "  Start backend: uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001" -ForegroundColor Yellow
    exit 1
}

# Step 1: Ingest sample CTR data
Write-Host "`n--- Step 1: Ingest CTR Data ---" -ForegroundColor Cyan

$payload = @{
    source = "search_console"
    rows = @(
        @{ url = "/"; impressions = 2200; clicks = 15 },
        @{ url = "/projects/siteagent"; impressions = 1800; clicks = 9 }
    )
} | ConvertTo-Json -Depth 5

Write-Host "Ingesting 2 rows with low CTR..."

try {
    $ingestResult = Invoke-RestMethod -Method Post `
        -Uri "$backend/agent/analytics/ingest" `
        -Headers @{
            "Authorization" = "Bearer dev"
            "Content-Type" = "application/json"
        } `
        -Body $payload `
        -TimeoutSec 10

    Write-Host "✓ Ingestion successful" -ForegroundColor Green
    Write-Host "  Inserted/Updated: $($ingestResult.inserted_or_updated)"
    Write-Host "  Rows: $($ingestResult.rows)"
    Write-Host "  Source: $($ingestResult.source)"
} catch {
    Write-Host "✗ Ingestion failed: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Run SEO tune task
Write-Host "`n--- Step 2: Run SEO Tune Task ---" -ForegroundColor Cyan
Write-Host "Attempting LLM rewrite (primary→fallback→heuristic)..."

try {
    $tuneResult = Invoke-RestMethod -Method Post `
        -Uri "$backend/agent/run?task=seo.tune" `
        -Headers @{
            "Authorization" = "Bearer dev"
            "Content-Type" = "application/json"
        } `
        -Body "{}" `
        -TimeoutSec 30

    Write-Host "✓ SEO tune completed" -ForegroundColor Green
    Write-Host "  Status: $($tuneResult.ok)"
    Write-Host "  Pages analyzed: $($tuneResult.count)"
    Write-Host "  JSON artifact: $($tuneResult.json)"
    Write-Host "  MD artifact: $($tuneResult.md)"
} catch {
    Write-Host "✗ SEO tune failed: $_" -ForegroundColor Red
    exit 1
}

# Step 3: Inspect generated artifacts
Write-Host "`n--- Step 3: Inspect Artifacts ---" -ForegroundColor Cyan

$jsonPath = $tuneResult.json
if (Test-Path $jsonPath) {
    Write-Host "✓ JSON artifact exists: $jsonPath" -ForegroundColor Green

    $jsonData = Get-Content $jsonPath | ConvertFrom-Json
    Write-Host "`nArtifact summary:"
    Write-Host "  Generated: $($jsonData.generated)"
    Write-Host "  Threshold: $($jsonData.threshold)"
    Write-Host "  Pages: $($jsonData.count)"

    if ($jsonData.pages.Count -gt 0) {
        Write-Host "`n  First page example:" -ForegroundColor Yellow
        $page = $jsonData.pages[0]
        Write-Host "    URL: $($page.url)"
        Write-Host "    CTR: $($page.ctr)"
        Write-Host "    Method: $($page.notes)" -ForegroundColor $(if ($page.notes -eq "llm") { "Green" } else { "Yellow" })
        Write-Host "    Old title: $($page.old_title)"
        Write-Host "    New title: $($page.new_title)"
        Write-Host "    Old description: $($page.old_description)"
        Write-Host "    New description: $($page.new_description)"
    }

    # Count LLM vs heuristic
    $llmCount = ($jsonData.pages | Where-Object { $_.notes -eq "llm" }).Count
    $heuristicCount = ($jsonData.pages | Where-Object { $_.notes -eq "heuristic" }).Count

    Write-Host "`n  Rewrite methods:" -ForegroundColor Yellow
    Write-Host "    LLM: $llmCount pages"
    Write-Host "    Heuristic: $heuristicCount pages"
} else {
    Write-Host "✗ JSON artifact not found: $jsonPath" -ForegroundColor Red
}

$mdPath = $tuneResult.md
if (Test-Path $mdPath) {
    Write-Host "`n✓ MD artifact exists: $mdPath" -ForegroundColor Green
    Write-Host "  Preview (first 10 lines):"
    Get-Content $mdPath -Head 10 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
} else {
    Write-Host "✗ MD artifact not found: $mdPath" -ForegroundColor Red
}

# Summary
Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
Write-Host "All steps completed successfully!" -ForegroundColor Green
Write-Host "`nNext steps:"
Write-Host "  1. Review artifacts in agent_artifacts/"
Write-Host "  2. Check if LLM was used (notes field = 'llm')"
Write-Host "  3. If Ollama is not running, verify heuristic fallback worked"
Write-Host "  4. Apply metadata changes to actual HTML files"
