# Agent Refresh Worker - Deployment Script
# Run from cloudflare-workers directory: .\deploy-complete.ps1

Write-Host "🚀 Cloudflare Worker Deployment - Agent Refresh" -ForegroundColor Cyan
Write-Host ""

# Generated ALLOW_KEY
$GENERATED_ALLOW_KEY = "SZdbVu7AlUZJ5Ce6d5hsO393tyuTwz5COc3VdxN0jZU="

Write-Host "📋 Pre-deployment Checklist:" -ForegroundColor Yellow
Write-Host "  1. GitHub Personal Access Token (GH_PAT) ready?" -ForegroundColor White
Write-Host "     Required scopes: repo, workflow (or Actions: Read/Write for fine-grained)" -ForegroundColor Gray
Write-Host "     Create at: https://github.com/settings/tokens" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Generated ALLOW_KEY (keep this secret!):" -ForegroundColor White
Write-Host "     $GENERATED_ALLOW_KEY" -ForegroundColor Green
Write-Host ""

$continue = Read-Host "Continue with deployment? (y/n)"
if ($continue -ne 'y') {
    Write-Host "❌ Deployment cancelled" -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "📦 Step 1: Setting Worker Secrets..." -ForegroundColor Cyan

# Set GH_PAT
Write-Host "Enter your GitHub Personal Access Token (GH_PAT):" -ForegroundColor Yellow
Write-Host "Paste and press Enter (input will be hidden)" -ForegroundColor Gray
$ghPat = Read-Host -AsSecureString
$ghPatPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($ghPat))

if ([string]::IsNullOrWhiteSpace($ghPatPlain)) {
    Write-Host "❌ GH_PAT cannot be empty" -ForegroundColor Red
    exit 1
}

# Use wrangler secret put via stdin
Write-Host "Setting GH_PAT..." -ForegroundColor Gray
$ghPatPlain | wrangler secret put GH_PAT

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to set GH_PAT" -ForegroundColor Red
    exit 1
}

# Set ALLOW_KEY
Write-Host ""
Write-Host "Using generated ALLOW_KEY: $GENERATED_ALLOW_KEY" -ForegroundColor Yellow
$useGenerated = Read-Host "Use this key? (y/n, default: y)"
if ($useGenerated -eq 'n') {
    Write-Host "Enter custom ALLOW_KEY:" -ForegroundColor Yellow
    $customKey = Read-Host
    $GENERATED_ALLOW_KEY = $customKey
}

Write-Host "Setting ALLOW_KEY..." -ForegroundColor Gray
$GENERATED_ALLOW_KEY | wrangler secret put ALLOW_KEY

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to set ALLOW_KEY" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Secrets configured" -ForegroundColor Green
Write-Host ""

# Deploy
Write-Host "📦 Step 2: Deploying Worker..." -ForegroundColor Cyan
wrangler deploy

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Worker deployed successfully!" -ForegroundColor Green
Write-Host ""

# Get worker URL from wrangler output (this is approximate - adjust if needed)
Write-Host "📝 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Note your worker URL (shown above in deployment output)" -ForegroundColor White
Write-Host "  2. Create apps/portfolio-ui/.env.local with:" -ForegroundColor White
Write-Host ""
Write-Host "     VITE_AGENT_REFRESH_URL=https://agent-refresh.leoklemet.workers.dev" -ForegroundColor Gray
Write-Host "     VITE_AGENT_ALLOW_KEY=$GENERATED_ALLOW_KEY" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Run smoke tests (see AGENT_REFRESH_DEPLOYMENT.md)" -ForegroundColor White
Write-Host ""
Write-Host "🔐 IMPORTANT: Save this ALLOW_KEY securely!" -ForegroundColor Yellow
Write-Host "   $GENERATED_ALLOW_KEY" -ForegroundColor Green
Write-Host ""
