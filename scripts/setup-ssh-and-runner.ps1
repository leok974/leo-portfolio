#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Set up SSH via Cloudflare Access and install GitHub Actions runner
.DESCRIPTION
    Automates the complete setup process:
    1. Configure tunnel ingress for SSH
    2. Route DNS to tunnel
    3. Create Cloudflare Access SSH application
    4. Configure local SSH client
    5. Install GitHub runner on server
.NOTES
    Required environment variables:
    - CF_API_TOKEN, CF_ACCOUNT_ID, CF_ZONE_ID, TUNNEL_ID
    - SSH_HOSTNAME, ALLOW_EMAIL, SERVER_USER
    - GH_REPO, GH_RUNNER_NAME, GH_RUNNER_LABELS, GH_RUNNER_TOKEN
#>

param(
    [switch]$SkipAccessApp,  # Skip Access app creation if token lacks scopes
    [switch]$SkipRunner      # Skip runner installation (just set up SSH)
)

$ErrorActionPreference = "Stop"

# Load from .env files if not in environment
function Load-EnvFile {
    param([string]$FilePath)
    if (Test-Path $FilePath) {
        Get-Content $FilePath | ForEach-Object {
            if ($_ -match '^([^#][^=]+)=(.+)$') {
                $name = $matches[1].Trim()
                $value = $matches[2].Trim()
                if (-not [Environment]::GetEnvironmentVariable($name, "Process")) {
                    [Environment]::SetEnvironmentVariable($name, $value, "Process")
                }
            }
        }
    }
}

Load-EnvFile ".env.cloudflare"
Load-EnvFile "cloudflared/.env.tunnel"

# Get required variables
$CF_API_TOKEN = $env:CF_API_TOKEN ?? $env:CLOUDFLARE_API_TOKEN
$CF_ACCOUNT_ID = $env:CF_ACCOUNT_ID
$CF_ZONE_ID = $env:CF_ZONE_ID
$TUNNEL_ID = $env:TUNNEL_ID ?? $env:CLOUDFLARE_TUNNEL_UUID
$SSH_HOSTNAME = $env:SSH_HOSTNAME ?? "ssh.leoklemet.com"
$ALLOW_EMAIL = $env:ALLOW_EMAIL ?? "leoklemet.pa@gmail.com"
$SERVER_USER = $env:SERVER_USER ?? "ubuntu"
$GH_REPO = $env:GH_REPO ?? "leok974/leo-portfolio"
$GH_RUNNER_NAME = $env:GH_RUNNER_NAME ?? "prod-runner-1"
$GH_RUNNER_LABELS = $env:GH_RUNNER_LABELS ?? "self-hosted,prod,deploy"
$GH_RUNNER_TOKEN = $env:GH_RUNNER_TOKEN

# Validate required variables
$required = @{
    CF_API_TOKEN = $CF_API_TOKEN
    CF_ZONE_ID = $CF_ZONE_ID
    TUNNEL_ID = $TUNNEL_ID
    SSH_HOSTNAME = $SSH_HOSTNAME
}

foreach ($key in $required.Keys) {
    if (-not $required[$key]) {
        Write-Error "❌ Missing required variable: $key"
        exit 1
    }
}

Write-Host "🚀 Cloudflare Access SSH + GitHub Runner Setup" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  SSH Hostname: $SSH_HOSTNAME" -ForegroundColor Gray
Write-Host "  Tunnel ID: $TUNNEL_ID" -ForegroundColor Gray
Write-Host "  Allow Email: $ALLOW_EMAIL" -ForegroundColor Gray
Write-Host "  Server User: $SERVER_USER" -ForegroundColor Gray
Write-Host "  GH Repo: $GH_REPO" -ForegroundColor Gray
Write-Host "  Runner Name: $GH_RUNNER_NAME" -ForegroundColor Gray
Write-Host ""

# Get account ID if not provided
if (-not $CF_ACCOUNT_ID) {
    Write-Host "🔍 Fetching Cloudflare account ID..." -ForegroundColor Cyan
    try {
        $response = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts" `
            -Headers @{ "Authorization" = "Bearer $CF_API_TOKEN" }
        $CF_ACCOUNT_ID = $response.result[0].id
        Write-Host "✓ Account ID: $CF_ACCOUNT_ID" -ForegroundColor Green
    } catch {
        Write-Host "⚠ Could not fetch account ID automatically" -ForegroundColor Yellow
        Write-Host "Please set CF_ACCOUNT_ID environment variable" -ForegroundColor Yellow
        exit 1
    }
}

