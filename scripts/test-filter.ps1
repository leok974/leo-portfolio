#!/usr/bin/env pwsh
# Quick test runner for homepage filter tests
# Usage: ./scripts/test-filter.ps1 [-Headed] [-Debug] [-Specific <pattern>]

param(
    [switch]$Headed,
    [switch]$Debug,
    [switch]$UI,
    [string]$Specific = ""
)

Write-Host "`n🧪 Running Homepage Filter Tests`n" -ForegroundColor Cyan

$testFile = "tests/e2e/home-filter.spec.ts"

# Build command
$cmd = "npx playwright test $testFile"

if ($Headed) {
    $cmd += " --headed"
    Write-Host "Mode: Headed (browser visible)" -ForegroundColor Yellow
}

if ($Debug) {
    $cmd += " --debug"
    Write-Host "Mode: Debug (step through)" -ForegroundColor Yellow
}

if ($UI) {
    $cmd += " --ui"
    Write-Host "Mode: UI (interactive mode)" -ForegroundColor Yellow
}

if ($Specific) {
    $cmd += " -g `"$Specific`""
    Write-Host "Filter: $Specific" -ForegroundColor Yellow
}

Write-Host "`nCommand: $cmd`n" -ForegroundColor Gray

# Run tests
Invoke-Expression $cmd

$exitCode = $LASTEXITCODE

Write-Host "`n" -NoNewline

if ($exitCode -eq 0) {
    Write-Host "✅ All tests passed!" -ForegroundColor Green
} else {
    Write-Host "❌ Some tests failed (exit code: $exitCode)" -ForegroundColor Red
    Write-Host "`nTips:" -ForegroundColor Yellow
    Write-Host "  • Run with -Headed to see browser" -ForegroundColor White
    Write-Host "  • Run with -Debug to step through" -ForegroundColor White
    Write-Host "  • Run with -UI for interactive mode" -ForegroundColor White
    Write-Host "  • Check test output above for details" -ForegroundColor White
}

Write-Host ""

# Show report if tests ran
if (Test-Path "playwright-report") {
    Write-Host "📊 HTML report available. Open with:" -ForegroundColor Cyan
    Write-Host "   npx playwright show-report" -ForegroundColor White
    Write-Host ""
}

exit $exitCode
