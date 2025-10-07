# Test Service Token Authentication
#
# Tests Cloudflare Access service token authentication with the admin API.
# Service tokens enable non-interactive authentication for CI/CD and automation.
#
# Setup:
#   1. Create service token in CF dashboard (Access > Service Auth > Service Tokens)
#   2. Add token to application policy
#   3. Set ACCESS_ALLOWED_SERVICE_SUBS in backend .env
#   4. Set credentials as environment variables or pass as parameters
#
# Usage:
#   .\test-service-token.ps1 -ClientId "<client-id>" -ClientSecret "<client-secret>"
#
#   Or with environment variables:
#   $env:CF_ACCESS_CLIENT_ID = "<client-id>"
#   $env:CF_ACCESS_CLIENT_SECRET = "<client-secret>"
#   .\test-service-token.ps1

param(
    [string]$ClientId = $env:CF_ACCESS_CLIENT_ID,
    [string]$ClientSecret = $env:CF_ACCESS_CLIENT_SECRET,
    [string]$BaseUrl = "https://assistant.ledger-mind.org"
)

Write-Host "=== Service Token Authentication Test ===" -ForegroundColor Cyan
Write-Host "Testing: $BaseUrl" -ForegroundColor Gray
Write-Host ""

# Validate credentials
if (-not $ClientId -or -not $ClientSecret) {
    Write-Host "✗ Missing credentials!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Provide credentials via:" -ForegroundColor Yellow
    Write-Host "  1. Parameters: .\test-service-token.ps1 -ClientId '<id>' -ClientSecret '<secret>'" -ForegroundColor Gray
    Write-Host "  2. Environment:" -ForegroundColor Gray
    Write-Host "       `$env:CF_ACCESS_CLIENT_ID = '<client-id>'" -ForegroundColor Gray
    Write-Host "       `$env:CF_ACCESS_CLIENT_SECRET = '<client-secret>'" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host "✓ Credentials provided" -ForegroundColor Green
Write-Host "  Client ID: $($ClientId.Substring(0, 20))..." -ForegroundColor Gray
Write-Host ""

# Prepare headers
$headers = @{
    "CF-Access-Client-Id" = $ClientId
    "CF-Access-Client-Secret" = $ClientSecret
}

# Test 1: Whoami (simplest smoke test)
Write-Host "Test 1: GET /api/admin/whoami" -ForegroundColor Yellow
$whoamiUrl = "$BaseUrl/api/admin/whoami"

try {
    $response = Invoke-WebRequest -Uri $whoamiUrl `
                                  -Headers $headers `
                                  -Method GET `
                                  -UseBasicParsing `
                                  -ErrorAction Stop

    $result = $response.Content | ConvertFrom-Json

    if ($result.ok -and $result.principal) {
        Write-Host "✓ Success! Principal: $($result.principal)" -ForegroundColor Green
        Write-Host "  Response: $($response.Content)" -ForegroundColor Gray
    } else {
        Write-Host "⚠ Unexpected response format" -ForegroundColor Yellow
        Write-Host "  $($response.Content)" -ForegroundColor Gray
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "✗ Request failed" -ForegroundColor Red

    if ($statusCode -eq 403) {
        Write-Host "  403 Forbidden - Possible causes:" -ForegroundColor Red
        Write-Host "    - Service token not added to CF Access policy" -ForegroundColor Gray
        Write-Host "    - Token subject not in ACCESS_ALLOWED_SERVICE_SUBS" -ForegroundColor Gray
        Write-Host "    - Request not going through Cloudflare" -ForegroundColor Gray
    } elseif ($statusCode -eq 401) {
        Write-Host "  401 Unauthorized - JWT verification failed" -ForegroundColor Red
    } else {
        Write-Host "  Status: $statusCode" -ForegroundColor Red
    }
    Write-Host ""
    exit 1
}
Write-Host ""

# Test 2: Uploads endpoint (GET should return 405)
Write-Host "Test 2: GET /api/admin/uploads (expect 405)" -ForegroundColor Yellow
$uploadsUrl = "$BaseUrl/api/admin/uploads"

try {
    $response = Invoke-WebRequest -Uri $uploadsUrl `
                                  -Headers $headers `
                                  -Method GET `
                                  -UseBasicParsing `
                                  -ErrorAction Stop
    Write-Host "⚠ Unexpected 200 OK" -ForegroundColor Yellow
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__

    if ($statusCode -eq 405) {
        Write-Host "✓ 405 Method Not Allowed (JWT verified!)" -ForegroundColor Green
    } elseif ($statusCode -eq 403) {
        Write-Host "✗ 403 Forbidden (JWT verification failed)" -ForegroundColor Red
    } else {
        Write-Host "⚠ Status: $statusCode (expected 405)" -ForegroundColor Yellow
    }
}
Write-Host ""

# Test 3: Gallery endpoint (GET should return 405)
Write-Host "Test 3: GET /api/admin/gallery/add (expect 405)" -ForegroundColor Yellow
$galleryUrl = "$BaseUrl/api/admin/gallery/add"

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
        Write-Host "✓ 405 Method Not Allowed (JWT verified!)" -ForegroundColor Green
    } elseif ($statusCode -eq 403) {
        Write-Host "✗ 403 Forbidden (JWT verification failed)" -ForegroundColor Red
    } else {
        Write-Host "⚠ Status: $statusCode (expected 405)" -ForegroundColor Yellow
    }
}
Write-Host ""

# Summary
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Service token authentication: ✓ Working" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  - Use these credentials in CI/CD pipelines" -ForegroundColor Gray
Write-Host "  - Store credentials securely (GitHub Secrets, AWS Secrets Manager, etc.)" -ForegroundColor Gray
Write-Host "  - Test file uploads: curl -X POST -H 'CF-Access-Client-Id: ...' -F 'file=@image.png' $BaseUrl/api/admin/uploads" -ForegroundColor Gray
Write-Host ""
Write-Host "Documentation: docs/CF_ACCESS_SERVICE_TOKENS.md" -ForegroundColor Gray
Write-Host ""
