Param(
  [string]$RepoSlug = "leok974/leo-portfolio",
  [string]$EnvName = "production"
)

$WantedKeys = @(
  "WATCHTOWER_HTTP_API_TOKEN",
  "WATCHTOWER_UPDATE_URL",
  "FIGMA_PAT",
  "FIGMA_TEMPLATE_KEY",
  "FIGMA_TEAM_ID",
  "OPENAI_API_KEY"
)

$Candidates = @(
  ".env.production",
  ".env.prod",
  "deploy/.env.production",
  "deploy/.env.prod",
  "infra/.env.prod",
  "apps/portfolio-ui/.env.production",
  "apps/portfolio-ui/.env",
  "assistant_api/.env.production",
  "assistant_api/.env"
)

# Ensure gh is authenticated
gh auth status | Out-Null

function Get-Val {
  param([string]$Key)
  foreach ($f in $Candidates) {
    if (Test-Path $f) {
      $line = (Select-String -Path $f -Pattern "^\s*$Key\s*=" -NoEmphasis | Select-Object -First 1).Line
      if ($line) {
        $val = $line.Split("=",2)[1].Trim()
        # strip surrounding quotes
        if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
          $val = $val.Substring(1, $val.Length-2)
        }
        if ($val) { return $val }
      }
    }
  }
  return $null
}

Write-Host "Setting secrets in environment: $EnvName (repo: $RepoSlug)" -ForegroundColor Cyan
foreach ($key in $WantedKeys) {
  $val = Get-Val $key
  if ($val) {
    # Use stdin pipe instead of --body-file (not supported in older gh versions)
    $val | gh secret set $key --env $EnvName --repo $RepoSlug --body - | Out-Null
    Write-Host "✓ $key set" -ForegroundColor Green
  } else {
    Write-Host "• $key not found in any candidate file (skipped)" -ForegroundColor Yellow
  }
}

Write-Host "Done. Verify with: gh secret list --env $EnvName --repo $RepoSlug" -ForegroundColor Cyan
