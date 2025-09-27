Param(
  [string]$BaseUrl = "http://localhost",
  [switch]$VerboseOutput
)

function Get-Json { param($u)
  try { return Invoke-RestMethod -Uri $u -TimeoutSec 10 }
  catch { return $null }
}

 # Determine if an edge proxy (which prefixes core endpoints with /api) is in front.
 $api = "$BaseUrl/api"
 $rootStatus = Get-Json "$BaseUrl/status/summary"
 $useRoot = $false
 if ($rootStatus -and $rootStatus.llm) { $useRoot = $true }

 # Build endpoint URLs conditionally:
 if ($useRoot) {
  $readyUrl  = "$BaseUrl/ready"
  $statusUrl = "$BaseUrl/status/summary"
  $llmUrl    = "$BaseUrl/llm/health"
 } else {
  $readyUrl  = "$api/ready"
  $statusUrl = "$api/status/summary"
  $llmUrl    = "$api/llm/health"
 }
 # RAG endpoints stay under /api even without edge for consistency
 $ragUrl = "$api/rag/query"

Write-Host "=== Smoke @ $BaseUrl ==="
$ready   = Get-Json $readyUrl
$status  = Get-Json $statusUrl
$llm     = Get-Json $llmUrl
$ragNull = $false
try {
  $ragQ = Invoke-RestMethod -Method Post -Uri $ragUrl -Body (@{ q = "hello"; k = 1 } | ConvertTo-Json) -ContentType "application/json" -TimeoutSec 10
} catch { $ragNull = $true }

$ok = @()
$fail = @()

if ($ready -and $ready.ok) { $ok += "ready" } else { $fail += "ready" }
if ($status) {
  if ($status.ready) { $ok += "status.ready" } else { $fail += "status.ready" }
  $lp = $status.llm.path
  Write-Host ("llm.path: {0}" -f $lp)
  if ($lp -eq "warming") { Write-Host "note: model present pending; retry shortly." }
} else { $fail += "status" }

if ($llm) {
  $llmStatus = $llm.status
  $ollamaState = $llmStatus.ollama
  if ($ollamaState -eq "up") { $ok += "ollama" } else { $fail += "ollama" }
  if ($llmStatus.primary_model_present) { $ok += "model.present" } else { $fail += "model.present" }
  Write-Host ("openai: {0}" -f $llmStatus.openai)
} else { $fail += "llm" }

if (-not $ragNull) { $ok += "rag.query" } else { $fail += "rag.query" }

Write-Host "`nPASS:" ($ok -join ", ")
if ($fail.Count) { Write-Host "FAIL:" ($fail -join ", ") -ForegroundColor Red }

if ($VerboseOutput) {
  Write-Host "`n--- ready ($readyUrl) ---";   $ready   | ConvertTo-Json -Depth 5
  Write-Host "`n--- status ($statusUrl) ---";  $status  | ConvertTo-Json -Depth 8
  Write-Host "`n--- llm ($llmUrl) ---";     $llm     | ConvertTo-Json -Depth 5
}
