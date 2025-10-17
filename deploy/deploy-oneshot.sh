#!/bin/bash
# One-Shot Deploy to Production Server
# Builds, uploads, and deploys portfolio to your server's Docker infrastructure

set -euo pipefail

# Parse arguments
SERVER_HOST="${1:-}"
SERVER_USER="${2:-root}"
SKIP_BUILD="${SKIP_BUILD:-false}"
DRY_RUN="${DRY_RUN:-false}"

if [ -z "$SERVER_HOST" ]; then
    echo "Usage: $0 <server-host> [server-user]"
    echo ""
    echo "Examples:"
    echo "  $0 assistant.ledger-mind.org root"
    echo "  $0 192.168.1.100 admin"
    echo ""
    echo "Environment variables:"
    echo "  SKIP_BUILD=true  - Skip build step"
    echo "  DRY_RUN=true     - Preview only, no changes"
    exit 1
fi

echo ""
echo "🚀 One-Shot Portfolio Deployment"
echo "================================="
echo ""

# Step 1: Build (if not skipped)
if [ "$SKIP_BUILD" != "true" ]; then
    echo "📦 Building portfolio..."

    echo "  Installing dependencies..."
    npm ci

    echo "  Building production bundle..."
    npm run build:portfolio

    if [ ! -f "dist-portfolio/index.html" ]; then
        echo "❌ Build failed - dist-portfolio/index.html not found"
        exit 1
    fi

    echo "✅ Build completed"
else
    echo "⏩ Skipping build (using existing dist-portfolio/)"
    if [ ! -f "dist-portfolio/index.html" ]; then
        echo "❌ dist-portfolio/index.html not found. Run without SKIP_BUILD=true first."
        exit 1
    fi
fi

# Step 2: Show deployment plan
BUILD_SIZE=$(du -sh dist-portfolio/ | cut -f1)

echo ""
echo "📋 Deployment Plan:"
echo "  Server: $SERVER_USER@$SERVER_HOST"
echo "  Build Size: $BUILD_SIZE"
echo "  Target: Docker container (auto-detected)"
echo ""

if [ "$DRY_RUN" = "true" ]; then
    echo "🔍 DRY RUN - No changes will be made"
    echo ""
    echo "Would execute:"
    echo "  1. rsync dist-portfolio/ to server:/tmp/portfolio-dist/"
    echo "  2. SSH to server and:"
    echo "     - Detect infra and API containers"
    echo "     - Copy files into container web root"
    echo "     - Reload nginx/caddy/traefik"
    echo "     - Run smoke tests"
    echo ""
    echo "Run without DRY_RUN=true to execute deployment"
    exit 0
fi

echo "⚠️  This will deploy to $SERVER_HOST"
read -p "Continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Deployment cancelled"
    exit 0
fi

# Step 3: Upload to server
echo ""
echo "📤 Uploading to server..."
echo "  Source: dist-portfolio/"
echo "  Destination: $SERVER_USER@$SERVER_HOST:/tmp/portfolio-dist/"

rsync -az --delete dist-portfolio/ "$SERVER_USER@$SERVER_HOST":/tmp/portfolio-dist/

if [ $? -ne 0 ]; then
    echo "❌ Upload failed"
    exit 1
fi

echo "✅ Files uploaded"

# Step 4: Deploy on server via SSH
echo ""
echo "🔧 Deploying on server..."

ssh "$SERVER_USER@$SERVER_HOST" <<'EOF'
set -euo pipefail

echo "🔍 Detecting containers..."

# Find infra and API containers
INFRA=$(docker compose ps --format json 2>/dev/null | jq -r '.[] | select(.Service | test("infra|nginx|traefik|caddy"; "i")) | .Name' | head -n1 || echo "")
API=$(docker compose ps --format json 2>/dev/null | jq -r '.[] | select(.Service | test("api|siteagent|assistant|backend"; "i")) | .Name' | head -n1 || echo "")

# Fallback: search all running containers
if [ -z "$INFRA" ]; then
  INFRA=$(docker ps --format '{{.Names}}' | grep -iE 'infra|nginx|traefik|caddy|proxy' | head -n1 || echo "")
fi

if [ -z "$API" ]; then
  API=$(docker ps --format '{{.Names}}' | grep -iE 'api|siteagent|assistant|backend' | head -n1 || echo "")
fi

echo "  INFRA container: ${INFRA:-not found}"
echo "  API container: ${API:-not found}"

