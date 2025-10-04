param(
  [string]$BindAddress = "127.0.0.1",
  [int]$Port = 8010,
  [string]$DbPath = "D:/leo-portfolio/data/rag_8010.sqlite",
  [int]$WaitMs = 60000,
  [int]$IntervalMs = 1000,
  [switch]$ShowWindow
)

$ErrorActionPreference = 'Stop'

Write-Host "[start-stable] Setting resilient env toggles..." -ForegroundColor Cyan
$env:SAFE_LIFESPAN = '1'
$env:DEV_ALLOW_NO_LLM = '1'
$env:RAG_DB = $DbPath
Remove-Item Env:RAG_URL -ErrorAction SilentlyContinue | Out-Null

$py = Join-Path $PSScriptRoot '..' '.venv' 'Scripts' 'python.exe' | Resolve-Path -ErrorAction SilentlyContinue
if (-not $py) {
  throw "Python venv not found at .venv/Scripts/python.exe. Activate your venv or run 'python -m venv .venv' then install requirements."
}
$py = $py.Path

# Propagate host/port for run_cmddev if it reads them
[Environment]::SetEnvironmentVariable('HOST', $BindAddress, 'Process')
[Environment]::SetEnvironmentVariable('PORT', "$Port", 'Process')

$argsList = @('-m','assistant_api.run_cmddev')
$ws = if ($ShowWindow.IsPresent) { 'Normal' } else { 'Minimized' }

Write-Host "[start-stable] Launching backend (detached): $py $($argsList -join ' ')" -ForegroundColor Cyan
$proc = Start-Process -FilePath $py -ArgumentList $argsList -WindowStyle $ws -PassThru
Start-Sleep -Milliseconds 500

$base = 'http://{0}:{1}' -f $BindAddress, $Port
$deadline = [DateTime]::UtcNow.AddMilliseconds($WaitMs)
$ready = $false
$lastErr = $null

Write-Host "[start-stable] Waiting for RAG readiness at $base/api/ready (timeout ${WaitMs}ms)..." -ForegroundColor Cyan
while([DateTime]::UtcNow -lt $deadline) {
  try {
    $r = Invoke-RestMethod -Uri "$base/api/ready" -TimeoutSec 3 -Method Get
    # Accept either lightweight shape { ok, rag: { ok:true } } or diagnostics shape { ok, checks: { rag_db: { ok:true } } }
    $ragOk = $false
    if ($r -and $r.ok) {
      if ($r.PSObject.Properties.Name -contains 'rag') {
        if ($r.rag -and $r.rag.ok) { $ragOk = $true }
      } elseif ($r.PSObject.Properties.Name -contains 'checks') {
        $chk = $r.checks
        if ($chk -and $chk.rag_db -and $chk.rag_db.ok) { $ragOk = $true }
      }
    }
    if ($ragOk) { $ready = $true; break }
    $lastErr = $r | ConvertTo-Json -Depth 6
  } catch {
    $lastErr = $_.Exception.Message
  }
  Start-Sleep -Milliseconds $IntervalMs
}

if ($ready) {
  Write-Host "[start-stable] Ready: $base/api/ready => rag.ok=true" -ForegroundColor Green
  try { $r | ConvertTo-Json -Depth 6 | Write-Output } catch {}
  exit 0
} else {
  Write-Warning "[start-stable] Not ready within ${WaitMs}ms"
  if ($lastErr) { Write-Host "Last: $lastErr" -ForegroundColor Yellow }
  Write-Host "Process Id: $($proc.Id)" -ForegroundColor Yellow
  exit 1
}
