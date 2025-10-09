#!/usr/bin/env pwsh
<#
.SYNOPSIS
Set up grafanactl environment variables

.DESCRIPTION
Interactive script to configure environment variables for grafanactl CLI.
Prompts for server type (on-premise or cloud) and required values.

.PARAMETER ServerType
Type of Grafana instance: "onprem" or "cloud"

.PARAMETER Permanent
If set, saves to PowerShell profile (persistent across sessions)

.EXAMPLE
.\setup-grafanactl.ps1

.EXAMPLE
.\setup-grafanactl.ps1 -ServerType onprem -Permanent

.EXAMPLE
.\setup-grafanactl.ps1 -ServerType cloud
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("onprem", "cloud")]
    [string]$ServerType,

    [Parameter(Mandatory=$false)]
    [switch]$Permanent
)

Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  grafanactl CLI Environment Setup                             ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Determine server type
if (-not $ServerType) {
    Write-Host "Select Grafana instance type:`n" -ForegroundColor Yellow
    Write-Host "  1. On-Premise (self-hosted)" -ForegroundColor White
    Write-Host "  2. Grafana Cloud`n" -ForegroundColor White

    $choice = Read-Host "Enter choice (1 or 2)"

    $ServerType = if ($choice -eq "2") { "cloud" } else { "onprem" }
}

Write-Host "`nConfiguring for: $($ServerType.ToUpper())`n" -ForegroundColor Green

# Collect configuration
if ($ServerType -eq "onprem") {
    # On-Premise Configuration
    Write-Host "═══ On-Premise Grafana Configuration ═══`n" -ForegroundColor Cyan

    $defaultServer = "http://localhost:3000"
    $server = Read-Host "Grafana Server URL (default: $defaultServer)"
    if (-not $server) { $server = $defaultServer }

    $defaultOrgId = "1"
    $orgId = Read-Host "Organization ID (default: $defaultOrgId)"
    if (-not $orgId) { $orgId = $defaultOrgId }

    Write-Host "`nℹ️  Create a token at: $server/org/apikeys" -ForegroundColor Cyan
    $token = Read-Host "API Token" -AsSecureString
    $tokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($token)
    )

    # Set environment variables
    $env:GRAFANA_SERVER = $server
    $env:GRAFANA_ORG_ID = $orgId
    $env:GRAFANA_TOKEN = $tokenPlain

    # Display configuration
    Write-Host "`n✅ Environment variables set:`n" -ForegroundColor Green
    Write-Host "  GRAFANA_SERVER = $server" -ForegroundColor Gray
    Write-Host "  GRAFANA_ORG_ID = $orgId" -ForegroundColor Gray
    Write-Host "  GRAFANA_TOKEN  = $($tokenPlain.Substring(0, [Math]::Min(15, $tokenPlain.Length)))..." -ForegroundColor Gray

} else {
    # Cloud Configuration
    Write-Host "═══ Grafana Cloud Configuration ═══`n" -ForegroundColor Cyan

    Write-Host "Find these values at: https://grafana.com/orgs/<your-org>/stacks" -ForegroundColor Cyan
    Write-Host ""

    $server = Read-Host "Grafana Stack URL (e.g., https://yourstack.grafana.net)"
    $stackId = Read-Host "Stack ID"

    Write-Host "`nℹ️  Create a service account token at: $server/org/serviceaccounts" -ForegroundColor Cyan
    $token = Read-Host "Service Account Token" -AsSecureString
    $tokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($token)
    )

    # Set environment variables
    $env:GRAFANA_SERVER = $server
    $env:GRAFANA_STACK_ID = $stackId
    $env:GRAFANA_TOKEN = $tokenPlain

    # Display configuration
    Write-Host "`n✅ Environment variables set:`n" -ForegroundColor Green
    Write-Host "  GRAFANA_SERVER   = $server" -ForegroundColor Gray
    Write-Host "  GRAFANA_STACK_ID = $stackId" -ForegroundColor Gray
    Write-Host "  GRAFANA_TOKEN    = $($tokenPlain.Substring(0, [Math]::Min(15, $tokenPlain.Length)))..." -ForegroundColor Gray
}

