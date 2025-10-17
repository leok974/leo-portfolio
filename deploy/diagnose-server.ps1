# Portfolio Server Diagnostics - 10-Step Fast Path Check
# Run this on your production server (Windows/PowerShell)

Write-Host "`n════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🔍 PORTFOLIO SERVER DIAGNOSTICS" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

$Failures = 0

# Step 1: Is the Cloudflare Tunnel up?
Write-Host "═══ STEP 1: Is the Cloudflare Tunnel up? ═══`n" -ForegroundColor Cyan
$tunnelContainer = docker ps --format "{{.Names}}" | Select-String "cloudflared" | Select-Object -First 1
if ($tunnelContainer) {
    Write-Host "✅ Tunnel container found: $tunnelContainer" -ForegroundColor Green
    Write-Host "`nLast 80 lines of tunnel logs:" -ForegroundColor Gray
    docker logs $tunnelContainer --tail=80 | Select-String -Pattern "Connection established|assistant\.ledger-mind\.org|error|ERR"

    $established = docker logs $tunnelContainer --tail=80 | Select-String "Connection established"
    if ($established) {
        Write-Host "`n✅ Tunnel shows 'Connection established'" -ForegroundColor Green
    } else {
        Write-Host "`n❌ No 'Connection established' found in recent logs" -ForegroundColor Red
        $Failures++
    }
} else {
    Write-Host "❌ No cloudflared container running" -ForegroundColor Red
    $Failures++
}
Write-Host ""

