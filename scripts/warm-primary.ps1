param(
  [string]$Base = "http://127.0.0.1:8001",
  [string]$Model = "gpt-oss:20b"
)
Write-Host "[warm-primary] warming $Model via $Base" -ForegroundColor Cyan
try {
  $ping = Invoke-RestMethod -UseBasicParsing -TimeoutSec 8 "$Base/llm/models?refresh=true" | Out-Null
} catch {}
try {
  $body = @{ messages = @(@{ role = 'user'; content = 'hi' }) } | ConvertTo-Json -Compress
  $resp = Invoke-RestMethod -UseBasicParsing -TimeoutSec 45 -Method Post -Uri "$Base/chat" -ContentType 'application/json' -Body $body
  if ($resp._served_by -eq 'primary' -and $resp.model -like "$Model*") {
    Write-Host "[warm-primary] ✅ primary ready: $($resp.model)" -ForegroundColor Green; exit 0
  } else {
    Write-Warning "[warm-primary] served_by=$($resp._served_by) model=$($resp.model)"
  }
} catch {
  Write-Warning "[warm-primary] warm request failed: $($_.Exception.Message)"
}
exit 0
