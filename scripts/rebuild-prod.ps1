Param(
  [switch]$Clean,
  [string]$ComposeFile = "deploy/docker-compose.prod.yml",
  [string]$PrimaryModel = "gpt-oss:20b"
)

Write-Host "Rebuilding production stack using $ComposeFile" -ForegroundColor Cyan

if ($Clean) {
  Write-Host "Stopping and removing existing stack..." -ForegroundColor Yellow
  docker compose -f $ComposeFile down --remove-orphans
}

# Pass through build SHA if available
$gitSha = (git rev-parse --short HEAD) 2>$null
if (-not $gitSha) { $gitSha = "local" }

Write-Host "Using GIT_SHA=$gitSha PRIMARY_MODEL=$PrimaryModel" -ForegroundColor Green
$env:GIT_SHA = $gitSha
$env:PRIMARY_MODEL = $PrimaryModel

docker compose -f $ComposeFile build --pull

Write-Host "Starting stack..." -ForegroundColor Cyan
docker compose -f $ComposeFile up -d

Write-Host "Waiting for backend health (poll /ready)..." -ForegroundColor Cyan
for ($i=0; $i -lt 120; $i++) {
  try {
    $resp = curl -s http://localhost:8080/api/status/summary 2>$null
    if ($LASTEXITCODE -eq 0 -and $resp) {
      if ($resp -match '"ready":true') { Write-Host "Backend ready." -ForegroundColor Green; break }
    }
  } catch { }
  Start-Sleep -Seconds 2
}

Write-Host "Current status snippet:" -ForegroundColor Yellow
curl -s http://localhost:8080/api/status/summary | Select-String -Pattern 'ready' -Context 0,3

Write-Host "Done. Use scripts/status-health.ps1 -AssistHost <host> to cross-origin verify." -ForegroundColor Green
