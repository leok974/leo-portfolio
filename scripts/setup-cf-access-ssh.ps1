# Setup Cloudflare Access for SSH
# This script configures SSH access through Cloudflare Zero Trust

Param(
    [string]$SSHHostname = "ssh.leoklemet.com",
    [string]$AllowEmail = "leoklemet.pa@gmail.com",
    [string]$ServerUser = "ubuntu"
)

# Load Cloudflare credentials
$envFile = Join-Path $PSScriptRoot ".." ".env.cloudflare"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.+)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

# Load tunnel config
$tunnelEnv = Join-Path $PSScriptRoot ".." "cloudflared" ".env.tunnel"
if (Test-Path $tunnelEnv) {
    Get-Content $tunnelEnv | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.+)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

$CF_API_TOKEN = $env:CLOUDFLARE_API_TOKEN
$CF_ZONE_ID = $env:CF_ZONE_ID
$TUNNEL_ID = $env:CLOUDFLARE_TUNNEL_UUID

# Get account ID from API
Write-Host "🔍 Fetching Cloudflare account ID..." -ForegroundColor Cyan
$accountResponse = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts" `
    -Headers @{ "Authorization" = "Bearer $CF_API_TOKEN" } `
    -Method Get

$CF_ACCOUNT_ID = $accountResponse.result[0].id
Write-Host "✓ Account ID: $CF_ACCOUNT_ID" -ForegroundColor Green

# Verify we have all required values
if (-not $CF_API_TOKEN) { Write-Error "Missing CLOUDFLARE_API_TOKEN"; exit 1 }
if (-not $CF_ZONE_ID) { Write-Error "Missing CF_ZONE_ID"; exit 1 }
if (-not $CF_ACCOUNT_ID) { Write-Error "Could not fetch CF_ACCOUNT_ID"; exit 1 }
if (-not $TUNNEL_ID) { Write-Error "Missing CLOUDFLARE_TUNNEL_UUID"; exit 1 }

Write-Host "`n📋 Configuration:" -ForegroundColor Cyan
Write-Host "  SSH Hostname: $SSHHostname"
Write-Host "  Tunnel ID: $TUNNEL_ID"
Write-Host "  Zone ID: $CF_ZONE_ID"
Write-Host "  Account ID: $CF_ACCOUNT_ID"
Write-Host "  Allow Email: $AllowEmail"

# Step 1: Create DNS record for SSH hostname
Write-Host "`n🌐 Step 1: Creating DNS record..." -ForegroundColor Cyan
$dnsPayload = @{
    type = "CNAME"
    name = ($SSHHostname -replace "\.$env:CF_DOMAIN$", "").Split(".")[0]
    content = "$TUNNEL_ID.cfargotunnel.com"
    proxied = $true
    ttl = 1
} | ConvertTo-Json

try {
    $dnsResponse = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records" `
        -Headers @{
            "Authorization" = "Bearer $CF_API_TOKEN"
            "Content-Type" = "application/json"
        } `
        -Method Post `
        -Body $dnsPayload

    Write-Host "✓ DNS record created: $SSHHostname → $TUNNEL_ID.cfargotunnel.com" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "⚠ DNS record already exists (OK)" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Failed to create DNS record: $_" -ForegroundColor Red
    }
}

# Step 2: Create Cloudflare Access Application
Write-Host "`n🔐 Step 2: Creating Cloudflare Access SSH application..." -ForegroundColor Cyan
$appPayload = @{
    type = "ssh"
    name = "prod-ssh"
    domain = $SSHHostname
    session_duration = "24h"
    auto_redirect_to_identity = $false
} | ConvertTo-Json

