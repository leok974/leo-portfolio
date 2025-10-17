#!/bin/bash
# Portfolio Server Diagnostics - 10-Step Fast Path Check
# Run this on your production server to diagnose deployment issues

set -e

echo "════════════════════════════════════════════════════════════════"
echo "  🔍 PORTFOLIO SERVER DIAGNOSTICS"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

PASS="${GREEN}✅${NC}"
FAIL="${RED}❌${NC}"
WARN="${YELLOW}⚠️${NC}"

# Track failures
FAILURES=0

echo "${CYAN}═══ STEP 1: Is the Cloudflare Tunnel up? ═══${NC}"
echo ""
if docker ps --format "{{.Names}}" | grep -q cloudflared; then
    TUNNEL_CONTAINER=$(docker ps --format "{{.Names}}" | grep cloudflared | head -n1)
    echo "${PASS} Tunnel container found: $TUNNEL_CONTAINER"
    echo ""
    echo "Last 80 lines of tunnel logs:"
    docker logs $TUNNEL_CONTAINER --tail=80 | grep -E "Connection established|assistant\.ledger-mind\.org|error|ERR" || echo "(No critical messages)"
    echo ""
    if docker logs $TUNNEL_CONTAINER --tail=80 | grep -q "Connection established"; then
        echo "${PASS} Tunnel shows 'Connection established'"
    else
        echo "${FAIL} No 'Connection established' found in recent logs"
        ((FAILURES++))
    fi
else
    echo "${FAIL} No cloudflared container running"
    ((FAILURES++))
fi
echo ""

echo "${CYAN}═══ STEP 2: Is nginx healthy? ═══${NC}"
echo ""
NGINX_CONTAINER=$(docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -Ei "nginx|proxy" | grep -v "NAMES" | head -n1 | awk '{print $1}')
if [ -n "$NGINX_CONTAINER" ]; then
    echo "${PASS} Nginx container found: $NGINX_CONTAINER"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -Ei "nginx|proxy"
    echo ""
    echo "Last 100 lines of nginx logs:"
    docker logs $NGINX_CONTAINER --tail=100 | tail -n20
    echo ""

    # Check if healthy
    STATUS=$(docker ps --filter name=$NGINX_CONTAINER --format "{{.Status}}")
    if echo "$STATUS" | grep -q "healthy"; then
        echo "${PASS} Nginx is healthy"
    else
        echo "${WARN} Nginx status: $STATUS"
    fi
else
    echo "${FAIL} No nginx/proxy container running"
    ((FAILURES++))
fi
echo ""

echo "${CYAN}═══ STEP 3: Is the portfolio container running & healthy? ═══${NC}"
echo ""
if docker ps --format "{{.Names}}" | grep -q portfolio; then
    PORTFOLIO_CONTAINER=$(docker ps --format "{{.Names}}" | grep portfolio | head -n1)
    echo "${PASS} Portfolio container found: $PORTFOLIO_CONTAINER"
    docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | grep -i portfolio
    echo ""

    # Check health
    HEALTH=$(docker inspect $PORTFOLIO_CONTAINER --format='{{.State.Health.Status}}' 2>/dev/null || echo "no-healthcheck")
    if [ "$HEALTH" = "healthy" ]; then
        echo "${PASS} Portfolio health: $HEALTH"
    else
        echo "${WARN} Portfolio health: $HEALTH"
    fi
    echo ""

    echo "Last 100 lines of portfolio logs:"
    docker logs --tail=100 $PORTFOLIO_CONTAINER | tail -n20
else
    echo "${FAIL} No portfolio container running"
    ((FAILURES++))
fi
echo ""

