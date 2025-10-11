#!/usr/bin/env pwsh
# Test script for Orchestration UI enhancements

$API_BASE = "http://localhost:8001"
$OUTPUT_DIR = "test-results"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Orchestration API Testing Script" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Create output directory
if (-Not (Test-Path $OUTPUT_DIR)) {
    New-Item -ItemType Directory -Path $OUTPUT_DIR | Out-Null
}

# Test 1: Health check
Write-Host "Test 1: Health Check" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE/ready" -Method Get
    Write-Host "  ✓ Server is healthy" -ForegroundColor Green
    Write-Host "    Ollama: $($response.checks.ollama.ok)" -ForegroundColor Gray
    Write-Host "    RAG DB: $($response.checks.rag_db.ok)" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ Health check failed: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 2: Basic pagination
Write-Host "Test 2: Basic Pagination (limit=10)" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE/agents/tasks/paged?limit=10" -Method Get
    Write-Host "  ✓ Returned $($response.items.Count) tasks" -ForegroundColor Green
    if ($response.next_cursor) {
        Write-Host "    Has next page (cursor: $($response.next_cursor.Substring(0, 20))...)" -ForegroundColor Gray
    } else {
        Write-Host "    No more pages" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ✗ Pagination test failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 3: Status filter (single)
Write-Host "Test 3: Status Filter (succeeded)" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE/agents/tasks/paged?status=succeeded&limit=10" -Method Get
    Write-Host "  ✓ Returned $($response.items.Count) succeeded tasks" -ForegroundColor Green
    $allSucceeded = $response.items | Where-Object { $_.status -ne "succeeded" } | Measure-Object | Select-Object -ExpandProperty Count
    if ($allSucceeded -eq 0) {
        Write-Host "    All tasks have status=succeeded" -ForegroundColor Gray
    } else {
        Write-Host "    Warning: Found $allSucceeded tasks with other statuses" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ✗ Status filter test failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 4: Status filter (multiple)
Write-Host "Test 4: Status Filter (succeeded + failed)" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE/agents/tasks/paged?status=succeeded&status=failed&limit=10" -Method Get
    Write-Host "  ✓ Returned $($response.items.Count) tasks (succeeded or failed)" -ForegroundColor Green
    $succeeded = ($response.items | Where-Object { $_.status -eq "succeeded" }).Count
    $failed = ($response.items | Where-Object { $_.status -eq "failed" }).Count
    Write-Host "    Succeeded: $succeeded, Failed: $failed" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ Multi-status filter test failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 5: Task filter
Write-Host "Test 5: Task Filter (seo.validate)" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE/agents/tasks/paged?task=seo.validate&limit=10" -Method Get
    Write-Host "  ✓ Returned $($response.items.Count) seo.validate tasks" -ForegroundColor Green
    $allSeo = $response.items | Where-Object { $_.task -ne "seo.validate" } | Measure-Object | Select-Object -ExpandProperty Count
    if ($allSeo -eq 0) {
        Write-Host "    All tasks have task=seo.validate" -ForegroundColor Gray
    } else {
        Write-Host "    Warning: Found $allSeo tasks with other names" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ✗ Task filter test failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 6: Combined filters
Write-Host "Test 6: Combined Filters (succeeded + seo.validate)" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE/agents/tasks/paged?status=succeeded&task=seo.validate&limit=10" -Method Get
    Write-Host "  ✓ Returned $($response.items.Count) succeeded seo.validate tasks" -ForegroundColor Green
    $matching = $response.items | Where-Object { $_.status -eq "succeeded" -and $_.task -eq "seo.validate" } | Measure-Object | Select-Object -ExpandProperty Count
    Write-Host "    Matching both filters: $matching" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ Combined filters test failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 7: Since filter
Write-Host "Test 7: Since Filter (last 7 days)" -ForegroundColor Yellow
try {
    $sevenDaysAgo = (Get-Date).AddDays(-7).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $response = Invoke-RestMethod -Uri "$API_BASE/agents/tasks/paged?since=$sevenDaysAgo&limit=10" -Method Get
    Write-Host "  ✓ Returned $($response.items.Count) tasks from last 7 days" -ForegroundColor Green
    Write-Host "    Since: $sevenDaysAgo" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ Since filter test failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 8: CSV export (basic)
Write-Host "Test 8: CSV Export (basic, limit=100)" -ForegroundColor Yellow
try {
    $csvPath = "$OUTPUT_DIR/tasks_basic.csv"
    Invoke-WebRequest -Uri "$API_BASE/agents/tasks/paged.csv?limit=100" -OutFile $csvPath
    $lineCount = (Get-Content $csvPath | Measure-Object -Line).Lines
    Write-Host "  ✓ Downloaded CSV with $lineCount lines" -ForegroundColor Green
    Write-Host "    Saved to: $csvPath" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ CSV export test failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 9: CSV export (filtered)
Write-Host "Test 9: CSV Export (filtered by status=succeeded)" -ForegroundColor Yellow
try {
    $csvPath = "$OUTPUT_DIR/tasks_succeeded.csv"
    Invoke-WebRequest -Uri "$API_BASE/agents/tasks/paged.csv?status=succeeded&limit=100" -OutFile $csvPath
    $lineCount = (Get-Content $csvPath | Measure-Object -Line).Lines
    Write-Host "  ✓ Downloaded filtered CSV with $lineCount lines" -ForegroundColor Green
    Write-Host "    Saved to: $csvPath" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ Filtered CSV export test failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 10: CSV export (combined filters)
Write-Host "Test 10: CSV Export (combined filters)" -ForegroundColor Yellow
try {
    $csvPath = "$OUTPUT_DIR/tasks_combined.csv"
    $sevenDaysAgo = (Get-Date).AddDays(-7).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    Invoke-WebRequest -Uri "$API_BASE/agents/tasks/paged.csv?since=$sevenDaysAgo&status=succeeded&task=seo.validate&limit=100" -OutFile $csvPath
    $lineCount = (Get-Content $csvPath | Measure-Object -Line).Lines
    Write-Host "  ✓ Downloaded combined filtered CSV with $lineCount lines" -ForegroundColor Green
    Write-Host "    Saved to: $csvPath" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ Combined filters CSV export test failed: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Testing Complete!" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "CSV files saved to: $OUTPUT_DIR" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Review CSV files in $OUTPUT_DIR" -ForegroundColor Gray
Write-Host "2. Test frontend UI at http://localhost:8080/?admin=1" -ForegroundColor Gray
Write-Host "3. Navigate to Agent Orchestration → Task History" -ForegroundColor Gray
Write-Host "4. Test status filter pills, task filter input, and CSV download button" -ForegroundColor Gray
