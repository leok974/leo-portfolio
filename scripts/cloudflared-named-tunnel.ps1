<#!
.SYNOPSIS
  Guided setup for a Cloudflare Named Tunnel (creates/authenticates and prepares config).
.DESCRIPTION
  Performs:
    1. Ensure cloudflared directory & .gitignore safety
    2. Run interactive 'tunnel login' (requires browser)
    3. Create named tunnel if not exists
    4. Generate config.yml from example if absent
    5. Output compose up instructions
.PARAMETER Name
  Desired tunnel name (default: portfolio)
.PARAMETER Hostname
  Public hostname to map to nginx (e.g. portfolio.example.com)
.PARAMETER ImageTag
  Cloudflared image tag (default: 2024.8.2)
.EXAMPLE
  pwsh ./scripts/cloudflared-named-tunnel.ps1 -Hostname portfolio.example.com
#>
[CmdletBinding()]
param(
  [string]$Name = 'portfolio',
  [string]$Hostname,
  [string]$ImageTag = '2024.8.2'
)

if(-not $Hostname){ Write-Error 'Hostname is required (e.g. -Hostname portfolio.example.com)'; exit 2 }

$cfDir = Join-Path (Get-Location) 'cloudflared'
if(-not (Test-Path $cfDir)){ New-Item -ItemType Directory -Force $cfDir | Out-Null }

# Ensure .gitignore patterns
$gitIgnore = Join-Path (Get-Location) '.gitignore'
$ignoreLines = @('cloudflared/*.json','cloudflared/cert.pem')
if(Test-Path $gitIgnore){
  $existing = Get-Content $gitIgnore -Raw
  foreach($l in $ignoreLines){ if($existing -notmatch [regex]::Escape($l)){ Add-Content $gitIgnore $l } }
}

Write-Host "[1/5] Authenticating (browser flow) ..." -ForegroundColor Cyan
& docker run -it --rm -v "${cfDir}:/etc/cloudflared" "cloudflare/cloudflared:$ImageTag" tunnel login

Write-Host "[2/5] Creating (or reusing) tunnel '$Name' ..." -ForegroundColor Cyan
$tunnelCreate = & docker run --rm -v "${cfDir}:/etc/cloudflared" "cloudflare/cloudflared:$ImageTag" tunnel create $Name 2>&1
Write-Host $tunnelCreate

# Extract UUID from output
if($tunnelCreate -match 'Tunnel credentials written to /etc/cloudflared/([0-9a-f-]+).json'){
  $uuid = $Matches[1]
} elseif($tunnelCreate -match 'Created tunnel (.*): ([0-9a-f-]+) <->'){ # fallback pattern
  $uuid = $Matches[2]
} else {
  # list tunnels as fallback
  $list = & docker run --rm -v "${cfDir}:/etc/cloudflared" "cloudflare/cloudflared:$ImageTag" tunnel list 2>&1
  if($list -match '([0-9a-f-]{36})\s+$Name\b'){
    $uuid = $Matches[1]
  }
}

if(-not $uuid){ Write-Error 'Unable to parse tunnel UUID. Inspect output above.'; exit 3 }
Write-Host "Tunnel UUID: $uuid" -ForegroundColor Green

$configPath = Join-Path $cfDir 'config.yml'
if(-not (Test-Path $configPath)){
  @(
    "tunnel: $uuid",
    "credentials-file: /etc/cloudflared/$uuid.json",
    "ingress:",
    "  - hostname: $Hostname",
    "    service: http://nginx:80",
    "  - service: http_status:404",
    "loglevel: info",
    "metrics: 0.0.0.0:2000"
  ) | Set-Content $configPath -NoNewline:$false
  Write-Host "Created $configPath" -ForegroundColor Green
} else {
  Write-Host "Config exists: $configPath (not overwriting)" -ForegroundColor Yellow
}

Write-Host "[3/5] Adding DNS route ..." -ForegroundColor Cyan
$dnsOut = & docker run --rm -v "${cfDir}:/etc/cloudflared" "cloudflare/cloudflared:$ImageTag" tunnel route dns $Name $Hostname 2>&1
Write-Host $dnsOut

Write-Host "[4/5] Launch from compose (overlay):" -ForegroundColor Cyan
Write-Host "  docker compose -f deploy/docker-compose.prod.yml -f docker-compose.cloudflared.yml up -d cloudflared" -ForegroundColor White

Write-Host "[5/5] Validate:" -ForegroundColor Cyan
Write-Host "  curl -I https://$Hostname" -ForegroundColor White
Write-Host "  curl -s https://$Hostname/api/ready" -ForegroundColor White

Write-Host "Done." -ForegroundColor Green
