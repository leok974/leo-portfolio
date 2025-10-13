<#
.SYNOPSIS
    One-shot PowerShell admin authentication verifier for portfolio backend.

.DESCRIPTION
    Tests the complete HMAC admin authentication workflow:
    - Admin login (get HMAC-signed cookie)
    - Auth status check (/api/auth/me)
    - Protected endpoints (with/without cookie)
    - SSE endpoint accessibility (optional)

.PARAMETER Site
    The portfolio site URL (e.g., https://assistant.ledger-mind.org)

.PARAMETER Email
    The admin email address to test with

.EXAMPLE
    .\Test-PortfolioAdmin.ps1 -Site "https://assistant.ledger-mind.org" -Email "leoklemet.pa@gmail.com"

.EXAMPLE
    Test-PortfolioAdmin -Site "http://127.0.0.1:5174" -Email "dev@localhost"
#>

function Test-PortfolioAdmin {
  param(
    [Parameter(Mandatory=$true)]
    [string]$Site,     # e.g. https://assistant.ledger-mind.org

    [Parameter(Mandatory=$true)]
    [string]$Email     # your admin email
  )

  $ProgressPreference = 'SilentlyContinue'
  $ErrorActionPreference = 'Stop'

  try {
    # 1) Admin login
    Write-Host "`n1) Logging in as admin..." -ForegroundColor Cyan
    Write-Host "   Email: $Email" -ForegroundColor DarkGray
    Write-Host "   Site:  $Site" -ForegroundColor DarkGray
    
    $loginUri = "$Site/api/auth/admin/login?email=$([uri]::EscapeDataString($Email))"
    $resp = Invoke-WebRequest -Uri $loginUri -Method POST -UseBasicParsing
    
    $cookie = ($resp.Headers.'Set-Cookie' | Select-String -Pattern 'admin_auth=([^;]+)').Matches.Groups[1].Value
    if (-not $cookie) {
      throw "No admin_auth cookie in response. Check backend logs for errors."
    }
    Write-Host "   ✓ Got admin_auth cookie (length: $($cookie.Length))" -ForegroundColor Green

    $headers = @{ Cookie = "admin_auth=$cookie" }

    # 2) Check auth status
    Write-Host "`n2) Checking /api/auth/me..." -ForegroundColor Cyan
    $meResp = Invoke-WebRequest -Uri "$Site/api/auth/me" -Headers $headers -UseBasicParsing
    $meJson = $meResp.Content | ConvertFrom-Json
    
    if (-not $meJson.is_admin) {
      throw "/api/auth/me did not return is_admin=true. Got: $($meResp.Content)"
    }
    Write-Host "   ✓ is_admin=true for $($meJson.user.email)" -ForegroundColor Green
    Write-Host "   ✓ Roles: $($meJson.roles -join ', ')" -ForegroundColor Green

    # 3) Protected endpoints (with cookie)
    Write-Host "`n3) Testing protected endpoints..." -ForegroundColor Cyan
    Write-Host "   a) With admin cookie:" -ForegroundColor DarkGray
    
    $resetResp = Invoke-WebRequest -Uri "$Site/api/layout/reset" -Method POST -Headers $headers -UseBasicParsing
    if ($resetResp.StatusCode -ge 400) {
      throw "POST /api/layout/reset failed with status $($resetResp.StatusCode)"
    }
    Write-Host "      ✓ POST /api/layout/reset → $($resetResp.StatusCode)" -ForegroundColor Green
    
    $autotuneResp = Invoke-WebRequest -Uri "$Site/api/layout/autotune" -Method POST -Headers $headers -UseBasicParsing
    if ($autotuneResp.StatusCode -ge 400) {
      throw "POST /api/layout/autotune failed with status $($autotuneResp.StatusCode)"
    }
    Write-Host "      ✓ POST /api/layout/autotune → $($autotuneResp.StatusCode)" -ForegroundColor Green

    # 4) Protected endpoints (without cookie - should fail)
    Write-Host "   b) Without cookie (should fail):" -ForegroundColor DarkGray
    
    try {
      $forbidResp = Invoke-WebRequest -Uri "$Site/api/layout/reset" -Method POST -UseBasicParsing -ErrorAction SilentlyContinue
      if ($forbidResp.StatusCode -lt 400) {
        throw "Endpoint allowed without cookie (status $($forbidResp.StatusCode)). Security issue!"
      }
    } catch {
      if ($_.Exception.Response.StatusCode.value__ -ge 400) {
        Write-Host "      ✓ POST /api/layout/reset → $($_.Exception.Response.StatusCode.value__) (blocked)" -ForegroundColor Green
      } else {
        throw $_
      }
    }

    # 5) SSE endpoint (optional check)
    Write-Host "`n4) Testing SSE endpoint..." -ForegroundColor Cyan
    try {
      $sseResp = Invoke-WebRequest -Method Head -Uri "$Site/agent/events" -Headers $headers -UseBasicParsing -ErrorAction SilentlyContinue
      if ($sseResp.StatusCode -eq 200) {
        Write-Host "   ✓ HEAD /agent/events → 200" -ForegroundColor Green
      } elseif ($sseResp.StatusCode -eq 405) {
        Write-Host "   ℹ HEAD /agent/events → 405 (Method Not Allowed - expected for some SSE backends)" -ForegroundColor Yellow
      } else {
        Write-Host "   ℹ HEAD /agent/events → $($sseResp.StatusCode)" -ForegroundColor Yellow
      }
    } catch {
      $statusCode = $_.Exception.Response.StatusCode.value__
      if ($statusCode -eq 401 -or $statusCode -eq 403) {
        Write-Host "   ✗ SSE endpoint requires auth (status $statusCode)" -ForegroundColor Red
      } else {
        Write-Host "   ℹ SSE endpoint returned $statusCode" -ForegroundColor Yellow
      }
    }

    # 6) Summary
    Write-Host "`n" + ("=" * 60) -ForegroundColor Green
    Write-Host "All admin authentication verifications passed ✅" -ForegroundColor Green
    Write-Host ("=" * 60) -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor Cyan
    Write-Host "  1. Open $Site in browser (logged in as admin)" -ForegroundColor White
    Write-Host "  2. Verify admin badge is visible (green pill)" -ForegroundColor White
    Write-Host "  3. Verify Autotune and Reset buttons are visible" -ForegroundColor White
    Write-Host "  4. Test buttons work (check browser console for errors)" -ForegroundColor White
    Write-Host ""

  } catch {
    Write-Host "`n✗ Verification failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`nTroubleshooting:" -ForegroundColor Yellow
    Write-Host "  • Check backend logs for authentication errors" -ForegroundColor White
    Write-Host "  • Verify ADMIN_HMAC_SECRET is set and same across all replicas" -ForegroundColor White
    Write-Host "  • Verify ADMIN_EMAILS contains: $Email" -ForegroundColor White
    Write-Host "  • Verify COOKIE_DOMAIN is set to .ledger-mind.org" -ForegroundColor White
    Write-Host "  • Verify CORS allows credentials (allow_credentials=True)" -ForegroundColor White
    Write-Host "  • Check docs/BACKEND_ADMIN_AUTH.md for full troubleshooting guide" -ForegroundColor White
    Write-Host ""
    exit 1
  }
}

# If script is run directly (not dot-sourced), execute the function
if ($MyInvocation.InvocationName -ne '.') {
  if ($args.Count -eq 0) {
    Write-Host @"
Usage:
  .\Test-PortfolioAdmin.ps1 -Site <url> -Email <email>

Examples:
  # Production
  .\Test-PortfolioAdmin.ps1 -Site "https://assistant.ledger-mind.org" -Email "leoklemet.pa@gmail.com"

  # Local dev
  .\Test-PortfolioAdmin.ps1 -Site "http://127.0.0.1:5174" -Email "dev@localhost"

  # Staging
  .\Test-PortfolioAdmin.ps1 -Site "https://staging.ledger-mind.org" -Email "leoklemet.pa@gmail.com"
"@
    exit 0
  }
  
  # Parse named parameters from args if provided
  $params = @{}
  for ($i = 0; $i -lt $args.Count; $i += 2) {
    if ($args[$i] -match '^-(.+)$') {
      $params[$matches[1]] = $args[$i + 1]
    }
  }
  
  if ($params.Site -and $params.Email) {
    Test-PortfolioAdmin @params
  } else {
    Write-Host "Error: -Site and -Email parameters are required" -ForegroundColor Red
    exit 1
  }
}