echo "${CYAN}═══ STEP 4: Can nginx reach the upstream (portfolio.int:80)? ═══${NC}"
echo ""
if [ -n "$NGINX_CONTAINER" ] && docker ps --format "{{.Names}}" | grep -q portfolio; then
    echo "Testing: docker exec $NGINX_CONTAINER curl -sI http://portfolio.int:80/"
    RESPONSE=$(docker exec $NGINX_CONTAINER curl -sI http://portfolio.int:80/ 2>&1 | head -n1)
    echo "Response: $RESPONSE"
    echo ""

    if echo "$RESPONSE" | grep -q "200 OK"; then
        echo "${PASS} Nginx can reach portfolio.int:80 (HTTP 200 OK)"
    else
        echo "${FAIL} Nginx cannot reach portfolio.int:80"
        echo "     This means nginx can't resolve or connect to the portfolio container"
        echo "     Fix: Ensure both containers are on the same Docker network (e.g., infra_net)"
        ((FAILURES++))
    fi
else
    echo "${WARN} Skipping (nginx or portfolio not running)"
fi
echo ""

echo "${CYAN}═══ STEP 5: Can the host reach the container's exposed port? ═══${NC}"
echo ""
PORTFOLIO_PORT=$(docker ps --format "{{.Names}}\t{{.Ports}}" | grep portfolio | grep -oP '0\.0\.0\.0:\K[0-9]+' | head -n1)
if [ -n "$PORTFOLIO_PORT" ]; then
    echo "Portfolio exposed on host port: $PORTFOLIO_PORT"
    RESPONSE=$(curl -sI http://127.0.0.1:$PORTFOLIO_PORT/ 2>&1 | head -n1)
    echo "Response: $RESPONSE"
    echo ""

    if echo "$RESPONSE" | grep -q "200 OK"; then
        echo "${PASS} Host can reach portfolio on port $PORTFOLIO_PORT"
    else
        echo "${FAIL} Host cannot reach portfolio on port $PORTFOLIO_PORT"
        ((FAILURES++))
    fi
else
    echo "${WARN} Portfolio not exposing any host ports (may be using Docker network only)"
fi
echo ""

echo "${CYAN}═══ STEP 6: Confirm the correct image is running ═══${NC}"
echo ""
if docker ps --format "{{.Names}}" | grep -q portfolio; then
    IMAGE=$(docker inspect $PORTFOLIO_CONTAINER --format='{{.Config.Image}}')
    IMAGE_ID=$(docker inspect $PORTFOLIO_CONTAINER --format='{{.Image}}')
    echo "Image: $IMAGE"
    echo "Image ID: $IMAGE_ID"
    echo ""

    # Check if it's the expected image
    if echo "$IMAGE" | grep -q "ghcr.io/leok974/leo-portfolio/portfolio:latest"; then
        echo "${PASS} Running expected image: ghcr.io/leok974/leo-portfolio/portfolio:latest"
    else
        echo "${WARN} Not running expected image"
        echo "     Expected: ghcr.io/leok974/leo-portfolio/portfolio:latest"
        echo "     Actual: $IMAGE"
    fi

    # Check digest
    echo ""
    echo "Full image details:"
    docker inspect $PORTFOLIO_CONTAINER | grep -A5 "Image"
else
    echo "${WARN} No portfolio container to check"
fi
echo ""

echo "${CYAN}═══ STEP 7: Nginx upstream sanity (DNS resolution) ═══${NC}"
echo ""
if [ -n "$NGINX_CONTAINER" ]; then
    echo "Testing DNS resolution and connectivity from inside nginx:"
    docker exec $NGINX_CONTAINER sh -c '
        echo "DNS lookup for portfolio.int:"
        getent hosts portfolio.int || echo "  ❌ DNS resolution failed"
        echo ""
        echo "HTTP test:"
        curl -sI http://portfolio.int/ 2>&1 | head -n1
    '
    echo ""
else
    echo "${WARN} No nginx container to test"
fi
echo ""

echo "${CYAN}═══ STEP 8: Check Docker network configuration ═══${NC}"
echo ""
if docker ps --format "{{.Names}}" | grep -q portfolio; then
    PORTFOLIO_NETWORK=$(docker inspect $PORTFOLIO_CONTAINER --format='{{range $net, $config := .NetworkSettings.Networks}}{{$net}} {{end}}')
    echo "Portfolio networks: $PORTFOLIO_NETWORK"
fi
if [ -n "$NGINX_CONTAINER" ]; then
    NGINX_NETWORK=$(docker inspect $NGINX_CONTAINER --format='{{range $net, $config := .NetworkSettings.Networks}}{{$net}} {{end}}')
    echo "Nginx networks: $NGINX_NETWORK"
fi
echo ""
if [ -n "$PORTFOLIO_NETWORK" ] && [ -n "$NGINX_NETWORK" ]; then
    # Check if they share a network
    SHARED=0
    for net in $PORTFOLIO_NETWORK; do
        if echo "$NGINX_NETWORK" | grep -q "$net"; then
            echo "${PASS} Both containers share network: $net"
            SHARED=1
        fi
    done
    if [ $SHARED -eq 0 ]; then
        echo "${FAIL} Containers are NOT on the same network!"
        echo "     This will cause 502 errors"
        echo "     Fix: Add both to the same network (e.g., infra_net)"
        ((FAILURES++))
    fi
fi
echo ""

echo "${CYAN}═══ STEP 9: Check nginx configuration for portfolio route ═══${NC}"
echo ""
if [ -n "$NGINX_CONTAINER" ]; then
    echo "Checking nginx config for portfolio.int upstream:"
    docker exec $NGINX_CONTAINER sh -c 'cat /etc/nginx/conf.d/*.conf 2>/dev/null || cat /etc/nginx/nginx.conf' | grep -A5 -i "portfolio" || echo "  ⚠️  No portfolio config found in nginx"
fi
echo ""

echo "${CYAN}═══ STEP 10: Cloudflare Tunnel routing check ═══${NC}"
echo ""
if docker ps --format "{{.Names}}" | grep -q cloudflared; then
    echo "Checking tunnel config for assistant.ledger-mind.org:"
    docker exec $TUNNEL_CONTAINER sh -c 'cat /etc/cloudflared/config.yml 2>/dev/null || echo "Config not at standard location"' | grep -A10 -i "assistant.ledger-mind.org" || echo "  ⚠️  Route not found in config"
    echo ""
    echo "Recent tunnel logs for assistant.ledger-mind.org:"
    docker logs $TUNNEL_CONTAINER --tail=200 | grep -i "assistant.ledger-mind.org" | tail -n10 || echo "  (No recent logs for this hostname)"
fi
echo ""

echo "════════════════════════════════════════════════════════════════"
if [ $FAILURES -eq 0 ]; then
    echo "${GREEN}  ✅ ALL CHECKS PASSED!${NC}"
else
    echo "${RED}  ❌ $FAILURES CHECKS FAILED${NC}"
fi
echo "════════════════════════════════════════════════════════════════"
echo ""

echo "${CYAN}📋 QUICK FIX COMMANDS:${NC}"
echo ""
echo "If portfolio container is outdated:"
echo "  docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest"
echo "  docker stop portfolio-ui && docker rm portfolio-ui"
echo "  docker run -d --name portfolio-ui --restart unless-stopped \\"
echo "    --network infra_net -p 8089:80 \\"
echo "    ghcr.io/leok974/leo-portfolio/portfolio:latest"
echo ""
echo "If both containers need restart:"
echo "  docker restart portfolio-ui"
echo "  docker restart $NGINX_CONTAINER"
echo ""
echo "If network issue:"
echo "  docker network connect infra_net portfolio-ui"
echo "  docker restart portfolio-ui"
echo ""
echo "Check Watchtower logs:"
echo "  docker logs watchtower --tail=100"
echo ""

exit $FAILURES
