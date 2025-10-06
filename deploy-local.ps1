#!/usr/bin/env pwsh
# Local deployment for assistant.ledger-mind.org (via Cloudflare Tunnel)
# This updates the local Docker stack that's exposed via tunnel

param(
    [switch]$SkipBuild,
    [switch]$BackendOnly,
    [switch]$FrontendOnly,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

if ($Help) {
    Write-Host @"
Deploy to local Docker stack (assistant.ledger-mind.org via Cloudflare Tunnel)

USAGE:
  ./deploy-local.ps1                    # Full deployment (build + restart)
  ./deploy-local.ps1 -SkipBuild        # Just restart services
  ./deploy-local.ps1 -BackendOnly      # Only update backend
  ./deploy-local.ps1 -FrontendOnly     # Only update frontend

OPTIONS:
  -SkipBuild      Skip frontend build (use existing dist/)
  -BackendOnly    Only deploy backend (pull image + restart)
  -FrontendOnly   Only deploy frontend (build + restart nginx)
  -Help           Show this help
"@
    exit 0
}

Write-Host @"
╔════════════════════════════════════════════════════════════╗
║  Deploying to assistant.ledger-mind.org (Local + Tunnel)  ║
╚════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

# ============================================================================
# STEP 1: Build Frontend
# ============================================================================
if (-not $BackendOnly -and -not $SkipBuild) {
    Write-Host "`n🏗️  Building frontend..." -ForegroundColor Yellow

    npm run build

    if ($LASTEXITCODE -ne 0) {
        Write-Error "❌ Frontend build failed"
        exit 1
    }

    Write-Host "✅ Frontend built successfully!" -ForegroundColor Green

    # Show bundle stats
    Write-Host "`n📦 Bundle contents:" -ForegroundColor Cyan
    Get-ChildItem -Path dist -Recurse -File |
        Select-Object Name, @{Name="Size (KB)";Expression={[math]::Round($_.Length/1KB, 2)}} |
        Sort-Object "Size (KB)" -Descending |
        Select-Object -First 8 |
        Format-Table -AutoSize
}

# ============================================================================
# STEP 2: Update Backend
# ============================================================================
if (-not $FrontendOnly) {
    Write-Host "`n🐳 Updating backend..." -ForegroundColor Yellow

    Push-Location deploy

    try {
        # Pull latest image from GHCR
        Write-Host "   📥 Pulling latest backend image..."
        docker compose -f docker-compose.yml -f docker-compose.shared-ollama.yml pull backend

        if ($LASTEXITCODE -ne 0) {
            Write-Warning "⚠️  Failed to pull backend image (using current version)"
        } else {
            Write-Host "   ✅ Backend image updated" -ForegroundColor Green
        }

        # Restart backend (using shared Ollama)
        Write-Host "   🔄 Restarting backend with shared Ollama..."
        docker compose -f docker-compose.yml -f docker-compose.shared-ollama.yml up -d backend

        if ($LASTEXITCODE -ne 0) {
            Write-Error "❌ Failed to restart backend"
            exit 1
        }

        Write-Host "   ✅ Backend restarted" -ForegroundColor Green

    } finally {
        Pop-Location
    }
}

# ============================================================================
# STEP 3: Restart Nginx (Frontend)
# ============================================================================
if (-not $BackendOnly) {
    Write-Host "`n🌐 Restarting nginx..." -ForegroundColor Yellow

    Push-Location deploy

    try {
        docker compose -f docker-compose.yml -f docker-compose.shared-ollama.yml up -d nginx

        if ($LASTEXITCODE -ne 0) {
            Write-Error "❌ Failed to restart nginx"
            exit 1
        }

        Write-Host "✅ Nginx restarted" -ForegroundColor Green

    } finally {
        Pop-Location
    }
}

# ============================================================================
# STEP 4: Verify Deployment
# ============================================================================
Write-Host "`n🔍 Verifying deployment..." -ForegroundColor Cyan

Start-Sleep -Seconds 3

# Check if services are running
Write-Host "`n📊 Docker container status:" -ForegroundColor Yellow
Push-Location deploy
docker compose -f docker-compose.yml -f docker-compose.shared-ollama.yml ps
Pop-Location

# Test local endpoints first
Write-Host "`n🏠 Testing local endpoints..." -ForegroundColor Yellow

try {
    $localReady = Invoke-WebRequest -Uri "http://localhost:8080/ready" -Method GET -TimeoutSec 5 -ErrorAction Stop
    if ($localReady.StatusCode -eq 200) {
        Write-Host "   ✅ Local backend ready (http://localhost:8080)" -ForegroundColor Green
    }
} catch {
    Write-Warning "   ⚠️  Local backend not responding: $_"
}

try {
    $localFrontend = Invoke-WebRequest -Uri "http://localhost:8080/" -Method GET -TimeoutSec 5 -ErrorAction Stop
    if ($localFrontend.StatusCode -eq 200 -and $localFrontend.Content -match "<!DOCTYPE html>") {
        Write-Host "   ✅ Local frontend serving (http://localhost:8080)" -ForegroundColor Green
    }
} catch {
    Write-Warning "   ⚠️  Local frontend not responding: $_"
}

# Test public URL via Cloudflare Tunnel
Write-Host "`n🌍 Testing public URL (via Cloudflare Tunnel)..." -ForegroundColor Yellow

try {
    $publicReady = Invoke-WebRequest -Uri "https://assistant.ledger-mind.org/api/ready" -Method GET -TimeoutSec 10 -ErrorAction Stop
    if ($publicReady.StatusCode -eq 200) {
        Write-Host "   ✅ Public backend ready (https://assistant.ledger-mind.org)" -ForegroundColor Green
    }
} catch {
    Write-Warning "   ⚠️  Public backend not responding: $_"
    Write-Warning "   Check Cloudflare Tunnel: docker compose -f deploy/docker-compose.cloudflared.yml ps"
}

try {
    $publicFrontend = Invoke-WebRequest -Uri "https://assistant.ledger-mind.org/" -Method GET -TimeoutSec 10 -ErrorAction Stop
    if ($publicFrontend.StatusCode -eq 200 -and $publicFrontend.Content -match "<!DOCTYPE html>") {
        Write-Host "   ✅ Public frontend live (https://assistant.ledger-mind.org)" -ForegroundColor Green
    }
} catch {
    Write-Warning "   ⚠️  Public frontend not responding: $_"
}

# ============================================================================
# Summary
# ============================================================================
Write-Host "`n" + ("="*70) -ForegroundColor Cyan
Write-Host "🎉 DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host ("="*70) -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 Production URL:   https://assistant.ledger-mind.org" -ForegroundColor White
Write-Host "🏠 Local URL:        http://localhost:8080" -ForegroundColor White
Write-Host "💚 Health check:     https://assistant.ledger-mind.org/api/ready" -ForegroundColor White
Write-Host "📊 Status:           https://assistant.ledger-mind.org/api/status/summary" -ForegroundColor White
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "  1. Open https://assistant.ledger-mind.org in browser"
Write-Host "  2. Test smooth scrolling (Lenis)"
Write-Host "  3. Verify Lucide icons in CTAs"
Write-Host "  4. Test assistant chat"
Write-Host "  5. Run smoke tests: ./scripts/smoke-public.ps1"
Write-Host ""
Write-Host "📝 View logs:" -ForegroundColor Yellow
Write-Host "  cd deploy && docker compose logs -f --tail=50"
Write-Host ""
Write-Host "🔧 Troubleshoot:" -ForegroundColor Yellow
Write-Host "  docker compose ps                    # Check container status"
Write-Host "  docker compose logs backend          # Backend logs"
Write-Host "  docker compose logs nginx            # Nginx logs"
Write-Host "  docker compose logs cloudflared      # Tunnel logs"
Write-Host ""
