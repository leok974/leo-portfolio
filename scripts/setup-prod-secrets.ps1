# Setup Production Environment Secrets
# Run this script to set secrets for the production environment

Write-Host "`n🔧 Setting up production environment secrets...`n" -ForegroundColor Cyan
Write-Host "⚠️  You'll need to provide secret values when prompted" -ForegroundColor Yellow
Write-Host "   Copy values from: Settings → Secrets and variables → Actions → Repository secrets`n" -ForegroundColor Yellow

# Known values that don't need input
$knownSecrets = @{
    "WATCHTOWER_UPDATE_URL" = "https://api.leoklemet.com/ops/watchtower/update"
}

# Secrets that need to be copied from repo secrets
$secretsToCopy = @(
    @{ Name = "WATCHTOWER_HTTP_API_TOKEN"; Description = "Watchtower API authentication token" },
    @{ Name = "FIGMA_PAT"; Description = "Figma personal access token (figd_xxx)" },
    @{ Name = "FIGMA_TEMPLATE_KEY"; Description = "Figma template file key" },
    @{ Name = "FIGMA_TEAM_ID"; Description = "Figma team ID (can be empty)" }
)

$count = 1
$total = $secretsToCopy.Count + 1

# Set known URL first
Write-Host "[$count/$total] Setting WATCHTOWER_UPDATE_URL..." -ForegroundColor Cyan
$knownSecrets["WATCHTOWER_UPDATE_URL"] | gh secret set WATCHTOWER_UPDATE_URL --env production
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ Set to: $($knownSecrets['WATCHTOWER_UPDATE_URL'])`n" -ForegroundColor Green
} else {
    Write-Host "  ❌ Failed`n" -ForegroundColor Red
}
$count++

# Set secrets that need input
foreach ($secret in $secretsToCopy) {
    Write-Host "[$count/$total] Setting $($secret.Name)..." -ForegroundColor Cyan
    Write-Host "  Description: $($secret.Description)" -ForegroundColor Gray
    Write-Host "  Copy the value from repo secrets and paste when prompted:" -ForegroundColor Yellow

    gh secret set $secret.Name --env production

    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Set successfully`n" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Failed`n" -ForegroundColor Red
    }
    $count++
}

# Optional: OPENAI_API_KEY
Write-Host "`n📝 Optional: Set OPENAI_API_KEY (fallback for backend)?" -ForegroundColor Cyan
$setOpenAI = Read-Host "  Set it? (y/N)"
if ($setOpenAI -match "^[Yy]$") {
    Write-Host "  Copy OPENAI_API_KEY from repo secrets:" -ForegroundColor Yellow
    gh secret set OPENAI_API_KEY --env production
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Set successfully" -ForegroundColor Green
    }
} else {
    Write-Host "  ⏭️  Skipped" -ForegroundColor Gray
}

Write-Host "`n✅ Production environment secrets configured!`n" -ForegroundColor Green
Write-Host "Verify with:" -ForegroundColor Cyan
Write-Host "  gh secret list --env production`n" -ForegroundColor White

# Verify
Write-Host "Current production secrets:" -ForegroundColor Cyan
gh secret list --env production