# Step 1: Generate tunnel config
Write-Host "`n📝 Step 1: Generating tunnel ingress configuration..." -ForegroundColor Cyan
$tunnelConfig = @"
tunnel: $TUNNEL_ID
credentials-file: /etc/cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: $SSH_HOSTNAME
    service: ssh://localhost:22
  - service: http_status:404
"@

$configPath = "cloudflared/config-ssh.yml"
Set-Content -Path $configPath -Value $tunnelConfig
Write-Host "✓ Config saved to: $configPath" -ForegroundColor Green

Write-Host "`n📋 Run this on your server:" -ForegroundColor Yellow
Write-Host @"
sudo mkdir -p /etc/cloudflared
sudo tee /etc/cloudflared/config.yml >/dev/null <<'EOF'
$tunnelConfig
EOF
sudo systemctl restart cloudflared || sudo service cloudflared restart
sudo systemctl status cloudflared --no-pager || true
"@ -ForegroundColor White

# Step 2: Create DNS record
Write-Host "`n🌐 Step 2: Creating DNS record..." -ForegroundColor Cyan
$DNS_NAME = $SSH_HOSTNAME.Split(".")[0]
$DNS_TARGET = "$TUNNEL_ID.cfargotunnel.com"

$dnsBody = @{
    type = "CNAME"
    name = $DNS_NAME
    content = $DNS_TARGET
    proxied = $true
    ttl = 1
} | ConvertTo-Json

try {
    $dnsResult = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records" `
        -Headers @{
            "Authorization" = "Bearer $CF_API_TOKEN"
            "Content-Type" = "application/json"
        } `
        -Method Post `
        -Body $dnsBody

    Write-Host "✓ DNS record created: $SSH_HOSTNAME → $DNS_TARGET" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 409) {
        Write-Host "✓ DNS record already exists" -ForegroundColor Green
    } else {
        $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "⚠ DNS error: $($errorBody.errors[0].message)" -ForegroundColor Yellow
        Write-Host "  (May already exist or be managed elsewhere)" -ForegroundColor Gray
    }
}

# Step 3: Create Access app + policy
if (-not $SkipAccessApp) {
    Write-Host "`n🔐 Step 3: Creating Cloudflare Access SSH application..." -ForegroundColor Cyan

    $appBody = @{
        type = "ssh"
        name = "prod-ssh"
        domain = $SSH_HOSTNAME
        session_duration = "24h"
        auto_redirect_to_identity = $false
    } | ConvertTo-Json

    try {
        $appResult = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/access/apps" `
            -Headers @{
                "Authorization" = "Bearer $CF_API_TOKEN"
                "Content-Type" = "application/json"
            } `
            -Method Post `
            -Body $appBody

        $APP_ID = $appResult.result.id
        Write-Host "✓ Access app created: prod-ssh (ID: $APP_ID)" -ForegroundColor Green

        # Create policy
        Write-Host "📜 Creating allow policy..." -ForegroundColor Cyan
        $policyBody = @{
            name = "allow-leo"
            precedence = 1
            decision = "allow"
            include = @(
                @{
                    email = @{
                        email = $ALLOW_EMAIL
                    }
                }
            )
        } | ConvertTo-Json -Depth 10

        $policyResult = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/access/apps/$APP_ID/policies" `
            -Headers @{
                "Authorization" = "Bearer $CF_API_TOKEN"
                "Content-Type" = "application/json"
            } `
            -Method Post `
            -Body $policyBody

        Write-Host "✓ Policy created: allow-leo (allows $ALLOW_EMAIL)" -ForegroundColor Green

    } catch {
        $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($errorBody.errors[0].code -eq 7003) {
            Write-Host "⚠ Access API requires additional permissions" -ForegroundColor Yellow
            Write-Host "  Please create the app manually in dashboard:" -ForegroundColor Yellow
            Write-Host "  https://one.dash.cloudflare.com/$CF_ACCOUNT_ID/access/apps" -ForegroundColor Blue
            Write-Host "  App type: SSH" -ForegroundColor Gray
            Write-Host "  Domain: $SSH_HOSTNAME" -ForegroundColor Gray
            Write-Host "  Allow: $ALLOW_EMAIL" -ForegroundColor Gray
        } else {
            Write-Host "❌ Access app creation failed: $($errorBody.errors[0].message)" -ForegroundColor Red
        }
    }
} else {
    Write-Host "`n⏭️  Step 3: Skipped (create Access app in dashboard)" -ForegroundColor Yellow
}

