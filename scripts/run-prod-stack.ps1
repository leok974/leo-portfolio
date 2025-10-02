<#
.SYNOPSIS
  Build production frontend, sync CSP hash into deploy nginx.conf, bring up prod stack with dist + conf overrides, wait for readiness, optionally run focused Playwright guard, optionally keep running.

.PARAMETER Test
  Run focused quick-guard Playwright specs after stack becomes ready.

.PARAMETER KeepUp
  Do not tear down the stack on completion (default tears down if -Test not specified or tests finish successfully).

.PARAMETER Timeout
  Seconds to wait for http readiness (default 60).

.PARAMETER Pattern
  Override the default Playwright -g pattern.

.EXAMPLE
  pwsh scripts/run-prod-stack.ps1 -Test

.EXAMPLE
  pwsh scripts/run-prod-stack.ps1 -Test -Pattern "security headers drift|mime smoke" -KeepUp

#>
[CmdletBinding()]param(
  [switch]$Test,
  [switch]$KeepUp,
  [int]$Timeout = 60,
  [string]$Pattern = 'security headers drift|projects.json conditional|projects json cache|mime smoke|bundle wiring|dist bind-mount parity|root html mime'
)

$ErrorActionPreference = 'Stop'

function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }

# Ensure BASE + strict flag
if (-not $Env:BASE) { $Env:BASE = 'http://localhost:8080' }
$Env:NGINX_STRICT = '1'

Write-Step 'Building frontend (prod)'
try {
  pnpm build:prod | Write-Host
} catch {
  Write-Warning 'build:prod failed, attempting fallback build'
  pnpm build | Write-Host
}

Write-Step 'Syncing CSP hash into deploy/nginx.conf'
try {
  pnpm csp:sync:deploy | Write-Host
} catch {
  Write-Warning 'CSP sync script failed (continuing)'
}

Write-Step 'Starting prod stack (dist + conf overrides)'
$composeFiles = @(
  'deploy/docker-compose.prod.yml',
  'deploy/docker-compose.prod.bind.override.yml',
  'deploy/docker-compose.prod.conf.override.yml'
) | ForEach-Object { '-f'; $_ }
& docker compose @composeFiles up -d --build | Write-Host

Write-Step "Waiting for $Env:BASE (timeout ${Timeout}s)"
$deadline = (Get-Date).AddSeconds($Timeout)
while ($true) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri $Env:BASE -Method Head -TimeoutSec 5
    if ($r.StatusCode -eq 200) { Write-Host "Ready: $($Env:BASE)" -ForegroundColor Green; break }
  } catch {}
  if ((Get-Date) -gt $deadline) { throw "Timed out waiting for $($Env:BASE)" }
  Start-Sleep -Seconds 1
}

if ($Test) {
  Write-Step 'Running focused Playwright guard'
  $cmd = "pnpm exec playwright test -g `"$Pattern`" --reporter=line"
  Write-Host $cmd
  Invoke-Expression $cmd
}

if (-not $KeepUp) {
  Write-Step 'Tearing down stack'
  & docker compose @composeFiles down -v | Write-Host
} else {
  Write-Step 'Stack left running (use docker compose down manually when done)'
}
