# save-ledgermind-logo.ps1
# Helper script to save LedgerMind logo from chat attachment

Write-Host "=== LedgerMind Logo Setup ===" -ForegroundColor Cyan
Write-Host ""

$targetPath = "d:\leo-portfolio\apps\portfolio-ui\public\assets\ledgermind-logo.png"
$targetDir = Split-Path $targetPath -Parent

# Ensure directory exists
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    Write-Host "Created directory: $targetDir" -ForegroundColor Green
}

Write-Host "Instructions:" -ForegroundColor Yellow
Write-Host "1. Find the LedgerMind logo image in the chat (brain with arrows)"
Write-Host "2. Right-click and 'Save Image As...'"
Write-Host "3. Save to: $targetPath"
Write-Host ""

# Check if file already exists
if (Test-Path $targetPath) {
    $file = Get-Item $targetPath
    Write-Host "✅ Logo already exists!" -ForegroundColor Green
    Write-Host "   Location: $targetPath"
    Write-Host "   Size: $($file.Length) bytes"
    Write-Host "   Modified: $($file.LastWriteTime)"
    Write-Host ""

    $continue = Read-Host "Replace with new logo? (y/N)"
    if ($continue -ne 'y') {
        Write-Host "Keeping existing logo" -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""
Write-Host "Waiting for logo file..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to cancel"
Write-Host ""

# Wait for file to appear
while (-not (Test-Path $targetPath)) {
    Start-Sleep -Seconds 1
}

Write-Host "✅ Logo detected!" -ForegroundColor Green
$file = Get-Item $targetPath
Write-Host "   Size: $($file.Length) bytes"
Write-Host "   Type: PNG image"
Write-Host ""

# Verify it's a valid PNG
$bytes = [System.IO.File]::ReadAllBytes($targetPath)
if ($bytes.Length -gt 8 -and
    $bytes[0] -eq 0x89 -and
    $bytes[1] -eq 0x50 -and
    $bytes[2] -eq 0x4E -and
    $bytes[3] -eq 0x47) {
    Write-Host "✅ Valid PNG file" -ForegroundColor Green
} else {
    Write-Host "⚠️  Warning: File may not be a valid PNG" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Update projects.json to reference 'assets/ledgermind-logo.png'"
Write-Host "2. Run: pnpm build:portfolio"
Write-Host "3. Test: npx serve apps/portfolio-ui/dist-portfolio"
Write-Host ""

# Optionally update projects.json automatically
$updateJson = Read-Host "Update projects.json automatically? (y/N)"
if ($updateJson -eq 'y') {
    $jsonPath = "d:\leo-portfolio\apps\portfolio-ui\public\projects.json"
    $json = Get-Content $jsonPath -Raw | ConvertFrom-Json
    $json.ledgermind.thumbnail = "assets/ledgermind-logo.png"
    $json | ConvertTo-Json -Depth 10 | Set-Content $jsonPath
    Write-Host "✅ Updated projects.json" -ForegroundColor Green
}

Write-Host ""
Write-Host "All done! 🎉" -ForegroundColor Green
