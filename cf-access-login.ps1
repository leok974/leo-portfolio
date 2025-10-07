# Cloudflare Access Authentication Helper
# Run this first before testing CF Access

Write-Host "=== Cloudflare Access Login ===" -ForegroundColor Cyan
Write-Host ""

# Check if cloudflared is installed
$cloudflaredPath = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflaredPath) {
    Write-Host "✗ cloudflared not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install cloudflared first:" -ForegroundColor Yellow
    Write-Host "  Option 1 - Chocolatey:" -ForegroundColor White
    Write-Host "    choco install cloudflared" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Option 2 - Direct Download:" -ForegroundColor White
    Write-Host "    https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Option 3 - winget:" -ForegroundColor White
    Write-Host "    winget install cloudflare.cloudflared" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host "✓ cloudflared found: $($cloudflaredPath.Path)" -ForegroundColor Green
Write-Host ""

# Show configuration
Write-Host "Your Cloudflare Access Configuration:" -ForegroundColor Cyan
Write-Host "  Team Domain: ledgermind.cloudflareaccess.com" -ForegroundColor White
Write-Host "  Application: https://assistant.ledger-mind.org/api/uploads" -ForegroundColor White
Write-Host "  AUD:         f34cb2b8f9a670c4f4df57f5c90b2cf45f31e27c1ec3ce83b5f75e2ce774f35c" -ForegroundColor White
Write-Host "  Email:       leoklemet.pa@gmail.com" -ForegroundColor White
Write-Host ""

# Try to get existing token
Write-Host "Checking for existing token..." -ForegroundColor Yellow
$testToken = & cloudflared access token --app https://assistant.ledger-mind.org/api/uploads 2>&1

if ($testToken -match '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$') {
    Write-Host "✓ Valid token found! You're already authenticated." -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now run:" -ForegroundColor Cyan
    Write-Host "  .\verify-cf-access.ps1  # Verify complete setup" -ForegroundColor Gray
    Write-Host "  .\start-backend.ps1     # Start backend server" -ForegroundColor Gray
    Write-Host ""
    exit 0
}

# Need to login
Write-Host "✗ No valid token found. Authentication required." -ForegroundColor Red
Write-Host ""
Write-Host "Starting authentication process..." -ForegroundColor Yellow
Write-Host ""
Write-Host "This will:" -ForegroundColor White
Write-Host "  1. Open your browser" -ForegroundColor Gray
Write-Host "  2. Redirect to Cloudflare Access login" -ForegroundColor Gray
Write-Host "  3. Ask you to sign in (use: leoklemet.pa@gmail.com)" -ForegroundColor Gray
Write-Host "  4. Save authentication token locally" -ForegroundColor Gray
Write-Host ""

$response = Read-Host "Press Enter to continue (or Ctrl+C to cancel)"

Write-Host ""
Write-Host "Launching browser for authentication..." -ForegroundColor Yellow
Write-Host ""

try {
    # Run the login command
    & cloudflared access login https://ledgermind.cloudflareaccess.com

    Write-Host ""
    Write-Host "Authentication completed!" -ForegroundColor Green
    Write-Host ""

    # Verify token was saved
    Write-Host "Verifying token..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2

    $verifyToken = & cloudflared access token --app https://assistant.ledger-mind.org/api/uploads 2>&1

    if ($verifyToken -match '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$') {
        Write-Host "✓ Token saved successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "  1. Run .\verify-cf-access.ps1 to verify complete setup" -ForegroundColor Gray
        Write-Host "  2. Run .\start-backend.ps1 to start the backend" -ForegroundColor Gray
        Write-Host "  3. Test uploads through your browser" -ForegroundColor Gray
        Write-Host ""
    } else {
        Write-Host "⚠ Authentication may have failed. Error:" -ForegroundColor Yellow
        Write-Host $verifyToken -ForegroundColor Gray
        Write-Host ""
        Write-Host "Please try again or check:" -ForegroundColor Yellow
        Write-Host "  - You used the correct email: leoklemet.pa@gmail.com" -ForegroundColor Gray
        Write-Host "  - Your email is authorized in CF Access policies" -ForegroundColor Gray
        Write-Host "  - The CF Access application is configured correctly" -ForegroundColor Gray
        Write-Host ""
    }

} catch {
    Write-Host ""
    Write-Host "✗ Authentication failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Check you have internet connection" -ForegroundColor Gray
    Write-Host "  2. Verify the team domain is correct: ledgermind.cloudflareaccess.com" -ForegroundColor Gray
    Write-Host "  3. Make sure CF Access application exists for assistant.ledger-mind.org" -ForegroundColor Gray
    Write-Host "  4. Check your email (leoklemet.pa@gmail.com) is in the Access policy" -ForegroundColor Gray
    Write-Host ""
    exit 1
}
