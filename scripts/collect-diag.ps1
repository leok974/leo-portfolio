#Requires -Version 5.1
<#
.SYNOPSIS
    Collect diagnostic information for post-mortem analysis.

.DESCRIPTION
    Gathers container logs, health endpoints, metrics, and test results
    into a timestamped artifacts directory for debugging test failures.

.PARAMETER OutDir
    Output directory for diagnostics. Defaults to artifacts/diag-{timestamp}.

.PARAMETER Containers
    Array of container names to collect logs from.

.EXAMPLE
    pwsh ./scripts/collect-diag.ps1

.EXAMPLE
    pwsh ./scripts/collect-diag.ps1 -OutDir ./my-diag -Containers @('portfolio-nginx-1','portfolio-backend-1')
#>

param(
  [string]$OutDir = "$(Join-Path $PSScriptRoot '..' 'artifacts' ('diag-' + (Get-Date -Format 'yyyyMMdd-HHmmss')))",
  [string[]]$Containers = @(
    'portfolio-nginx-1',
    'portfolio-backend-1',
    'infra-pg-1',
    'infra-ollama-1',
    'infra-cloudflared-1'
  )
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"  # Don't stop on individual fetch errors

Write-Host "📦 Collecting diagnostics..." -ForegroundColor Cyan
Write-Host "Output directory: $OutDir" -ForegroundColor Gray

# Create output directory
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# ---- Collect container logs ----
Write-Host "`n📝 Collecting container logs..." -ForegroundColor Cyan
foreach ($c in $Containers) {
  try {
    Write-Host "  - $c" -ForegroundColor Gray
    $logPath = Join-Path $OutDir "$c.log"
    docker logs --tail 400 $c *> $logPath 2>&1
    if ($LASTEXITCODE -ne 0) {
      "[$c] Container not found or not running" | Out-File -Append (Join-Path $OutDir "errors.txt")
    }
  } catch {
    "`n[$c] log fetch error: $($_.Exception.Message)" | Out-File -Append (Join-Path $OutDir "errors.txt")
  }
}

# ---- Collect docker ps output ----
Write-Host "`n🐳 Collecting docker ps..." -ForegroundColor Cyan
try {
  docker ps --all --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | Out-File -Encoding utf8 (Join-Path $OutDir "docker-ps.txt")
} catch {
  "docker ps error: $($_.Exception.Message)" | Out-File -Append (Join-Path $OutDir "errors.txt")
}

# ---- Collect local endpoints ----
Write-Host "`n🌐 Collecting local endpoints..." -ForegroundColor Cyan
$urls = @(
  "http://127.0.0.1:8080/ready",
  "http://127.0.0.1:8080/api/status/summary",
  "http://127.0.0.1:8080/api/metrics",
  "http://127.0.0.1:8080/api/llm/models",
  "http://127.0.0.1:8080/",
  "http://127.0.0.1:11434/api/tags"
)

foreach ($u in $urls) {
  try {
    Write-Host "  - $u" -ForegroundColor Gray
    $filename = $u -replace 'http://', '' -replace '[:/]+', '_'
    $outPath = Join-Path $OutDir "$filename.txt"

    $response = Invoke-WebRequest -Uri $u -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    $response.Content | Out-File -Encoding utf8 $outPath
    "Status: $($response.StatusCode)`n$($response.Content)" | Out-File -Encoding utf8 $outPath
  } catch {
    $filename = $u -replace 'http://', '' -replace '[:/]+', '_'
    "[$u] fetch error: $($_.Exception.Message)" | Out-File -Append (Join-Path $OutDir "errors.txt")
    "[$u] Not available - $($_.Exception.Message)" | Out-File -Encoding utf8 (Join-Path $OutDir "$filename.txt")
  }
}

# ---- Collect Playwright test results ----
Write-Host "`n🎭 Collecting Playwright test results..." -ForegroundColor Cyan
$playwrightDirs = @(
  (Join-Path $PSScriptRoot ".." "test-results"),
  (Join-Path $PSScriptRoot ".." "playwright-report")
)

foreach ($dir in $playwrightDirs) {
  if (Test-Path $dir) {
    $destName = Split-Path $dir -Leaf
    Write-Host "  - $destName" -ForegroundColor Gray
    Copy-Item $dir (Join-Path $OutDir $destName) -Recurse -Force -ErrorAction SilentlyContinue
  }
}

# ---- Collect environment info ----
Write-Host "`n💻 Collecting environment info..." -ForegroundColor Cyan
$envInfo = @"
Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
PowerShell: $($PSVersionTable.PSVersion)
OS: $([System.Environment]::OSVersion.VersionString)
Docker Context: $($env:DOCKER_CONTEXT)
Node Version: $(node --version 2>&1)
npm Version: $(npm --version 2>&1)
pnpm Version: $(pnpm --version 2>&1)
Python Version: $(python --version 2>&1)

Environment Variables:
  APP_ENV=$($env:APP_ENV)
  BASE_URL=$($env:BASE_URL)
  BACKEND_MODE=$($env:BACKEND_MODE)
  OLLAMA_HOST=$($env:OLLAMA_HOST)
  DATABASE_URL=$($env:DATABASE_URL)
  PLAYWRIGHT_GLOBAL_SETUP_SKIP=$($env:PLAYWRIGHT_GLOBAL_SETUP_SKIP)
"@

$envInfo | Out-File -Encoding utf8 (Join-Path $OutDir "environment.txt")

# ---- Create summary ----
$errorFile = Join-Path $OutDir "errors.txt"
$hasErrors = (Test-Path $errorFile) -and ((Get-Content $errorFile -ErrorAction SilentlyContinue).Length -gt 0)

Write-Host "`n✅ Diagnostics collection complete!" -ForegroundColor Green
Write-Host "📁 Location: $OutDir" -ForegroundColor Cyan

if ($hasErrors) {
  Write-Host "⚠️  Some errors occurred during collection. See errors.txt" -ForegroundColor Yellow
}

# Return the output directory path for CI/CD
return $OutDir
