#!/usr/bin/env bash
set -euo pipefail

# Set up SSH via Cloudflare Access and install GitHub Actions runner
#
# Required environment variables:
# - CF_API_TOKEN, CF_ACCOUNT_ID (optional), CF_ZONE_ID, TUNNEL_ID
# - SSH_HOSTNAME, ALLOW_EMAIL, SERVER_USER
# - GH_REPO, GH_RUNNER_NAME, GH_RUNNER_LABELS, GH_RUNNER_TOKEN (optional)

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# Load .env files if they exist
load_env() {
    local file="$1"
    if [[ -f "$file" ]]; then
        while IFS='=' read -r key value; do
            if [[ ! "$key" =~ ^# && -n "$key" ]]; then
                export "${key}=${value}"
            fi
        done < <(grep -v '^#' "$file" || true)
    fi
}

load_env ".env.cloudflare"
load_env "cloudflared/.env.tunnel"

# Get variables with defaults
CF_API_TOKEN="${CF_API_TOKEN:-${CLOUDFLARE_API_TOKEN:-}}"
CF_ACCOUNT_ID="${CF_ACCOUNT_ID:-}"
CF_ZONE_ID="${CF_ZONE_ID:-}"
TUNNEL_ID="${TUNNEL_ID:-${CLOUDFLARE_TUNNEL_UUID:-}}"
SSH_HOSTNAME="${SSH_HOSTNAME:-ssh.leoklemet.com}"
ALLOW_EMAIL="${ALLOW_EMAIL:-leoklemet.pa@gmail.com}"
SERVER_USER="${SERVER_USER:-ubuntu}"
GH_REPO="${GH_REPO:-leok974/leo-portfolio}"
GH_RUNNER_NAME="${GH_RUNNER_NAME:-prod-runner-1}"
GH_RUNNER_LABELS="${GH_RUNNER_LABELS:-self-hosted,prod,deploy}"
GH_RUNNER_TOKEN="${GH_RUNNER_TOKEN:-}"

# Validate required variables
[[ -z "$CF_API_TOKEN" ]] && { echo -e "${RED}❌ Missing CF_API_TOKEN${NC}"; exit 1; }
[[ -z "$CF_ZONE_ID" ]] && { echo -e "${RED}❌ Missing CF_ZONE_ID${NC}"; exit 1; }
[[ -z "$TUNNEL_ID" ]] && { echo -e "${RED}❌ Missing TUNNEL_ID${NC}"; exit 1; }

echo -e "${CYAN}🚀 Cloudflare Access SSH + GitHub Runner Setup${NC}"
echo -e "${CYAN}================================================${NC}"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo -e "  SSH Hostname: ${GRAY}$SSH_HOSTNAME${NC}"
echo -e "  Tunnel ID: ${GRAY}$TUNNEL_ID${NC}"
echo -e "  Allow Email: ${GRAY}$ALLOW_EMAIL${NC}"
echo -e "  Server User: ${GRAY}$SERVER_USER${NC}"
echo -e "  GH Repo: ${GRAY}$GH_REPO${NC}"
echo -e "  Runner Name: ${GRAY}$GH_RUNNER_NAME${NC}"
echo ""

# Get account ID if not provided
if [[ -z "$CF_ACCOUNT_ID" ]]; then
    echo -e "${CYAN}🔍 Fetching Cloudflare account ID...${NC}"
    CF_ACCOUNT_ID=$(curl -sS "https://api.cloudflare.com/client/v4/accounts" \
        -H "Authorization: Bearer $CF_API_TOKEN" | jq -r '.result[0].id')

    if [[ -z "$CF_ACCOUNT_ID" || "$CF_ACCOUNT_ID" == "null" ]]; then
        echo -e "${YELLOW}⚠ Could not fetch account ID${NC}"
        echo -e "${YELLOW}Please set CF_ACCOUNT_ID environment variable${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Account ID: $CF_ACCOUNT_ID${NC}"
fi

# Step 1: Generate tunnel config
echo -e "\n${CYAN}📝 Step 1: Generating tunnel ingress configuration...${NC}"
TUNNEL_CONFIG="tunnel: $TUNNEL_ID
credentials-file: /etc/cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: $SSH_HOSTNAME
    service: ssh://localhost:22
  - service: http_status:404"

mkdir -p cloudflared
echo "$TUNNEL_CONFIG" > cloudflared/config-ssh.yml
echo -e "${GREEN}✓ Config saved to: cloudflared/config-ssh.yml${NC}"

echo -e "\n${YELLOW}📋 Run this on your server:${NC}"
cat <<EOF
sudo mkdir -p /etc/cloudflared
sudo tee /etc/cloudflared/config.yml >/dev/null <<'YAML'
$TUNNEL_CONFIG
YAML
sudo systemctl restart cloudflared || sudo service cloudflared restart
sudo systemctl status cloudflared --no-pager || true
EOF

# Step 2: Create DNS record
echo -e "\n${CYAN}🌐 Step 2: Creating DNS record...${NC}"
DNS_NAME=$(echo "$SSH_HOSTNAME" | cut -d. -f1)
DNS_TARGET="$TUNNEL_ID.cfargotunnel.com"

DNS_RESULT=$(curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"CNAME\",\"name\":\"$DNS_NAME\",\"content\":\"$DNS_TARGET\",\"proxied\":true,\"ttl\":1}")

if echo "$DNS_RESULT" | jq -e '.success' >/dev/null 2>&1; then
    echo -e "${GREEN}✓ DNS record created: $SSH_HOSTNAME → $DNS_TARGET${NC}"
elif echo "$DNS_RESULT" | jq -e '.errors[0].code == 81057' >/dev/null 2>&1; then
    echo -e "${GREEN}✓ DNS record already exists${NC}"
else
    ERROR_MSG=$(echo "$DNS_RESULT" | jq -r '.errors[0].message // "Unknown error"')
    echo -e "${YELLOW}⚠ DNS error: $ERROR_MSG${NC}"
    echo -e "${GRAY}  (May already exist or be managed elsewhere)${NC}"
fi

# Step 3: Create Access app + policy
echo -e "\n${CYAN}🔐 Step 3: Creating Cloudflare Access SSH application...${NC}"

APP_CREATE=$(curl -sS -X POST "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/access/apps" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"ssh\",\"name\":\"prod-ssh\",\"domain\":\"$SSH_HOSTNAME\",\"session_duration\":\"24h\",\"auto_redirect_to_identity\":false}")

if echo "$APP_CREATE" | jq -e '.success' >/dev/null 2>&1; then
    APP_ID=$(echo "$APP_CREATE" | jq -r '.result.id')
    echo -e "${GREEN}✓ Access app created: prod-ssh (ID: $APP_ID)${NC}"

    # Create policy
    echo -e "${CYAN}📜 Creating allow policy...${NC}"
    POLICY_CREATE=$(curl -sS -X POST "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/access/apps/$APP_ID/policies" \
        -H "Authorization: Bearer $CF_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"allow-leo\",\"precedence\":1,\"decision\":\"allow\",\"include\":[{\"email\":{\"email\":\"$ALLOW_EMAIL\"}}]}")

    if echo "$POLICY_CREATE" | jq -e '.success' >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Policy created: allow-leo (allows $ALLOW_EMAIL)${NC}"
    else
        echo -e "${YELLOW}⚠ Policy creation warning (may already exist)${NC}"
    fi
else
    ERROR_CODE=$(echo "$APP_CREATE" | jq -r '.errors[0].code // 0')
    if [[ "$ERROR_CODE" == "7003" ]]; then
        echo -e "${YELLOW}⚠ Access API requires additional permissions${NC}"
        echo -e "${YELLOW}  Please create the app manually in dashboard:${NC}"
        echo -e "${BLUE}  https://one.dash.cloudflare.com/$CF_ACCOUNT_ID/access/apps${NC}"
        echo -e "${GRAY}  App type: SSH${NC}"
        echo -e "${GRAY}  Domain: $SSH_HOSTNAME${NC}"
        echo -e "${GRAY}  Allow: $ALLOW_EMAIL${NC}"
    else
        ERROR_MSG=$(echo "$APP_CREATE" | jq -r '.errors[0].message // "Unknown error"')
        echo -e "${RED}❌ Access app creation failed: $ERROR_MSG${NC}"
    fi
fi

# Step 4: Local SSH config
echo -e "\n${CYAN}🔧 Step 4: Configure local SSH client...${NC}"
echo -e "${YELLOW}Run this command to add SSH config:${NC}"
echo -e "  cloudflared access ssh-config --hostname $SSH_HOSTNAME --short-lived-cert >> ~/.ssh/config"

# Check if cloudflared is installed
if command -v cloudflared &> /dev/null; then
    CLOUDFLARED_VERSION=$(cloudflared --version 2>&1 | head -n1)
    echo -e "${GREEN}✓ cloudflared installed: $CLOUDFLARED_VERSION${NC}"
else
    echo -e "${YELLOW}⚠ cloudflared not found. Install with:${NC}"
    echo -e "  ${GRAY}macOS: brew install cloudflare/cloudflare/cloudflared${NC}"
    echo -e "  ${GRAY}Linux: curl -fsSL https://pkg.cloudflare.com/cloudflared/install.sh | sudo bash${NC}"
fi

# Step 5: Test SSH connection
echo -e "\n${CYAN}🔌 Step 5: Test SSH connection...${NC}"
echo -e "${YELLOW}After completing server setup, connect with:${NC}"
echo -e "  ssh $SERVER_USER@$SSH_HOSTNAME"
echo -e "${GRAY}  (First connection opens browser for authentication)${NC}"

# Step 6: Runner installation
echo -e "\n${CYAN}🤖 Step 6: GitHub Runner Installation...${NC}"

if [[ -z "$GH_RUNNER_TOKEN" ]]; then
    echo -e "${YELLOW}⚠ GH_RUNNER_TOKEN not set. Getting new token...${NC}"
    if command -v gh &> /dev/null; then
        GH_RUNNER_TOKEN=$(gh api -X POST "repos/$GH_REPO/actions/runners/registration-token" --jq '.token')
        echo -e "${GREEN}✓ New runner token obtained${NC}"
    else
        echo -e "${RED}❌ gh CLI not found. Please run:${NC}"
        echo -e "  gh api -X POST repos/$GH_REPO/actions/runners/registration-token --jq '.token'"
        echo -e "  Then set GH_RUNNER_TOKEN environment variable"
        exit 1
    fi
fi

echo -e "\n${YELLOW}📋 Run this on your server (after SSH works):${NC}"
cat <<EOF
sudo docker rm -f gh-runner-prod 2>/dev/null || true

sudo docker run -d --restart unless-stopped --name gh-runner-prod \\
  -e REPO_URL="https://github.com/$GH_REPO" \\
  -e RUNNER_NAME="$GH_RUNNER_NAME" \\
  -e RUNNER_LABELS="$GH_RUNNER_LABELS" \\
  -e RUNNER_TOKEN="$GH_RUNNER_TOKEN" \\
  -e RUNNER_WORKDIR="/runner/_work" \\
  -v /srv/gh-runner:/runner \\
  -v /var/run/docker.sock:/var/run/docker.sock \\
  myoung34/github-runner:latest

sudo docker logs -f gh-runner-prod --tail=50
EOF

echo -e "\n${GREEN}✓ Runner token ready (expires in ~1 hour)${NC}"

# Step 7: Verification commands
echo -e "\n${GREEN}✅ Setup Complete!${NC}"
echo -e "\n${CYAN}📊 Verification Commands:${NC}"

echo -e "\n${YELLOW}DNS check:${NC}"
echo -e "  dig +short $SSH_HOSTNAME"

echo -e "\n${YELLOW}Runner status:${NC}"
echo -e "  gh api repos/$GH_REPO/actions/runners --jq '.runners[] | {name,status,labels:[.labels[].name]}'"

echo -e "\n${CYAN}🔗 Useful Links:${NC}"
echo -e "  ${BLUE}Access Apps: https://one.dash.cloudflare.com/$CF_ACCOUNT_ID/access/apps${NC}"
echo -e "  ${BLUE}DNS Records: https://dash.cloudflare.com/$CF_ZONE_ID/dns/records${NC}"
echo -e "  ${BLUE}GitHub Runners: https://github.com/$GH_REPO/settings/actions/runners${NC}"

echo -e "\n${CYAN}📝 Next Steps:${NC}"
echo -e "${GRAY}1. Run tunnel config on server (see Step 1 above)${NC}"
echo -e "${GRAY}2. Configure local SSH client (see Step 4 above)${NC}"
echo -e "${GRAY}3. Test SSH connection${NC}"
echo -e "${GRAY}4. Install runner on server (see Step 6 above)${NC}"
echo -e "${GRAY}5. Verify runner shows 'online'${NC}"
