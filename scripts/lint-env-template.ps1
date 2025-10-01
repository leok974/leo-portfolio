Param()
$ErrorActionPreference = 'Stop'

# Expected variable keys present in docs + template
$expected = @(
  'DOMAIN',
  'CLOUDFLARE_TUNNEL_TOKEN',
  'CLOUDFLARE_TUNNEL_UUID',
  'PRIMARY_MODEL',
  'OPENAI_MODEL',
  'OPENAI_BASE_URL',
  'FALLBACK_BASE_URL',
  'FALLBACK_MODEL',
  'ALLOWED_ORIGINS',
  'RAG_DB',
  'RAG_REPOS',
  'EMBED_MODEL_QUERY'
)

$templatePath = '.env.deploy.example'
if(!(Test-Path $templatePath)){ Write-Error "Template $templatePath not found"; exit 2 }

$content = Get-Content $templatePath | Where-Object { $_ -notmatch '^\s*#' -and $_ -match '=' }
$present = @{}
foreach($line in $content){
  $parts = $line.Split('=',2)
  if($parts[0]){ $present[$parts[0].Trim()] = $true }
}

$missing = @()
foreach($k in $expected){ if(-not $present.ContainsKey($k)){ $missing += $k } }

if($missing.Count -gt 0){
  $msg = "Missing keys in $templatePath`:` $($missing -join ', ')"
  Write-Error $msg; exit 3
}

# Ensure no obvious secret values accidentally committed (e.g., starts with sk-)
$secretsLike = $content | Where-Object { $_ -match 'sk-[a-zA-Z0-9]+' }
if($secretsLike){
  $msg = "Potential secret-like values found in template`n$($secretsLike -join "`n")"
  Write-Error $msg; exit 4
}

Write-Host "lint-env-template: OK ($($expected.Count) keys)" -ForegroundColor Green
