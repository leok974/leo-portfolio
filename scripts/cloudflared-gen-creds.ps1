<#!
.SYNOPSIS
  Generate / refresh credentials JSON, config.yml, DNS route, and start compose tunnel for an existing Cloudflare Tunnel UUID.
.DESCRIPTION
  Automates the manual steps:
    * tunnel login (if cert.pem missing)
    * tunnel credentials create <UUID>
    * write config.yml with ingress mapping to nginx service
    * tunnel route dns <UUID> <hostname>
    * start cloudflared-portfolio compose service & tail logs
.PARAMETER Uuid
  Existing tunnel UUID (36-char GUID)
.PARAMETER Hostname
  Public hostname to map (must be on the same Cloudflare account/zone as cert)
.PARAMETER Image
  Cloudflared image tag (default cloudflare/cloudflared:2024.8.2)
.PARAMETER ComposeFile
  Path to compose file (default deploy/docker-compose.prod.yml)
.PARAMETER Service
  Compose service name (default cloudflared-portfolio)
.EXAMPLE
  pwsh ./scripts/cloudflared-gen-creds.ps1 -Uuid db56892d-4879-4263-99bf-202d46b6aff9 -Hostname app.example.com
#>
[CmdletBinding()]param(
  [Parameter(Mandatory)] [string]$Uuid,
  [Parameter(Mandatory)] [string]$Hostname,
  [string]$Image = 'cloudflare/cloudflared:2024.8.2',
  [string]$ComposeFile = 'deploy/docker-compose.prod.yml',
  [string]$Service = 'cloudflared-portfolio'
)

$ErrorActionPreference = 'Stop'
if($Uuid -notmatch '^[0-9a-fA-F-]{36}$'){ throw "Uuid format invalid: $Uuid" }

$root = Get-Location
$dir = Join-Path $root 'cloudflared'
New-Item -ItemType Directory -Force $dir | Out-Null

$cert = Join-Path $dir 'cert.pem'
if(-not (Test-Path $cert)){
  Write-Host '[login] cert.pem missing -> launching interactive login...' -ForegroundColor Yellow
  docker run -it --rm -v "${dir}:/etc/cloudflared" $Image tunnel login
  if(-not (Test-Path $cert)){ throw 'cert.pem still missing after login.' }
} else {
  Write-Host '[login] cert.pem present (skipping login)' -ForegroundColor Green
}

Write-Host "[creds] Creating credentials for tunnel $Uuid" -ForegroundColor Cyan
$credCmd = "tunnel credentials create $Uuid"
$credOut = docker run --rm -v "${dir}:/etc/cloudflared" $Image tunnel credentials create $Uuid 2>&1
Write-Host $credOut

$credJson = Join-Path $dir ("$Uuid.json")
if(-not (Test-Path $credJson)){ throw "Credentials JSON not found: $credJson" }
Write-Host "[creds] Found $credJson" -ForegroundColor Green

$configPath = Join-Path $dir 'config.yml'
if(Test-Path $configPath){
  Write-Host '[config] Existing config.yml detected -> updating core fields' -ForegroundColor Yellow
  # naive replace of tunnel/credentials/ingress block
  $cfg = Get-Content $configPath -Raw
  $newCore = @(
    "tunnel: $Uuid",
    "credentials-file: /etc/cloudflared/$Uuid.json",
    "metrics: 0.0.0.0:2000",
    "ingress:",
    "  - hostname: $Hostname",
    "    service: http://nginx:80",
    "  - service: http_status:404"
  ) -join "`n"
  # If ingress exists, strip old core lines; else append
  if($cfg -match '^tunnel:'){ $cfg = $cfg -replace '(?s)^tunnel:.*?(?=\n[a-zA-Z])', '' }
  Set-Content $configPath $newCore
} else {
  Write-Host '[config] Writing new config.yml' -ForegroundColor Cyan
  @(
    "tunnel: $Uuid",
    "credentials-file: /etc/cloudflared/$Uuid.json",
    "metrics: 0.0.0.0:2000",
    "ingress:",
    "  - hostname: $Hostname",
    "    service: http://nginx:80",
    "  - service: http_status:404"
  ) | Set-Content $configPath
}
Write-Host "[config] Ready -> $configPath" -ForegroundColor Green

Write-Host "[dns] Adding DNS route $Hostname -> $Uuid" -ForegroundColor Cyan
$dnsOut = docker run --rm -v "${dir}:/etc/cloudflared" $Image tunnel route dns $Uuid $Hostname 2>&1
Write-Host $dnsOut

Write-Host "[compose] Starting service $Service" -ForegroundColor Cyan
$composeCmd = "docker compose -f $ComposeFile up -d --force-recreate $Service"
Write-Host $composeCmd -ForegroundColor DarkGray
Invoke-Expression $composeCmd

Start-Sleep -Seconds 2
Write-Host '[logs] Tail (Ctrl+C to stop)...' -ForegroundColor Cyan
Invoke-Expression "docker compose -f $ComposeFile logs -f --tail=120 $Service"
