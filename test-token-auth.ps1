# Test script for token authentication
# Stop any existing server
Write-Host "`n=== Stopping any existing servers ===" -ForegroundColor Yellow
Get-NetTCPConnection -LocalPort 8023 -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

# Set environment variables
Remove-Item Env:ALLOW_TOOLS -ErrorAction SilentlyContinue
$env:ADMIN_TOKEN = 'use-a-long-random-string'
$env:RAG_DB = 'D:/leo-portfolio/data/rag_8023.sqlite'

Write-Host "`n=== Starting backend with token guard ===" -ForegroundColor Cyan
Write-Host "ADMIN_TOKEN is set: $($env:ADMIN_TOKEN -ne $null)" -ForegroundColor Gray
Write-Host "ALLOW_TOOLS is: $($env:ALLOW_TOOLS)" -ForegroundColor Gray
Write-Host "RAG_DB: $env:RAG_DB" -ForegroundColor Gray

# Start server in background job
$job = Start-Job -ScriptBlock {
    param($AdminToken, $RagDb, $WorkDir)
    Set-Location $WorkDir
    $env:ADMIN_TOKEN = $AdminToken
    $env:RAG_DB = $RagDb
    & "$WorkDir\.venv\Scripts\python.exe" -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8023
} -ArgumentList $env:ADMIN_TOKEN, $env:RAG_DB, "D:\leo-portfolio"

Write-Host "Waiting for server to start..." -ForegroundColor Gray
Start-Sleep -Seconds 8

# Check if server is ready
try {
    $ready = Invoke-RestMethod -Uri "http://127.0.0.1:8023/ready" -TimeoutSec 5
    Write-Host "✓ Server is ready!" -ForegroundColor Green
} catch {
    Write-Host "✗ Server not responding" -ForegroundColor Red
    $job | Stop-Job
    $job | Remove-Job
    exit 1
}

# Test 1: 403 without admin token
Write-Host "`n=== Test 1: Endpoint returns 403 without token ===" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:8023/api/rag/ingest/projects" -Method POST -ErrorAction Stop
    Write-Host "✗ Expected 403 but got $($response.StatusCode)" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 403) {
        $result = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "✓ Got 403: $($result.detail)" -ForegroundColor Green
    } else {
        Write-Host "✗ Unexpected error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 2: 200 with valid token (using structured update - simpler than ingest)
Write-Host "`n=== Test 2: Structured update with valid token ===" -ForegroundColor Yellow
try {
    $headers = @{
        "X-Admin-Token" = $env:ADMIN_TOKEN
        "Content-Type" = "application/json"
    }
    $body = @{
        slug = "clarity-companion"
        status = "in-progress"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "http://127.0.0.1:8023/api/rag/projects/update" -Method POST -Headers $headers -Body $body
    Write-Host "✓ Got 200: ok=$($response.ok), by=$($response.by)" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host "   Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

# Test 3: Run Playwright tests
Write-Host "`n=== Test 3: Running Playwright E2E tests ===" -ForegroundColor Yellow
$env:API_BASE = 'http://127.0.0.1:8023'
npx playwright test tests/e2e/api-rag-admin-gate.spec.ts --project=chromium --reporter=list

# Cleanup
Write-Host "`n=== Cleanup ===" -ForegroundColor Yellow
$job | Stop-Job
$job | Remove-Job
Write-Host "Done!" -ForegroundColor Green
