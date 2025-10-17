# Portfolio Deployment - Step-by-Step Execution
# Run these commands in order, replacing placeholders with your values

param(
    [Parameter(Mandatory=$false)]
    [string]$ServerHost,

    [Parameter(Mandatory=$false)]
    [string]$ServerUser,

    [Parameter(Mandatory=$false)]
    [string]$NginxContainer
)

Write-Host "`n════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🚀 PORTFOLIO DEPLOYMENT HELPER" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

# Check if we have required info
$needsInput = $false
if (-not $ServerHost) {
    $ServerHost = Read-Host "Enter server hostname or IP"
    $needsInput = $true
}
if (-not $ServerUser) {
    $ServerUser = Read-Host "Enter SSH username"
    $needsInput = $true
}

$serverString = "${ServerUser}@${ServerHost}"

Write-Host "Target server: $serverString`n" -ForegroundColor Green

# Get nginx container name from server
if (-not $NginxContainer) {
    Write-Host "Finding nginx container name on server..." -ForegroundColor Yellow
    Write-Host "Running: ssh $serverString 'docker ps | grep nginx'`n" -ForegroundColor Gray

    $nginxInfo = ssh $serverString 'docker ps | grep nginx' 2>&1
    if ($LASTEXITCODE -eq 0 -and $nginxInfo) {
        Write-Host "Nginx containers found:" -ForegroundColor Green
        Write-Host $nginxInfo -ForegroundColor White

        # Try to extract first container name
        $NginxContainer = ($nginxInfo -split '\s+')[0]
        Write-Host "`nUsing nginx container: $NginxContainer" -ForegroundColor Green
        $confirm = Read-Host "Is this correct? (y/n)"
        if ($confirm -ne 'y') {
            $NginxContainer = Read-Host "Enter nginx container name"
        }
    } else {
        Write-Host "Could not detect nginx container automatically." -ForegroundColor Yellow
        $NginxContainer = Read-Host "Enter nginx container name manually"
    }
}

Write-Host "`n════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  📋 DEPLOYMENT CONFIGURATION" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan
Write-Host "Server:          $serverString" -ForegroundColor White
Write-Host "Nginx Container: $NginxContainer" -ForegroundColor White
Write-Host ""

$proceed = Read-Host "Proceed with deployment? (y/n)"
if ($proceed -ne 'y') {
    Write-Host "`nDeployment cancelled." -ForegroundColor Yellow
    exit 0
}

# STEP 1: Copy and run diagnostics
Write-Host "`n════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  STEP 1: Run Diagnostics" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

Write-Host "Copying diagnostics script to server..." -ForegroundColor Yellow
$scpCmd = "scp deploy/diagnose-server.sh ${serverString}:/tmp/"
Write-Host "Command: $scpCmd" -ForegroundColor Gray
Invoke-Expression $scpCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Diagnostics script copied successfully`n" -ForegroundColor Green

    Write-Host "Running diagnostics on server..." -ForegroundColor Yellow
    $diagCmd = "ssh $serverString 'chmod +x /tmp/diagnose-server.sh && bash /tmp/diagnose-server.sh'"
    Write-Host "Command: $diagCmd`n" -ForegroundColor Gray

    Invoke-Expression $diagCmd
    $diagExitCode = $LASTEXITCODE

    if ($diagExitCode -eq 0) {
        Write-Host "`n✅ All diagnostics passed!" -ForegroundColor Green
    } else {
        Write-Host "`n⚠️  Some diagnostics failed (exit code: $diagExitCode)" -ForegroundColor Yellow
        Write-Host "This is expected if portfolio container doesn't exist yet." -ForegroundColor Gray
        $continue = Read-Host "Continue with deployment? (y/n)"
        if ($continue -ne 'y') {
            Write-Host "`nDeployment stopped. Fix issues and try again." -ForegroundColor Yellow
            exit 1
        }
    }
} else {
    Write-Host "❌ Failed to copy diagnostics script" -ForegroundColor Red
    exit 1
}

# STEP 2: Deploy portfolio container
Write-Host "`n════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  STEP 2: Deploy Portfolio Container" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

$deployScript = @"
set -e
echo '=== Pulling latest image ==='
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest

echo -e '\n=== Stopping old container ==='
docker stop portfolio-ui 2>/dev/null || echo 'No existing container'
docker rm portfolio-ui 2>/dev/null || echo 'No container to remove'

echo -e '\n=== Starting new container ==='
docker run -d --name portfolio-ui --restart unless-stopped \
  --network infra_net \
  --network-alias portfolio.int \
  -p 8089:80 \
  ghcr.io/leok974/leo-portfolio/portfolio:latest

echo -e '\n=== Verifying container ==='
docker ps | grep portfolio-ui
docker logs portfolio-ui --tail=10
"@

Write-Host "Deploying portfolio container..." -ForegroundColor Yellow
$deployCmd = "ssh $serverString '$deployScript'"
Write-Host "Command: Executing deployment script`n" -ForegroundColor Gray

Invoke-Expression $deployCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Portfolio container deployed successfully`n" -ForegroundColor Green
} else {
    Write-Host "`n❌ Failed to deploy portfolio container" -ForegroundColor Red
    exit 1
}

# STEP 3: Verify nginx connectivity
Write-Host "`n════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  STEP 3: Verify Nginx → Portfolio" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

Write-Host "Restarting nginx..." -ForegroundColor Yellow
$restartCmd = "ssh $serverString 'docker restart $NginxContainer'"
Invoke-Expression $restartCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Nginx restarted`n" -ForegroundColor Green

    Start-Sleep -Seconds 3

    Write-Host "Testing connectivity from nginx to portfolio..." -ForegroundColor Yellow
    $testScript = @"
echo '[resolve]'
getent hosts portfolio.int
echo '[probe]'
curl -sI http://portfolio.int/ | head -n1
"@

    $testCmd = "ssh $serverString 'docker exec $NginxContainer sh -lc `"$testScript`"'"
    Write-Host "Command: docker exec $NginxContainer sh -lc '...test script...'`n" -ForegroundColor Gray

    Invoke-Expression $testCmd

    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Nginx can reach portfolio!" -ForegroundColor Green
    } else {
        Write-Host "`n⚠️  Nginx connectivity test had issues" -ForegroundColor Yellow
        Write-Host "You may need to connect containers to same network:" -ForegroundColor Gray
        Write-Host "  docker network connect infra_net $NginxContainer" -ForegroundColor Gray
    }
} else {
    Write-Host "❌ Failed to restart nginx" -ForegroundColor Red
}

# STEP 4: Test public URL
Write-Host "`n════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  STEP 4: Test Public URL" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

Write-Host "Testing https://assistant.ledger-mind.org..." -ForegroundColor Yellow
$curlCmd = "curl.exe -I https://assistant.ledger-mind.org 2>&1 | Select-Object -First 5"
Invoke-Expression $curlCmd

Write-Host "`n════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ✅ DEPLOYMENT COMPLETE" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

Write-Host "🎯 NEXT STEPS:`n" -ForegroundColor Yellow
Write-Host "1. Open https://assistant.ledger-mind.org in your browser" -ForegroundColor White
Write-Host "2. Check browser console (F12) for any errors" -ForegroundColor White
Write-Host "3. Verify all assets load correctly" -ForegroundColor White
Write-Host "4. Test Calendly widget" -ForegroundColor White
Write-Host "`n5. (Optional) Enable Watchtower for auto-updates:" -ForegroundColor White
Write-Host "   ssh $serverString" -ForegroundColor Gray
Write-Host "   docker run -d --name watchtower --restart unless-stopped \" -ForegroundColor Gray
Write-Host "     -v /var/run/docker.sock:/var/run/docker.sock \" -ForegroundColor Gray
Write-Host "     containrrr/watchtower --interval 300 --cleanup portfolio-ui" -ForegroundColor Gray
Write-Host "`n════════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

Write-Host "📚 For troubleshooting, see:" -ForegroundColor Cyan
Write-Host "   • COMMAND_SHEET.md" -ForegroundColor White
Write-Host "   • EXECUTE_DEPLOYMENT.md" -ForegroundColor White
Write-Host "   • deploy/DIAGNOSTICS_QUICKREF.md`n" -ForegroundColor White
