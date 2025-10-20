# Smoke Tests for Agent Refresh
# Run after deploying the Cloudflare Worker

param(
    [Parameter(Mandatory=$true)]
    [string]$WorkerUrl,

    [Parameter(Mandatory=$true)]
    [string]$AllowKey
)

Write-Host "🧪 Agent Refresh Smoke Tests" -ForegroundColor Cyan
Write-Host "Worker URL: $WorkerUrl" -ForegroundColor Gray
Write-Host ""

# Test 1: Status Endpoint
Write-Host "Test 1: GET /agent/refresh/status" -ForegroundColor Yellow
try {
    $statusUrl = "$($WorkerUrl.TrimEnd('/'))/agent/refresh/status"
    $response = curl -sS -H "x-agent-key: $AllowKey" $statusUrl | ConvertFrom-Json

    Write-Host "✅ Status endpoint responded" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Gray
    $response | Format-List
    Write-Host ""
} catch {
    Write-Host "❌ Status endpoint failed: $_" -ForegroundColor Red
    Write-Host ""
}

# Test 2: Dispatch (with user confirmation)
Write-Host "Test 2: POST dispatch (triggers GitHub Actions)" -ForegroundColor Yellow
$confirm = Read-Host "This will trigger a real GitHub Actions run. Continue? (y/n)"
if ($confirm -eq 'y') {
    try {
        $body = @{
            reason = "manual-test"
            ref = "main"
        } | ConvertTo-Json

        $response = curl -X POST -H "content-type: application/json" -H "x-agent-key: $AllowKey" -d $body $WorkerUrl | ConvertFrom-Json

        Write-Host "✅ Dispatch succeeded" -ForegroundColor Green
        Write-Host "Response:" -ForegroundColor Gray
        $response | Format-List
        Write-Host ""

        # Wait a moment then check GitHub Actions
        Write-Host "Waiting 3 seconds for GitHub to process..." -ForegroundColor Gray
        Start-Sleep -Seconds 3

        Write-Host "Recent workflow runs:" -ForegroundColor Yellow
        gh run list --workflow=refresh-content.yml --limit 3
        Write-Host ""

        Write-Host "💡 Tip: Use 'gh run view <ID> --log' to see run details" -ForegroundColor Cyan

    } catch {
        Write-Host "❌ Dispatch failed: $_" -ForegroundColor Red
        Write-Host ""
    }
} else {
    Write-Host "⏭️  Skipped dispatch test" -ForegroundColor Gray
    Write-Host ""
}

# Test 3: Rate limiting (optional)
Write-Host "Test 3: Rate limiting check (optional)" -ForegroundColor Yellow
$testRateLimit = Read-Host "Send 7 rapid requests to test rate limit? (y/n)"
if ($testRateLimit -eq 'y') {
    Write-Host "Sending 7 requests rapidly..." -ForegroundColor Gray
    $successes = 0
    $rateLimited = 0

    for ($i = 1; $i -le 7; $i++) {
        try {
            $statusUrl = "$($WorkerUrl.TrimEnd('/'))/agent/refresh/status"
            $response = curl -sS -H "x-agent-key: $AllowKey" $statusUrl -w "%{http_code}" 2>&1
            if ($response -match "200") {
                $successes++
            } elseif ($response -match "429") {
                $rateLimited++
            }
        } catch {
            # Likely rate limited
            $rateLimited++
        }
        Start-Sleep -Milliseconds 100
    }

    Write-Host "Results: $successes succeeded, $rateLimited rate-limited" -ForegroundColor Gray
    if ($rateLimited -gt 0) {
        Write-Host "✅ Rate limiting is active" -ForegroundColor Green
    } else {
        Write-Host "⚠️  No rate limiting detected (may need more requests)" -ForegroundColor Yellow
    }
    Write-Host ""
}

Write-Host "✅ Smoke tests complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  - Run Playwright E2E: npx playwright test tests/e2e/agent.refresh.status.spec.ts" -ForegroundColor White
Write-Host "  - Add frontend .env.local with VITE_AGENT_REFRESH_URL and VITE_AGENT_ALLOW_KEY" -ForegroundColor White
Write-Host ""
