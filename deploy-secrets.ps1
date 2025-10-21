# Deploy Production Secrets to Cloudflare
# This script helps you deploy the .env.production file to your production server

param(
    [string]$DeployMethod = "manual",  # manual, cloudflare-api, rsync, scp
    [string]$ServerPath = "/app/deploy",
    [string]$ServerHost = "",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Production Secrets Deployment Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env.production exists
$envFile = "deploy\.env.production"
if (-not (Test-Path $envFile)) {
    Write-Host "❌ Error: $envFile not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Creating template..." -ForegroundColor Yellow
    
    $template = @"
# Production Secrets for Docker Compose
# This file should NOT be committed to git

# Figma MCP Integration (Phase 51)
FIGMA_PAT=figd_YOUR_FIGMA_TOKEN_HERE
FIGMA_TEAM_ID=
FIGMA_TEMPLATE_KEY=

# OpenAI Fallback (optional)
# FALLBACK_API_KEY=sk-...

# Cloudflare Access (if using)
# CF_ACCESS_TEAM_DOMAIN=your-team.cloudflareaccess.com
# CF_ACCESS_AUD=your-aud-value
# ACCESS_ALLOWED_EMAILS=admin@example.com
"@
    
    $template | Out-File -FilePath $envFile -Encoding UTF8
    Write-Host "✅ Created template at: $envFile" -ForegroundColor Green
    Write-Host "📝 Please edit the file and fill in your secrets, then re-run this script." -ForegroundColor Yellow
    exit 0
}

Write-Host "✅ Found: $envFile" -ForegroundColor Green
Write-Host ""

# Validate file content
$content = Get-Content $envFile -Raw
if ($content -notmatch "FIGMA_PAT=figd_") {
    Write-Host "⚠️  Warning: FIGMA_PAT not found or empty" -ForegroundColor Yellow
}

Write-Host "📋 Deployment Method: $DeployMethod" -ForegroundColor Cyan
Write-Host ""

switch ($DeployMethod) {
    "manual" {
        Write-Host "📦 Manual Deployment Instructions:" -ForegroundColor Cyan
        Write-Host "===================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "1. Copy the .env.production file to your production server" -ForegroundColor White
        Write-Host "   Location: $ServerPath/.env.production" -ForegroundColor Gray
        Write-Host ""
        Write-Host "2. Method options:" -ForegroundColor White
        Write-Host "   a) Cloudflare Dashboard file upload" -ForegroundColor Gray
        Write-Host "   b) Cloudflare Tunnel + scp/rsync" -ForegroundColor Gray
        Write-Host "   c) Any server access method you have" -ForegroundColor Gray
        Write-Host ""
        Write-Host "3. Restart the backend container:" -ForegroundColor White
        Write-Host "   docker-compose -f docker-compose.portfolio-prod.yml restart backend" -ForegroundColor Gray
        Write-Host ""
        Write-Host "4. Verify the token is loaded:" -ForegroundColor White
        Write-Host "   docker exec portfolio-backend env | grep FIGMA_PAT" -ForegroundColor Gray
        Write-Host ""
        Write-Host "File ready at: $(Resolve-Path $envFile)" -ForegroundColor Green
    }
    
    "cloudflare-api" {
        Write-Host "🔧 Cloudflare API deployment not yet implemented" -ForegroundColor Yellow
        Write-Host "Please use manual deployment or contribute this feature!" -ForegroundColor Yellow
    }
    
    "rsync" {
        if (-not $ServerHost) {
            Write-Host "❌ Error: -ServerHost required for rsync" -ForegroundColor Red
            exit 1
        }
        
        $rsyncCmd = "rsync -avz $envFile ${ServerHost}:${ServerPath}/.env.production"
        
        if ($DryRun) {
            Write-Host "🧪 Dry run - would execute:" -ForegroundColor Yellow
            Write-Host $rsyncCmd -ForegroundColor Gray
        } else {
            Write-Host "📤 Deploying via rsync..." -ForegroundColor Cyan
            Invoke-Expression $rsyncCmd
            Write-Host "✅ Deployed! Remember to restart the backend container." -ForegroundColor Green
        }
    }
    
    "scp" {
        if (-not $ServerHost) {
            Write-Host "❌ Error: -ServerHost required for scp" -ForegroundColor Red
            exit 1
        }
        
        $scpCmd = "scp $envFile ${ServerHost}:${ServerPath}/.env.production"
        
        if ($DryRun) {
            Write-Host "🧪 Dry run - would execute:" -ForegroundColor Yellow
            Write-Host $scpCmd -ForegroundColor Gray
        } else {
            Write-Host "📤 Deploying via scp..." -ForegroundColor Cyan
            Invoke-Expression $scpCmd
            Write-Host "✅ Deployed! Remember to restart the backend container." -ForegroundColor Green
        }
    }
    
    default {
        Write-Host "❌ Unknown deployment method: $DeployMethod" -ForegroundColor Red
        Write-Host "Valid options: manual, cloudflare-api, rsync, scp" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""
Write-Host "📚 See CLOUDFLARE_WATCHTOWER_DEPLOY.md for full documentation" -ForegroundColor Cyan
