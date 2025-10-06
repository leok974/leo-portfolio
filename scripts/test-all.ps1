Param(
  [switch]$Baseline,       # pass to Playwright as --update-snapshots
  [string]$Grep = "",      # optional -g filter for Playwright
  [switch]$FrontendOnly,   # skip backend/infra, only run frontend CSS/UX tests
  [switch]$SkipInfra       # skip infra startup (assumes already running)
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ---- Helper functions ----
function Use-Pkg {
  if (Get-Command pnpm -ErrorAction SilentlyContinue) { return "pnpm" }
  if (Get-Command npm  -ErrorAction SilentlyContinue) { return "npm"  }
  throw "Neither pnpm nor npm is installed."
}
function Run-Pkg {
  param([string]$cmd)
  $pkg = Use-Pkg
  if ($pkg -eq "pnpm") {
    pnpm exec $cmd
  } else {
    npx $cmd
  }
}

# ---- Ensure we always execute from repo root ----
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot   = Resolve-Path (Join-Path $ScriptRoot "..")
Set-Location $RepoRoot
$root = $RepoRoot

# ---- Load .env.test if present (zero-config local runs) ----
$envTestFile = Join-Path $RepoRoot ".env.test"
if (Test-Path $envTestFile) {
  Write-Host "Loading .env.test..." -ForegroundColor Gray
  Get-Content $envTestFile | Where-Object { $_ -match '^\s*[^#]\w+=' } | ForEach-Object {
    $k,$v = $_ -split '=',2
    $key = $k.Trim()
    $val = $v.Trim()
    [System.Environment]::SetEnvironmentVariable($key, $val)
    Write-Host "  $key=$val" -ForegroundColor DarkGray
  }
}

function Find-Dir($candidates){ foreach($c in $candidates){ if(Test-Path $c){ return (Resolve-Path $c).Path } } return $null }
$backendDir = Find-Dir @("apps\backend","backend","server","api","assistant_api")
$webDir     = Find-Dir @("apps\web","web","frontend","ui","src")
if(-not $webDir){ throw "Web directory not found. Create apps/web or web." }

# ---- Frontend-only mode: skip backend, use Vite dev server ----
if ($FrontendOnly) {
  Write-Host "🎨 Frontend-only mode: CSS/UX tests without backend" -ForegroundColor Magenta
  $env:PLAYWRIGHT_GLOBAL_SETUP_SKIP = '1'
  $env:BASE_URL = 'http://127.0.0.1:5173'
}

# ---- Use Docker Desktop Linux engine in this shell ----
if(-not $env:DOCKER_CONTEXT){ $env:DOCKER_CONTEXT = "desktop-linux" }

# ---- Optional: ensure shared infra is running (D:\infra or ../infra) ----
if (-not $SkipInfra -and -not $FrontendOnly) {
  $infra = $env:INFRA_DIR
  if([string]::IsNullOrEmpty($infra)){
    $guess = @("D:\infra","..\..\infra","..\infra")
    foreach($g in $guess){ if(Test-Path $g){ $infra=(Resolve-Path $g).Path; break } }
  }
  if($infra -and (Test-Path (Join-Path $infra "compose.yml"))){
    Write-Host "Starting shared infra at $infra..." -ForegroundColor Cyan
    Push-Location $infra
    docker compose up -d
    Pop-Location
  }
}

# ---- Bring up project-scoped Postgres for E2E if docker-compose.e2e.yml exists ----
if (-not $FrontendOnly -and (Test-Path "$root\docker-compose.e2e.yml")){
  Write-Host "Starting E2E Postgres..." -ForegroundColor Cyan
  docker compose -f docker-compose.e2e.yml up -d pg
  # Wait for health
  $ok=$false
  for($i=0;$i -lt 60;$i++){
    try{
      $out = docker compose -f docker-compose.e2e.yml exec -T pg pg_isready -U app -d app_e2e 2>&1
      if($LASTEXITCODE -eq 0){ $ok=$true; break }
    } catch {}
    Start-Sleep -Seconds 2
  }
  if(-not $ok){ throw "E2E Postgres not healthy." }
  Write-Host "E2E Postgres ready" -ForegroundColor Green
}

# ---- Ensure models if script exists ----
if (-not $FrontendOnly -and (Test-Path "$root\scripts\ensure-models.ps1")){
  Write-Host "Ensuring models..." -ForegroundColor Cyan
  & pwsh "$root\scripts\ensure-models.ps1"
}

# ---- Backend: install dependencies if backend present ----
if (-not $FrontendOnly) {
  $dbHost = $env:E2E_DB_HOST; if([string]::IsNullOrEmpty($dbHost)){ $dbHost = '127.0.0.1' }
  $env:DATABASE_URL = "postgresql+psycopg://app:app@$dbHost:5432/app_e2e"
  if($backendDir){
    Write-Host "Setting up backend at $backendDir..." -ForegroundColor Cyan
    Push-Location $backendDir
    if(Test-Path "requirements.txt"){ python -m pip install -r requirements.txt }
    # Note: This RAG backend doesn't require migrations or seeding
    Pop-Location
  }

  # ---- Backend readiness: probe mode without failing the run ----
  try {
    $healthUrl = "http://127.0.0.1:8080/ready"
    $res = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 5 -ErrorAction Stop
    if ($res.ok -eq $true) {
      Write-Host "✅ Backend ready" -ForegroundColor Green
      # Check if using fallback mode
      $statusUrl = "http://127.0.0.1:8080/api/status/summary"
      try {
        $status = Invoke-RestMethod -Uri $statusUrl -TimeoutSec 3
        if ($status.llm.path -eq "fallback") {
          Write-Warning "⚠️  LLM backend in fallback mode (warmup/skipping). Tests will continue."
          $env:BACKEND_MODE = "fallback"
        } else {
          $env:BACKEND_MODE = "warm"
        }
      } catch {
        $env:BACKEND_MODE = "unknown"
      }
    }
  } catch {
    Write-Warning "⚠️  Health probe failed; proceeding (hermetic flow will surface real failures)."
    $env:BACKEND_MODE = "unavailable"
  }
}

# ---- Web: deps + typecheck ----
Write-Host "Setting up web at $webDir..." -ForegroundColor Cyan
$pkg = Use-Pkg
Write-Host "Using package manager: $pkg" -ForegroundColor Gray
Push-Location $webDir
if(Test-Path "package.json"){
  Write-Host "Installing dependencies..." -ForegroundColor Gray
  if ($pkg -eq "pnpm") { pnpm i } else { npm install }
}
if(Test-Path "package.json"){
  Write-Host "Running typecheck..." -ForegroundColor Gray
  try {
    if ($pkg -eq "pnpm") { pnpm run typecheck } else { npm run typecheck }
  } catch { Write-Host "typecheck failed" -ForegroundColor Red; throw }
}
if(Test-Path "package.json"){
  Write-Host "Running lint..." -ForegroundColor Gray
  if ($pkg -eq "pnpm") { pnpm run lint --if-present } else { npm run lint --if-present }
}
Pop-Location

# ---- Playwright: install browsers and run tests hermetically from project root ----
Write-Host "Installing Playwright browsers..." -ForegroundColor Cyan
Run-Pkg "playwright install --with-deps"
$env:APP_ENV = "dev"
$env:ALLOW_DEV_ROUTES = "1"
$env:DEV_E2E_EMAIL = "leoklemet.pa@gmail.com"
$env:DEV_E2E_PASSWORD = "Superleo3"
$env:DEV_SUPERUSER_PIN = "946281"
$env:E2E_DB_HOST = $dbHost
$env:OLLAMA_HOST = "http://127.0.0.1:11434"

$testArgs = @()
if($Grep){ $testArgs += @("-g",$Grep) }
if($Baseline){ $testArgs += @("--update-snapshots") }

Write-Host "Running Playwright tests..." -ForegroundColor Cyan
$pkg = Use-Pkg
if($pkg -eq "pnpm"){
  if($testArgs.Count -gt 0){
    pnpm exec playwright test @testArgs
  } else {
    pnpm exec playwright test
  }
} else {
  if($testArgs.Count -gt 0){
    npx playwright test @testArgs
  } else {
    npx playwright test
  }
}
$code = $LASTEXITCODE
if($code -ne 0){ exit $code }
Write-Host "✅ All tests completed." -ForegroundColor Green
