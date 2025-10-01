param(
  [string]$Base = "http://localhost:8080"
)

Write-Host "▶ ready:" -ForegroundColor Cyan
try { Invoke-RestMethod "$Base/api/ready" -TimeoutSec 5 | ConvertTo-Json -Depth 6 } catch { Write-Host $_; exit 1 }

Write-Host "`n▶ summary (key bits):" -ForegroundColor Cyan
try {
  $sum = Invoke-RestMethod "$Base/api/status/summary" -TimeoutSec 5
  $obj = [PSCustomObject]@{
    ready                 = $sum.ready
    primary_model_present = $sum.primary_model_present
    build_sha             = $sum.build_sha
  }
  $obj | ConvertTo-Json
} catch { Write-Host $_; exit 1 }

Write-Host "`n▶ latency:" -ForegroundColor Cyan
try { Invoke-RestMethod "$Base/llm/primary/latency" -TimeoutSec 5 | ConvertTo-Json -Depth 6 } catch { Write-Host $_; exit 1 }

Write-Host "`n▶ chat (non-stream if available):" -ForegroundColor Cyan
try {
  $Body = @{ messages = @(@{ role="user"; content="Say hello (non-stream) with _served_by." }) } | ConvertTo-Json -Depth 6
  $resp = Invoke-RestMethod -Method POST -Uri "$Base/chat" -ContentType "application/json" -Body $Body -TimeoutSec 30
  $resp | ConvertTo-Json -Depth 10
} catch {
  Write-Host "non-stream /chat not available or failed → skipping." -ForegroundColor Yellow
}

Write-Host "`n▶ chat/stream (curl.exe if available):" -ForegroundColor Cyan
$curl = "$Env:ProgramFiles\Git\mingw64\bin\curl.exe"
if (-not (Test-Path $curl)) { $curl = (Get-Command curl.exe -ErrorAction SilentlyContinue)?.Source }
if (-not $curl) { Write-Host "curl.exe not found → skip SSE test." -ForegroundColor Yellow; exit 0 }

& $curl --http1.1 -N -sS -H "Content-Type: application/json" -X POST `
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"Stream a 1-2 line hello with _served_by.\"}]}" `
  "$Base/chat/stream"

Write-Host "`n(done)" -ForegroundColor Green
