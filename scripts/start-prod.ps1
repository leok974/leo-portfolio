param(
  [string]$ComposeFile = "deploy/docker-compose.prod.yml"
)

function Test-Docker {
  try {
    docker version --format '{{.Server.Version}}' 1>$null 2>$null
    return $true
  } catch { return $false }
}

function Restart-DockerDesktop {
  Write-Host "Restarting Docker Desktop service..." -ForegroundColor Yellow
  Stop-Service com.docker.service -ErrorAction SilentlyContinue
  wsl --shutdown
  Start-Sleep -Seconds 2
  Start-Service com.docker.service
  Write-Host "Docker Desktop restarted" -ForegroundColor Green
}

if (-not (Test-Docker)) {
  Restart-DockerDesktop
  # Wait a bit for daemon
  for ($i=0; $i -lt 30; $i++) {
    if (Test-Docker) { break }
    Start-Sleep -Seconds 1
  }
}

$_composeArgs = @('-f', $ComposeFile)
Write-Host "Bringing up stack..." -ForegroundColor Cyan
& docker compose @$_composeArgs up -d --remove-orphans

$base = "http://127.0.0.1:8080"
Write-Host "Waiting for nginx/edge..." -ForegroundColor Cyan
for ($i=0; $i -lt 40; $i++) {
  try {
    (Invoke-WebRequest "$base/_up" -UseBasicParsing -TimeoutSec 2) 1>$null
    break
  } catch { Start-Sleep 1 }
}

Write-Host "Waiting for backend summary..." -ForegroundColor Cyan
for ($i=0; $i -lt 60; $i++) {
  try {
    $r = Invoke-WebRequest "$base/api/status/summary" -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -eq 200) { break }
  } catch { Start-Sleep 1 }
}

try {
  $summary = (Invoke-WebRequest "$base/api/status/summary" -UseBasicParsing -TimeoutSec 3).Content | ConvertFrom-Json
  $path = $summary.llm.path
  $present = $summary.llm.primary_model_present
  Write-Host ("Stack ready · path={0} model_present={1}" -f $path, $present) -ForegroundColor Green
} catch {
  Write-Warning "Stack started but summary could not be parsed."
}