# Step 4: Local SSH config
Write-Host "`n🔧 Step 4: Configure local SSH client..." -ForegroundColor Cyan
Write-Host "Run this command to add SSH config:" -ForegroundColor Yellow
Write-Host "  cloudflared access ssh-config --hostname $SSH_HOSTNAME --short-lived-cert >> `$env:USERPROFILE\.ssh\config" -ForegroundColor White

# Check if cloudflared is installed
try {
    $cloudflaredVersion = & cloudflared --version 2>&1
    Write-Host "✓ cloudflared installed: $cloudflaredVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠ cloudflared not found. Install with:" -ForegroundColor Yellow
    Write-Host "  winget install Cloudflare.cloudflared" -ForegroundColor White
}

# Step 5: Test SSH connection
Write-Host "`n🔌 Step 5: Test SSH connection..." -ForegroundColor Cyan
Write-Host "After completing server setup, connect with:" -ForegroundColor Yellow
Write-Host "  ssh $SERVER_USER@$SSH_HOSTNAME" -ForegroundColor White
Write-Host "  (First connection opens browser for authentication)" -ForegroundColor Gray

# Step 6: Runner installation
if (-not $SkipRunner) {
    Write-Host "`n🤖 Step 6: GitHub Runner Installation..." -ForegroundColor Cyan

    if (-not $GH_RUNNER_TOKEN) {
        Write-Host "⚠ GH_RUNNER_TOKEN not set. Getting new token..." -ForegroundColor Yellow
        try {
            $tokenResponse = gh api -X POST "repos/$GH_REPO/actions/runners/registration-token" | ConvertFrom-Json
            $GH_RUNNER_TOKEN = $tokenResponse.token
            Write-Host "✓ New runner token obtained" -ForegroundColor Green
        } catch {
            Write-Host "❌ Failed to get runner token. Please run:" -ForegroundColor Red
            Write-Host "  gh api -X POST repos/$GH_REPO/actions/runners/registration-token --jq '.token'" -ForegroundColor White
            Write-Host "  Then set GH_RUNNER_TOKEN environment variable" -ForegroundColor White
            exit 1
        }
    }

    Write-Host "`n📋 Run this on your server (after SSH works):" -ForegroundColor Yellow
    Write-Host @"
sudo docker rm -f gh-runner-prod 2>/dev/null || true

sudo docker run -d --restart unless-stopped --name gh-runner-prod \
  -e REPO_URL="https://github.com/$GH_REPO" \
  -e RUNNER_NAME="$GH_RUNNER_NAME" \
  -e RUNNER_LABELS="$GH_RUNNER_LABELS" \
  -e RUNNER_TOKEN="$GH_RUNNER_TOKEN" \
  -e RUNNER_WORKDIR="/runner/_work" \
  -v /srv/gh-runner:/runner \
  -v /var/run/docker.sock:/var/run/docker.sock \
  myoung34/github-runner:latest

sudo docker logs -f gh-runner-prod --tail=50
"@ -ForegroundColor White

    Write-Host "`n✓ Runner token ready (expires in ~1 hour)" -ForegroundColor Green
}

# Step 7: Verification commands
Write-Host "`n✅ Setup Complete!" -ForegroundColor Green
Write-Host "`n📊 Verification Commands:" -ForegroundColor Cyan

Write-Host "`nDNS check:" -ForegroundColor Yellow
Write-Host "  nslookup $SSH_HOSTNAME" -ForegroundColor White

Write-Host "`nRunner status:" -ForegroundColor Yellow
Write-Host "  gh api repos/$GH_REPO/actions/runners --jq '.runners[] | {name,status,labels:[.labels[].name]}'" -ForegroundColor White

Write-Host "`n🔗 Useful Links:" -ForegroundColor Cyan
Write-Host "  Access Apps: https://one.dash.cloudflare.com/$CF_ACCOUNT_ID/access/apps" -ForegroundColor Blue
Write-Host "  DNS Records: https://dash.cloudflare.com/$CF_ZONE_ID/dns/records" -ForegroundColor Blue
Write-Host "  GitHub Runners: https://github.com/$GH_REPO/settings/actions/runners" -ForegroundColor Blue

Write-Host "`n📝 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Run tunnel config on server (see Step 1 above)" -ForegroundColor Gray
Write-Host "2. Configure local SSH client (see Step 4 above)" -ForegroundColor Gray
Write-Host "3. Test SSH connection" -ForegroundColor Gray
Write-Host "4. Install runner on server (see Step 6 above)" -ForegroundColor Gray
Write-Host "5. Verify runner shows 'online'" -ForegroundColor Gray
