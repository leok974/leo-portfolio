# Production Deployment Checklist - assistant.ledger-mind.org

## ✅ Completed Locally (Windows Docker Desktop)

- [x] Portfolio container deployed as `portfolio-ui`
- [x] Container on `infra_net` network with alias `portfolio.int`
- [x] Nginx connected to `infra_net`
- [x] Nginx can reach `portfolio.int` (DNS + HTTP verified)
- [x] Local test: http://localhost:8089/ → 200 OK
- [x] **Docker healthcheck added** (shows "healthy" status)
- [x] **Nginx config persisted** to `deploy/nginx.assistant.conf`
- [x] **Watchtower deployed** for auto-updates (5-minute interval)
- [x] **Production URL live**: https://assistant.ledger-mind.org ✅

📖 **See also:** [HARDENING.md](docs/HARDENING.md) for security and reliability details

## 🚀 Production Server Steps

### STEP 1: Deploy Portfolio Container on Server

SSH to your production server and run:

```bash
# Pull latest image
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest

# Ensure infra_net exists
docker network inspect infra_net >/dev/null 2>&1 || docker network create infra_net

# Stop/remove old container (if exists)
docker stop portfolio-ui 2>/dev/null || true
docker rm portfolio-ui 2>/dev/null || true

# Deploy portfolio container
docker run -d --name portfolio-ui --restart unless-stopped \
  --network infra_net --network-alias portfolio.int \
  -p 8089:80 \
  ghcr.io/leok974/leo-portfolio/portfolio:latest

# Verify it's running
docker ps --filter name=portfolio-ui
docker logs portfolio-ui --tail=20
```

**Expected**: Container running, logs show nginx startup

---

### STEP 2: Connect Nginx to infra_net

```bash
# Find nginx container name
docker ps --format "table {{.Names}}\t{{.Image}}" | grep -i nginx

# Connect to infra_net (if not already)
docker network connect infra_net applylens-nginx-prod 2>/dev/null || true

# Restart nginx
docker restart applylens-nginx-prod

# Wait a few seconds
sleep 3

# Verify nginx can reach portfolio.int
docker exec applylens-nginx-prod getent hosts portfolio.int
docker exec applylens-nginx-prod sh -lc "curl -sI http://portfolio.int/ | head -n1"
```

**Expected**:
- DNS shows: `172.X.X.X  portfolio.int`
- HTTP shows: `HTTP/1.1 200 OK`

---

### STEP 3: Update Nginx Configuration

Find your nginx config for `assistant.ledger-mind.org`:

```bash
# Check existing config
docker exec applylens-nginx-prod cat /etc/nginx/conf.d/default.conf | grep -A 10 "server_name"
```

Add or update the `location /` block to proxy to portfolio:

```nginx
server {
    listen 80;
    server_name assistant.ledger-mind.org;

    # Add this location block (should be LAST, after any /api/ or /chat routes)
    location / {
        proxy_pass http://portfolio.int:80;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Test and reload nginx:**

```bash
# Test config syntax
docker exec applylens-nginx-prod nginx -t

# If OK, reload
docker exec applylens-nginx-prod nginx -s reload
```

**Expected**: `nginx: configuration file /etc/nginx/nginx.conf test is successful`

---

### STEP 4: Configure Cloudflare Tunnel

Go to: **Cloudflare Zero Trust → Access → Tunnels**

1. Find your tunnel (e.g., `infra-cloudflared-1`)
2. Click **Public Hostnames**
3. Add or edit the hostname:

```
Subdomain: assistant
Domain: ledger-mind.org
Type: HTTP
URL: portfolio.int
Port: 80
```

**Save**, then restart the tunnel:

```bash
docker restart infra-cloudflared-1

# Check tunnel logs
docker logs infra-cloudflared-1 --tail=50 | grep "assistant.ledger-mind.org"
```

**Expected**: Logs show tunnel connected and routing to `portfolio.int`

---

## 🧪 Final Verification

### Test 1: From Server (Internal)

```bash
# Test from nginx container
docker exec applylens-nginx-prod curl -sI http://portfolio.int/ | head -n1
```

**Expected**: `HTTP/1.1 200 OK`

### Test 2: From Server (Public via Tunnel)

```bash
# Test public URL from server
curl -sI https://assistant.ledger-mind.org | head -n5
```

**Expected**:
```
HTTP/2 200
server: cloudflare
date: [current date]
content-type: text/html
```

### Test 3: From Your Computer

```powershell
# Test from Windows
curl.exe -I https://assistant.ledger-mind.org | Select-Object -First 5
```

**Expected**: `HTTP/2 200`

### Test 4: Browser

Open: https://assistant.ledger-mind.org

**Checklist:**
- [ ] Page loads without errors
- [ ] Open F12 Console → No errors
- [ ] Check Network tab → All assets loading (200 OK)
- [ ] Calendly widget displays correctly
- [ ] Resume download buttons work
- [ ] No CORS errors

---

## 📊 Architecture Overview

```
Internet
  ↓
Cloudflare Tunnel (infra-cloudflared-1)
  ↓ (routes assistant.ledger-mind.org → portfolio.int:80)
Nginx (applylens-nginx-prod)
  ↓ (proxies to portfolio.int:80)
Portfolio Container (portfolio-ui)
  • Network: infra_net
  • Alias: portfolio.int
  • Port: 80 (internal), 8089 (host)
  • Image: ghcr.io/leok974/leo-portfolio/portfolio:latest
