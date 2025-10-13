#!/usr/bin/env pwsh
# Portfolio Migration Verification Script
# Builds portfolio, tests resume endpoints, and runs E2E tests

$ErrorActionPreference = "Stop"

Write-Host "🔨 Building portfolio..." -ForegroundColor Cyan
npm run build:portfolio

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build successful!" -ForegroundColor Green
Write-Host ""

# Verify built files exist
$requiredFiles = @(
    "dist-portfolio/index.html",
    "dist-portfolio/assets",
    "public/sitemap.xml",
    "public/robots.txt"
)

Write-Host "📦 Verifying build artifacts..." -ForegroundColor Cyan
foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        Write-Host "❌ Missing required file: $file" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✅ All build artifacts present!" -ForegroundColor Green
Write-Host ""

# Verify resume buttons in built HTML
Write-Host "🔍 Verifying resume buttons in HTML..." -ForegroundColor Cyan
$html = Get-Content "dist-portfolio/index.html" -Raw
$requiredElements = @(
    "resume-md-download",
    "resume-pdf-download",
    "resume-linkedin-copy",
    "footer-resume-md",
    "footer-resume-pdf"
)

$missing = @()
foreach ($element in $requiredElements) {
    if ($html -notmatch $element) {
        $missing += $element
    }
}

if ($missing.Count -gt 0) {
    Write-Host "❌ Missing resume buttons: $($missing -join ', ')" -ForegroundColor Red
    exit 1
}
Write-Host "✅ All resume buttons present!" -ForegroundColor Green
Write-Host ""

# Verify social links
Write-Host "🔍 Verifying social links..." -ForegroundColor Cyan
$socialLinks = @(
    "link-github",
    "link-linkedin",
    "link-artstation",
    "link-email",
    "link-resume"
)

$missingSocial = @()
foreach ($link in $socialLinks) {
    if ($html -notmatch $link) {
        $missingSocial += $link
    }
}

if ($missingSocial.Count -gt 0) {
    Write-Host "❌ Missing social links: $($missingSocial -join ', ')" -ForegroundColor Red
    exit 1
}
Write-Host "✅ All social links present!" -ForegroundColor Green
Write-Host ""

# Verify OG meta tags
Write-Host "🔍 Verifying Open Graph meta tags..." -ForegroundColor Cyan
$ogTags = @(
    'property="og:title"',
    'property="og:description"',
    'property="og:type"'
)

$missingOg = @()
foreach ($tag in $ogTags) {
    if ($html -notmatch [regex]::Escape($tag)) {
        $missingOg += $tag
    }
}

if ($missingOg.Count -gt 0) {
    Write-Host "❌ Missing OG meta tags: $($missingOg -join ', ')" -ForegroundColor Red
    exit 1
}
Write-Host "✅ All OG meta tags present!" -ForegroundColor Green
Write-Host ""

# Verify nginx CSP configuration
Write-Host "🔍 Verifying nginx CSP configuration..." -ForegroundColor Cyan
$nginxConf = Get-Content "deploy/nginx.portfolio.conf" -Raw
if ($nginxConf -match "connect-src.*https://assistant\.ledger-mind\.org") {
    Write-Host "✅ CSP includes backend API origin!" -ForegroundColor Green
} else {
    Write-Host "❌ CSP missing backend API origin in connect-src!" -ForegroundColor Red
    exit 1
}

# Verify SSE proxy configuration
if ($nginxConf -match "location.*agent/events|chat/stream" -and $nginxConf -match "proxy_buffering off") {
    Write-Host "✅ SSE proxy configuration present!" -ForegroundColor Green
} else {
    Write-Host "❌ SSE proxy configuration missing or incomplete!" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Check if backend is running (optional - don't fail if not)
Write-Host "🔍 Checking backend availability..." -ForegroundColor Cyan
try {
    $backendResponse = Invoke-WebRequest -Uri "http://127.0.0.1:8001/ready" -UseBasicParsing -Method Get -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✅ Backend is running!" -ForegroundColor Green
    $backendRunning = $true
} catch {
    Write-Host "⚠️  Backend not running (tests may fail)" -ForegroundColor Yellow
    $backendRunning = $false
}
Write-Host ""

# Smoke test resume endpoints (only if backend is running)
if ($backendRunning) {
    Write-Host "🧪 Smoke testing resume endpoints..." -ForegroundColor Cyan
    $endpoints = @(
        "/resume/generate.md",
        "/resume/generate.json"
    )

    foreach ($endpoint in $endpoints) {
        try {
            $url = "http://127.0.0.1:8001$endpoint"
            $res = Invoke-WebRequest -Uri $url -UseBasicParsing -Method Get -ErrorAction Stop
            if ($res.StatusCode -lt 400) {
                Write-Host "  ✅ $endpoint → $($res.StatusCode)" -ForegroundColor Green
            } else {
                Write-Host "  ❌ $endpoint → $($res.StatusCode)" -ForegroundColor Red
            }
        } catch {
            Write-Host "  ⚠️  $endpoint → ERROR: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
    Write-Host ""
}

# Run E2E tests
Write-Host "🧪 Running E2E tests..." -ForegroundColor Cyan
Write-Host ""

# Set environment variables to skip webserver start (use existing)
$env:PW_SKIP_WS = '1'
$env:BACKEND_REQUIRED = '0'

# Run portfolio smoke tests
Write-Host "Running portfolio.smoke.spec.ts..." -ForegroundColor Cyan
npm run test:e2e -- tests/e2e/portfolio.smoke.spec.ts --project=chromium
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Portfolio smoke tests passed!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Portfolio smoke tests had failures" -ForegroundColor Yellow
}
Write-Host ""

# Run resume endpoints tests
Write-Host "Running resume-endpoints.spec.ts..." -ForegroundColor Cyan
npm run test:e2e -- tests/e2e/resume-endpoints.spec.ts --project=chromium
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Resume endpoints tests passed!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Resume endpoints tests had failures" -ForegroundColor Yellow
}
Write-Host ""

# Run assistant stream tests
Write-Host "Running assistant.stream.spec.ts..." -ForegroundColor Cyan
npm run test:e2e -- tests/e2e/assistant.stream.spec.ts --project=chromium
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Assistant stream tests passed!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Assistant stream tests had failures" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "📊 VERIFICATION SUMMARY" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Portfolio build successful" -ForegroundColor Green
Write-Host "✅ Resume buttons present (About + Footer)" -ForegroundColor Green
Write-Host "✅ Social links intact" -ForegroundColor Green
Write-Host "✅ OG meta tags present" -ForegroundColor Green
Write-Host "✅ CSP configured for SSE" -ForegroundColor Green
Write-Host "✅ Nginx SSE proxy configured" -ForegroundColor Green
Write-Host "✅ Sitemap/robots generation wired" -ForegroundColor Green
Write-Host ""
Write-Host "📝 E2E test results available in console output above" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎉 Migration verification complete!" -ForegroundColor Green
