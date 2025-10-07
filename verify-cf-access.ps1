# Cloudflare Access Token Verification Script
# Run this to verify your CF Access configuration

Write-Host "=== Cloudflare Access Verification ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Get Access token
Write-Host "Step 1: Fetching Access token..." -ForegroundColor Yellow

# Check if cloudflared is installed
$cloudflaredPath = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflaredPath) {
    Write-Host "✗ cloudflared not found. Please install it first:" -ForegroundColor Red
    Write-Host "  Download: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/" -ForegroundColor Gray
    Write-Host "  Or via chocolatey: choco install cloudflared" -ForegroundColor Gray
    exit 1
}

# Try to get token
$token = $null
try {
    $token = & cloudflared access token --app https://assistant.ledger-mind.org/api/uploads 2>&1

    # Check if token is valid (JWT format: xxx.yyy.zzz)
    if ($token -match '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$') {
        Write-Host "✓ Token retrieved successfully" -ForegroundColor Green
        Write-Host ""
    } else {
        # Token retrieval failed, likely needs login
        Write-Host "✗ Failed to get token. Authentication required." -ForegroundColor Red
        Write-Host ""
        Write-Host "Please login first:" -ForegroundColor Yellow
        Write-Host "  cloudflared access login https://ledgermind.cloudflareaccess.com" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "This will open a browser for you to authenticate." -ForegroundColor Gray
        Write-Host "After successful login, run this script again." -ForegroundColor Gray
        exit 1
    }
} catch {
    Write-Host "✗ Failed to get token: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please login first:" -ForegroundColor Yellow
    Write-Host "  cloudflared access login https://ledgermind.cloudflareaccess.com" -ForegroundColor Cyan
    exit 1
}

# Step 2: Decode JWT payload
Write-Host "Step 2: Decoding JWT payload..." -ForegroundColor Yellow
try {
    $parts = $token.Split('.')

    # Pad base64 string
    $pad = ('=' * ((4 - ($parts[1].Length % 4)) % 4))
    $payloadJson = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($parts[1] + $pad))
    $payload = $payloadJson | ConvertFrom-Json

    Write-Host "✓ JWT decoded successfully" -ForegroundColor Green
    Write-Host ""

    # Display claims
    Write-Host "JWT Claims:" -ForegroundColor Cyan
    Write-Host "  Audience (aud): $($payload.aud)" -ForegroundColor White
    Write-Host "  Email:          $($payload.email)" -ForegroundColor White
    Write-Host "  Issued At:      $(Get-Date -UnixTimeSeconds $payload.iat -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
    Write-Host "  Expires:        $(Get-Date -UnixTimeSeconds $payload.exp -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
    Write-Host ""

    # Verify against expected values
    $expectedAud = "f34cb2b8f9a670c4f4df57f5c90b2cf45f31e27c1ec3ce83b5f75e2ce774f35c"
    $expectedEmail = "leoklemet.pa@gmail.com"

    Write-Host "Verification:" -ForegroundColor Cyan
    if ($payload.aud -eq $expectedAud) {
        Write-Host "  ✓ AUD matches expected value" -ForegroundColor Green
    } else {
        Write-Host "  ✗ AUD mismatch!" -ForegroundColor Red
        Write-Host "    Expected: $expectedAud" -ForegroundColor Gray
        Write-Host "    Got:      $($payload.aud)" -ForegroundColor Gray
    }

    if ($payload.email -eq $expectedEmail) {
        Write-Host "  ✓ Email matches expected value" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Email mismatch!" -ForegroundColor Red
        Write-Host "    Expected: $expectedEmail" -ForegroundColor Gray
        Write-Host "    Got:      $($payload.email)" -ForegroundColor Gray
    }
    Write-Host ""

} catch {
    Write-Host "✗ Failed to decode JWT: $_" -ForegroundColor Red
    exit 1
}

# Step 3: Check JWKS endpoint
Write-Host "Step 3: Checking JWKS endpoint..." -ForegroundColor Yellow
$jwksUrl = "https://ledgermind.cloudflareaccess.com/cdn-cgi/access/certs"

try {
    $response = Invoke-WebRequest -Uri $jwksUrl -UseBasicParsing
    $jwks = $response.Content | ConvertFrom-Json

    Write-Host "✓ JWKS endpoint accessible" -ForegroundColor Green
    Write-Host "  URL: $jwksUrl" -ForegroundColor Gray
    Write-Host "  Keys available: $($jwks.keys.Count)" -ForegroundColor White
    Write-Host ""

    if ($jwks.keys.Count -gt 0) {
        Write-Host "  Available Key IDs (kid):" -ForegroundColor Cyan
        foreach ($key in $jwks.keys) {
            Write-Host "    - $($key.kid) ($($key.alg))" -ForegroundColor Gray
        }
    }
    Write-Host ""

} catch {
    Write-Host "✗ Failed to fetch JWKS: $_" -ForegroundColor Red
    Write-Host "  URL: $jwksUrl" -ForegroundColor Gray
    exit 1
}

# Step 4: Test backend JWT verification (if running)
Write-Host "Step 4: Testing backend JWT verification..." -ForegroundColor Yellow
$backendUrl = "http://127.0.0.1:8001/api/uploads"

try {
    $headers = @{
        "Cf-Access-Jwt-Assertion" = $token
    }

    # We expect a 405 (Method Not Allowed) since we're doing GET on a POST-only endpoint
    # But if JWT verification works, we won't get 403 (Cloudflare Access required)
    $response = Invoke-WebRequest -Uri $backendUrl -Headers $headers -Method GET -UseBasicParsing -ErrorAction Stop
    Write-Host "✓ Backend accepted JWT (unexpected 200 OK)" -ForegroundColor Yellow
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__

    if ($statusCode -eq 405) {
        Write-Host "✓ Backend accepted JWT (405 Method Not Allowed is expected for GET)" -ForegroundColor Green
        Write-Host "  This means JWT verification passed!" -ForegroundColor Gray
    } elseif ($statusCode -eq 403) {
        Write-Host "✗ Backend rejected JWT (403 Forbidden)" -ForegroundColor Red
        Write-Host "  Check backend logs for details" -ForegroundColor Gray
    } elseif ($statusCode -eq 401) {
        Write-Host "✗ Backend rejected JWT (401 Unauthorized)" -ForegroundColor Red
        Write-Host "  JWT signature verification failed" -ForegroundColor Gray
    } else {
        Write-Host "⚠ Unexpected status code: $statusCode" -ForegroundColor Yellow
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Gray
    }
}
Write-Host ""

# Summary
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Configuration:" -ForegroundColor White
Write-Host "  Team Domain: ledgermind.cloudflareaccess.com" -ForegroundColor Gray
Write-Host "  AUD:         f34cb2b8f9a670c4f4df57f5c90b2cf45f31e27c1ec3ce83b5f75e2ce774f35c" -ForegroundColor Gray
Write-Host "  Email:       leoklemet.pa@gmail.com" -ForegroundColor Gray
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. If backend test failed, restart backend: python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001" -ForegroundColor Gray
Write-Host "  2. Check backend logs for JWT verification errors" -ForegroundColor Gray
Write-Host "  3. Test file upload with attachment button in browser" -ForegroundColor Gray
Write-Host ""
