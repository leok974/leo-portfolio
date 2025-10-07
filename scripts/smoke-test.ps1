# Post-deployment smoke tests (PowerShell)
# Usage: .\scripts\smoke-test.ps1 -Host "https://your-domain.com" -AdminToken $env:ADMIN_TOKEN

param(
    [Parameter(Mandatory=$false)]
    [string]$Host = "http://localhost:8000",

    [Parameter(Mandatory=$false)]
    [string]$AdminToken = ""
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "🔍 Running smoke tests for: $Host" -ForegroundColor Cyan
Write-Host "=================================================="

function Pass {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Fail {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
    exit 1
}

function Warn {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

# Test 1: Backend health check
Write-Host ""
Write-Host "1️⃣  Testing backend health..."
try {
    $response = Invoke-WebRequest -Uri "$Host/ready" -Method GET -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Pass "Backend is healthy"
        $response.Content | ConvertFrom-Json | ConvertTo-Json
    }
} catch {
    Fail "Backend health check failed: $($_.Exception.Message)"
}

# Test 2: RAG system diagnostics
Write-Host ""
Write-Host "2️⃣  Testing RAG system..."
if ([string]::IsNullOrEmpty($AdminToken)) {
    Warn "ADMIN_TOKEN not provided, skipping RAG diagnostics"
} else {
    try {
        $headers = @{ "X-Admin-Token" = $AdminToken }
        $response = Invoke-WebRequest -Uri "$Host/api/rag/diag/rag" -Headers $headers -UseBasicParsing
        $rag = $response.Content | ConvertFrom-Json

        # Check user_version
        if ($rag.env.user_version -eq "4") {
            Pass "RAG schema version correct (4)"
        } else {
            Fail "RAG schema version mismatch (expected 4, got $($rag.env.user_version))"
        }

        # Check database exists
        if ($rag.files.rag_db.exists -eq $true) {
            Pass "RAG database exists"
        } else {
            Fail "RAG database not found"
        }

        # Check embeddings count
        if ($rag.stats.embeddings_count -and $rag.stats.embeddings_count -gt 0) {
            Pass "RAG has $($rag.stats.embeddings_count) embeddings"
        } else {
            Warn "RAG has no embeddings or count unavailable"
        }
    } catch {
        Fail "RAG diagnostics failed: $($_.Exception.Message)"
    }
}

# Test 3: Homepage loads
Write-Host ""
Write-Host "3️⃣  Testing homepage..."
try {
    $response = Invoke-WebRequest -Uri "$Host/" -Method GET -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Pass "Homepage loads (HTTP 200)"
        $indexHtml = $response.Content
    }
} catch {
    Fail "Homepage failed to load: $($_.Exception.Message)"
}

# Test 4: Calendly popup button present
Write-Host ""
Write-Host "4️⃣  Testing Calendly popup integration..."
if ($indexHtml -match 'data-calendly-url') {
    Pass "Calendly popup button found on homepage"
    if ($indexHtml -match 'data-calendly-url="([^"]*)"') {
        Write-Host "   └─ data-calendly-url=`"$($Matches[1])`""
    }
} else {
    Fail "Calendly popup button not found on homepage"
}

# Test 5: Book page loads
Write-Host ""
Write-Host "5️⃣  Testing booking page..."
try {
    $response = Invoke-WebRequest -Uri "$Host/book.html" -Method GET -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Pass "Booking page loads (HTTP 200)"
        $bookHtml = $response.Content
    }
} catch {
    Fail "Booking page failed to load: $($_.Exception.Message)"
}

# Test 6: Calendly inline widget configured
Write-Host ""
Write-Host "6️⃣  Testing Calendly inline widget..."
if ($bookHtml -match 'calendly-inline') {
    Pass "Calendly inline widget found"
    if ($bookHtml -match 'data-calendly-url="([^"]*)"') {
        Pass "Inline widget is configured"
        Write-Host "   └─ data-calendly-url=`"$($Matches[1])`""
    } else {
        Warn "Inline widget found but not configured"
    }
} else {
    Fail "Calendly inline widget not found"
}

# Test 7: Calendly helper script accessible
Write-Host ""
Write-Host "7️⃣  Testing Calendly helper script..."
try {
    $response = Invoke-WebRequest -Uri "$Host/assets/js/calendly.js" -Method GET -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Pass "calendly.js is accessible"
        $calendlyJs = $response.Content

        # Check for key functions
        if ($calendlyJs -match 'trackAnalytics') {
            Pass "Analytics tracking function found"
        } else {
            Warn "Analytics tracking function not found in calendly.js"
        }

        if ($calendlyJs -match '__calendlyHelperLoaded') {
            Pass "Helper readiness signal found"
        } else {
            Warn "Helper readiness signal not found"
        }
    }
} catch {
    Fail "calendly.js not accessible: $($_.Exception.Message)"
}