# Test configuration
Write-Host "`n═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Testing configuration...`n" -ForegroundColor Yellow

# Test with curl first (grafanactl might not be installed)
try {
    $headers = @{
        "Authorization" = "Bearer $tokenPlain"
    }
    $response = Invoke-RestMethod -Uri "$($env:GRAFANA_SERVER)/api/org" -Headers $headers -Method Get -UseBasicParsing
    Write-Host "✅ Connection successful!" -ForegroundColor Green
    Write-Host "   Connected to: $($response.name)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Connection failed!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`n⚠️  Check your server URL and token." -ForegroundColor Yellow
}

# Try grafanactl if available
Write-Host ""
if (Get-Command grafanactl -ErrorAction SilentlyContinue) {
    Write-Host "Running: grafanactl config check`n" -ForegroundColor Gray
    grafanactl config check
} else {
    Write-Host "ℹ️  grafanactl not found in PATH" -ForegroundColor Cyan
    Write-Host "   Install it to use CLI commands." -ForegroundColor Gray
}

# Offer to save permanently
Write-Host "`n═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
if ($Permanent) {
    Write-Host "Saving to PowerShell profile...`n" -ForegroundColor Yellow

    $profileContent = @"

# Grafana CLI Configuration (added by setup-grafanactl.ps1)
`$env:GRAFANA_SERVER = "$($env:GRAFANA_SERVER)"
"@

    if ($ServerType -eq "onprem") {
        $profileContent += "`n`$env:GRAFANA_ORG_ID = `"$($env:GRAFANA_ORG_ID)`""
    } else {
        $profileContent += "`n`$env:GRAFANA_STACK_ID = `"$($env:GRAFANA_STACK_ID)`""
    }

    $profileContent += @"

# WARNING: Token not saved to profile for security!
# Set manually: `$env:GRAFANA_TOKEN = '<your-token>'
"@

    if (-not (Test-Path $PROFILE)) {
        New-Item -Path $PROFILE -ItemType File -Force | Out-Null
    }

    Add-Content -Path $PROFILE -Value $profileContent

    Write-Host "✅ Saved to: $PROFILE" -ForegroundColor Green
    Write-Host "⚠️  Token NOT saved (security)" -ForegroundColor Yellow
    Write-Host "   Set token manually in new sessions:`n" -ForegroundColor Gray
    Write-Host "   `$env:GRAFANA_TOKEN = '<your-token>'" -ForegroundColor Gray
} else {
    Write-Host "Current session only (not persistent)" -ForegroundColor Gray
    Write-Host "To save permanently, run with: -Permanent" -ForegroundColor Gray
}

# Summary
Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ Setup Complete!                                            ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Green

Write-Host "Next steps:`n" -ForegroundColor Yellow

if (Get-Command grafanactl -ErrorAction SilentlyContinue) {
    Write-Host "1. Verify configuration:" -ForegroundColor White
    Write-Host "   grafanactl config check`n" -ForegroundColor Green

    Write-Host "2. List dashboards:" -ForegroundColor White
    Write-Host "   grafanactl dashboard list`n" -ForegroundColor Green

    Write-Host "3. Import SEO Meta dashboard:" -ForegroundColor White
    Write-Host "   grafanactl dashboard import grafana/seo-meta-auto-dashboard.json`n" -ForegroundColor Green
} else {
    Write-Host "1. Install grafanactl CLI" -ForegroundColor White
    Write-Host "   (See: grafana/GRAFANACTL_QUICKREF.md)`n" -ForegroundColor Gray

    Write-Host "2. Or use our test script:" -ForegroundColor White
    Write-Host "   .\scripts\test-grafana-token.ps1`n" -ForegroundColor Green
}

Write-Host "📚 Documentation: grafana/GRAFANACTL_QUICKREF.md`n" -ForegroundColor Cyan
