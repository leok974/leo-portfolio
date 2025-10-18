#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Purge Cloudflare cache for portfolio OG images

.DESCRIPTION
  Clears stale cached 404 responses for OG social media preview images.
  Requires CLOUDFLARE_API_TOKEN and CF_ZONE_ID environment variables.

.EXAMPLE
  # Set credentials first (get from Cloudflare dashboard)
  $env:CLOUDFLARE_API_TOKEN = "your-token-here"
  $env:CF_ZONE_ID = "your-zone-id-here"

  # Then run this script
  .\scripts\purge-og-cache.ps1
#>

$ErrorActionPreference = 'Stop'

# Check required env vars
if (-not $env:CLOUDFLARE_API_TOKEN) {
  Write-Error "Missing CLOUDFLARE_API_TOKEN env var"
  exit 1
}

if (-not $env:CF_ZONE_ID) {
  Write-Error "Missing CF_ZONE_ID env var"
  exit 1
}

# OG image files to purge
$files = @(
  "https://www.leoklemet.com/og/og.png",
  "https://www.leoklemet.com/og/applylens.png",
  "https://www.leoklemet.com/og/ai-finance-agent-oss.png",
  "https://www.leoklemet.com/og/ai-ops-agent-gke.png",
  "https://www.leoklemet.com/og/pixo-banana-suite.png",
  "https://www.leoklemet.com/og/adgen-starter-kit.png",
  "https://www.leoklemet.com/og/leo-portfolio.png"
)

# Build JSON payload
$payload = @{ files = $files } | ConvertTo-Json -Compress

Write-Host "Purging Cloudflare cache for $($files.Count) OG images..." -ForegroundColor Cyan

$url = "https://api.cloudflare.com/client/v4/zones/$env:CF_ZONE_ID/purge_cache"
$headers = @{
  "Authorization" = "Bearer $env:CLOUDFLARE_API_TOKEN"
  "Content-Type" = "application/json"
}

try {
  $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $payload

  if ($response.success) {
    Write-Host "✅ Cache purged successfully!" -ForegroundColor Green
    Write-Host "Files cleared:" -ForegroundColor Gray
    $files | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }
  } else {
    Write-Error "Cloudflare API returned success=false: $($response.errors)"
  }
} catch {
  Write-Error "Failed to purge cache: $_"
  exit 1
}
