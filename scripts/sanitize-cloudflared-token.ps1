<#!
.SYNOPSIS
  Sanitize and lightly validate a Cloudflare Tunnel connector token and export it for docker compose.
.DESCRIPTION
  - Trims whitespace/newlines
  - Performs opaque safety checks (length + dot count)
  - Optionally writes a cleaned file (default overwrite)
  - Sets CLOUDFLARE_TUNNEL_TOKEN environment variable for current session
.PARAMETER Path
  Path to the token file (default: secrets/cloudflared_token.txt if exists, else secrets/cloudflared_token)
.PARAMETER MinLength
  Minimum acceptable length (default 60)
.PARAMETER MinDots
  Minimum number of '.' separators expected (default 2)
.PARAMETER OutPath
  Where to write sanitized token (defaults to same as Path)
.EXAMPLE
  pwsh ./scripts/sanitize-cloudflared-token.ps1
.EXAMPLE
  pwsh ./scripts/sanitize-cloudflared-token.ps1 -Path secrets/cloudflared_token -OutPath secrets/cloudflared_token
#>
[CmdletBinding()]
param(
  [string]$Path = $( if(Test-Path 'secrets/cloudflared_token.txt'){ 'secrets/cloudflared_token.txt' } elseif(Test-Path 'secrets/cloudflared_token'){ 'secrets/cloudflared_token' } else { 'secrets/cloudflared_token.txt' } ),
  [int]$MinLength = 60,
  [int]$MinDots = 2,
  [string]$OutPath
)

if(-not (Test-Path (Split-Path $Path -Parent))){ New-Item -ItemType Directory -Force (Split-Path $Path -Parent) | Out-Null }
if(-not (Test-Path $Path)){
  Write-Host "Token file not found: $Path" -ForegroundColor Yellow
  Write-Host "Create it and paste ONLY the connector token (single line) then rerun." -ForegroundColor Yellow
  exit 2
}

$raw = Get-Content $Path -Raw
$trim = $raw.Trim()

if([string]::IsNullOrWhiteSpace($trim)){
  Write-Error "Token file is empty after trimming."; exit 3
}

$dotCount = ($trim.ToCharArray() | Where-Object { $_ -eq '.' }).Count
if($trim.Length -lt $MinLength){ Write-Host "[WARN] Token length $($trim.Length) < MinLength $MinLength" -ForegroundColor Yellow }
if($dotCount -lt $MinDots){ Write-Host "[WARN] Dots $dotCount < MinDots $MinDots (token may be malformed)" -ForegroundColor Yellow }

if(-not $OutPath){ $OutPath = $Path }
[IO.File]::WriteAllText((Resolve-Path $OutPath), $trim)

$env:CLOUDFLARE_TUNNEL_TOKEN = $trim

Write-Host "[OK] Sanitized token written to $OutPath" -ForegroundColor Green
Write-Host "Length=$($trim.Length) Dots=$dotCount" -ForegroundColor Cyan
Write-Host "Preview=$($trim.Substring(0,[Math]::Min(5,$trim.Length)))...$($trim.Substring([Math]::Max(0,$trim.Length-5)))" -ForegroundColor DarkGray
Write-Host "Exported CLOUDFLARE_TUNNEL_TOKEN in current session." -ForegroundColor Green
