param([Parameter(Position=0)][string]$Task = "help")

function Deps {
  $ErrorActionPreference = "Stop"
  python -m pip install --upgrade pip
  pip install -r assistant_api/requirements.in
  pip freeze > assistant_api/requirements.txt
  pytest -q
  Write-Host "✅ Deps pinned & tests green."
}

function Test { pytest -q }
function Build {
  $env:DOCKER_BUILDKIT = "1"
  docker build -t leo-portfolio-backend ./assistant_api
}
function Run {
  docker run --rm -p 8001:8000 --name leo-portfolio leo-portfolio-backend
}
function Audit {
  python -m pip install pip-audit
  pip-audit --strict
}

function CmdDev {
  Write-Host "Starting cmddev (loop policy enforced)" -ForegroundColor Cyan
  $env:HOST = ${env:HOST} ? ${env:HOST} : "127.0.0.1"
  if (-not $env:PORT) { $env:PORT = "8010" }
  python assistant_api/run_cmddev.py
}

function HyperDev {
  Write-Host "Starting hypercorn dev server" -ForegroundColor Cyan
  if (-not (Get-Command hypercorn -ErrorAction SilentlyContinue)) {
    Write-Host "Hypercorn not installed in this venv. Install with: pip install hypercorn" -ForegroundColor Yellow
  }
  if (-not $env:PORT) { $env:PORT = "8010" }
  hypercorn assistant_api.main:app --bind 127.0.0.1:$env:PORT --workers 1 --log-level info
}

function WebDev {
  Write-Host "Starting static web server (browser-sync)" -ForegroundColor Cyan
  if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    Write-Host "Node / npx not found. Install Node.js to use WebDev." -ForegroundColor Red
    exit 1
  }
  if (-not $env:WEB_PORT) { $env:WEB_PORT = "5530" }
  npx browser-sync start --server --no-ui --no-notify --host 127.0.0.1 --port $env:WEB_PORT --files "index.html,*.css,main.js,js/**/*.js,projects/**/*.html,assets/**/*,manifest.webmanifest,sw.js,projects.json"
}

function ProdUp {
  Write-Host "Starting production stack (deploy/docker-compose.prod.yml)" -ForegroundColor Cyan
  docker compose -f deploy/docker-compose.prod.yml up -d
}

function ProdDown {
  Write-Host "Stopping production stack" -ForegroundColor Cyan
  docker compose -f deploy/docker-compose.prod.yml down
}

function ProdLogs {
  Write-Host "Tailing production stack logs (Ctrl+C to exit)" -ForegroundColor Cyan
  docker compose -f deploy/docker-compose.prod.yml logs -f
}

function ProdRebuild {
  Write-Host "Rebuilding + recreating production stack" -ForegroundColor Cyan
  docker compose -f deploy/docker-compose.prod.yml build --pull
  docker compose -f deploy/docker-compose.prod.yml up -d --force-recreate --remove-orphans
}

function ProdBind {
  Write-Host "Starting prod stack with bind-mounted dist (prod.bind override)" -ForegroundColor Cyan
  if (-not (Test-Path dist/index.html)) {
    Write-Host "dist missing; building..." -ForegroundColor Yellow
    pnpm build:prod | Out-Null
  }
  docker compose -f deploy/docker-compose.prod.yml -f deploy/docker-compose.prod.bind.override.yml up -d
  Write-Host "=> Access at http://localhost:8080/" -ForegroundColor Green
}

function ProdBindRestart {
  Write-Host "Rebuilding dist and restarting nginx (bind override)" -ForegroundColor Cyan
  pnpm build:prod | Out-Null
  docker compose -f deploy/docker-compose.prod.yml -f deploy/docker-compose.prod.bind.override.yml restart nginx
  Write-Host "=> Refreshed assets deployed" -ForegroundColor Green
}

