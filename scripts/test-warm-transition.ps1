Param(
  [string]$BaseUrl = "http://localhost:8080",
  [int]$MaxSeconds = 300,
  [int]$IntervalSeconds = 3,
  [switch]$NoColor
)

function Get-Status {
  param([string]$Url)
  try {
    return Invoke-RestMethod -Uri "$Url/status/summary" -TimeoutSec 8
  } catch {
    return $null
  }
}

$start = Get-Date
$seenWarming = $false
$seenPrimary = $false
$ready = $false

$green = if ($NoColor) { '' } else { "`e[32m" }
$yellow = if ($NoColor) { '' } else { "`e[33m" }
$red = if ($NoColor) { '' } else { "`e[31m" }
$reset = if ($NoColor) { '' } else { "`e[0m" }

Write-Host "⏳ Watching warm→primary at $BaseUrl (max ${MaxSeconds}s) ..."

while ((Get-Date) - $start -lt [TimeSpan]::FromSeconds($MaxSeconds)) {
  $s = Get-Status -Url $BaseUrl
  if ($null -eq $s) { Start-Sleep -Seconds $IntervalSeconds; continue }

  $path = $s.llm.path
  $ready = [bool]$s.ready
  $ts = (Get-Date).ToString("HH:mm:ss")
  $color = switch ($path) {
    'primary' { $green }
    'warming' { $yellow }
    'fallback' { $yellow }
    default { $red }
  }
  Write-Host ("[{0}] {1}llm.path={2}{3} ready={4}" -f $ts, $color, $path, $reset, $ready)

  if ($path -eq 'warming') { $seenWarming = $true }
  if ($path -eq 'primary') { $seenPrimary = $true }

  if ($seenPrimary -and $ready) {
    Write-Host "${green}✅ Primary present and system ready.${reset}"
    exit 0
  }

  Start-Sleep -Seconds $IntervalSeconds
}

Write-Host ''
if (-not $seenWarming) { Write-Warning "Never observed 'warming' (instant transition or primary disabled)." }
if (-not $seenPrimary) { Write-Warning "Never observed 'primary'—verify model tag & PRIMARY_MODEL." }
if (-not $ready) { Write-Warning "System never reached ready=true." }
Write-Error "❌ Warm transition test did not pass within ${MaxSeconds}s."; exit 1
