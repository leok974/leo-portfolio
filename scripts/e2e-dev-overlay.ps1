#!/usr/bin/env pwsh
#Requires -Version 7

<#
.SYNOPSIS
    Local dev environment setup and E2E test runner for dev overlay tests.

.DESCRIPTION
    Starts backend (uvicorn) and frontend (Vite) servers, waits for them to be ready,
    then runs the dev overlay and SEO E2E tests. Designed to match CI environment exactly.

.EXAMPLE
    .\scripts\e2e-dev-overlay.ps1

.EXAMPLE
    .\scripts\e2e-dev-overlay.ps1 -SkipServers
    # Assumes servers are already running
#>

param(
    [switch]$SkipServers,
    [switch]$Headed,
    [string]$TestPattern = "tests/e2e/dev-overlay*.spec.ts tests/e2e/seo-pr-persist.spec.ts"
)

$ErrorActionPreference = "Stop"

Write-Host "🔧 E2E Dev Overlay Test Runner" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Check if backend and frontend are already running
$backendRunning = $false
$frontendRunning = $false

try {
    $null = Invoke-WebRequest -Uri "http://127.0.0.1:8001/ready" -TimeoutSec 2 -UseBasicParsing 2>$null
    $backendRunning = $true
    Write-Host "✓ Backend already running on port 8001" -ForegroundColor Green
} catch {
    Write-Host "○ Backend not running" -ForegroundColor Yellow
}

try {
    $null = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 2 -UseBasicParsing 2>$null
    $frontendRunning = $true
    Write-Host "✓ Frontend already running on port 5173" -ForegroundColor Green
} catch {
    Write-Host "○ Frontend not running" -ForegroundColor Yellow
}

# Start servers if needed
if (-not $SkipServers) {
    if (-not $backendRunning) {
        Write-Host "`n🚀 Starting backend server..." -ForegroundColor Cyan
        $backendJob = Start-Job -ScriptBlock {
            Set-Location $using:PWD
            $env:SCHEDULER_ENABLED = '0'
            $env:SITEAGENT_DEV_COOKIE_KEY = 'test-key-for-e2e-only'
            $env:SITEAGENT_HMAC_SECRET = 'local-dev-secret-12345'
            python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001
        }
        Write-Host "  Backend job started (ID: $($backendJob.Id))" -ForegroundColor Gray
    }

    if (-not $frontendRunning) {
        Write-Host "🚀 Starting Vite dev server..." -ForegroundColor Cyan
        $frontendJob = Start-Job -ScriptBlock {
            Set-Location $using:PWD
            pnpm dev
        }
        Write-Host "  Frontend job started (ID: $($frontendJob.Id))" -ForegroundColor Gray
    }

    # Wait for services to be ready
    Write-Host "`n⏳ Waiting for services to be ready..." -ForegroundColor Cyan

    # Install wait-on if not present
    if (-not (Get-Command wait-on -ErrorAction SilentlyContinue)) {
        Write-Host "  Installing wait-on..." -ForegroundColor Gray
        npm install -g wait-on | Out-Null
    }

    try {
        npx wait-on -t 60000 http://127.0.0.1:8001/ready http://localhost:5173
        Write-Host "✓ Services ready!" -ForegroundColor Green
    } catch {
        Write-Host "✗ Services failed to start within timeout" -ForegroundColor Red
        if ($backendJob) { Stop-Job $backendJob; Remove-Job $backendJob }
        if ($frontendJob) { Stop-Job $frontendJob; Remove-Job $frontendJob }
        exit 1
    }
}

# Run tests
Write-Host "`n🧪 Running E2E tests..." -ForegroundColor Cyan
Write-Host "  Pattern: $TestPattern" -ForegroundColor Gray
Write-Host "  Projects: setup, chromium-dev-overlay`n" -ForegroundColor Gray

$env:BASE_URL = 'http://localhost:5173'

$playwrightArgs = @(
    'playwright', 'test',
    $TestPattern.Split(' '),
    '--project=setup',
    '--project=chromium-dev-overlay'
)

if ($Headed) {
    $playwrightArgs += '--headed'
}

try {
    & pnpm @playwrightArgs
    $testExitCode = $LASTEXITCODE
} catch {
    $testExitCode = 1
}

# Cleanup if we started servers
if (-not $SkipServers) {
    Write-Host "`n🧹 Cleaning up..." -ForegroundColor Cyan
    if ($backendJob) {
        Stop-Job $backendJob -ErrorAction SilentlyContinue
        Remove-Job $backendJob -ErrorAction SilentlyContinue
    }
    if ($frontendJob) {
        Stop-Job $frontendJob -ErrorAction SilentlyContinue
        Remove-Job $frontendJob -ErrorAction SilentlyContinue
    }
}

# Summary
Write-Host "`n================================" -ForegroundColor Cyan
if ($testExitCode -eq 0) {
    Write-Host "✓ All tests passed!" -ForegroundColor Green
} else {
    Write-Host "✗ Tests failed (exit code: $testExitCode)" -ForegroundColor Red
}
Write-Host "================================`n" -ForegroundColor Cyan

exit $testExitCode
