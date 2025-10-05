param(
  [string]$BaseUrl = "https://assistant.ledger-mind.org",
  [int]$Retries = 5,
  [int]$DelaySec = 2
)

function Invoke-With-Retry([scriptblock]$Action, [int]$Retries, [int]$DelaySec) {
  for ($i=1; $i -le $Retries; $i++) {
    try { return & $Action } catch {
      if ($i -eq $Retries) { throw }
      Start-Sleep -Seconds $DelaySec
    }
  }
}

Write-Host "→ Health: $BaseUrl/ready"
$ready = Invoke-With-Retry { curl -k "$BaseUrl/ready" --silent --show-error } $Retries $DelaySec
if (-not $ready) { throw "ready failed" }
Write-Host "OK"

Write-Host "→ Diag: $BaseUrl/llm/diag"
$diag = Invoke-With-Retry { curl -k "$BaseUrl/llm/diag" --silent --show-error } $Retries $DelaySec
if (-not $diag) { throw "diag failed" }
Write-Host "OK"

Write-Host "→ Chat: $BaseUrl/api/chat (non-stream)"
$payload = '{"messages":[{"role":"user","content":"Public smoke ping."}],"stream":false}'
$chat = Invoke-With-Retry { curl -k "$BaseUrl/api/chat" -H "Content-Type: application/json" -d $payload --silent --show-error } $Retries $DelaySec
if (-not $chat) { throw "chat failed" }

# Basic JSON sanity (avoid HTML error pages)
if ($chat -notmatch '^\s*[{[]') { throw "chat returned non-JSON" }

Write-Host "All public smoke checks passed ✅"
