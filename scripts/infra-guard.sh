#!/usr/bin/env bash
# Infrastructure guard script for local verification
# Ensures Docker + Cloudflare Tunnel deployment is configured correctly

set -euo pipefail

echo "🔍 Verifying production infrastructure..."
echo ""

# 1. Check cloudflared is connected to infra_net
echo "1️⃣  Checking cloudflared network connectivity..."
if docker network inspect infra_net | grep -q applylens-cloudflared-prod; then
  echo "   ✅ cloudflared is on infra_net"
else
  echo "   ⚠️  cloudflared NOT on infra_net - connecting now..."
  docker network connect infra_net applylens-cloudflared-prod
  echo "   ✅ Connected cloudflared to infra_net"
fi

# 2. Check portfolio-nginx is on infra_net
echo "2️⃣  Checking portfolio-nginx network connectivity..."
if docker inspect portfolio-nginx --format '{{json .NetworkSettings.Networks}}' | grep -q infra_net; then
  echo "   ✅ portfolio-nginx is on infra_net"
else
  echo "   ❌ portfolio-nginx NOT on infra_net - check docker-compose.portfolio-prod.yml"
  exit 1
fi

# 3. Check portfolio.int DNS alias
echo "3️⃣  Checking portfolio.int DNS alias..."
ALIASES=$(docker inspect portfolio-nginx --format '{{range $n,$c:=.NetworkSettings.Networks}}{{if eq $n "infra_net"}}{{println (join $c.Aliases ",")}}{{end}}{{end}}')
if echo "$ALIASES" | grep -q 'portfolio.int'; then
  echo "   ✅ portfolio.int alias configured"
else
  echo "   ❌ portfolio.int alias MISSING - check docker-compose.portfolio-prod.yml networks section"
  exit 1
fi

# 4. Test DNS resolution from cloudflared
echo "4️⃣  Testing DNS resolution from cloudflared..."
if docker exec applylens-cloudflared-prod getent hosts portfolio.int > /dev/null 2>&1; then
  IP=$(docker exec applylens-cloudflared-prod getent hosts portfolio.int | awk '{print $1}')
  echo "   ✅ cloudflared can resolve portfolio.int -> $IP"
else
  echo "   ❌ cloudflared CANNOT resolve portfolio.int"
  exit 1
fi

# 5. Check production site headers
echo "5️⃣  Checking production site headers..."
HEADERS=$(curl -sSI https://www.leoklemet.com | tr -d '\r')
echo "$HEADERS" | sed -n '1,12p' | sed 's/^/   /'

if echo "$HEADERS" | grep -qi '^server: cloudflare'; then
  echo "   ✅ Server: cloudflare header present"
else
  echo "   ❌ Missing Cloudflare server header"
  exit 1
fi

if echo "$HEADERS" | grep -qi '^x-config:'; then
  CONFIG=$(echo "$HEADERS" | grep -i '^x-config:' | cut -d: -f2 | xargs)
  echo "   ✅ Nginx x-config header: $CONFIG"
else
  echo "   ❌ Missing nginx x-config header"
  exit 1
fi

if echo "$HEADERS" | grep -qi 'github'; then
  echo "   ❌ Headers contain 'github' - GitHub Pages may be active!"
  exit 1
fi

if echo "$HEADERS" | grep -qi '^http/.* 200 '; then
  echo "   ✅ Site returns 200 OK"
else
  echo "   ❌ Site not returning 200 OK"
  exit 1
fi

echo ""
echo "✅ Infrastructure verification PASSED"
echo "   Production is correctly deployed via Docker + Cloudflare Tunnel"
echo "   Site: https://www.leoklemet.com"
echo "   Origin: Cloudflare → portfolio.int:80 → portfolio-nginx container"
