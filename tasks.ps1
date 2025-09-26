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
  default { Write-Host "Tasks: deps | test | build | run | audit" }
}
