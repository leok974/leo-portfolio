#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Deploy portfolio website to production

.DESCRIPTION
    Builds the portfolio frontend and deploys it with docker compose.
    Supports portfolio-only mode (static site) or full-stack mode (with backend).

.PARAMETER Mode
    Deployment mode: 'portfolio-only' (default) or 'full-stack'

.PARAMETER Build
    Whether to rebuild the frontend (default: true)

.PARAMETER Pull
    Whether to pull latest images (default: false)

.PARAMETER Check
    Run health checks after deployment (default: true)

.EXAMPLE
    .\deploy-portfolio.ps1
    Deploy portfolio in static-only mode

.EXAMPLE
    .\deploy-portfolio.ps1 -Mode full-stack
    Deploy portfolio with backend and Ollama

.EXAMPLE
    .\deploy-portfolio.ps1 -Build:$false
    Deploy without rebuilding (use existing dist-portfolio)
#>

[CmdletBinding()]
param(
    [Parameter()]
    [ValidateSet('portfolio-only', 'full-stack')]
    [string]$Mode = 'portfolio-only',

    [Parameter()]
    [bool]$Build = $true,

    [Parameter()]
    [bool]$Pull = $false,

    [Parameter()]
    [bool]$Check = $true
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

Write-Host "🚀 Portfolio Deployment Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Mode: $Mode" -ForegroundColor Yellow
Write-Host "Build: $Build" -ForegroundColor Yellow
Write-Host "Pull: $Pull" -ForegroundColor Yellow
Write-Host ""

# Step 1: Build frontend if requested
if ($Build) {
    Write-Host "📦 Building portfolio frontend..." -ForegroundColor Green
    Push-Location $repoRoot
    try {
        npm run build:portfolio
        if ($LASTEXITCODE -ne 0) {
            throw "Frontend build failed"
        }
        Write-Host "✓ Frontend built successfully" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}
else {
    Write-Host "⏭️  Skipping build (using existing dist-portfolio)" -ForegroundColor Yellow
}

# Step 2: Verify dist-portfolio exists
$distPath = Join-Path $repoRoot "dist-portfolio"
if (-not (Test-Path $distPath)) {
    Write-Host "❌ Error: dist-portfolio not found. Run with -Build:`$true" -ForegroundColor Red
    exit 1
}

$indexPath = Join-Path $distPath "index.html"
if (-not (Test-Path $indexPath)) {
    Write-Host "❌ Error: dist-portfolio/index.html not found. Build may have failed." -ForegroundColor Red
    exit 1
}

Write-Host "✓ dist-portfolio validated" -ForegroundColor Green

# Step 3: Choose compose file based on mode
Push-Location (Join-Path $repoRoot "deploy")
try {
    $composeFile = if ($Mode -eq 'portfolio-only') {
        "docker-compose.portfolio-only.yml"
    }
    else {
        "docker-compose.yml"
    }

    # Step 4: Create portfolio-only compose file if it doesn't exist
    if ($Mode -eq 'portfolio-only' -and -not (Test-Path $composeFile)) {
        Write-Host "📝 Creating $composeFile..." -ForegroundColor Green

        $portfolioOnlyYaml = @"
version: "3.9"

name: portfolio

services:
  portfolio-ui:
    image: nginx:1.27-alpine
    container_name: portfolio-ui
    volumes:
      - ./nginx.portfolio.conf:/etc/nginx/conf.d/default.conf:ro
      - ../dist-portfolio:/usr/share/nginx/html:ro
    ports:
      - "8090:80"
      # Uncomment for HTTPS (requires certs in ./certs/)
      # - "443:443"
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1/healthz || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 5
    # Uncomment for TLS
    # volumes (additional):
    #   - ./certs:/etc/nginx/certs:ro
"@

        Set-Content -Path $composeFile -Value $portfolioOnlyYaml -Encoding UTF8
        Write-Host "✓ Created $composeFile" -ForegroundColor Green
    }

    # Step 5: Pull images if requested
    if ($Pull) {
        Write-Host "⬇️  Pulling latest images..." -ForegroundColor Green
        docker compose -f $composeFile pull
    }

    # Step 6: Deploy
    Write-Host "🐳 Deploying with docker compose..." -ForegroundColor Green
    docker compose -f $composeFile up -d

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Deployment failed" -ForegroundColor Red
        exit 1
    }

    Write-Host "✓ Services deployed" -ForegroundColor Green

    # Step 7: Wait a moment for services to start
    Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5

    # Step 8: Health checks
    if ($Check) {
        Write-Host ""
        Write-Host "🏥 Running health checks..." -ForegroundColor Green
        Write-Host ""

        # Check portfolio-ui
        try {
            $portfolioPort = if ($Mode -eq 'portfolio-only') { 8090 } else { 8081 }
            $response = Invoke-WebRequest -Uri "http://localhost:$portfolioPort/healthz" -UseBasicParsing -TimeoutSec 10
            if ($response.StatusCode -eq 200) {
                Write-Host "✓ Portfolio UI healthy (port $portfolioPort)" -ForegroundColor Green
            }
            else {
                Write-Host "⚠️  Portfolio UI responded with status $($response.StatusCode)" -ForegroundColor Yellow
            }
        }
        catch {
            Write-Host "❌ Portfolio UI health check failed: $($_.Exception.Message)" -ForegroundColor Red
        }

        # Check homepage
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$portfolioPort/" -UseBasicParsing -TimeoutSec 10
            if ($response.StatusCode -eq 200 -and $response.Content -match "Portfolio|Leo") {
                Write-Host "✓ Homepage accessible" -ForegroundColor Green
            }
            else {
                Write-Host "⚠️  Homepage responded but content unexpected" -ForegroundColor Yellow
            }
        }
        catch {
            Write-Host "❌ Homepage check failed: $($_.Exception.Message)" -ForegroundColor Red
        }

        # Check backend (full-stack mode only)
        if ($Mode -eq 'full-stack') {
            Write-Host ""
            try {
                $response = Invoke-WebRequest -Uri "http://localhost:8002/ready" -UseBasicParsing -TimeoutSec 10
                if ($response.StatusCode -eq 200) {
                    Write-Host "✓ Backend API ready" -ForegroundColor Green
                }
                else {
                    Write-Host "⚠️  Backend responded with status $($response.StatusCode)" -ForegroundColor Yellow
                }
            }
            catch {
                Write-Host "❌ Backend health check failed: $($_.Exception.Message)" -ForegroundColor Red
                Write-Host "   (Backend may still be starting up, check logs with: docker compose logs backend)" -ForegroundColor Yellow
            }
        }
    }

    # Step 9: Show status
    Write-Host ""
    Write-Host "📊 Container Status:" -ForegroundColor Green
    docker compose -f $composeFile ps

    Write-Host ""
    Write-Host "✅ Deployment complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Access your portfolio at:" -ForegroundColor Cyan

    if ($Mode -eq 'portfolio-only') {
        Write-Host "  http://localhost:8090/" -ForegroundColor White
    }
    else {
        Write-Host "  Portfolio: http://localhost:8081/" -ForegroundColor White
        Write-Host "  Backend:   http://localhost:8002/ready" -ForegroundColor White
    }

    Write-Host ""
    Write-Host "Useful commands:" -ForegroundColor Cyan
    Write-Host "  View logs:    docker compose -f $composeFile logs -f" -ForegroundColor White
    Write-Host "  Stop:         docker compose -f $composeFile down" -ForegroundColor White
    Write-Host "  Restart:      docker compose -f $composeFile restart" -ForegroundColor White
    Write-Host "  Status:       docker compose -f $composeFile ps" -ForegroundColor White
    Write-Host ""
}
finally {
    Pop-Location
}
