# Start Backend with CF Access Configuration
# This script loads .env and starts the uvicorn server

Write-Host "=== Starting Backend with CF Access ===" -ForegroundColor Cyan
Write-Host ""

# Load .env file
if (Test-Path ".env") {
    Write-Host "Loading environment from .env..." -ForegroundColor Yellow
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.+)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
            Write-Host "  ✓ Set $name" -ForegroundColor Green
        }
    }
    Write-Host ""
} else {
    Write-Host "⚠ .env file not found, using system environment variables" -ForegroundColor Yellow
    Write-Host ""
}

# Verify configuration
Write-Host "Configuration:" -ForegroundColor Cyan
$teamDomain = [Environment]::GetEnvironmentVariable("CF_ACCESS_TEAM_DOMAIN", "Process")
$aud = [Environment]::GetEnvironmentVariable("CF_ACCESS_AUD", "Process")
$emails = [Environment]::GetEnvironmentVariable("ACCESS_ALLOWED_EMAILS", "Process")

if ($teamDomain) {
    Write-Host "  ✓ CF_ACCESS_TEAM_DOMAIN: $teamDomain" -ForegroundColor Green
} else {
    Write-Host "  ✗ CF_ACCESS_TEAM_DOMAIN not set!" -ForegroundColor Red
}

if ($aud) {
    Write-Host "  ✓ CF_ACCESS_AUD: $($aud.Substring(0,16))..." -ForegroundColor Green
} else {
    Write-Host "  ✗ CF_ACCESS_AUD not set!" -ForegroundColor Red
}

if ($emails) {
    Write-Host "  ✓ ACCESS_ALLOWED_EMAILS: $emails" -ForegroundColor Green
} else {
    Write-Host "  ℹ ACCESS_ALLOWED_EMAILS not set (optional)" -ForegroundColor Gray
}
Write-Host ""

# Check if port 8001 is in use
$port = 8001
$tcpConnection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($tcpConnection) {
    Write-Host "⚠ Port $port is already in use" -ForegroundColor Yellow
    Write-Host "  Kill existing process? (Y/N)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -eq 'Y' -or $response -eq 'y') {
        $processId = $tcpConnection[0].OwningProcess
        Stop-Process -Id $processId -Force
        Write-Host "  ✓ Killed process $processId" -ForegroundColor Green
        Start-Sleep -Seconds 2
    } else {
        Write-Host "  Using different port 8002" -ForegroundColor Yellow
        $port = 8002
    }
    Write-Host ""
}

# Start uvicorn
Write-Host "Starting uvicorn on port $port..." -ForegroundColor Yellow
Write-Host "  URL: http://127.0.0.1:$port" -ForegroundColor Gray
Write-Host "  Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

try {
    python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port $port --reload
} catch {
    Write-Host ""
    Write-Host "✗ Failed to start backend: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Check Python is installed: python --version" -ForegroundColor Gray
    Write-Host "  2. Install dependencies: cd assistant_api; pip install -r requirements.txt" -ForegroundColor Gray
    Write-Host "  3. Check cf_access module: python -c 'from assistant_api.utils.cf_access import require_cf_access'" -ForegroundColor Gray
    exit 1
}
