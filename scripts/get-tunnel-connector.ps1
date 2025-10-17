# Get Cloudflare Tunnel Connector Metadata
# This script queries Cloudflare API to find the server hostname

param(
    [string]$AccountId = $env:CF_ACCOUNT_ID,
    [string]$ApiToken = $env:CF_API_TOKEN,
    [string]$TunnelId = "db56892d-4879-4263-99bf-202d46b6aff9"
)

if (-not $AccountId) {
    Write-Host "❌ CF_ACCOUNT_ID not set" -ForegroundColor Red
    Write-Host ""
    Write-Host "To find your Account ID:" -ForegroundColor Yellow
    Write-Host "1. Go to https://dash.cloudflare.com" -ForegroundColor Cyan
    Write-Host "2. Click on any domain" -ForegroundColor Cyan
    Write-Host "3. Scroll down on Overview page - Account ID is on the right sidebar" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Then set it:" -ForegroundColor Yellow
    Write-Host "  `$env:CF_ACCOUNT_ID = 'your-account-id-here'" -ForegroundColor Green
    Write-Host ""
    exit 1
}

if (-not $ApiToken) {
    Write-Host "❌ CF_API_TOKEN not set" -ForegroundColor Red
    Write-Host ""
    Write-Host "To create an API token:" -ForegroundColor Yellow
    Write-Host "1. Go to https://dash.cloudflare.com/profile/api-tokens" -ForegroundColor Cyan
    Write-Host "2. Click 'Create Token'" -ForegroundColor Cyan
    Write-Host "3. Use 'Edit Cloudflare Zero Trust' template OR custom token with:" -ForegroundColor Cyan
    Write-Host "   - Permissions: Account > Cloudflare Tunnel > Read" -ForegroundColor Cyan
    Write-Host "4. Copy the token" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Then set it:" -ForegroundColor Yellow
    Write-Host "  `$env:CF_API_TOKEN = 'your-api-token-here'" -ForegroundColor Green
    Write-Host ""
    exit 1
}

Write-Host "🔍 Querying Cloudflare for tunnel connectors..." -ForegroundColor Cyan
Write-Host "   Account ID: $AccountId" -ForegroundColor Gray
Write-Host "   Tunnel ID: $TunnelId" -ForegroundColor Gray
Write-Host ""

try {
    $headers = @{
        "Authorization" = "Bearer $ApiToken"
        "Content-Type" = "application/json"
    }

    $uri = "https://api.cloudflare.com/client/v4/accounts/$AccountId/cfd_tunnel/$TunnelId/connectors"

    $response = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get

    if ($response.success) {
        Write-Host "✅ Success! Found connectors:" -ForegroundColor Green
        Write-Host ""

        $response.result | ForEach-Object {
            Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
            Write-Host "Connector ID:  " -NoNewline -ForegroundColor Yellow
            Write-Host $_.id -ForegroundColor White

            Write-Host "Name:          " -NoNewline -ForegroundColor Yellow
            Write-Host $_.name -ForegroundColor Cyan -BackgroundColor Black

            Write-Host "Status:        " -NoNewline -ForegroundColor Yellow
            if ($_.status -eq "connected") {
                Write-Host $_.status -ForegroundColor Green
            } else {
                Write-Host $_.status -ForegroundColor Red
            }

            Write-Host "Platform:      " -NoNewline -ForegroundColor Yellow
            Write-Host $_.arch -ForegroundColor White

            Write-Host "Version:       " -NoNewline -ForegroundColor Yellow
            Write-Host $_.version -ForegroundColor White

            Write-Host "Connected At:  " -NoNewline -ForegroundColor Yellow
            Write-Host $_.conns.connected_at -ForegroundColor White

            Write-Host ""
        }

        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
        Write-Host ""
        Write-Host "📝 The 'Name' field above is your server hostname!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Use it to SSH:" -ForegroundColor Yellow

        $firstConnector = $response.result | Select-Object -First 1
        if ($firstConnector) {
            Write-Host "  ssh root@$($firstConnector.name)" -ForegroundColor Cyan -BackgroundColor Black
        }

    } else {
        Write-Host "❌ API request failed:" -ForegroundColor Red
        Write-Host ($response | ConvertTo-Json -Depth 5) -ForegroundColor Red
    }

} catch {
    Write-Host "❌ Error querying Cloudflare API:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Check your API token has 'Account > Cloudflare Tunnel > Read' permission" -ForegroundColor Cyan
    Write-Host "2. Verify the Account ID is correct" -ForegroundColor Cyan
    Write-Host "3. Ensure the tunnel ID exists: $TunnelId" -ForegroundColor Cyan
}
