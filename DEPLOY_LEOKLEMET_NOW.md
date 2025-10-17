# Deploy Portfolio to leoklemet.com

**Status**: Ready for deployment with one-liner
**Date**: October 17, 2025

## 🚀 Quick start (server)

Print the one-liner command to run on your server:

```bash
pnpm run deploy:server:print
```

Or use make:

```bash
make deploy-server-print
```

Copy the output and run it on your production server via SSH.

---

## ✅ What's Ready

1. **Docker image**: `ghcr.io/leok974/leo-portfolio/portfolio:latest` (publicly accessible)
2. **Compose file**: Optimized with healthcheck and proper network configuration
3. **Nginx routing**: Already configured on server (`applylens-nginx-prod`)
4. **Network**: `infra_net` external network (shared with nginx, cloudflared, backend)
5. **Cloudflare**: DNS and cache rules already configured
6. **Watchtower**: Auto-update every 60 seconds when new images are pushed

## � Manual Deployment Steps (if needed)

**How to access your server**: You need to tell me! Options:
- `ssh root@<YOUR_SERVER_IP>`
- `ssh -i <key_file> user@<YOUR_SERVER_IP>`
- Cloud provider console (DigitalOcean, Vultr, AWS, etc.)

### Step 1: Deploy Portfolio + Watchtower

```bash
# Create directory and download compose file
mkdir -p ~/leo-portfolio && cd ~/leo-portfolio
curl -fsSLO https://raw.githubusercontent.com/leok974/leo-portfolio/portfolio-polish/deploy/docker-compose.portfolio-ui.yml

# Start containers (pulls image automatically)
docker compose -f docker-compose.portfolio-ui.yml up -d
```

**Expected output**:
```
[+] Running 3/3
 ✔ Network infra_net        Created
 ✔ Container portfolio-ui   Started
 ✔ Container watchtower     Started
```

### Step 2: Verify Deployment

```bash
# Check containers running
docker ps | grep -E 'portfolio-ui|watchtower'

# Should show:
# portfolio-ui    ... Up ... (healthy) ... 0.0.0.0:8089->80/tcp
# watchtower      ... Up ...

# Check portfolio-ui is in infra_net
docker network inspect infra_net | grep -A5 portfolio-ui

# Test through nginx (should show new hash)
docker exec applylens-nginx-prod curl -s http://portfolio-ui/ | grep -oE 'main-[A-Za-z0-9_-]+\.js'

# Expected: main-D0fKNExd.js
```

### Step 3: Check Logs

```bash
# Portfolio logs
docker logs portfolio-ui --tail 20

# Watchtower logs
docker logs watchtower --tail 20

# Should see watchtower polling every 60 seconds
```

## 📋 After Deployment

### 1. Verify containers and nginx routing

```bash
# On server - check containers
docker compose -f docker-compose.portfolio-ui.yml ps
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep -E 'portfolio-ui|watchtower'

# Test nginx can reach portfolio-ui
docker exec applylens-nginx-prod curl -sI http://portfolio-ui | head -5
```

### 2. Check which JS bundle is live (from your local machine)

```bash
curl -s https://leoklemet.com/ | grep -oE 'main-[A-Za-z0-9_-]+\.js' | head -1
```

### 3. Purge Cloudflare cache (optional, but makes update instant)

**Option A: Via API** (requires CF_API_TOKEN + CF_ZONE_ID)

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

**Option B: Via Dashboard**
1. Go to https://dash.cloudflare.com
2. Select `leoklemet.com` zone
3. **Caching** → **Configuration** → **Purge Everything**

### 4. Verify new hash is live

```bash
# Wait 30 seconds after cache purge, then:
curl -s https://leoklemet.com/ | grep -oE 'main-[A-Za-z0-9_-]+\.js' | head -1
# Should show: main-D0fKNExd.js (or newer)
```

## 🤖 Test Automated Deployment

Watchtower now checks every 60 seconds. Test the full pipeline:

### 1. Make a small change

```bash
echo "// Test automated deployment" >> apps/portfolio-ui/src/main.tsx
git add .
git commit -m "test: verify automated deployment pipeline"
git push origin main
```

### 2. Watch GitHub Actions

Go to: https://github.com/leok974/leo-portfolio/actions

Wait ~2-3 minutes for build + push.

### 3. Watch Watchtower (on server)

```bash
docker logs -f watchtower
# Should see within 60 seconds:
# - "Found new image"
# - "Stopping /portfolio-ui"
# - "Starting /portfolio-ui"
```

### 4. Verify new version live (~3-4 min after push)

```bash
curl -s https://leoklemet.com/ | grep -oE 'main-[A-Za-z0-9_-]+\.js'
# Hash should be different now
```

## 🔍 Infrastructure Overview

```
Cloudflare Tunnel (db56892d-4879-4263-99bf-202d46b6aff9)
    ↓
applylens-nginx-prod (port 80, in infra_net)
    ├─ leoklemet.com → 301 → www.leoklemet.com
    ├─ www.leoklemet.com/       → portfolio-ui:80
    ├─ www.leoklemet.com/agent/* → ai-finance-backend-1:8000
    ├─ www.leoklemet.com/api/*   → ai-finance-backend-1:8000
    └─ assistant.ledger-mind.org → (other services)

Containers in infra_net:
- applylens-nginx-prod
- ai-finance-backend-1
- portfolio-ui (NEW)
- watchtower (NEW)
- cloudflared
- infra-ollama-1
```

## ❓ Questions for You

1. **What's your SSH command to access the server?**
   - Example: `ssh root@your-server.com`
   - Or: "I use DigitalOcean console"

2. **Do you want me to set up automated deployment?**
   - Option A: GitHub Actions → Server (via self-hosted runner or webhook)
   - Option B: Just use Watchtower (already included, pulls every 60 seconds)

## 🎯 Current Status

- ✅ Docker compose file syntax fixed
- ✅ Pushed to GitHub
- ⏳ **WAITING**: You need to run the deployment commands on your server
- ⏳ Then: Cloudflare cache purge
- ⏳ Then: Verify live site

**Ready to deploy?** Tell me how you access your server, or just run the commands above and let me know the output!
