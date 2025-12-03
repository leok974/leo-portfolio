# Simplified Cloudflare Access SSH Setup
# Run this step-by-step

# Configuration
$SSH_HOSTNAME = "ssh.leoklemet.com"
$ALLOW_EMAIL = "leoklemet.pa@gmail.com"

# Load credentials from .env.cloudflare
$CF_API_TOKEN = (Get-Content .env.cloudflare | Select-String "^CLOUDFLARE_API_TOKEN=" | ForEach-Object { $_.ToString().Split("=",2)[1] })
$CF_ZONE_ID = (Get-Content .env.cloudflare | Select-String "^CF_ZONE_ID=" | ForEach-Object { $_.ToString().Split("=",2)[1] })
$TUNNEL_ID = (Get-Content cloudflared\.env.tunnel | Select-String "^CLOUDFLARE_TUNNEL_UUID=" | ForEach-Object { $_.ToString().Split("=",2)[1] })

Write-Host "Loaded credentials:" -ForegroundColor Cyan
Write-Host "  Token: $($CF_API_TOKEN.Substring(0,10))..." -ForegroundColor Gray
Write-Host "  Zone ID: $CF_ZONE_ID" -ForegroundColor Gray
Write-Host "  Tunnel ID: $TUNNEL_ID" -ForegroundColor Gray

# Get Account ID
Write-Host "`n🔍 Fetching account ID..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts" `
        -Headers @{ "Authorization" = "Bearer $CF_API_TOKEN" } `
        -Method Get

    $CF_ACCOUNT_ID = $response.result[0].id
    $ACCOUNT_NAME = $response.result[0].name
    Write-Host "✓ Account: $ACCOUNT_NAME ($CF_ACCOUNT_ID)" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to fetch account: $_" -ForegroundColor Red
    exit 1
}

# Step 1: Create/verify DNS record
Write-Host "`n🌐 Step 1: DNS Record..." -ForegroundColor Cyan
$DNS_NAME = $SSH_HOSTNAME.Split(".")[0]
$DNS_CONTENT = "$TUNNEL_ID.cfargotunnel.com"

$dnsBody = @{
    type = "CNAME"
    name = $DNS_NAME
    content = $DNS_CONTENT
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

    Write-Host "✓ DNS record created: $SSH_HOSTNAME → $DNS_CONTENT" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 409 -or $_.Exception.Message -like "*already exists*") {
        Write-Host "✓ DNS record already exists (OK)" -ForegroundColor Yellow
    } else {
        Write-Host "⚠ DNS error (may be OK): $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Step 2: Create Access Application
Write-Host "`n🔐 Step 2: Access Application..." -ForegroundColor Cyan
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
    Write-Host "✓ App created: prod-ssh ($APP_ID)" -ForegroundColor Green
} catch {
    Write-Host "⚠ App may exist, fetching..." -ForegroundColor Yellow
    $existingApps = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/access/apps" `
        -Headers @{ "Authorization" = "Bearer $CF_API_TOKEN" }

    $existingApp = $existingApps.result | Where-Object { $_.domain -eq $SSH_HOSTNAME }
    if ($existingApp) {
        $APP_ID = $existingApp.id
        Write-Host "✓ Using existing app: $($existingApp.name) ($APP_ID)" -ForegroundColor Green
    } else {
        Write-Host "❌ Could not create or find app" -ForegroundColor Red
        exit 1
    }
}

# Step 3: Create Policy
Write-Host "`n📜 Step 3: Access Policy..." -ForegroundColor Cyan
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

try {
    $policyResult = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/access/apps/$APP_ID/policies" `
        -Headers @{
            "Authorization" = "Bearer $CF_API_TOKEN"
            "Content-Type" = "application/json"
        } `
        -Method Post `
        -Body $policyBody

    Write-Host "✓ Policy created: allow-leo" -ForegroundColor Green
} catch {
    Write-Host "⚠ Policy may already exist (OK)" -ForegroundColor Yellow
}

# Step 4: Generate server config
Write-Host "`n📝 Step 4: Server Configuration..." -ForegroundColor Cyan
$tunnelConfig = @"
tunnel: $TUNNEL_ID
credentials-file: /etc/cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: $SSH_HOSTNAME
    service: ssh://localhost:22
  - service: http_status:404
"@

$configPath = "cloudflared\config-ssh.yml"
Set-Content -Path $configPath -Value $tunnelConfig
Write-Host "✓ Config saved to: $configPath" -ForegroundColor Green

# Print next steps
Write-Host "`n✅ Setup Complete!" -ForegroundColor Green
Write-Host "`n📋 Next Steps:" -ForegroundColor Cyan

Write-Host "`n1️⃣  Upload config to your production server:" -ForegroundColor Yellow
Write-Host @"

sudo tee /etc/cloudflared/config.yml >/dev/null <<'EOF'
$tunnelConfig
EOF

sudo systemctl restart cloudflared
sudo systemctl status cloudflared --no-pager

"@ -ForegroundColor White

Write-Host "2️⃣  Install cloudflared locally (if not installed):" -ForegroundColor Yellow
Write-Host "  winget install Cloudflare.cloudflared" -ForegroundColor White

Write-Host "`n3️⃣  Configure SSH:" -ForegroundColor Yellow
Write-Host "  cloudflared access ssh-config --hostname $SSH_HOSTNAME --short-lived-cert >> `$env:USERPROFILE\.ssh\config" -ForegroundColor White

Write-Host "`n4️⃣  Connect:" -ForegroundColor Yellow
Write-Host "  ssh ubuntu@$SSH_HOSTNAME" -ForegroundColor White

Write-Host "`n5️⃣  Start runner:" -ForegroundColor Yellow
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

Write-Host "`n🔗 Links:" -ForegroundColor Cyan
Write-Host "  Access Apps: https://one.dash.cloudflare.com/$CF_ACCOUNT_ID/access/apps" -ForegroundColor Blue
Write-Host "  DNS Records: https://dash.cloudflare.com/$CF_ZONE_ID/dns/records" -ForegroundColor Blue
