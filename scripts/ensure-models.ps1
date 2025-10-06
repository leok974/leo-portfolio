# Ensure Required Ollama Models Script
# Pulls models listed in models.portfolio.txt if not already present

param(
    [string]$OllamaContainer = "infra-ollama-1",
    [string]$ModelsFile = "models.portfolio.txt"
)

Write-Host "`n🤖 Ensuring Ollama models are available`n" -ForegroundColor Cyan

$env:DOCKER_CONTEXT = "desktop-linux"

# Check if container exists
$containerExists = docker ps -q -f name=$OllamaContainer
if (-not $containerExists) {
    Write-Host "❌ Ollama container '$OllamaContainer' not found" -ForegroundColor Red
    Write-Host "   Start the infra stack first: cd D:\infra; docker compose up -d`n" -ForegroundColor Yellow
    exit 1
}

# Check if models file exists
$modelsPath = Join-Path $PSScriptRoot ".." $ModelsFile
if (-not (Test-Path $modelsPath)) {
    Write-Host "⚠️  Models file not found: $modelsPath" -ForegroundColor Yellow
    Write-Host "   Creating default models.portfolio.txt`n" -ForegroundColor Gray

    @"
# Portfolio-specific Ollama models
# One model per line, format: model:tag
gpt-oss:20b
nomic-embed-text:latest
"@ | Out-File -FilePath $modelsPath -Encoding UTF8
}

# Read models list
$models = Get-Content $modelsPath | Where-Object { $_ -match '^\s*[^#]' -and $_.Trim() }

if ($models.Count -eq 0) {
    Write-Host "✅ No models specified in $ModelsFile`n" -ForegroundColor Green
    exit 0
}

Write-Host "📋 Models to ensure:" -ForegroundColor Yellow
$models | ForEach-Object { Write-Host "   - $_" -ForegroundColor Gray }
Write-Host ""

# Get currently installed models
$installedOutput = docker exec $OllamaContainer ollama list 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to list models from $OllamaContainer" -ForegroundColor Red
    exit 1
}

$installed = @()
if ($installedOutput) {
    # Parse output (skip header line, extract first column)
    $installed = ($installedOutput -split "`n" | Select-Object -Skip 1 | ForEach-Object {
        if ($_ -match '^(\S+)') { $matches[1] }
    }) | Where-Object { $_ }
}

# Pull missing models
$pulled = 0
$skipped = 0

foreach ($model in $models) {
    $modelName = $model.Trim()

    # Check if already installed (handle tag variations)
    $isInstalled = $installed | Where-Object { $_ -like "*$($modelName.Split(':')[0])*" }

    if ($isInstalled) {
        Write-Host "✅ $modelName" -NoNewline -ForegroundColor Green
        Write-Host " (already installed)" -ForegroundColor Gray
        $skipped++
    } else {
        Write-Host "📥 Pulling $modelName..." -ForegroundColor Yellow
        docker exec $OllamaContainer ollama pull $modelName

        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ $modelName pulled successfully" -ForegroundColor Green
            $pulled++
        } else {
            Write-Host "❌ Failed to pull $modelName" -ForegroundColor Red
        }
    }
}

Write-Host "`n📊 Summary:" -ForegroundColor Cyan
Write-Host "   Pulled: $pulled" -ForegroundColor $(if ($pulled -gt 0) { "Green" } else { "Gray" })
Write-Host "   Skipped: $skipped" -ForegroundColor Gray
Write-Host "   Total: $($models.Count)`n" -ForegroundColor Gray

# Show final list
Write-Host "📦 Current models in $OllamaContainer :" -ForegroundColor Cyan
docker exec $OllamaContainer ollama list
