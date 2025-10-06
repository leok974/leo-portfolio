# Safe Docker Compose Down Script
# Explicitly uses -p portfolio to avoid affecting other projects

Write-Host "`n🛑 Safely stopping portfolio services`n" -ForegroundColor Yellow

$env:DOCKER_CONTEXT = "desktop-linux"
Set-Location D:\leo-portfolio\deploy

Write-Host "Running: docker compose -p portfolio down --remove-orphans`n" -ForegroundColor Gray

docker compose -p portfolio down --remove-orphans

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Portfolio services stopped successfully" -ForegroundColor Green
    Write-Host "   Only portfolio-* containers were affected" -ForegroundColor Gray
    Write-Host "   Shared infrastructure (infra-*) remains running`n" -ForegroundColor Gray
} else {
    Write-Host "`n❌ Error stopping services (exit code: $LASTEXITCODE)`n" -ForegroundColor Red
}