try {
    $appResponse = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/access/apps" `
        -Headers @{
            "Authorization" = "Bearer $CF_API_TOKEN"
            "Content-Type" = "application/json"
        } `
        -Method Post `
        -Body $appPayload

    $APP_ID = $appResponse.result.id
    Write-Host "✓ Access app created: $($appResponse.result.name) (ID: $APP_ID)" -ForegroundColor Green
} catch {
    # Try to get existing app
    Write-Host "⚠ App may already exist, fetching..." -ForegroundColor Yellow
    $existingApps = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/access/apps" `
        -Headers @{ "Authorization" = "Bearer $CF_API_TOKEN" } `
        -Method Get

    $existingApp = $existingApps.result | Where-Object { $_.domain -eq $SSHHostname }
    if ($existingApp) {
        $APP_ID = $existingApp.id
        Write-Host "✓ Using existing app: $($existingApp.name) (ID: $APP_ID)" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to create or find Access app" -ForegroundColor Red
        exit 1
    }
}

# Step 3: Create Allow Policy
Write-Host "`n📜 Step 3: Creating allow policy for $AllowEmail..." -ForegroundColor Cyan
$policyPayload = @{
    name = "allow-leo"
    precedence = 1
    decision = "allow"
    include = @(
        @{
            email = @{
                email = $AllowEmail
            }
        }
    )
} | ConvertTo-Json -Depth 10

try {
    $policyResponse = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/access/apps/$APP_ID/policies" `
        -Headers @{
            "Authorization" = "Bearer $CF_API_TOKEN"
            "Content-Type" = "application/json"
        } `
        -Method Post `
        -Body $policyPayload

    Write-Host "✓ Policy created: $($policyResponse.result.name)" -ForegroundColor Green
} catch {
    Write-Host "⚠ Policy may already exist or error occurred: $_" -ForegroundColor Yellow
}

# Step 4: Generate server-side tunnel config
Write-Host "`n📝 Step 4: Generating tunnel ingress config..." -ForegroundColor Cyan
$tunnelConfig = @"
tunnel: $TUNNEL_ID
credentials-file: /etc/cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: $SSHHostname
    service: ssh://localhost:22
  - service: http_status:404
"@

Write-Host $tunnelConfig -ForegroundColor DarkGray

# Save to file
$configPath = Join-Path $PSScriptRoot ".." "cloudflared" "config-ssh.yml"
Set-Content -Path $configPath -Value $tunnelConfig
Write-Host "✓ Config saved to: $configPath" -ForegroundColor Green

# Step 5: Print instructions
Write-Host "`n✅ Cloudflare Access SSH setup complete!" -ForegroundColor Green
Write-Host "`n📋 Next Steps:" -ForegroundColor Cyan

Write-Host "`n1️⃣  On your production server, upload tunnel config:" -ForegroundColor Yellow
Write-Host @"
sudo mkdir -p /etc/cloudflared
sudo tee /etc/cloudflared/config.yml >/dev/null <<'YAML'
$tunnelConfig
YAML

# Restart tunnel
sudo systemctl restart cloudflared || sudo service cloudflared restart
sudo systemctl status cloudflared --no-pager
"@ -ForegroundColor White

Write-Host "`n2️⃣  On your local machine, install cloudflared:" -ForegroundColor Yellow
Write-Host "  Windows: winget install Cloudflare.cloudflared" -ForegroundColor White
Write-Host "  macOS: brew install cloudflare/cloudflare/cloudflared" -ForegroundColor White
Write-Host "  Linux: curl -fsSL https://pkg.cloudflare.com/cloudflared/install.sh | sudo bash" -ForegroundColor White

Write-Host "`n3️⃣  Configure SSH client (local machine):" -ForegroundColor Yellow
Write-Host "  cloudflared access ssh-config --hostname $SSHHostname --short-lived-cert >> ~/.ssh/config" -ForegroundColor White

Write-Host "`n4️⃣  Connect via SSH:" -ForegroundColor Yellow
Write-Host "  ssh $ServerUser@$SSHHostname" -ForegroundColor White
Write-Host "  (First connection will open browser for authentication)" -ForegroundColor DarkGray

Write-Host "`n5️⃣  Install GitHub runner (once connected):" -ForegroundColor Yellow
Write-Host @"
sudo docker run -d --restart unless-stopped --name gh-runner-prod \
  -e REPO_URL="https://github.com/leok974/leo-portfolio" \
  -e RUNNER_NAME="prod-runner-1" \
  -e RUNNER_LABELS="self-hosted,prod,deploy" \
  -e RUNNER_TOKEN="BTGQ4IBYGBEHZVPCATZTKDDI7EWTO" \
  -e RUNNER_WORKDIR="/runner/_work" \
  -v /srv/gh-runner:/runner \
  -v /var/run/docker.sock:/var/run/docker.sock \
  myoung34/github-runner:latest
"@ -ForegroundColor White

Write-Host "`n🔗 Useful Links:" -ForegroundColor Cyan
Write-Host "  Zero Trust Dashboard: https://one.dash.cloudflare.com/$CF_ACCOUNT_ID/access/apps" -ForegroundColor Blue
Write-Host "  DNS Records: https://dash.cloudflare.com/$CF_ZONE_ID/dns/records" -ForegroundColor Blue