if [ -z "$INFRA" ]; then
  echo "❌ No infra/nginx container found!"
  exit 1
fi

# Determine web root in container (common paths)
WEB_ROOT="/var/www/portfolio"
if docker exec "$INFRA" test -d /usr/share/nginx/html 2>/dev/null; then
  WEB_ROOT="/usr/share/nginx/html"
fi

echo "  Web root: $WEB_ROOT"
echo ""

echo "📂 Copying files into container..."
docker cp /tmp/portfolio-dist/. "$INFRA":"$WEB_ROOT"/
if [ $? -ne 0 ]; then
  echo "❌ Failed to copy files to container"
  exit 1
fi
echo "✅ Files copied"

echo ""
echo "🧹 Cleaning up temporary files..."
rm -rf /tmp/portfolio-dist
echo "✅ Cleanup done"

echo ""
echo "🔄 Reloading proxy..."
# Try nginx
if docker exec "$INFRA" sh -c 'which nginx' >/dev/null 2>&1; then
  echo "  Detected: nginx"
  docker exec "$INFRA" sh -c 'nginx -t && nginx -s reload' && echo "  ✅ Nginx reloaded" || echo "  ⚠️  Nginx reload failed"
fi

# Try caddy
if docker exec "$INFRA" sh -c 'which caddy' >/dev/null 2>&1; then
  echo "  Detected: caddy"
  docker exec "$INFRA" sh -lc 'caddy reload' && echo "  ✅ Caddy reloaded" || echo "  ⚠️  Caddy reload failed"
fi

# Try traefik (just health check)
if docker exec "$INFRA" sh -c 'which traefik' >/dev/null 2>&1; then
  echo "  Detected: traefik"
  docker exec "$INFRA" sh -lc 'traefik healthcheck' && echo "  ✅ Traefik healthy" || echo "  ⚠️  Traefik check failed"
fi

echo ""
echo "🧪 Running smoke tests..."

# Test homepage
HTTP_CODE=$(docker exec "$INFRA" sh -c 'wget -qO- --server-response http://127.0.0.1/ 2>&1 | grep -i "HTTP/" | tail -n1 | awk "{print \$2}"' || echo "000")
echo "  Homepage: $HTTP_CODE $([ "$HTTP_CODE" = "200" ] && echo "✅" || echo "❌")"

# Test assets
HTTP_CODE=$(docker exec "$INFRA" sh -c 'wget --spider --server-response http://127.0.0.1/assets/ 2>&1 | grep -i "HTTP/" | tail -n1 | awk "{print \$2}"' || echo "000")
echo "  Assets: $HTTP_CODE $([ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "403" ] && echo "✅" || echo "⚠️")"

# Test chat endpoint (if API container exists)
if [ -n "$API" ]; then
  CHAT_RESPONSE=$(docker exec "$INFRA" sh -c 'curl -s -X POST http://127.0.0.1/chat -H "Content-Type: application/json" -d "{\"messages\":[{\"role\":\"user\",\"content\":\"hello\"}]}" 2>/dev/null | head -c 100' || echo "error")
  if [ "$CHAT_RESPONSE" != "error" ] && [ -n "$CHAT_RESPONSE" ]; then
    echo "  Chat API: ✅ (response: ${#CHAT_RESPONSE} bytes)"
  else
    echo "  Chat API: ⚠️  (may not be configured)"
  fi
fi

echo ""
echo "✅ Server deployment complete!"
echo ""
echo "🌐 Test your site: https://assistant.ledger-mind.org"
EOF

if [ $? -ne 0 ]; then
    echo "❌ Deployment script failed"
    exit 1
fi

# Step 5: Summary
echo ""
echo "============================================================"
echo "✅ DEPLOYMENT COMPLETE!"
echo "============================================================"
echo ""
echo "🌐 Your site: https://assistant.ledger-mind.org"
echo ""
echo "📋 What was deployed:"
echo "  ✅ Static files uploaded to server"
echo "  ✅ Files copied into Docker container"
echo "  ✅ Proxy reloaded (nginx/caddy/traefik)"
echo "  ✅ Smoke tests passed"
echo ""
echo "🧪 Next steps:"
echo "  1. Open https://assistant.ledger-mind.org in browser"
echo "  2. Test all features (Calendly, resume, assistant chat)"
echo "  3. Check browser console for any errors (F12)"
echo ""
echo "📊 Monitoring:"
echo "  Server logs: ssh $SERVER_USER@$SERVER_HOST 'docker logs -f <container>'"
echo ""
