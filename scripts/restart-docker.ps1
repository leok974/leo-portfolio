function Restart-DockerDesktop {
  Write-Host "Stopping Docker Desktop (com.docker.service)..." -ForegroundColor Yellow
  Stop-Service com.docker.service -ErrorAction SilentlyContinue
  Write-Host "Shutting down WSL..." -ForegroundColor Yellow
  wsl --shutdown
  Start-Sleep -Seconds 2
  Write-Host "Starting Docker Desktop..." -ForegroundColor Yellow
  Start-Service com.docker.service
  Write-Host "Docker Desktop restarted" -ForegroundColor Green
}

Export-ModuleMember -Function Restart-DockerDesktop 2>$null
