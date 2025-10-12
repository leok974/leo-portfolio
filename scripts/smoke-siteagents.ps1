# SiteAgent Brand Smoke Test
# Verifies no brand leakage and correct content on public site

$ErrorActionPreference = "Stop"

Write-Host "`n[smoke-siteagent] Testing https://siteagents.app/..." -ForegroundColor Cyan

# Fetch homepage content
$html = curl -k -s https://siteagents.app/ | Out-String

# Check for brand leakage (should NOT contain LedgerMind)
if ($html -match 'LedgerMind') {
    Write-Error "❌ Found LedgerMind on SiteAgent domain - brand leakage detected!"
    exit 1
}

# Check for correct branding (should contain SiteAgent, handle encoding)
if ($html -notmatch 'SiteAgent' -and $html -notmatch 'siteagent') {
    Write-Error "❌ Missing SiteAgent branding on SiteAgent domain!"
    exit 1
}

Write-Host "✅ Brand check passed: SiteAgent content, no LedgerMind" -ForegroundColor Green

# Check API health
Write-Host "`n[smoke-siteagent] Testing API health..." -ForegroundColor Cyan
try {
    $apiHealth = curl -k -s https://api.siteagents.app/ready | ConvertFrom-Json

    if (-not $apiHealth.ok) {
        Write-Error "❌ API health check failed: ok=$($apiHealth.ok)"
        exit 1
    }

    Write-Host "✅ API health OK: db=$($apiHealth.db.ok), migrations=$($apiHealth.migrations.ok)" -ForegroundColor Green
} catch {
    Write-Error "❌ API health check failed: $_"
    exit 1
}

# Check CSP header points to correct API
Write-Host "`n[smoke-siteagent] Testing CSP header..." -ForegroundColor Cyan
$headers = curl -k -I -s https://siteagents.app/ 2>&1
$csp = $headers | Select-String "content-security-policy" | Select-Object -First 1

if ($csp -match 'api\.siteagents\.app') {
    Write-Host "✅ CSP points to api.siteagents.app" -ForegroundColor Green
} else {
    Write-Error "❌ CSP does not point to api.siteagents.app"
    exit 1
}

Write-Host "`n✅ All SiteAgent smoke tests passed!" -ForegroundColor Green
exit 0
