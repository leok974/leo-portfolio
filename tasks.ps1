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

switch ($Task) {
  "deps"  { Deps }
  "test"  { Test }
  "build" { Build }
  "run"   { Run }
  "audit" { Audit }
  "latency" { Latency }
  "cmddev" { CmdDev }
  "hyperdev" { HyperDev }
  "webdev" { WebDev }
  "prod" { ProdUp }
  "prod-up" { ProdUp }
  "prod-down" { ProdDown }
  "prod-logs" { ProdLogs }
  "prod-rebuild" { ProdRebuild }
  "tunnel" { Tunnel }
  "tunnel-down" { TunnelDown }
  default { Write-Host "Tasks: deps | test | build | run | audit" }
}