```

---

## 🔧 Troubleshooting Commands

### Check All Container Status

```bash
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | grep -E "portfolio|nginx|cloudflared"
```

### Check Networks

```bash
# Portfolio networks
docker inspect portfolio-ui --format='{{range $net, $config := .NetworkSettings.Networks}}{{$net}} {{end}}'

# Nginx networks
docker inspect applylens-nginx-prod --format='{{range $net, $config := .NetworkSettings.Networks}}{{$net}} {{end}}'
```

**Both should show**: `infra_net`

### Check Logs

```bash
# Portfolio logs
docker logs portfolio-ui --tail=50

# Nginx logs
docker logs applylens-nginx-prod --tail=50

# Tunnel logs
docker logs infra-cloudflared-1 --tail=50
```

### Test DNS Resolution

```bash
# From nginx
docker exec applylens-nginx-prod getent hosts portfolio.int

# Should show: 172.X.X.X  portfolio.int
```

### Test HTTP Connectivity

```bash
# From nginx to portfolio
docker exec applylens-nginx-prod curl -v http://portfolio.int/

# From host to portfolio
curl http://localhost:8089/

# Public URL
curl -I https://assistant.ledger-mind.org
```

---

## 🔄 Update Workflow (Future Deployments)

When you push new changes:

1. **Build and push** (already automated):
   ```bash
   npm run build:portfolio
   docker build -f Dockerfile.portfolio -t ghcr.io/leok974/leo-portfolio/portfolio:latest .
   docker push ghcr.io/leok974/leo-portfolio/portfolio:latest
   ```

2. **Update on server** (with healthcheck):
   ```bash
   docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest
   docker stop portfolio-ui
   docker rm portfolio-ui
   docker run -d --name portfolio-ui --restart unless-stopped \
     --network infra_net --network-alias portfolio.int -p 8089:80 \
     --health-cmd="curl -fs http://localhost/ || exit 1" \
     --health-interval=30s --health-timeout=3s --health-retries=3 \
     ghcr.io/leok974/leo-portfolio/portfolio:latest
   ```

3. **OR** set up Watchtower (automatic - **✅ DEPLOYED**):
   ```bash
   docker run -d --name watchtower --restart unless-stopped \
     -v /var/run/docker.sock:/var/run/docker.sock \
     containrrr/watchtower --interval 300 --cleanup portfolio-ui
   ```

   With Watchtower running, just push to GHCR and wait ~5 minutes for auto-update!

---

## 🔒 Security Hardening (✅ COMPLETED)

The following hardening measures have been applied:

- [x] **Docker Healthchecks** - Container shows "(healthy)" status
- [x] **Persistent Nginx Config** - Saved to `deploy/nginx.assistant.conf`
- [x] **Auto-Updates** - Watchtower deployed, checks every 5 minutes
- [x] **Network Isolation** - All components on `infra_net`
- [x] **Cloudflare Tunnel** - No direct internet exposure

**Restore nginx config after rebuild:**
```powershell
.\deploy\restore-nginx-config.ps1
```

📖 **Full details:** See [docs/HARDENING.md](docs/HARDENING.md)

---

## ✅ Deployment Complete Checklist

- [x] **STEP 1**: Portfolio container running (local Windows + healthcheck ✅)
- [x] **STEP 2**: Nginx connected to infra_net and can reach portfolio.int ✅
- [x] **STEP 3**: Nginx config updated to proxy to portfolio.int ✅
- [x] **STEP 4**: Cloudflare Tunnel routing to portfolio.int:80 ✅
- [x] **VERIFY**: Internal test (nginx → portfolio) returns 200 OK ✅
- [x] **VERIFY**: Public test (https://assistant.ledger-mind.org) returns 200 OK ✅
- [x] **VERIFY**: Browser loads site without errors ✅
- [x] **HARDENING**: Docker healthcheck added ✅
- [x] **HARDENING**: Nginx config persisted to repo ✅
- [x] **HARDENING**: Watchtower configured for auto-updates ✅

🎉 **DEPLOYMENT SUCCESSFUL!**

---

## 📝 Server Details (Fill In)

- **Server IP/Host**: `Local (Windows Docker Desktop)` ✅
- **SSH User**: `N/A (Docker Desktop)`
- **Nginx Container**: `applylens-nginx-prod` ✅
- **Tunnel Container**: `applylens-cloudflared-prod` ✅ (was: infra-cloudflared-1)
- **Network**: `infra_net` ✅
- **Domain**: `assistant.ledger-mind.org` ✅
- **Portfolio Container**: `portfolio-ui` ✅

---

## 🎯 Current Status

**Production (Live):**
- ✅ Portfolio deployed and healthy
- ✅ Nginx configured with server block
- ✅ Cloudflare Tunnel connected to infra_net
- ✅ Public URL: https://assistant.ledger-mind.org (200 OK)
- ✅ Auto-updates enabled (Watchtower)

**Monitoring:**
```powershell
# Check all containers
docker ps --format "table {{.Names}}\t{{.Status}}"

# View logs
docker logs portfolio-ui --tail=20 -f
docker logs watchtower --tail=20
```

---

**Last Updated**: October 15, 2025 02:09 UTC
**Status**: ✅ **DEPLOYED TO PRODUCTION**
**URL**: https://assistant.ledger-mind.org