# Test 8: CSP headers check
Write-Host ""
Write-Host "8️⃣  Testing Content Security Policy..."
try {
    $response = Invoke-WebRequest -Uri "$Host/book.html" -Method HEAD -UseBasicParsing
    $csp = $response.Headers["Content-Security-Policy"]
    if ($csp) {
        Pass "CSP header present on book.html"
        if ($csp -match 'assets\.calendly\.com') {
            Pass "CSP allows Calendly assets"
        } else {
            Warn "CSP may not allow Calendly assets"
        }
    } else {
        Warn "No CSP header found on book.html"
    }
} catch {
    Warn "Could not check CSP headers"
}

# Test 9: Font preconnect
Write-Host ""
Write-Host "9️⃣  Testing font configuration..."
if ($indexHtml -match 'fonts\.gstatic\.com') {
    Pass "Google Fonts preconnect found"
} else {
    Warn "Google Fonts preconnect not found"
}

# Test 10: Cache headers
Write-Host ""
Write-Host "🔟 Testing cache headers..."
try {
    $response = Invoke-WebRequest -Uri "$Host/assets/js/calendly.js" -Method HEAD -UseBasicParsing
    $cache = $response.Headers["Cache-Control"]
    if ($cache) {
        Pass "Cache-Control header present"
        Write-Host "   └─ Cache-Control: $cache"
    } else {
        Warn "No Cache-Control header on static assets"
    }
} catch {
    Warn "Could not check cache headers"
}

# Test 11: Chat endpoint (basic)
Write-Host ""
Write-Host "1️⃣1️⃣  Testing chat endpoint..."
try {
    $body = @{
        message = "Hello"
        stream = $false
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "$Host/chat" -Method POST `
        -ContentType "application/json" -Body $body -UseBasicParsing

    if ($response.StatusCode -eq 200) {
        Pass "Chat endpoint responds"
        $chat = $response.Content | ConvertFrom-Json
        if ($chat.response -and $chat.response.Length -gt 0) {
            Pass "Chat returns valid response"
            Write-Host "   └─ Response length: $($chat.response.Length) chars"
        } else {
            Warn "Chat response is empty or invalid"
        }
    }
} catch {
    Warn "Chat endpoint returned error: $($_.Exception.Message)"
}

# Summary
Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "🎉 Smoke tests completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Test Calendly popup manually in browser"
Write-Host "  2. Test inline booking page manually"
Write-Host "  3. Verify analytics events in browser console"
Write-Host "  4. Monitor logs for any errors"
Write-Host ""
Write-Host "Monitoring commands (Linux/WSL):"
Write-Host "  journalctl -u assistant-api -f              # Watch backend logs"
Write-Host "  tail -f /var/log/nginx/access.log           # Watch Nginx access logs"
Write-Host "  tail -f /var/log/nginx/error.log            # Watch Nginx errors"
Write-Host ""
