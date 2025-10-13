# Production/Staging Admin Smoke Test
# Usage: 
#   $env:SITE = "https://assistant.ledger-mind.org"; $env:ADMIN_EMAIL = "leoklemet.pa@gmail.com"; .\scripts\smoke-admin-prod.ps1
#   Or: .\scripts\smoke-admin-prod.ps1 -Site "https://assistant.ledger-mind.org" -Email "leoklemet.pa@gmail.com"

param(
    [string]$Site = $env:SITE ?? "https://assistant.ledger-mind.org",
    [string]$Email = $env:ADMIN_EMAIL ?? "you@yourdomain.com"
)

$ErrorActionPreference = "Stop"

Write-Host "== Admin login ==" -ForegroundColor Cyan
try {
    $loginResponse = Invoke-WebRequest -Uri "$Site/api/auth/admin/login?email=$Email" -Method POST -SessionVariable session
    Write-Host "Status: $($loginResponse.StatusCode)"
    
    $cookie = $session.Cookies.GetCookies($Site) | Where-Object { $_.Name -eq "admin_auth" }
    if (-not $cookie) {
        Write-Host "❌ No admin_auth cookie found" -ForegroundColor Red
        exit 1
    }
    
    $cookieValue = $cookie.Value
    Write-Host "✓ Cookie extracted: $($cookieValue.Substring(0, [Math]::Min(50, $cookieValue.Length)))..." -ForegroundColor Green
}
catch {
    Write-Host "❌ Login failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n== /api/auth/me ==" -ForegroundColor Cyan
try {
    $headers = @{ "Cookie" = "admin_auth=$cookieValue" }
    $meResponse = Invoke-RestMethod -Uri "$Site/api/auth/me" -Headers $headers
    Write-Host ($meResponse | ConvertTo-Json -Compress)
    
    if ($meResponse.is_admin -ne $true) {
        Write-Host "❌ Expected is_admin: true" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Admin status confirmed" -ForegroundColor Green
}
catch {
    Write-Host "❌ /api/auth/me failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n== Protected endpoints (should be 200) ==" -ForegroundColor Cyan
try {
    $headers = @{ "Cookie" = "admin_auth=$cookieValue" }
    
    $resetResponse = Invoke-WebRequest -Uri "$Site/api/layout/reset" -Method POST -Headers $headers
    Write-Host "  /api/layout/reset: $($resetResponse.StatusCode)"
    
    $autotuneResponse = Invoke-WebRequest -Uri "$Site/api/layout/autotune" -Method POST -Headers $headers
    Write-Host "  /api/layout/autotune: $($autotuneResponse.StatusCode)"
    
    if ($resetResponse.StatusCode -eq 200 -and $autotuneResponse.StatusCode -eq 200) {
        Write-Host "✓ Protected endpoints working" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Expected 200 for both endpoints" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "❌ Protected endpoints failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n== Protected without cookie (should be 401/403) ==" -ForegroundColor Cyan
try {
    $unauthResponse = Invoke-WebRequest -Uri "$Site/api/layout/reset" -Method POST -ErrorAction Stop
    Write-Host "❌ Expected 401/403 but got $($unauthResponse.StatusCode)" -ForegroundColor Red
    exit 1
}
catch {
    if ($_.Exception.Response.StatusCode -in @(401, 403)) {
        Write-Host "  Status: $($_.Exception.Response.StatusCode.value__)" 
        Write-Host "✓ Correctly blocked without auth" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Unexpected error: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host "`n✅ Smoke complete" -ForegroundColor Green
