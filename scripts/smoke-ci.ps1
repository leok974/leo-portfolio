param(
  [string]$BaseUrl = "http://127.0.0.1:8001",
  [int]$TimeoutSec = 60
)

$ErrorActionPreference = "Stop"
$deadline = (Get-Date).AddSeconds($TimeoutSec)
$ok = $false
Write-Host "🔍 Waiting for $BaseUrl/health ..." -ForegroundColor Cyan

while((Get-Date) -lt $deadline) {
  try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/health" -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300) {
      $ok = $true
      break
    }
  } catch {
    Start-Sleep -Seconds 2
  }
}

if (-not $ok) {
  Write-Error "❌ Backend did not become healthy within $TimeoutSec seconds."
  Write-Host "`n📊 Attempting to fetch diagnostic info..." -ForegroundColor Yellow
  try {
    $status = Invoke-WebRequest -Uri "$BaseUrl/status/summary" -UseBasicParsing -TimeoutSec 5
    Write-Host "`nStatus Summary Response:" -ForegroundColor Yellow
    Write-Host $status.Content
  } catch {
    Write-Host "⚠️ Could not fetch status/summary: $_" -ForegroundColor Yellow
  }
  exit 1
}

Write-Host "✅ Health check passed!" -ForegroundColor Green
Write-Host "📊 Probing /status/summary ..." -ForegroundColor Cyan

try {
  $summary = Invoke-WebRequest -Uri "$BaseUrl/status/summary" -UseBasicParsing -TimeoutSec 10
  if ($summary.StatusCode -ge 200 -and $summary.StatusCode -lt 300) {
    Write-Host "✅ Status summary OK" -ForegroundColor Green
    Write-Host "`nResponse preview:" -ForegroundColor Cyan
    Write-Host ($summary.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3)
    exit 0
  } else {
    Write-Error "❌ Status summary returned non-2xx status: $($summary.StatusCode)"
    exit 1
  }
} catch {
  Write-Error "❌ Failed to fetch status/summary: $_"
  exit 1
}

exit 1
