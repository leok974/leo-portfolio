# Production Smoke Test for Cloudflare Access
# Tests the deployed backend with CF Access JWT verification

Write-# Step 5: Test /api/admin/gallery/add with JWT
Write-Host "Step 5: Testing /api/admin/gallery/add with JWT..." -ForegroundColor Yellowst "=== Production Smoke Test ===" -ForegroundColor Cyan
Write-Host "Testing: https://assistant.ledger-mind.org" -ForegroundColor Gray
Write-Host ""

# Configuration
$appUrl = "https://assistant.ledger-mind.org/api/admin/uploads"
$galleryUrl = "https://assistant.ledger-mind.org/api/admin/gallery/add"

# Check cloudflared is installed
$cloudflaredPath = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflaredPath) {
    Write-Host "✗ cloudflared not found!" -ForegroundColor Red
    Write-Host "  Install: choco install cloudflared" -ForegroundColor Gray
    exit 1
}

Write-Host "✓ cloudflared found" -ForegroundColor Green
Write-Host ""

# Step 1: Authenticate
Write-Host "Step 1: Authenticating with Cloudflare Access..." -ForegroundColor Yellow
Write-Host "  This may open your browser for SSO" -ForegroundColor Gray

try {
    cloudflared access login $appUrl
    Write-Host "✓ Authentication completed" -ForegroundColor Green
} catch {
    Write-Host "✗ Authentication failed: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 2: Get JWT token
Write-Host "Step 2: Getting JWT token..." -ForegroundColor Yellow
try {
    $token = cloudflared access token --app $appUrl 2>&1

    if ($token -match '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$') {
        Write-Host "✓ Token retrieved: $($token.Substring(0,20))..." -ForegroundColor Green
    } else {
        Write-Host "✗ Invalid token format" -ForegroundColor Red
        Write-Host "  Got: $token" -ForegroundColor Gray
        exit 1
    }
} catch {
    Write-Host "✗ Failed to get token: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 3: Test /api/admin/whoami (simple smoke test)
Write-Host "Step 3: Testing /api/admin/whoami with JWT..." -ForegroundColor Yellow
$whoamiUrl = "https://assistant.ledger-mind.org/api/admin/whoami"

try {
    $response = Invoke-WebRequest -Uri $whoamiUrl `
                                  -Headers $headers `
                                  -Method GET `
                                  -UseBasicParsing `
                                  -ErrorAction Stop

    $result = $response.Content | ConvertFrom-Json

    if ($result.ok -and $result.principal) {
        Write-Host "✓ Whoami returned: $($result.principal)" -ForegroundColor Green
    } else {
        Write-Host "⚠ Unexpected response format" -ForegroundColor Yellow
        Write-Host "  $($response.Content)" -ForegroundColor Gray
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__

    if ($statusCode -eq 403) {
        Write-Host "✗ 403 Forbidden (JWT verification FAILED)" -ForegroundColor Red
    } elseif ($statusCode -eq 401) {
        Write-Host "✗ 401 Unauthorized (JWT signature invalid)" -ForegroundColor Red
    } else {
        Write-Host "✗ Status: $statusCode" -ForegroundColor Red
    }
}
Write-Host ""

# Step 4: Test /api/admin/uploads with JWT
Write-Host "Step 4: Testing /api/admin/uploads with JWT..." -ForegroundColor Yellow
$headers = @{ "Cf-Access-Jwt-Assertion" = $token }

try {
    $response = Invoke-WebRequest -Uri $appUrl `
                                  -Headers $headers `
                                  -Method GET `
                                  -UseBasicParsing `
                                  -ErrorAction Stop
    Write-Host "⚠ Unexpected 200 OK" -ForegroundColor Yellow
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__

    if ($statusCode -eq 405) {
        Write-Host "✓ 405 Method Not Allowed (JWT verified successfully!)" -ForegroundColor Green
    } elseif ($statusCode -eq 400) {
        Write-Host "✓ 400 Bad Request (JWT verified, missing POST data)" -ForegroundColor Green
    } elseif ($statusCode -eq 403) {
        Write-Host "✗ 403 Forbidden (JWT verification FAILED)" -ForegroundColor Red
        Write-Host "  Check backend logs and environment variables" -ForegroundColor Gray
    } elseif ($statusCode -eq 401) {
        Write-Host "✗ 401 Unauthorized (JWT signature invalid)" -ForegroundColor Red
    } else {
        Write-Host "⚠ Status: $statusCode" -ForegroundColor Yellow
    }
}
Write-Host ""

# Step 5: Test /api/gallery with JWT
Write-Host "Step 5: Testing /api/gallery with JWT..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri $galleryUrl `
                                  -Headers $headers `
                                  -Method GET `
                                  -UseBasicParsing `
                                  -ErrorAction Stop
    Write-Host "⚠ Unexpected 200 OK" -ForegroundColor Yellow
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__

    if ($statusCode -eq 405) {
        Write-Host "✓ 405 Method Not Allowed (JWT verified successfully!)" -ForegroundColor Green
    } elseif ($statusCode -eq 400) {
        Write-Host "✓ 400 Bad Request (JWT verified, missing POST data)" -ForegroundColor Green
    } elseif ($statusCode -eq 403) {
        Write-Host "✗ 403 Forbidden (JWT verification FAILED)" -ForegroundColor Red
    } elseif ($statusCode -eq 401) {
        Write-Host "✗ 401 Unauthorized (JWT signature invalid)" -ForegroundColor Red
    } else {
        Write-Host "⚠ Status: $statusCode" -ForegroundColor Yellow
    }
}
Write-Host ""

# Step 6: Test without JWT (should fail)
Write-Host "Step 6: Testing /api/uploads WITHOUT JWT (should fail)..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri $appUrl `
                                  -Method GET `
                                  -UseBasicParsing `
                                  -ErrorAction Stop
    Write-Host "✗ Unexpected 200 OK (JWT should be required!)" -ForegroundColor Red
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__

    if ($statusCode -eq 403) {
        Write-Host "✓ 403 Forbidden (JWT requirement enforced!)" -ForegroundColor Green
    } else {
        Write-Host "⚠ Status: $statusCode (expected 403)" -ForegroundColor Yellow
    }
}
Write-Host ""

# Step 7: Decode JWT to verify claims
Write-Host "Step 7: Verifying JWT claims..." -ForegroundColor Yellow

try {
    $parts = $token.Split('.')
    $pad = ('=' * ((4 - ($parts[1].Length % 4)) % 4))
    $payloadJson = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($parts[1] + $pad))
    $payload = $payloadJson | ConvertFrom-Json

    Write-Host "  Email: $($payload.email)" -ForegroundColor White
    Write-Host "  AUD:   $($payload.aud)" -ForegroundColor White

    $expectedAud = "f34cb2b8f9a670c4f4df57f5c90b2cf45f31e27c1ec3ce83b5f75e2ce774f35c"
    $expectedEmail = "leoklemet.pa@gmail.com"

    if ($payload.aud -eq $expectedAud) {
        Write-Host "  ✓ AUD matches backend configuration" -ForegroundColor Green
    } else {
        Write-Host "  ✗ AUD mismatch!" -ForegroundColor Red
        Write-Host "    Expected: $expectedAud" -ForegroundColor Gray
        Write-Host "    Got:      $($payload.aud)" -ForegroundColor Gray
    }

    if ($payload.email -eq $expectedEmail) {
        Write-Host "  ✓ Email matches backend configuration" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Email: $($payload.email)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Failed to decode JWT: $_" -ForegroundColor Red
}
Write-Host ""

# Summary
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration:" -ForegroundColor White
Write-Host "  Team Domain: ledgermind.cloudflareaccess.com" -ForegroundColor Gray
Write-Host "  Application: https://assistant.ledger-mind.org" -ForegroundColor Gray
Write-Host "  AUD:         f34cb2b8...774f35c" -ForegroundColor Gray
Write-Host "  Email:       leoklemet.pa@gmail.com" -ForegroundColor Gray
Write-Host ""

Write-Host "If all tests passed (✓), your production deployment is working correctly!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Test file uploads through browser" -ForegroundColor Gray
Write-Host "  2. Check Cloudflare Access logs for authentication events" -ForegroundColor Gray
Write-Host "  3. Monitor backend logs: docker-compose logs -f backend" -ForegroundColor Gray
Write-Host ""
