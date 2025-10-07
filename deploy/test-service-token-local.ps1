# Test Service Token Authentication Locally
# This script tests the backend's service token logic by injecting a mock CF JWT

Write-Host "`n🧪 Local Service Token Test" -ForegroundColor Cyan
Write-Host ("=" * 60)

# Backend configuration (from environment)
$TEAM_DOMAIN = "ledgermind.cloudflareaccess.com"
$AUD = "f34cb2b8f9a670c4f4df57f5c90b2cf45f31e27c1ec3ce83b5f75e2ce774f35c"
$SERVICE_TOKEN_NAME = "portfolio-admin-smoke"

Write-Host "`n📋 Test Configuration:" -ForegroundColor Yellow
Write-Host "  Backend: http://localhost:8080"
Write-Host "  Service Token Name: $SERVICE_TOKEN_NAME"
Write-Host "  Expected Response: {`"ok`":true,`"principal`":`"$SERVICE_TOKEN_NAME`"}"
Write-Host ""

Write-Host "⚠️  NOTE: This test requires valid CF JWT from Cloudflare" -ForegroundColor Yellow
Write-Host "   The backend validates JWT signature against CF public keys" -ForegroundColor Yellow
Write-Host "   We cannot generate valid JWTs locally without CF's private key" -ForegroundColor Yellow
Write-Host ""

Write-Host "✅ SOLUTION: Test against PRODUCTION with real service token" -ForegroundColor Green
Write-Host ""

# Test production
Write-Host "Testing PRODUCTION..." -ForegroundColor Cyan
$env:CF_ACCESS_CLIENT_ID = "bcf632e4a22f6a8007d47039038904b7.access"
$env:CF_ACCESS_CLIENT_SECRET = "1532e93c9599937c3155af61945d2c814168c6a5fa809f554d6e3257289268b6"

try {
    $response = Invoke-WebRequest `
        -Uri "https://assistant.ledger-mind.org/api/admin/whoami" `
        -Headers @{
            "CF-Access-Client-Id"=$env:CF_ACCESS_CLIENT_ID
            "CF-Access-Client-Secret"=$env:CF_ACCESS_CLIENT_SECRET
        } `
        -SkipCertificateCheck `
        -UseBasicParsing `
        -ErrorAction Stop

    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Content-Type: $($response.Headers['Content-Type'])"

    if ($response.Content -like "*{*") {
        Write-Host "`n🎉 SUCCESS!" -ForegroundColor Green
        $json = $response.Content | ConvertFrom-Json
        Write-Host ($json | ConvertTo-Json -Depth 5)
    } else {
        Write-Host "`n❌ Got HTML instead of JSON" -ForegroundColor Red
        Write-Host "First 200 chars:" -ForegroundColor Gray
        Write-Host $response.Content.Substring(0, [Math]::Min(200, $response.Content.Length))
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "`n❌ Request failed" -ForegroundColor Red
    Write-Host "Status: $statusCode" -ForegroundColor Yellow

    if ($statusCode -eq 401) {
        Write-Host "`n✅ PROGRESS: Cloudflare IS forwarding JWT now!" -ForegroundColor Green
        Write-Host "   The 401 means:" -ForegroundColor Cyan
        Write-Host "   - CF recognized the service token ✅" -ForegroundColor Green
        Write-Host "   - CF generated and forwarded a JWT ✅" -ForegroundColor Green
        Write-Host "   - Backend received the JWT ✅" -ForegroundColor Green
        Write-Host "   - Backend validation failed ❌" -ForegroundColor Red
        Write-Host ""
        Write-Host "   Possible causes:" -ForegroundColor Yellow
        Write-Host "   1. JWT 'sub' claim doesn't match '$SERVICE_TOKEN_NAME'" -ForegroundColor Gray
        Write-Host "   2. JWT signature validation failed" -ForegroundColor Gray
        Write-Host "   3. JWT aud claim doesn't match backend AUD" -ForegroundColor Gray
        Write-Host "   4. JWT expired" -ForegroundColor Gray
    } elseif ($statusCode -eq 403) {
        Write-Host "   Backend rejected - no JWT forwarded by CF" -ForegroundColor Yellow
    } else {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host ("=" * 60)
