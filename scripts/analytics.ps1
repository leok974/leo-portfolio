# Analytics Pipeline Runner (PowerShell)
# Phase 51.0 — Analytics Loop / RAG Insights

param(
    [string]$Date = "",
    [int]$WindowDays = 7
)

Write-Host "🚀 Running Analytics Pipeline..." -ForegroundColor Cyan
Write-Host ""

# Build command
$cmd = "python -m analytics.pipeline --window-days $WindowDays"

if ($Date -ne "") {
    $cmd += " --date $Date"
    Write-Host "📅 Date: $Date" -ForegroundColor Yellow
}

Write-Host "📊 Window: $WindowDays days" -ForegroundColor Yellow
Write-Host ""

# Run pipeline
Invoke-Expression $cmd

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Analytics pipeline completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📄 Reports generated:" -ForegroundColor Cyan
    Write-Host "   - analytics/outputs/insight-summary.md"
    Write-Host "   - analytics/outputs/trend-report.json"
    Write-Host ""
    Write-Host "View insight:" -ForegroundColor Cyan
    Write-Host "   code analytics/outputs/insight-summary.md"
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Analytics pipeline failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
    exit $LASTEXITCODE
}
