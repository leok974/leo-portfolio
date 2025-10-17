# Test api.leoklemet.com configuration
# Run this after adding DNS record and waiting 5 minutes

Write-Host "`n=== api.leoklemet.com Configuration Test ===" -ForegroundColor Cyan
Write-Host "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n" -ForegroundColor Gray

# Test 1: DNS Resolution
Write-Host "1. DNS Resolution:" -ForegroundColor Yellow
try {
    $dns = nslookup api.leoklemet.com 2>&1 | Select-String "Address" | Select-Object -Last 2
    if ($dns) {
        Write-Host "   ✅ DNS resolves:" -ForegroundColor Green
        $dns | ForEach-Object { Write-Host "      $_" -ForegroundColor White }
    } else {
        Write-Host "   ❌ DNS not resolving yet" -ForegroundColor Red
        Write-Host "      Wait 2-3 more minutes and try again" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ DNS resolution failed" -ForegroundColor Red
}

# Test 2: API Endpoint JSON
Write-Host "`n2. /agent/dev/status (should return JSON):" -ForegroundColor Yellow
try {
    $status = curl.exe --ssl-no-revoke -s https://api.leoklemet.com/agent/dev/status 2>&1
    if ($status -match '^\s*\{.*"enabled"') {
        Write-Host "   ✅✅✅ SUCCESS! JSON response:" -ForegroundColor Green
        Write-Host "      $status" -ForegroundColor Green
    } else {
        $firstChars = $status.Substring(0, [Math]::Min(100, $status.Length))
        if ($firstChars -match "Could not resolve") {
            Write-Host "   ⏳ DNS not propagated yet" -ForegroundColor Yellow
            Write-Host "      $firstChars" -ForegroundColor Gray
        } else {
            Write-Host "   ❌ Returns HTML or error:" -ForegroundColor Red
            Write-Host "      $firstChars" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "   ❌ Request failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Cache Status
Write-Host "`n3. Cache Status (should be BYPASS/MISS/DYNAMIC):" -ForegroundColor Yellow
try {
    $headers = curl.exe --ssl-no-revoke -I https://api.leoklemet.com/agent/dev/status 2>&1 | Select-String "CF-Cache-Status|Content-Type"
    $headers | ForEach-Object {
        $line = $_.ToString()
        if ($line -match "CF-Cache-Status:\s*(BYPASS|DYNAMIC|MISS)") {
            Write-Host "   ✅ $line" -ForegroundColor Green
        } elseif ($line -match "CF-Cache-Status:\s*HIT") {
            Write-Host "   ❌ $line (cached!)" -ForegroundColor Red
        } elseif ($line -match "Content-Type:\s*application/json") {
            Write-Host "   ✅ $line" -ForegroundColor Green
        } else {
            Write-Host "   $line" -ForegroundColor White
        }
    }
} catch {
    Write-Host "   ⚠️  Could not check headers" -ForegroundColor Yellow
}

# Test 4: Dev Overlay Enable
Write-Host "`n4. /agent/dev/enable (should set cookie):" -ForegroundColor Yellow
try {
    $enable = curl.exe --ssl-no-revoke -i -H "Authorization: Bearer dev" https://api.leoklemet.com/agent/dev/enable 2>&1 | Select-String "Set-Cookie|Domain" | Select-Object -First 3
    if ($enable -match "sa_dev") {
        Write-Host "   ✅ Cookie set successfully:" -ForegroundColor Green
        $enable | ForEach-Object { Write-Host "      $_" -ForegroundColor White }
    } else {
        Write-Host "   ⚠️  No cookie found in response" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Request failed" -ForegroundColor Red
}

# Test 5: Apex Redirect
Write-Host "`n5. Apex Redirect (should be 301):" -ForegroundColor Yellow
try {
    $redirect = curl.exe --ssl-no-revoke -I https://leoklemet.com/ 2>&1 | Select-String "^HTTP/|^Location:" | Select-Object -First 2
    $has301 = $false
    $hasLocation = $false

    $redirect | ForEach-Object {
        $line = $_.ToString()
        if ($line -match "HTTP.*301") {
            Write-Host "   ✅ $line" -ForegroundColor Green
            $has301 = $true
        } elseif ($line -match "Location:.*www\.leoklemet\.com") {
            Write-Host "   ✅ $line" -ForegroundColor Green
            $hasLocation = $true
        } elseif ($line -match "HTTP.*200") {
            Write-Host "   ❌ $line (should be 301!)" -ForegroundColor Red
        } else {
            Write-Host "   $line" -ForegroundColor White
        }
    }

    if (-not $has301 -and -not $hasLocation) {
        Write-Host "   ⚠️  No redirect found (check Cloudflare Tunnel config)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Request failed" -ForegroundColor Red
}

# Test 6: Homepage (should still work)
Write-Host "`n6. Homepage www.leoklemet.com (should be 200):" -ForegroundColor Yellow
try {
    $homepage = curl.exe -I https://www.leoklemet.com/ 2>&1 | Select-String "^HTTP/" | Select-Object -First 1
    if ($homepage -match "200") {
        Write-Host "   ✅ $homepage" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  $homepage" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Request failed" -ForegroundColor Red
}

# Summary
Write-Host "`n=== Summary ===" -ForegroundColor Cyan

$allGood = $status -match '^\s*\{' -and $headers -match "BYPASS|DYNAMIC|MISS" -and $redirect -match "301"

if ($allGood) {
    Write-Host "✅ All tests passed! Configuration is working correctly." -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor White
    Write-Host "  1. Visit: https://www.leoklemet.com/?dev_overlay=dev" -ForegroundColor White
    Write-Host "  2. Dev badge should appear in bottom-right corner" -ForegroundColor White
    Write-Host "  3. Update frontend to use api.leoklemet.com for API calls (optional)" -ForegroundColor White
} elseif ($status -match "Could not resolve") {
    Write-Host "⏳ DNS not propagated yet." -ForegroundColor Yellow
    Write-Host "`nAction needed:" -ForegroundColor White
    Write-Host "  1. Add DNS record in Cloudflare dashboard:" -ForegroundColor White
    Write-Host "     Type: CNAME, Name: api, Target: www.leoklemet.com" -ForegroundColor Gray
    Write-Host "     Proxy: ON (orange cloud)" -ForegroundColor Gray
    Write-Host "  2. Wait 5 minutes" -ForegroundColor White
    Write-Host "  3. Run this script again" -ForegroundColor White
} elseif ($status -match '^\s*\{') {
    Write-Host "✅ API endpoint works!" -ForegroundColor Green
    Write-Host "⚠️  Some tests still failing - check details above" -ForegroundColor Yellow
} else {
    Write-Host "❌ Configuration issues detected." -ForegroundColor Red
    Write-Host "`nTroubleshooting:" -ForegroundColor White
    Write-Host "  1. Verify DNS record exists in Cloudflare dashboard" -ForegroundColor White
    Write-Host "  2. Check nginx config: docker exec applylens-nginx-prod nginx -T | grep api.leoklemet" -ForegroundColor Gray
    Write-Host "  3. Check backend: docker exec applylens-nginx-prod wget -qO- http://ai-finance-backend-1:8000/agent/dev/status" -ForegroundColor Gray
    Write-Host "  4. Wait a bit longer and retry" -ForegroundColor White
}

Write-Host ""
