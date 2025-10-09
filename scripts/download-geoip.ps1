#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Download MaxMind GeoLite2-Country database for geo enrichment analytics.

.DESCRIPTION
    This script downloads the GeoLite2-Country database from MaxMind and extracts
    the .mmdb file to data/geo/GeoLite2-Country.mmdb for use with behavior analytics.

.PARAMETER LicenseKey
    Your MaxMind license key. Get one free at https://www.maxmind.com/en/geolite2/signup

.EXAMPLE
    ./scripts/download-geoip.ps1 -LicenseKey "YOUR_LICENSE_KEY_HERE"

.NOTES
    - Requires PowerShell 5.1+ on Windows or PowerShell Core on Unix
    - Sets GEOIP_DB_PATH environment variable for backend
    - Database is updated monthly by MaxMind (re-run script to refresh)
#>

param(
    [Parameter(Mandatory=$true, HelpMessage="MaxMind license key (get free at https://www.maxmind.com/en/geolite2/signup)")]
    [string]$LicenseKey
)

$ErrorActionPreference = "Stop"

Write-Host "MaxMind GeoLite2-Country Database Downloader" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Create geo directory
$geoDir = "data/geo"
Write-Host "[1/4] Creating directory: $geoDir" -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $geoDir | Out-Null

# Download URL
$edition = "GeoLite2-Country"
$downloadUrl = "https://download.maxmind.com/app/geoip_download?edition_id=$edition&license_key=$LicenseKey&suffix=tar.gz"
$tarFile = "$geoDir/GeoLite2-Country.tar.gz"

Write-Host "[2/4] Downloading GeoLite2-Country database..." -ForegroundColor Yellow
Write-Host "      URL: $downloadUrl" -ForegroundColor Gray

try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $tarFile -UseBasicParsing
    Write-Host "      Downloaded: $tarFile ($([math]::Round((Get-Item $tarFile).Length / 1MB, 2)) MB)" -ForegroundColor Green
} catch {
    Write-Host "      ERROR: Failed to download database" -ForegroundColor Red
    Write-Host "      $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "  - Invalid license key (check https://www.maxmind.com/en/accounts/current/license-key)" -ForegroundColor Gray
    Write-Host "  - Network connectivity problems" -ForegroundColor Gray
    Write-Host "  - MaxMind API rate limit (wait a few minutes and retry)" -ForegroundColor Gray
    exit 1
}

# Extract .mmdb file
Write-Host "[3/4] Extracting .mmdb file..." -ForegroundColor Yellow

# Use tar command (works on Windows 10+ and Unix)
if (Get-Command tar -ErrorAction SilentlyContinue) {
    # Extract to temp location
    tar -xzf $tarFile -C $geoDir

    # Find the .mmdb file (MaxMind extracts to GeoLite2-Country_YYYYMMDD/ subdirectory)
    $mmdbFile = Get-ChildItem -Path $geoDir -Recurse -Filter "*.mmdb" | Select-Object -First 1

    if ($mmdbFile) {
        # Move to expected location
        $targetPath = "$geoDir/GeoLite2-Country.mmdb"
        Move-Item -Path $mmdbFile.FullName -Destination $targetPath -Force
        Write-Host "      Extracted: $targetPath" -ForegroundColor Green

        # Clean up extracted directory
        Get-ChildItem -Path $geoDir -Directory | Remove-Item -Recurse -Force
    } else {
        Write-Host "      ERROR: Could not find .mmdb file in archive" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "      ERROR: 'tar' command not found. Please install tar or extract manually." -ForegroundColor Red
    Write-Host "      Manual steps:" -ForegroundColor Yellow
    Write-Host "        1. Extract $tarFile" -ForegroundColor Gray
    Write-Host "        2. Move GeoLite2-Country.mmdb to $geoDir/" -ForegroundColor Gray
    exit 1
}

# Clean up tar file
Remove-Item -Path $tarFile -Force
Write-Host "[4/4] Cleaned up temporary files" -ForegroundColor Green

Write-Host ""
Write-Host "✓ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Set environment variable in your .env file:" -ForegroundColor White
Write-Host "     GEOIP_DB_PATH=./data/geo/GeoLite2-Country.mmdb" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Enable IP logging (optional):" -ForegroundColor White
Write-Host "     LOG_IP_ENABLED=true" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Restart backend to apply changes:" -ForegroundColor White
Write-Host "     ./.venv/Scripts/python.exe -m uvicorn assistant_api.main:app --reload" -ForegroundColor Gray
Write-Host ""
Write-Host "Database location: $geoDir/GeoLite2-Country.mmdb" -ForegroundColor Cyan
Write-Host "Update frequency: Monthly (re-run this script to refresh)" -ForegroundColor Gray
Write-Host ""
