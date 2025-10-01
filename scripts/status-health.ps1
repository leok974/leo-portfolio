Param(
  [string]$Origin = "https://leok974.github.io",
  [string]$AssistHost = "assistant.ledger-mind.org"
)
Write-Host "Origin: $Origin"
Write-Host "Host:   $AssistHost`n"

Write-Host "GET /api/status/summary"
${function:GetStatus} = {
  param([int]$Attempts = 1)
  for ($i=1; $i -le $Attempts; $i++) {
    $resp = curl -is -H "Origin: $Origin" "https://$AssistHost/api/status/summary" 2>$null
    $statusLine = ($resp | Select-String -Pattern '^HTTP/' | Select-Object -First 1).Line
    Write-Host "Attempt #$i -> $statusLine"
    if ($statusLine -match ' 200 ') { return $resp }
    if ($i -lt $Attempts) { Start-Sleep -Seconds 2 }
  }
  return $resp
}

$api = GetStatus -Attempts 3
$api | Select-Object -First 40
if (-not ($api -match '^HTTP/.* 200')) {
  $statusLine = ($api | Select-String -Pattern '^HTTP/' | Select-Object -First 1).Line
  throw "API status not 200: $statusLine"
}
if (-not ($api -match [regex]::Escape("Access-Control-Allow-Origin: $Origin"))) { throw 'Missing ACAO' }
if (-not ($api -match 'Vary: Origin')) { Write-Warning 'Vary header missing' }
if ($api -match 'X-Status-Path: api') { Write-Host '(debug) X-Status-Path: api' }

Write-Host "`nOPTIONS /api/status/summary"
$opt = curl -is -X OPTIONS -H "Origin: $Origin" -H "Access-Control-Request-Method: GET" "https://$AssistHost/api/status/summary"
$opt | Select-Object -First 40
if (-not ($opt -match '^HTTP/.* (204|200)')) { throw 'OPTIONS not 204/200' }
if (-not ($opt -match [regex]::Escape("Access-Control-Allow-Origin: $Origin"))) { throw 'Missing ACAO (OPTIONS)' }

Write-Host "`nLegacy GET /status/summary (informational)"
curl -is -H "Origin: $Origin" "https://$AssistHost/status/summary" | Select-Object -First 40 | Out-Null

Write-Host "`nDone." -ForegroundColor Green
