Param(
  [string]$Compose="deploy/docker-compose.prod.yml",
  [string]$DeployMd="docs/DEPLOY.md"
)
$ErrorActionPreference = 'Stop'
$errors = @()

function Assert-Contains($File, [string]$Pattern, [string]$Msg){
  if(-not (Test-Path $File)){ $script:errors += "missing file: $File"; return }
  if(-not (Select-String -Path $File -Pattern $Pattern -SimpleMatch -Quiet)){
    $script:errors += $Msg
  }
}

Assert-Contains $Compose  'cloudflared-portfolio'      'compose: cloudflared-portfolio service missing'
Assert-Contains $DeployMd 'Cloudflare Tunnel (Managed'  'docs: managed/token tunnel section missing'
Assert-Contains $DeployMd 'CLOUDFLARE_TUNNEL_TOKEN'     'docs: CLOUDFLARE_TUNNEL_TOKEN missing'
Assert-Contains $DeployMd 'DOMAIN'                      'docs: DOMAIN explanation missing'
Assert-Contains $Compose  'nginx:'                      'compose: nginx service missing'
Assert-Contains $Compose  'backend:'                    'compose: backend service missing'

if($errors.Count){
  Write-Host 'Lint FAIL:' -ForegroundColor Red
  $errors | ForEach-Object { Write-Host " - $_" }
  exit 1
}
Write-Host 'Lint OK' -ForegroundColor Green
