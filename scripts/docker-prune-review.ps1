<#!
.SYNOPSIS
  Interactive, review-first Docker disk usage and pruning helper.
.DESCRIPTION
  Provides a safe workflow to:
    1. Snapshot current disk usage (docker system df -v)
    2. Classify volumes: in-use vs unused (candidates)
    3. Protect important volumes by name pattern
    4. (Optional) Inspect a volume before deletion
    5. Prune selected unused volumes only after confirmation
    6. Prune build/image/network/container caches (optional)
    7. Snapshot after state
.NOTES
  Run in PowerShell:  ./scripts/docker-prune-review.ps1
#>
[CmdletBinding()] param(
  [string[]] $Protect = @('deploy_ollama-data','ollama-data'),
  [switch] $Auto,
  [switch] $IncludeCaches,
  [switch] $Force
)

function Write-Section($title) {
  Write-Host "`n=== $title ===" -ForegroundColor Cyan
}

function Show-DiskUsage($label) {
  Write-Section "Disk Usage ($label)"
  docker system df -v 2>$null | Out-String | Write-Host
}

function Get-InUseVolumeNames {
  $containerIds = docker ps -aq
  $inUse = @()
  foreach ($cid in $containerIds) {
    $tmpl = '{{range .Mounts}}{{if eq .Type "volume"}}{{println .Name}}{{end}}{{end}}'
    $names = docker inspect $cid --format $tmpl 2>$null
    if ($LASTEXITCODE -eq 0 -and $names) {
      $inUse += ($names -split "`r?`n") | Where-Object { $_ }
    }
  }
  return $inUse | Sort-Object -Unique
}

function Get-VolumeClassification {
  $all = docker volume ls -q | Where-Object { $_ }
  $inUse = Get-InUseVolumeNames
  $unused = $all | Where-Object { $_ -notin $inUse }
  [PSCustomObject]@{
    All     = $all
    InUse   = $inUse
    Unused  = $unused
  }
}

function Show-VolumeClassification($vols, [string[]] $protect) {
  Write-Section 'Volume Classification'
  Write-Host 'Protected patterns:' ($protect -join ', ') -ForegroundColor Yellow
  Write-Host "In-Use Volumes (" $vols.InUse.Count ")" -ForegroundColor Green
  $vols.InUse | ForEach-Object { Write-Host "  $_" }
  Write-Host "Unused Volumes (" $vols.Unused.Count ")" -ForegroundColor Magenta
  $vols.Unused | ForEach-Object { Write-Host "  $_" }

  $toDelete = $vols.Unused | Where-Object { $_ -notin $protect }
  Write-Host "\nDeletion Candidates after protection (" $toDelete.Count ")" -ForegroundColor Red
  $toDelete | ForEach-Object { Write-Host "  $_" }
  return $toDelete
}

function Test-VolumeContents($name) {
  Write-Section "Inspect Volume: $name"
  # Use string expansion with braces to avoid colon parsing confusion
  docker run --rm -v "${name}:/v" alpine sh -lc 'ls -lah /v; echo ---; du -sh /v 2>/dev/null || true' 2>$null
}

function Confirm($message) {
  if ($Force) { return $true }
  if ($Auto) { return $true }
  $ans = Read-Host "$message [y/N]"
  return $ans -match '^(y|yes)$'
}

function Remove-UnusedVolumes($names) {
  if (-not $names -or $names.Count -eq 0) {
    Write-Host 'No deletion candidates.' -ForegroundColor Yellow
    return
  }
  if (-not (Confirm "Delete $($names.Count) unused volumes?")) { return }
  Write-Section 'Deleting Volumes'
  foreach ($n in $names) {
    Write-Host "Removing $n ..." -NoNewline
    docker volume rm $n 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Host ' OK' -ForegroundColor Green } else { Write-Host ' FAIL' -ForegroundColor Red }
  }
}

function Invoke-CachePrune {
  if (-not $IncludeCaches) { return }
  if (-not (Confirm 'Prune builder/image/network/container caches?')) { return }
  Write-Section 'Pruning Caches'
  docker container prune -f | Out-String | Write-Host
  docker network prune -f | Out-String | Write-Host
  docker image prune -a -f | Out-String | Write-Host
  docker builder prune -f | Out-String | Write-Host
}

# MAIN
Show-DiskUsage 'BEFORE'
$vols    = Get-VolumeClassification
$cand    = Show-VolumeClassification -vols $vols -protect $Protect

if (-not $Auto) {
  Write-Host "\nOptional: Inspect a volume with:  Test-VolumeContents <name>" -ForegroundColor Cyan
}

Remove-UnusedVolumes $cand
Invoke-CachePrune
Show-DiskUsage 'AFTER'

Write-Host '\nDone.' -ForegroundColor Cyan