function Tunnel {
  Write-Host "Starting Cloudflare tunnel sidecar" -ForegroundColor Cyan
  # Health check backend readiness
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:8001/ready" -Method GET -TimeoutSec 3
    if ($resp.StatusCode -ne 200) { Write-Host "Backend /ready returned $($resp.StatusCode); aborting tunnel start." -ForegroundColor Red; exit 2 }
  } catch {
    Write-Host "Backend /ready unreachable; start backend first (tasks.ps1 prod)." -ForegroundColor Red; exit 2
  }
  if (-not $env:CLOUDFLARE_TUNNEL_TOKEN) {
    $tokenFile = Join-Path $PSScriptRoot 'secrets/cloudflared_token'
    if (-not (Test-Path $tokenFile)) { $tokenFile = Join-Path $PSScriptRoot '../secrets/cloudflared_token' }
    if (Test-Path $tokenFile) { $env:CLOUDFLARE_TUNNEL_TOKEN = Get-Content $tokenFile -Raw | Select-Object -First 1 }
  }
  if (-not $env:CLOUDFLARE_TUNNEL_TOKEN) { Write-Host "Token missing. Set CLOUDFLARE_TUNNEL_TOKEN or create secrets/cloudflared_token" -ForegroundColor Red; exit 1 }
  docker compose -f deploy/docker-compose.prod.yml -f deploy/docker-compose.tunnel.override.yml up -d cloudflared
}

function TunnelDown {
  Write-Host "Stopping Cloudflare tunnel sidecar" -ForegroundColor Cyan
  docker compose -f deploy/docker-compose.prod.yml -f deploy/docker-compose.tunnel.override.yml rm -sfv cloudflared | Out-Null
}

function EnvInit {
  $template = Join-Path (Get-Location) '.env.deploy.example'
  $dest = Join-Path (Get-Location) '.env'
  if (Test-Path $dest) {
    Write-Host ".env already exists (skipping)" -ForegroundColor Yellow
  } elseif (-not (Test-Path $template)) {
    Write-Host ".env.deploy.example missing; cannot initialize." -ForegroundColor Red; exit 1
  } else {
    Copy-Item $template $dest
    Write-Host "Created .env from template" -ForegroundColor Green
  }
}

function Latency {
  Write-Host "Probing primary latency (direct /models sampling)..."
  try {
    $resp = Invoke-RestMethod -Uri "http://127.0.0.1:8001/llm/primary/latency2?count=8&warmup=2" -TimeoutSec 5
    $resp | ConvertTo-Json -Depth 6
  } catch {
    Write-Host "Latency probe failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
  }
}

function Invoke-StrictNginxSmoke {
  param(
    [string]$Base = "http://localhost:5178",
    [string]$ComposeFile = "docker-compose.test.yml",
    [switch]$FullSuite
  )
  try {
    Write-Host "==> Build dist" -ForegroundColor Cyan
    pnpm build:prod | Out-Null
    Write-Host "==> Sync CSP hash" -ForegroundColor Cyan
  # Extract hashes from built dist index.html (required by extractor now)
  if (-not (Test-Path "dist/index.html")) { throw "dist/index.html missing after build" }
  pnpm exec node scripts/csp-hash-extract.mjs --html dist/index.html | Out-Null
    pnpm csp:sync:test | Out-Null
    Write-Host "==> Compose up ($ComposeFile)" -ForegroundColor Cyan
    docker compose -f $ComposeFile up -d | Out-Null
    Write-Host "==> Wait for /healthz" -ForegroundColor Cyan
    $ok = $false
    foreach ($i in 1..60) {
      try {
        $r = Invoke-WebRequest "$Base/healthz" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($r.StatusCode -eq 204) { $ok = $true; break }
      } catch {}
      Start-Sleep -Seconds 1
    }
    if (-not $ok) { throw "web-test did not become healthy in time" }
    $env:BASE = $Base
    $env:REQUIRE_CSS_200 = '1'
    $env:REQUIRE_STATUS_PILL_STRICT = '1'
  $env:PLAYWRIGHT_STRICT_STREAM = '1'
  $env:NGINX_STRICT = '1'
  # Static nginx test stack does not include backend API; allow backend-dependent tests to skip
  if (-not $env:BACKEND_REQUIRED) { $env:BACKEND_REQUIRED = '0' }
    if ($FullSuite) {
      pnpm exec playwright test
    } else {
      pnpm test:smoke
    }
  } finally {
    Write-Host "==> Compose down" -ForegroundColor Cyan
    docker compose -f $ComposeFile down -v | Out-Null
  }
}

