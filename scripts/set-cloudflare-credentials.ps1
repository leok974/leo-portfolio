#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Store Cloudflare credentials securely in Windows environment variables

.DESCRIPTION
  Saves CLOUDFLARE_API_TOKEN and CF_ZONE_ID to user-level environment variables
  so they persist across PowerShell sessions.

.EXAMPLE
  # Run this script once to set credentials
  .\scripts\set-cloudflare-credentials.ps1

.NOTES
  Credentials are stored at user level (not machine level) for security.
  Use $env:CLOUDFLARE_API_TOKEN and $env:CF_ZONE_ID in subsequent scripts.
#>

$ErrorActionPreference = 'Stop'

Write-Host "🔐 Cloudflare Credentials Setup" -ForegroundColor Cyan
Write-Host ""

# Cloudflare API Token
$apiToken = "nliaGPFEvvkoJILaT6DBkW8CF1cA5dQaxt8zGcye"
Write-Host "Setting CLOUDFLARE_API_TOKEN..." -ForegroundColor Yellow

# Zone ID
$zoneId = "3fbdb3802ab36704e7c652ad03ccb390"
Write-Host "Setting CF_ZONE_ID..." -ForegroundColor Yellow

# Store as user-level environment variables (persistent across sessions)
[System.Environment]::SetEnvironmentVariable("CLOUDFLARE_API_TOKEN", $apiToken, [System.EnvironmentVariableTarget]::User)
[System.Environment]::SetEnvironmentVariable("CF_ZONE_ID", $zoneId, [System.EnvironmentVariableTarget]::User)

# Also set for current session
$env:CLOUDFLARE_API_TOKEN = $apiToken
$env:CF_ZONE_ID = $zoneId

Write-Host ""
Write-Host "✅ Credentials stored successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Environment variables set:" -ForegroundColor Gray
Write-Host "  • CLOUDFLARE_API_TOKEN = $($apiToken.Substring(0, 10))..." -ForegroundColor Gray
Write-Host "  • CF_ZONE_ID = $zoneId" -ForegroundColor Gray
Write-Host ""
Write-Host "💡 These will be available in all new PowerShell sessions." -ForegroundColor Cyan
Write-Host "   You can now run: .\scripts\purge-og-cache.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  To remove credentials later, run:" -ForegroundColor Yellow
Write-Host '   [System.Environment]::SetEnvironmentVariable("CLOUDFLARE_API_TOKEN", $null, [System.EnvironmentVariableTarget]::User)' -ForegroundColor Gray
Write-Host '   [System.Environment]::SetEnvironmentVariable("CF_ZONE_ID", $null, [System.EnvironmentVariableTarget]::User)' -ForegroundColor Gray
