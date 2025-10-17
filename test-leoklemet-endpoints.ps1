# Test leoklemet.com endpoints after cache propagation
# Run this script in 5-10 minutes to verify everything is working

Write-Host "`n=== leoklemet.com Endpoint Tests ===" -ForegroundColor Cyan
Write-Host "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n" -ForegroundColor Gray

# Test 1: Dev Overlay Status
Write-Host "1. Testing /agent/dev/status (should return JSON)..." -ForegroundColor Yellow
try {
    $status = curl.exe -k -s https://www.leoklemet.com/agent/dev/status 2>&1
    if ($status -match '^\s*\{') {
        Write-Host "   ✅ SUCCESS! JSON Response:" -ForegroundColor Green
        $status | ConvertFrom-Json | ConvertTo-Json -Compress | Write-Host -ForegroundColor Green
    } else {
        Write-Host "   ❌ Still returning HTML (cached)" -ForegroundColor Red
        Write-Host "   First 80 chars: $($status.Substring(0, [Math]::Min(80, $status.Length)))" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ Error: $_" -ForegroundColor Red
}

# Test 2: Apex Redirect
Write-Host "`n2. Testing apex redirect (should return 301)..." -ForegroundColor Yellow
try {
    $redirect = curl.exe -k -I https://leoklemet.com/ 2>&1 | Select-String -Pattern "^HTTP/|^Location:" | Select-Object -First 2
    if ($redirect -match "301") {
        Write-Host "   ✅ SUCCESS! Redirect working:" -ForegroundColor Green
        $redirect | ForEach-Object { Write-Host "   $_" -ForegroundColor Green }
    } else {
        Write-Host "   ❌ No redirect found:" -ForegroundColor Red
        $redirect | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    }
} catch {
    Write-Host "   ❌ Error: $_" -ForegroundColor Red
}

# Test 3: Homepage
Write-Host "`n3. Testing homepage (should return 200 HTML)..." -ForegroundColor Yellow
try {
    $homepage = curl.exe -k -I https://www.leoklemet.com/ 2>&1 | Select-String -Pattern "^HTTP/|^Content-Type:" | Select-Object -First 2
    if ($homepage -match "200" -and $homepage -match "text/html") {
        Write-Host "   ✅ SUCCESS! Homepage loading:" -ForegroundColor Green
        $homepage | ForEach-Object { Write-Host "   $_" -ForegroundColor Green }
    } else {
        Write-Host "   ⚠️ Unexpected response:" -ForegroundColor Yellow
        $homepage | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    }
} catch {
    Write-Host "   ❌ Error: $_" -ForegroundColor Red
}

# Test 4: Dev Overlay Enable
Write-Host "`n4. Testing /agent/dev/enable (should set cookie)..." -ForegroundColor Yellow
try {
    $enable = curl.exe -k -i -H "Authorization: Bearer dev" https://www.leoklemet.com/agent/dev/enable 2>&1 | Select-String -Pattern "^HTTP/|^Set-Cookie:" | Select-Object -First 2
    if ($enable -match "Set-Cookie.*sa_dev") {
        Write-Host "   ✅ SUCCESS! Cookie being set:" -ForegroundColor Green
        $enable | ForEach-Object { Write-Host "   $_" -ForegroundColor Green }
    } else {
        Write-Host "   ❌ No cookie found:" -ForegroundColor Red
        $enable | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    }
} catch {
    Write-Host "   ❌ Error: $_" -ForegroundColor Red
}

# Summary
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "If all tests pass (✅):" -ForegroundColor White
Write-Host "  1. Visit https://www.leoklemet.com/?dev_overlay=dev" -ForegroundColor White
Write-Host "  2. Reload the page" -ForegroundColor White
Write-Host "  3. Look for green 'DEV' badge in bottom-right corner" -ForegroundColor White
Write-Host "`nIf tests still fail (❌):" -ForegroundColor White
Write-Host "  - Wait another 5 minutes for Cloudflare propagation" -ForegroundColor White
Write-Host "  - Check Development Mode is active in Cloudflare dashboard" -ForegroundColor White
Write-Host "  - Try: curl -k -H 'Cache-Control: no-cache' https://www.leoklemet.com/agent/dev/status" -ForegroundColor White
Write-Host ""
