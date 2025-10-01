Param(
  [string]$Root = ".",
  [string]$Html = "index.html,projects/*.html",
  [string]$Assets = "."
)

Write-Host "[SRI] Generating SHA-384 integrity attributes..." -ForegroundColor Cyan
node "$(Join-Path $Root scripts/generate-sri.mjs)" --root $Root --html $Html --assets $Assets
if ($LASTEXITCODE -ne 0) { Write-Error "SRI generation failed with exit code $LASTEXITCODE"; exit $LASTEXITCODE }
Write-Host "[SRI] Completed." -ForegroundColor Green
