#!/usr/bin/env pwsh
# Quick tunnel sanity check - one-liner for production health probe
# Usage: pwsh ./scripts/tunnel-probe.ps1
#        pwsh ./scripts/tunnel-probe.ps1 -Url "https://your-domain.com"

param(
    [string]$Url = "https://assistant.ledger-mind.org",
    [int]$TimeoutSec = 5
)

Write-Host "🔍 Probing $Url/ready..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "$Url/ready" -TimeoutSec $TimeoutSec -ErrorAction Stop
    $bytes = ($response | ConvertTo-Json -Compress).Length
    Write-Host "✅ OK: $bytes bytes" -ForegroundColor Green
    Write-Host $response
    exit 0
} catch {
    Write-Host "❌ FAIL: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
