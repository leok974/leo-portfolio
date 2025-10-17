#!/bin/bash
# Production Deployment Script - Run on Production Server
# Generated: October 17, 2024
# Purpose: Deploy portfolio v0.4.0 with Watchtower auto-update

set -e  # Exit on any error

echo "🚀 Starting Portfolio Deployment v0.4.0"
echo "========================================"
echo ""

# Step 1: Create deployment directory
echo "📁 Step 1: Creating deployment directory..."
mkdir -p ~/leo-portfolio
cd ~/leo-portfolio
echo "✓ Directory created: $(pwd)"
echo ""

# Step 2: Download docker-compose configuration
echo "⬇️  Step 2: Downloading Watchtower configuration..."
curl -fsSLO https://raw.githubusercontent.com/leok974/leo-portfolio/portfolio-polish/deploy/docker-compose.portfolio-ui.yml
echo "✓ Downloaded docker-compose.portfolio-ui.yml"
echo ""

# Step 3: Verify download
echo "🔍 Step 3: Verifying download..."
ls -lh docker-compose.portfolio-ui.yml
echo ""
echo "File preview:"
head -10 docker-compose.portfolio-ui.yml
echo ""

# Step 4: Pull Docker image (optional - compose will do this, but good to verify access)
echo "🐳 Step 4: Pulling Docker image..."
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest
echo "✓ Image pulled successfully"
echo ""

# Step 5: Start services
echo "▶️  Step 5: Starting portfolio-ui and watchtower..."
docker compose -f docker-compose.portfolio-ui.yml up -d
echo "✓ Services started"
echo ""

# Step 6: Wait for containers to initialize
echo "⏳ Waiting 5 seconds for containers to initialize..."
sleep 5
echo ""

# Step 7: Verify containers are running
echo "✅ Step 6: Verifying containers..."
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep -E 'NAMES|portfolio-ui|watchtower'
echo ""

# Step 8: Check portfolio-ui logs
echo "📋 Portfolio-UI Logs (last 10 lines):"
docker logs portfolio-ui --tail 10
echo ""

# Step 9: Check watchtower logs
echo "📋 Watchtower Logs (last 10 lines):"
docker logs watchtower --tail 10
echo ""

# Step 10: Test direct container access
echo "🧪 Step 7: Testing direct container access..."
HASH=$(curl -s http://localhost:8089/ | grep -oE 'main-[A-Za-z0-9_-]+\.js' | head -1)
if [ -n "$HASH" ]; then
    echo "✓ Container is serving: $HASH"
    if [ "$HASH" = "main-D0fKNExd.js" ]; then
        echo "✓ ✓ CORRECT HASH! Deployment successful!"
    else
        echo "⚠️  Hash is different than expected (main-D0fKNExd.js)"
    fi
else
    echo "❌ Could not retrieve hash from container"
fi
echo ""

# Step 11: Check container health
echo "🏥 Step 8: Checking container health..."
HEALTH=$(docker inspect portfolio-ui --format='{{.State.Health.Status}}' 2>/dev/null || echo "no-healthcheck")
echo "Health status: $HEALTH"
echo ""

echo "========================================"
echo "✅ Deployment script completed!"
echo ""
echo "Next steps:"
echo "1. Update nginx to proxy to http://portfolio.int:80"
echo "2. Reload nginx: docker exec applylens-nginx-prod nginx -s reload"
echo "3. Purge Cloudflare cache"
echo "4. Verify: curl -s https://leoklemet.com/ | grep -oE 'main-[A-Za-z0-9_-]+\.js'"
echo ""
echo "🎉 After nginx update, your site will be live with automated deployments!"
