<#!
.SYNOPSIS
  Start a Cloudflare Tunnel container (cloudflared) targeting backend or edge.

.DESCRIPTION
  Reads token from secrets/cloudflared_token (or CLOUDFLARE_TUNNEL_TOKEN env) and launches
  a disposable docker container attached to host network mapping.

.PARAMETER Mode
  'backend' (default) -> http://host.docker.internal:8001
  'edge'             -> http://host.docker.internal:8080

.EXAMPLE
  ./scripts/start-cloudflared.ps1 -Mode backend

.NOTES
  Ensure your backend allows the tunnel origin (set DOMAIN=your.hostname or append to ALLOWED_ORIGINS).
#>
param(
  [ValidateSet('backend','edge')]
  [string]$Mode = 'backend'
)

$ErrorActionPreference = 'Stop'
$token = $env:CLOUDFLARE_TUNNEL_TOKEN
if (-not $token) {
  $tokenFile = Join-Path $PSScriptRoot '..' | Join-Path -ChildPath 'secrets/cloudflared_token'
  if (Test-Path $tokenFile) {
    $token = Get-Content $tokenFile -Raw | Select-Object -First 1
  }
}
if (-not $token) {
  Write-Error 'Cloudflare tunnel token not found. Set CLOUDFLARE_TUNNEL_TOKEN or create secrets/cloudflared_token'
  exit 1
}

$target = if ($Mode -eq 'edge') { 'http://host.docker.internal:8080' } else { 'http://host.docker.internal:8001' }
Write-Host "[cloudflared] Starting tunnel targeting $target" -ForegroundColor Cyan

# Run ephemeral container; user can CTRL+C to terminate
# Note: Using host.docker.internal for Windows host to reach local services.

docker run --rm -e TUNNEL_TRANSPORT_PROTOCOL=auto cloudflare/cloudflared:latest tunnel --no-autoupdate run --token $token
