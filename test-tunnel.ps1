# Cloudflare Tunnel Testing Script
# Usage: .\test-tunnel.ps1

Write-Host "`n🔍 Cloudflare Tunnel Status Check`n" -ForegroundColo    Write-Host "   Add hostname:" -ForegroundColor Cyan
    Write-Host "   - Subdomain: assistant" -ForegroundColor Gray
    Write-Host "   - Domain: ledger-mind.org" -ForegroundColor Gray
    Write-Host "   - Service: http://portfolio-nginx-1:80" -ForegroundColor Grayan

# 1. Check if tunnel container is running
Write-Host "1️⃣  Checking tunnel container..." -ForegroundColor Yellow
$tunnel = docker ps --filter "name=cloudflared" --format "{{.Names}}\t{{.Status}}"
if ($tunnel) {
    Write-Host "   ✅ Tunnel running: $tunnel" -ForegroundColor Green
} else {
    Write-Host "   ❌ Tunnel not running!" -ForegroundColor Red
    exit 1
}

# 2. Check network connectivity
Write-Host "`n2️⃣  Checking network connections..." -ForegroundColor Yellow
$containers = docker network inspect infra_net --format '{{range .Containers}}{{.Name}}{{"\n"}}{{end}}'
if ($containers -match "cloudflared" -and $containers -match "nginx") {
    Write-Host "   ✅ Tunnel and nginx on same network" -ForegroundColor Green
    Write-Host "   Containers on infra_net:" -ForegroundColor Gray
    $containers | ForEach-Object { Write-Host "     - $_" -ForegroundColor Gray }
} else {
    Write-Host "   ❌ Network not properly configured!" -ForegroundColor Red
    Write-Host "   Note: Tunnel should be able to reach portfolio-nginx-1 via infra_net" -ForegroundColor Gray
    exit 1
}

# 3. Check local nginx is responding
Write-Host "`n3️⃣  Testing local nginx..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/ready" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Local nginx responding (port 8080)" -ForegroundColor Green
        $content = $response.Content | ConvertFrom-Json
        if ($content.ok -eq $true) {
            Write-Host "   ✅ Backend healthy" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "   ❌ Local nginx not responding!" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
}

# 4. Check tunnel logs for errors
Write-Host "`n4️⃣  Checking tunnel logs for errors..." -ForegroundColor Yellow
$errors = docker logs infra-cloudflared-1 --tail=50 2>&1 | Select-String -Pattern "ERR|error|failed" | Select-Object -Last 3
if ($errors) {
    Write-Host "   ⚠️  Recent errors found:" -ForegroundColor Yellow
    $errors | ForEach-Object { Write-Host "     $_" -ForegroundColor Gray }
} else {
    Write-Host "   ✅ No recent errors" -ForegroundColor Green
}

# 5. Check tunnel connections
Write-Host "`n5️⃣  Checking tunnel edge connections..." -ForegroundColor Yellow
$connections = docker logs infra-cloudflared-1 --tail=100 2>&1 | Select-String "Registered tunnel connection" | Select-Object -Last 4
if ($connections.Count -ge 4) {
    Write-Host "   ✅ 4 edge connections registered" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Only $($connections.Count) connections (expected 4)" -ForegroundColor Yellow
}

# 6. Test public URL (if configured)
Write-Host "`n6️⃣  Testing public URL..." -ForegroundColor Yellow
Write-Host "   ⏳ Testing https://assistant.ledger-mind.org/ready ..." -ForegroundColor Gray

try {
    $public = Invoke-WebRequest -Uri "https://assistant.ledger-mind.org/ready" -UseBasicParsing -TimeoutSec 10
    if ($public.StatusCode -eq 200) {
        Write-Host "   ✅ Public URL responding!" -ForegroundColor Green
        $publicContent = $public.Content | ConvertFrom-Json
        if ($publicContent.ok -eq $true) {
            Write-Host "   ✅ Backend accessible via public URL" -ForegroundColor Green
        }

        # Test frontend
        Write-Host "`n   Testing frontend..." -ForegroundColor Gray
        $frontend = Invoke-WebRequest -Uri "https://assistant.ledger-mind.org/" -UseBasicParsing -TimeoutSec 10
        if ($frontend.Content -match "Leo Klemet") {
            Write-Host "   ✅ Frontend serving correctly" -ForegroundColor Green
        }
    }
} catch {
    $errorMsg = $_.Exception.Message
    if ($errorMsg -match "502") {
        Write-Host "   ❌ 502 Bad Gateway - Tunnel can't reach nginx" -ForegroundColor Red
        Write-Host "   💡 Check Cloudflare Dashboard service URL:" -ForegroundColor Cyan
        Write-Host "      Should be: http://deploy-nginx-1:80" -ForegroundColor Cyan
    } elseif ($errorMsg -match "1033") {
        Write-Host "   ⚠️  Tunnel not configured yet" -ForegroundColor Yellow
        Write-Host "   💡 Add public hostname in Cloudflare Dashboard:" -ForegroundColor Cyan
        Write-Host "      https://one.dash.cloudflare.com/" -ForegroundColor Cyan
    } elseif ($errorMsg -match "timed out") {
        Write-Host "   ⏱️  Connection timeout - tunnel may be starting" -ForegroundColor Yellow
        Write-Host "   💡 Wait 30 seconds and try again" -ForegroundColor Cyan
    } else {
        Write-Host "   ❌ Error: $errorMsg" -ForegroundColor Red
    }
}

# Summary
Write-Host "`n📊 Summary`n" -ForegroundColor Cyan

$localOk = $false
$publicOk = $false

try {
    $localTest = Invoke-WebRequest -Uri "http://localhost:8080/ready" -UseBasicParsing -TimeoutSec 3
    $localOk = $localTest.StatusCode -eq 200
} catch { }

try {
    $publicTest = Invoke-WebRequest -Uri "https://assistant.ledger-mind.org/ready" -UseBasicParsing -TimeoutSec 5
    $publicOk = $publicTest.StatusCode -eq 200
} catch { }

if ($localOk -and $publicOk) {
    Write-Host "🎉 " -NoNewline -ForegroundColor Green
    Write-Host "FULL SUCCESS!" -ForegroundColor Green
    Write-Host "   Local:  http://localhost:8080" -ForegroundColor Green
    Write-Host "   Public: https://assistant.ledger-mind.org" -ForegroundColor Green
} elseif ($localOk -and -not $publicOk) {
    Write-Host "⚠️  " -NoNewline -ForegroundColor Yellow
    Write-Host "LOCAL WORKS, PUBLIC NEEDS CONFIGURATION" -ForegroundColor Yellow
    Write-Host "   Local:  http://localhost:8080 ✅" -ForegroundColor Green
    Write-Host "   Public: https://assistant.ledger-mind.org ❌" -ForegroundColor Red
    Write-Host "`n   Next Step: Configure public hostname in Cloudflare Dashboard" -ForegroundColor Cyan
    Write-Host "   URL: https://one.dash.cloudflare.com/" -ForegroundColor Cyan
    Write-Host "`n   Add hostname:" -ForegroundColor Cyan
    Write-Host "   - Subdomain: assistant" -ForegroundColor Gray
    Write-Host "   - Domain: ledger-mind.org" -ForegroundColor Gray
    Write-Host "   - Service: http://deploy-nginx-1:80" -ForegroundColor Gray
} else {
    Write-Host "❌ " -NoNewline -ForegroundColor Red
    Write-Host "ISSUES DETECTED" -ForegroundColor Red
    Write-Host "   Check the error messages above" -ForegroundColor Yellow
}

Write-Host ""