# Step 2: Is nginx healthy?
Write-Host "═══ STEP 2: Is nginx healthy? ═══`n" -ForegroundColor Cyan
$nginxContainer = docker ps --format "{{.Names}}" | Select-String -Pattern "nginx|proxy" | Select-Object -First 1
if ($nginxContainer) {
    Write-Host "✅ Nginx container found: $nginxContainer" -ForegroundColor Green
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | Select-String -Pattern "nginx|proxy"
    Write-Host "`nLast 100 lines of nginx logs:" -ForegroundColor Gray
    docker logs $nginxContainer --tail=100 | Select-Object -Last 20

    $status = docker ps --filter name=$nginxContainer --format "{{.Status}}"
    if ($status -match "healthy") {
        Write-Host "`n✅ Nginx is healthy" -ForegroundColor Green
    } else {
        Write-Host "`n⚠️  Nginx status: $status" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ No nginx/proxy container running" -ForegroundColor Red
    $Failures++
}
Write-Host ""

# Step 3: Is the portfolio container running & healthy?
Write-Host "═══ STEP 3: Is the portfolio container running & healthy? ═══`n" -ForegroundColor Cyan
$portfolioContainer = docker ps --format "{{.Names}}" | Select-String "portfolio" | Select-Object -First 1
if ($portfolioContainer) {
    Write-Host "✅ Portfolio container found: $portfolioContainer" -ForegroundColor Green
    docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | Select-String "portfolio"

    $health = docker inspect $portfolioContainer --format='{{.State.Health.Status}}' 2>$null
    if (!$health) { $health = "no-healthcheck" }
    if ($health -eq "healthy") {
        Write-Host "`n✅ Portfolio health: $health" -ForegroundColor Green
    } else {
        Write-Host "`n⚠️  Portfolio health: $health" -ForegroundColor Yellow
    }

    Write-Host "`nLast 100 lines of portfolio logs:" -ForegroundColor Gray
    docker logs --tail=100 $portfolioContainer | Select-Object -Last 20
} else {
    Write-Host "❌ No portfolio container running" -ForegroundColor Red
    $Failures++
}
Write-Host ""

# Step 4: Can nginx reach the upstream (portfolio.int:80)?
Write-Host "═══ STEP 4: Can nginx reach the upstream (portfolio.int:80)? ═══`n" -ForegroundColor Cyan
if ($nginxContainer -and $portfolioContainer) {
    Write-Host "Testing: docker exec $nginxContainer curl -sI http://portfolio.int:80/" -ForegroundColor Gray
    try {
        $response = docker exec $nginxContainer curl -sI http://portfolio.int:80/ 2>&1 | Select-Object -First 1
        Write-Host "Response: $response" -ForegroundColor Gray

        if ($response -match "200 OK") {
            Write-Host "`n✅ Nginx can reach portfolio.int:80 (HTTP 200 OK)" -ForegroundColor Green
        } else {
            Write-Host "`n❌ Nginx cannot reach portfolio.int:80" -ForegroundColor Red
            Write-Host "   This means nginx can't resolve or connect to the portfolio container" -ForegroundColor Yellow
            Write-Host "   Fix: Ensure both containers are on the same Docker network (e.g., infra_net)" -ForegroundColor Yellow
            $Failures++
        }
    } catch {
        Write-Host "`n❌ Error testing upstream: $_" -ForegroundColor Red
        $Failures++
    }
} else {
    Write-Host "⚠️  Skipping (nginx or portfolio not running)" -ForegroundColor Yellow
}
Write-Host ""

# Step 5: Can the host reach the container's exposed port?
Write-Host "═══ STEP 5: Can the host reach the container's exposed port? ═══`n" -ForegroundColor Cyan
$portfolioPorts = docker ps --format "{{.Names}}\t{{.Ports}}" | Select-String "portfolio"
if ($portfolioPorts -match "0\.0\.0\.0:(\d+)") {
    $port = $Matches[1]
    Write-Host "Portfolio exposed on host port: $port" -ForegroundColor Gray
    try {
        $response = curl.exe -sI "http://127.0.0.1:$port/" 2>&1 | Select-Object -First 1
        Write-Host "Response: $response" -ForegroundColor Gray

        if ($response -match "200") {
            Write-Host "`n✅ Host can reach portfolio on port $port" -ForegroundColor Green
        } else {
            Write-Host "`n❌ Host cannot reach portfolio on port $port" -ForegroundColor Red
            $Failures++
        }
    } catch {
        Write-Host "`n❌ Error testing host port: $_" -ForegroundColor Red
        $Failures++
    }
} else {
    Write-Host "⚠️  Portfolio not exposing any host ports (may be using Docker network only)" -ForegroundColor Yellow
}
Write-Host ""

# Step 6: Confirm the correct image is running
Write-Host "═══ STEP 6: Confirm the correct image is running ═══`n" -ForegroundColor Cyan
if ($portfolioContainer) {
    $image = docker inspect $portfolioContainer --format='{{.Config.Image}}'
    $imageId = docker inspect $portfolioContainer --format='{{.Image}}'
    Write-Host "Image: $image" -ForegroundColor Gray
    Write-Host "Image ID: $imageId" -ForegroundColor Gray

    if ($image -match "ghcr.io/leok974/leo-portfolio/portfolio:latest") {
        Write-Host "`n✅ Running expected image: ghcr.io/leok974/leo-portfolio/portfolio:latest" -ForegroundColor Green
    } else {
        Write-Host "`n⚠️  Not running expected image" -ForegroundColor Yellow
        Write-Host "   Expected: ghcr.io/leok974/leo-portfolio/portfolio:latest" -ForegroundColor Yellow
        Write-Host "   Actual: $image" -ForegroundColor Yellow
    }

    Write-Host "`nExpected digest: sha256:6725055..." -ForegroundColor Gray
}
Write-Host ""

# Step 7: Check Docker network configuration
Write-Host "═══ STEP 7: Check Docker network configuration ═══`n" -ForegroundColor Cyan
if ($portfolioContainer) {
    $portfolioNetwork = docker inspect $portfolioContainer --format='{{range $net, $config := .NetworkSettings.Networks}}{{$net}} {{end}}'
    Write-Host "Portfolio networks: $portfolioNetwork" -ForegroundColor Gray
}
if ($nginxContainer) {
    $nginxNetwork = docker inspect $nginxContainer --format='{{range $net, $config := .NetworkSettings.Networks}}{{$net}} {{end}}'
    Write-Host "Nginx networks: $nginxNetwork" -ForegroundColor Gray
}

if ($portfolioNetwork -and $nginxNetwork) {
    $shared = $false
    foreach ($net in $portfolioNetwork.Split()) {
        if ($nginxNetwork -match $net) {
            Write-Host "`n✅ Both containers share network: $net" -ForegroundColor Green
            $shared = $true
        }
    }
    if (!$shared) {
        Write-Host "`n❌ Containers are NOT on the same network!" -ForegroundColor Red
        Write-Host "   This will cause 502 errors" -ForegroundColor Yellow
        Write-Host "   Fix: Add both to the same network (e.g., infra_net)" -ForegroundColor Yellow
        $Failures++
    }
}
Write-Host ""

# Summary
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
if ($Failures -eq 0) {
    Write-Host "  ✅ ALL CHECKS PASSED!" -ForegroundColor Green
} else {
    Write-Host "  ❌ $Failures CHECKS FAILED" -ForegroundColor Red
}
Write-Host "════════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

# Quick fix commands
Write-Host "📋 QUICK FIX COMMANDS:`n" -ForegroundColor Cyan
Write-Host "If portfolio container is outdated:" -ForegroundColor Yellow
Write-Host "  docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest" -ForegroundColor White
Write-Host "  docker stop portfolio-ui; docker rm portfolio-ui" -ForegroundColor White
Write-Host "  docker run -d --name portfolio-ui --restart unless-stopped ``" -ForegroundColor White
Write-Host "    --network infra_net -p 8089:80 ``" -ForegroundColor White
Write-Host "    ghcr.io/leok974/leo-portfolio/portfolio:latest`n" -ForegroundColor White

Write-Host "If both containers need restart:" -ForegroundColor Yellow
Write-Host "  docker restart portfolio-ui" -ForegroundColor White
Write-Host "  docker restart $nginxContainer`n" -ForegroundColor White

Write-Host "If network issue:" -ForegroundColor Yellow
Write-Host "  docker network connect infra_net portfolio-ui" -ForegroundColor White
Write-Host "  docker restart portfolio-ui`n" -ForegroundColor White

Write-Host "Check Watchtower logs:" -ForegroundColor Yellow
Write-Host "  docker logs watchtower --tail=100`n" -ForegroundColor White

exit $Failures
