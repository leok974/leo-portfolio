#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Deploy Agent Refresh Cloudflare Worker

.DESCRIPTION
    Deploys the agent-refresh worker and configures secrets.

.PARAMETER SetSecrets
    If specified, prompts for and sets GH_PAT and ALLOW_KEY secrets

.EXAMPLE
    .\deploy-agent-refresh.ps1

.EXAMPLE
    .\deploy-agent-refresh.ps1 -SetSecrets
#>

param(
    [switch]$SetSecrets
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Agent Refresh Worker Deployment" -ForegroundColor Cyan
Write-Host ""

# Check if wrangler is installed
if (-not (Get-Command wrangler -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: wrangler CLI not found" -ForegroundColor Red
    Write-Host "Install with: npm install -g wrangler" -ForegroundColor Yellow
    exit 1
}

# Navigate to worker directory
$workerDir = Join-Path $PSScriptRoot ".." "cloudflare-workers"
if (-not (Test-Path $workerDir)) {
    Write-Host "❌ Error: cloudflare-workers directory not found" -ForegroundColor Red
    exit 1
}

Set-Location $workerDir
Write-Host "📁 Working directory: $workerDir" -ForegroundColor Gray
Write-Host ""

# Check if logged in
Write-Host "🔐 Checking Cloudflare authentication..." -ForegroundColor Cyan
try {
    wrangler whoami | Out-Null
} catch {
    Write-Host "❌ Not logged in to Cloudflare" -ForegroundColor Red
    Write-Host "Run: wrangler login" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Authenticated" -ForegroundColor Green
Write-Host ""

# Deploy worker
Write-Host "📦 Deploying worker..." -ForegroundColor Cyan
try {
    wrangler deploy
    Write-Host "✅ Worker deployed successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Deployment failed: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Set secrets if requested
if ($SetSecrets) {
    Write-Host "🔑 Setting secrets..." -ForegroundColor Cyan
    Write-Host ""

    # GH_PAT
    Write-Host "Enter GitHub Personal Access Token (GH_PAT):" -ForegroundColor Yellow
    Write-Host "Scope required: workflow" -ForegroundColor Gray
    $ghPat = Read-Host -AsSecureString
    if ($ghPat.Length -eq 0) {
        Write-Host "⚠️  Skipping GH_PAT (empty)" -ForegroundColor Yellow
    } else {
        $ghPatPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($ghPat)
        )
        echo $ghPatPlain | wrangler secret put GH_PAT
        Write-Host "✅ GH_PAT set" -ForegroundColor Green
    }
    Write-Host ""

    # ALLOW_KEY
    Write-Host "Enter shared authentication key (ALLOW_KEY):" -ForegroundColor Yellow
    Write-Host "Generate with: openssl rand -base64 48" -ForegroundColor Gray
    $allowKey = Read-Host -AsSecureString
    if ($allowKey.Length -eq 0) {
        Write-Host "⚠️  Skipping ALLOW_KEY (empty)" -ForegroundColor Yellow
    } else {
        $allowKeyPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($allowKey)
        )
        echo $allowKeyPlain | wrangler secret put ALLOW_KEY
        Write-Host "✅ ALLOW_KEY set" -ForegroundColor Green
    }
    Write-Host ""
}

# Show worker info
Write-Host "📊 Worker Information:" -ForegroundColor Cyan
Write-Host "Name: agent-refresh" -ForegroundColor Gray
Write-Host "Route: api.leoklemet.com/agent/refresh" -ForegroundColor Gray
Write-Host ""

# Test endpoint
Write-Host "🧪 Testing endpoint..." -ForegroundColor Cyan
$testUrl = "https://agent-refresh.leoklemet.workers.dev"
try {
    $response = Invoke-WebRequest -Uri $testUrl -Method OPTIONS -ErrorAction Stop
    Write-Host "✅ Worker responding (CORS preflight OK)" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Worker not responding yet (may take a few seconds)" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "🎉 Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Set frontend env vars:" -ForegroundColor Gray
Write-Host "   VITE_AGENT_REFRESH_URL=https://api.leoklemet.com/agent/refresh" -ForegroundColor Gray
Write-Host "   VITE_AGENT_ALLOW_KEY=<same-as-ALLOW_KEY>" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Test with curl:" -ForegroundColor Gray
Write-Host '   curl -X POST https://api.leoklemet.com/agent/refresh \' -ForegroundColor Gray
Write-Host '     -H "Content-Type: application/json" \' -ForegroundColor Gray
Write-Host '     -H "x-agent-key: <ALLOW_KEY>" \' -ForegroundColor Gray
Write-Host '     -d ''{"reason":"test","ref":"main"}''' -ForegroundColor Gray
Write-Host ""
Write-Host "3. Check GitHub Actions:" -ForegroundColor Gray
Write-Host "   https://github.com/leok974/leo-portfolio/actions/workflows/refresh-content.yml" -ForegroundColor Gray