function Invoke-StrictNginxFullStack {
  param(
    [string]$Base = "http://localhost:8080",
    [switch]$FullSuite
  )
  $compose = "docker-compose.test.full.yml"
  try {
    Write-Host "==> Build dist" -ForegroundColor Cyan
    pnpm build:prod | Out-Null
    Write-Host "==> Sync CSP hash" -ForegroundColor Cyan
    if (-not (Test-Path "dist/index.html")) { throw "dist/index.html missing after build" }
    pnpm exec node scripts/csp-hash-extract.mjs --html dist/index.html | Out-Null
    pnpm csp:sync:test | Out-Null
    Write-Host "==> Compose up ($compose)" -ForegroundColor Cyan
    docker compose -f $compose up -d | Out-Null
    Write-Host "==> Wait for web /healthz" -ForegroundColor Cyan
    $ok = $false
    foreach ($i in 1..90) {
      try {
        $r = Invoke-WebRequest "$Base/healthz" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($r.StatusCode -eq 204) { $ok = $true; break }
      } catch {}
      Start-Sleep -Milliseconds 750
    }
    if (-not $ok) { throw "web-test did not become healthy in time" }
    Write-Host "==> Wait for backend /api/ready" -ForegroundColor Cyan
    $bOk = $false
    foreach ($i in 1..60) {
      try {
        $r2 = Invoke-WebRequest "http://localhost:8101/api/ready" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($r2.StatusCode -eq 200) { $bOk = $true; break }
      } catch {}
      Start-Sleep -Milliseconds 750
    }
    if (-not $bOk) { throw "backend-test did not become ready in time" }
    $env:BASE = $Base
    $env:REQUIRE_CSS_200 = '1'
    $env:REQUIRE_STATUS_PILL_STRICT = '1'
    $env:PLAYWRIGHT_STRICT_STREAM = '1'
    $env:NGINX_STRICT = '1'
    $env:BACKEND_REQUIRED = '1'
    if ($FullSuite) {
      pnpm exec playwright test
    } else {
      pnpm test:smoke
    }
  } finally {
    Write-Host "==> Compose down" -ForegroundColor Cyan
    docker compose -f $compose down -v | Out-Null
  }
}

switch ($Task) {
  "deps"  { Deps }
  "test"  { Test }
  "build" { Build }
  "run"   { Run }
  "audit" { Audit }
  "latency" { Latency }
  "strict-nginx" { Invoke-StrictNginxSmoke }
  "strict-nginx-full" { Invoke-StrictNginxSmoke -FullSuite }
  "strict-nginx-fullstack" { Invoke-StrictNginxFullStack }
  "strict-nginx-fullstack-full" { Invoke-StrictNginxFullStack -FullSuite }
  "cmddev" { CmdDev }
  "hyperdev" { HyperDev }
  "webdev" { WebDev }
  "prod" { ProdUp }
  "prod-up" { ProdUp }
  "prod-down" { ProdDown }
  "prod-logs" { ProdLogs }
  "prod-rebuild" { ProdRebuild }
  "prod-bind" { ProdBind }
  "prod-bind-restart" { ProdBindRestart }
  "tunnel" { Tunnel }
  "tunnel-down" { TunnelDown }
  "env-init" { EnvInit }
  default { Write-Host "Tasks: deps | test | build | run | audit" }
}
