#!/usr/bin/env pwsh
# Run dev overlay E2E tests

Write-Host "`n=== Dev Overlay E2E Test Runner ===" -ForegroundColor Cyan

# Check if backend is running
Write-Host "`n[1/3] Checking backend..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8001/ready" -Method GET -TimeoutSec 2
    if ($health.ok) {
        Write-Host "✅ Backend is running on port 8001" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Backend health check failed" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Backend not responding on port 8001" -ForegroundColor Red
    Write-Host "   Start backend: python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001" -ForegroundColor Gray
    exit 1
}

# Check if frontend dev server is running
Write-Host "`n[2/3] Checking frontend dev server..." -ForegroundColor Yellow
try {
    $frontend = Invoke-WebRequest -Uri "http://localhost:5173" -Method GET -TimeoutSec 2 -UseBasicParsing
    if ($frontend.StatusCode -eq 200) {
        Write-Host "✅ Frontend dev server running on port 5173" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Frontend returned status $($frontend.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Frontend dev server not responding on port 5173" -ForegroundColor Red
    Write-Host "   Start frontend: npm run dev" -ForegroundColor Gray
    Write-Host "   Or use preview: npm run preview (port 4173)" -ForegroundColor Gray
    exit 1
}

# Run the dev overlay tests
Write-Host "`n[3/3] Running dev overlay E2E tests..." -ForegroundColor Yellow
Write-Host ""

npx playwright test tests/e2e/dev-overlay.spec.ts --project=chromium

$exitCode = $LASTEXITCODE

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "✅ All dev overlay tests passed!" -ForegroundColor Green
} else {
    Write-Host "❌ Some tests failed. Exit code: $exitCode" -ForegroundColor Red
    Write-Host ""
    Write-Host "To debug:" -ForegroundColor Yellow
    Write-Host "  npx playwright test tests/e2e/dev-overlay.spec.ts --project=chromium --headed" -ForegroundColor Gray
    Write-Host "  npx playwright test tests/e2e/dev-overlay.spec.ts --project=chromium --debug" -ForegroundColor Gray
}

Write-Host ""
exit $exitCode
