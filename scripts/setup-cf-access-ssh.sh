#!/usr/bin/env bash
set -euo pipefail

# Setup Cloudflare Access for SSH
# This script configures SSH access through Cloudflare Zero Trust

SSH_HOSTNAME="${SSH_HOSTNAME:-ssh.leoklemet.com}"
ALLOW_EMAIL="${ALLOW_EMAIL:-leoklemet.pa@gmail.com}"
SERVER_USER="${SERVER_USER:-ubuntu}"

# Load .env.cloudflare
if [[ -f "$(dirname "$0")/../.env.cloudflare" ]]; then
    source <(grep -v '^#' "$(dirname "$0")/../.env.cloudflare" | sed 's/^/export /')
fi

# Load tunnel config
if [[ -f "$(dirname "$0")/../cloudflared/.env.tunnel" ]]; then
    source <(grep -v '^#' "$(dirname "$0")/../cloudflared/.env.tunnel" | sed 's/^/export /')
fi

CF_API_TOKEN="${CLOUDFLARE_API_TOKEN}"
CF_ZONE_ID="${CF_ZONE_ID}"
TUNNEL_ID="${CLOUDFLARE_TUNNEL_UUID}"

# Get account ID
echo "🔍 Fetching Cloudflare account ID..."
CF_ACCOUNT_ID=$(curl -sS "https://api.cloudflare.com/client/v4/accounts" \
    -H "Authorization: Bearer $CF_API_TOKEN" | jq -r '.result[0].id')

echo "✓ Account ID: $CF_ACCOUNT_ID"

# Verify required values
[[ -z "$CF_API_TOKEN" ]] && { echo "❌ Missing CLOUDFLARE_API_TOKEN"; exit 1; }
[[ -z "$CF_ZONE_ID" ]] && { echo "❌ Missing CF_ZONE_ID"; exit 1; }
[[ -z "$CF_ACCOUNT_ID" ]] && { echo "❌ Could not fetch CF_ACCOUNT_ID"; exit 1; }
[[ -z "$TUNNEL_ID" ]] && { echo "❌ Missing CLOUDFLARE_TUNNEL_UUID"; exit 1; }

echo ""
echo "📋 Configuration:"
echo "  SSH Hostname: $SSH_HOSTNAME"
echo "  Tunnel ID: $TUNNEL_ID"
echo "  Zone ID: $CF_ZONE_ID"
echo "  Account ID: $CF_ACCOUNT_ID"
echo "  Allow Email: $ALLOW_EMAIL"

# Step 1: Create DNS record
echo ""
echo "🌐 Step 1: Creating DNS record..."
DNS_NAME=$(echo "$SSH_HOSTNAME" | cut -d. -f1)

curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
        \"type\": \"CNAME\",
        \"name\": \"$DNS_NAME\",
        \"content\": \"$TUNNEL_ID.cfargotunnel.com\",
        \"proxied\": true,
        \"ttl\": 1
    }" | jq . || echo "⚠ DNS record may already exist (OK)"

echo "✓ DNS record created/verified"

# Step 2: Create Access Application
echo ""
echo "🔐 Step 2: Creating Cloudflare Access SSH application..."

APP_RESPONSE=$(curl -sS -X POST "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/access/apps" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
        \"type\": \"ssh\",
        \"name\": \"prod-ssh\",
        \"domain\": \"$SSH_HOSTNAME\",
        \"session_duration\": \"24h\",
        \"auto_redirect_to_identity\": false
    }") || true

APP_ID=$(echo "$APP_RESPONSE" | jq -r '.result.id // empty')

if [[ -z "$APP_ID" ]]; then
    echo "⚠ App may already exist, fetching..."
    EXISTING_APPS=$(curl -sS "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/access/apps" \
        -H "Authorization: Bearer $CF_API_TOKEN")
    APP_ID=$(echo "$EXISTING_APPS" | jq -r ".result[] | select(.domain == \"$SSH_HOSTNAME\") | .id")
fi

echo "✓ Access app ID: $APP_ID"

# Step 3: Create Allow Policy
echo ""
echo "📜 Step 3: Creating allow policy for $ALLOW_EMAIL..."

curl -sS -X POST "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/access/apps/$APP_ID/policies" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
        \"name\": \"allow-leo\",
        \"precedence\": 1,
        \"decision\": \"allow\",
        \"include\": [{
            \"email\": {
                \"email\": \"$ALLOW_EMAIL\"
            }
        }]
    }" | jq . || echo "⚠ Policy may already exist"

echo "✓ Policy created/verified"

# Step 4: Generate tunnel config
echo ""
echo "📝 Step 4: Generating tunnel ingress config..."

TUNNEL_CONFIG="tunnel: $TUNNEL_ID
credentials-file: /etc/cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: $SSH_HOSTNAME
    service: ssh://localhost:22
  - service: http_status:404"

echo "$TUNNEL_CONFIG"

# Save to file
mkdir -p "$(dirname "$0")/../cloudflared"
echo "$TUNNEL_CONFIG" > "$(dirname "$0")/../cloudflared/config-ssh.yml"
echo "✓ Config saved to: cloudflared/config-ssh.yml"

# Print instructions
echo ""
echo "✅ Cloudflare Access SSH setup complete!"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1️⃣  On your production server, upload tunnel config:"
echo ""
cat <<'BASH'
sudo mkdir -p /etc/cloudflared
sudo tee /etc/cloudflared/config.yml >/dev/null <<'YAML'
YAML
echo "$TUNNEL_CONFIG"
cat <<'BASH'
YAML

# Restart tunnel
sudo systemctl restart cloudflared || sudo service cloudflared restart
sudo systemctl status cloudflared --no-pager
BASH

echo ""
echo "2️⃣  On your local machine, install cloudflared:"
echo "  macOS: brew install cloudflare/cloudflare/cloudflared"
echo "  Linux: curl -fsSL https://pkg.cloudflare.com/cloudflared/install.sh | sudo bash"
echo ""

echo "3️⃣  Configure SSH client (local machine):"
echo "  cloudflared access ssh-config --hostname $SSH_HOSTNAME --short-lived-cert >> ~/.ssh/config"
echo ""

echo "4️⃣  Connect via SSH:"
echo "  ssh $SERVER_USER@$SSH_HOSTNAME"
echo "  (First connection will open browser for authentication)"
echo ""

echo "5️⃣  Install GitHub runner (once connected):"
cat <<'RUNNER'
sudo docker run -d --restart unless-stopped --name gh-runner-prod \
  -e REPO_URL="https://github.com/leok974/leo-portfolio" \
  -e RUNNER_NAME="prod-runner-1" \
  -e RUNNER_LABELS="self-hosted,prod,deploy" \
  -e RUNNER_TOKEN="BTGQ4IBYGBEHZVPCATZTKDDI7EWTO" \
  -e RUNNER_WORKDIR="/runner/_work" \
  -v /srv/gh-runner:/runner \
  -v /var/run/docker.sock:/var/run/docker.sock \
  myoung34/github-runner:latest
RUNNER

echo ""
echo "🔗 Useful Links:"
echo "  Zero Trust Dashboard: https://one.dash.cloudflare.com/$CF_ACCOUNT_ID/access/apps"
echo "  DNS Records: https://dash.cloudflare.com/$CF_ZONE_ID/dns/records"
