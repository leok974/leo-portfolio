param(
  [string]$BaseUrl = "http://127.0.0.1:8001"
)

$ErrorActionPreference = 'Stop'

function Write-Status {
  param(
    [bool]$Ok,
    [string]$Name,
    $Extra = $null
  )
  if ($Ok) { Write-Host "[PASS] $Name" -ForegroundColor Green }
  else     { Write-Host "[FAIL] $Name" -ForegroundColor Red }
  if ($null -ne $Extra) {
    try { $Extra | ConvertTo-Json -Depth 8 }
    catch { $Extra | Out-String }
  }
}

function ConvertFrom-JsonSafe {
  param([string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text)) { return $null }
  try { return $Text | ConvertFrom-Json -Depth 100 } catch { return $Text }
}

function Read-ResponseBody {
  param($Response)
  try {
    if ($Response -and $Response.Content) { return $Response.Content }
    if ($Response -and $Response.GetResponseStream) {
      $sr = New-Object System.IO.StreamReader($Response.GetResponseStream())
      $text = $sr.ReadToEnd()
      $sr.Dispose()
      return $text
    }
  } catch { }
  return $null
}

function Invoke-Http {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory=$true)][ValidateSet('GET','POST')] [string]$Method,
    [Parameter(Mandatory=$true)][string]$Url,
    $Body = $null,
    [int]$TimeoutSec = 25
  )

  # PowerShell 7+: -SkipHttpErrorCheck keeps non-2xx as non-throw
  $isPwsh7 = $PSVersionTable.PSVersion.Major -ge 7

  try {
    if ($Method -eq 'GET') {
      if ($isPwsh7) {
        $res = Invoke-WebRequest -Method GET -Uri $Url -TimeoutSec $TimeoutSec -SkipHttpErrorCheck
      } else {
        $res = Invoke-WebRequest -Method GET -Uri $Url -TimeoutSec $TimeoutSec -ErrorAction Stop
      }
    } else {
      $json = if ($null -ne $Body) { $Body | ConvertTo-Json -Depth 100 } else { $null }
      if ($isPwsh7) {
        $res = Invoke-WebRequest -Method POST -Uri $Url -Body $json -ContentType 'application/json' -TimeoutSec $TimeoutSec -SkipHttpErrorCheck
      } else {
        $res = Invoke-WebRequest -Method POST -Uri $Url -Body $json -ContentType 'application/json' -TimeoutSec $TimeoutSec -ErrorAction Stop
      }
    }

    $status = if ($res.StatusCode) { [int]$res.StatusCode } else { 200 }
    $ok = ($status -ge 200 -and $status -lt 300)
    $bodyText = $res.Content
    $body = ConvertFrom-JsonSafe $bodyText

    return [pscustomobject]@{
      status = $status
      ok     = $ok
      body   = $body
      error  = $null
    }
  }
  catch {
    # Windows PowerShell throws for non-2xx; extract details
    $status = $null
    $bodyText = $null
    try {
      $resp = $_.Exception.Response
      if ($resp -and $resp.StatusCode) { $status = [int]$resp.StatusCode }
      $bodyText = Read-ResponseBody $resp
    } catch { }

    $body = ConvertFrom-JsonSafe $bodyText
    $ok = ($status -ge 200 -and $status -lt 300)

    return [pscustomobject]@{
      status = $status
      ok     = $ok
      body   = $body
      error  = $_.Exception.Message
    }
  }
}

# ---------- Checks ----------

Write-Host "== READY =="
$ready = Invoke-Http -Method GET -Url "$BaseUrl/ready" -TimeoutSec 10
Write-Status $ready.ok "GET /ready" $ready

Write-Host "`n== HEALTH =="
$health = Invoke-Http -Method GET -Url "$BaseUrl/llm/health" -TimeoutSec 10
Write-Status $health.ok "GET /llm/health" $health

Write-Host "`n== RAG QUERY =="
$ragBody = @{ question = "Where is the assistant chip wired?"; k = 5 }
$rag = Invoke-Http -Method POST -Url "$BaseUrl/api/rag/query" -Body $ragBody -TimeoutSec 25
Write-Status $rag.ok "POST /api/rag/query" $rag

Write-Host "`n== CHAT (fallback test) =="
$chatBody = @{ messages = @(@{ role = "user"; content = "Explain the portfolio assistant chip" }) }
$chat = Invoke-Http -Method POST -Url "$BaseUrl/chat" -Body $chatBody -TimeoutSec 25
Write-Status $chat.ok "POST /chat" $chat

Write-Host "`n== METRICS =="
$metrics = Invoke-Http -Method GET -Url "$BaseUrl/metrics" -TimeoutSec 10
Write-Status $metrics.ok "GET /metrics" $metrics
