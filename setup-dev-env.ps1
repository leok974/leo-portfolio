# PowerShell script to set up environment variables for dev overlay
# Usage: .\setup-dev-env.ps1

Write-Host "🔧 Setting up Dev Overlay Environment Variables" -ForegroundColor Cyan
Write-Host ""

# Check if .env.local already exists
if (Test-Path ".env.local") {
    Write-Host "⚠️  .env.local already exists!" -ForegroundColor Yellow
    $response = Read-Host "Do you want to overwrite it? (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host "❌ Aborted. Your existing .env.local is unchanged." -ForegroundColor Red
        exit 0
    }
}

# Copy .env.example to .env.local
if (Test-Path ".env.example") {
    Copy-Item ".env.example" ".env.local"
    Write-Host "✅ Copied .env.example to .env.local" -ForegroundColor Green
} else {
    Write-Host "❌ .env.example not found!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📋 Environment file created with secure keys:" -ForegroundColor Cyan
Write-Host "   • DEV_OVERLAY_KEY (backend + frontend)" -ForegroundColor White
Write-Host "   • ADMIN_HMAC_KEY (backend + frontend)" -ForegroundColor White
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Edit .env.local and configure any additional settings" -ForegroundColor White
Write-Host "   2. For backend: source .env.local or export variables" -ForegroundColor White
Write-Host "   3. For frontend: Variables are auto-loaded by Vite" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Start backend:" -ForegroundColor Cyan
Write-Host "   cd assistant_api" -ForegroundColor White
Write-Host "   uvicorn assistant_api.main:app --reload --port 8001" -ForegroundColor White
Write-Host ""
Write-Host "🎨 Build frontend:" -ForegroundColor Cyan
Write-Host "   pnpm run build:portfolio" -ForegroundColor White
Write-Host ""
Write-Host "✨ Done! Dev overlay is ready to use." -ForegroundColor Green
