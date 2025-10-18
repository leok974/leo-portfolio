#!/usr/bin/env pwsh
<#
.SYNOPSIS
Purge Cloudflare cache for portfolio deployment

.DESCRIPTION
Purges all cached files on Cloudflare for www.leoklemet.com to ensure
visitors see the latest deployment with new OG images and content.

.EXAMPLE
.\cf-cache-purge.ps1

.EXAMPLE
.\cf-cache-purge.ps1 -PurgeEverything

.NOTES
Requires:
- CF_API_TOKEN environment variable (Cloudflare API token with Zone:Edit permission)
- Or CF_ZONE_ID and CF_API_TOKEN in .env file
#>

[CmdletBinding()]
param(
    [switch]$PurgeEverything,  # Purge all files (use with caution)
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host "🌩️  Cloudflare Cache Purge" -ForegroundColor Cyan
Write-Host ""

# Configuration
$DOMAIN = "leoklemet.com"
$ZONE_ID = $env:CF_ZONE_ID
$API_TOKEN = $env:CF_API_TOKEN

# Try to load from .env if not in environment
if (-not $API_TOKEN -or -not $ZONE_ID) {
    if (Test-Path ".env") {
        Write-Host "📄 Loading from .env..." -ForegroundColor Yellow
        Get-Content ".env" | ForEach-Object {
            if ($_ -match '^CF_API_TOKEN=(.+)$') {
                $API_TOKEN = $matches[1]
            }
            if ($_ -match '^CF_ZONE_ID=(.+)$') {
                $ZONE_ID = $matches[1]
            }
        }
    }
}

# Validate credentials
if (-not $API_TOKEN) {
    Write-Host "❌ CF_API_TOKEN not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Set it with:" -ForegroundColor Yellow
    Write-Host '  $env:CF_API_TOKEN = "your-token"' -ForegroundColor Gray
    Write-Host "Or add to .env file:" -ForegroundColor Yellow
    Write-Host '  CF_API_TOKEN=your-token' -ForegroundColor Gray
    Write-Host ""
    Write-Host "Get token from: https://dash.cloudflare.com/profile/api-tokens" -ForegroundColor Cyan
    exit 1
}

# Get Zone ID if not provided
if (-not $ZONE_ID) {
    Write-Host "🔍 Fetching Zone ID for $DOMAIN..." -ForegroundColor Yellow
    $headers = @{
        "Authorization" = "Bearer $API_TOKEN"
        "Content-Type"  = "application/json"
    }

    try {
        $zones = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones?name=$DOMAIN" -Headers $headers
        if ($zones.success -and $zones.result.Count -gt 0) {
            $ZONE_ID = $zones.result[0].id
            Write-Host "✅ Zone ID: $ZONE_ID" -ForegroundColor Green
        }
        else {
            Write-Host "❌ Zone not found for $DOMAIN" -ForegroundColor Red
            exit 1
        }
    }
    catch {
        Write-Host "❌ Failed to fetch Zone ID: $_" -ForegroundColor Red
        exit 1
    }
}

# Prepare purge request
$headers = @{
    "Authorization" = "Bearer $API_TOKEN"
    "Content-Type"  = "application/json"
}

if ($PurgeEverything) {
    Write-Host "⚠️  PURGE EVERYTHING mode" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "This will clear ALL cached files for $DOMAIN" -ForegroundColor Red
    if (-not $DryRun) {
        $confirm = Read-Host "Type 'yes' to confirm"
        if ($confirm -ne "yes") {
            Write-Host "❌ Cancelled" -ForegroundColor Red
            exit 0
        }
    }

    $body = @{
        purge_everything = $true
    } | ConvertTo-Json
}
else {
    Write-Host "🎯 Selective cache purge (OG images, HTML, assets)" -ForegroundColor Yellow

    # Purge specific files/patterns
    $files = @(
        "https://www.leoklemet.com/",
        "https://www.leoklemet.com/index.html",
        "https://www.leoklemet.com/og/og.png",
        "https://www.leoklemet.com/og/leo-portfolio.png",
        "https://www.leoklemet.com/og/applylens.png",
        "https://www.leoklemet.com/og/ai-finance-agent-oss.png",
        "https://www.leoklemet.com/og/ai-ops-agent-gke.png",
        "https://www.leoklemet.com/og/pixo-banana-suite.png",
        "https://www.leoklemet.com/og/adgen-starter-kit.png"
    )

    Write-Host ""
    Write-Host "Files to purge:" -ForegroundColor Cyan
    $files | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }

    $body = @{
        files = $files
    } | ConvertTo-Json
}

# Execute purge
Write-Host ""
if ($DryRun) {
    Write-Host "[DRY RUN] Would purge cache" -ForegroundColor Gray
    Write-Host "Zone: $ZONE_ID" -ForegroundColor Gray
    Write-Host "Body: $body" -ForegroundColor Gray
}
else {
    Write-Host "🔄 Purging cache..." -ForegroundColor Yellow

    try {
        $response = Invoke-RestMethod `
            -Method Post `
            -Uri "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" `
            -Headers $headers `
            -Body $body

        if ($response.success) {
            Write-Host "✅ Cache purged successfully" -ForegroundColor Green
            Write-Host ""
            Write-Host "📊 Response:" -ForegroundColor Cyan
            $response | ConvertTo-Json -Depth 3 | Write-Host -ForegroundColor Gray
        }
        else {
            Write-Host "❌ Purge failed" -ForegroundColor Red
            Write-Host ""
            Write-Host "Errors:" -ForegroundColor Red
            $response.errors | ForEach-Object {
                Write-Host "  - $($_.message)" -ForegroundColor Red
            }
            exit 1
        }
    }
    catch {
        Write-Host "❌ API request failed: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "✅ Cache Purge Complete" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Wait 30-60 seconds for CDN propagation" -ForegroundColor White
Write-Host "2. Test OG images:" -ForegroundColor White
Write-Host "   curl -I https://www.leoklemet.com/og/og.png" -ForegroundColor Gray
Write-Host "3. Open site in incognito:" -ForegroundColor White
Write-Host "   Start-Process 'https://www.leoklemet.com' -InPrivate" -ForegroundColor Gray
Write-Host ""
