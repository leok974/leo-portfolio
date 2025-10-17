# Production Deployment - Copy-Paste Commands

## Quick Deploy (All-in-One)

SSH to your production server and run this single command:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/leok974/leo-portfolio/portfolio-polish/deploy-to-production.sh)
```

---

## Or Run Step-by-Step

### 1. Create Directory & Download Config

```bash
mkdir -p ~/leo-portfolio && cd ~/leo-portfolio
curl -fsSLO https://raw.githubusercontent.com/leok974/leo-portfolio/portfolio-polish/deploy/docker-compose.portfolio-ui.yml
```

### 2. Start Services

```bash
docker compose -f docker-compose.portfolio-ui.yml up -d
```

### 3. Verify Running

```bash
docker ps | grep -E 'portfolio-ui|watchtower'
docker logs portfolio-ui --tail 10
docker logs watchtower --tail 10
curl -s http://localhost:8089/ | grep -oE 'main-[A-Za-z0-9_-]+\.js'
```

**Expected output**: `main-D0fKNExd.js`

---

## After Containers Are Running

### 4. Update Nginx (if needed)

Check if nginx already proxies to portfolio-ui:

```bash
docker exec applylens-nginx-prod cat /etc/nginx/conf.d/default.conf | grep -A5 "location /"
```

If not configured, you'll need to edit nginx config to proxy to `http://portfolio.int:80` and reload:

```bash
docker exec applylens-nginx-prod nginx -t
docker exec applylens-nginx-prod nginx -s reload
```

### 5. Purge Cloudflare Cache

**Option A - Using API** (from local machine):

```powershell
# PowerShell
$headers = @{ Authorization = "Bearer $env:CF_API_TOKEN" }
Invoke-RestMethod -Method Post -Headers $headers `
  -Uri "https://api.cloudflare.com/client/v4/zones/$env:CF_ZONE_ID/purge_cache" `
  -Body '{"purge_everything":true}' -ContentType "application/json"
```

**Option B - Cloudflare Dashboard**:
1. Go to https://dash.cloudflare.com/
2. Select leoklemet.com
3. Caching > Purge Everything

### 6. Verify Live Site

Wait 2-3 minutes after cache purge, then:

```powershell
# From local machine
curl.exe -s https://leoklemet.com/ | Select-String 'main-[A-Za-z0-9_-]+\.js'
```

**Expected**: `main-D0fKNExd.js` (or newer)

---

## Verification Checklist

Run these on the production server:

```bash
# Container status
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'portfolio-ui|watchtower'

# Health check
docker inspect portfolio-ui --format='{{.State.Health.Status}}'

# What's being served
curl -s http://localhost:8089/ | grep -oE 'main-[A-Za-z0-9_-]+\.js'

# Watchtower is monitoring
docker logs watchtower --tail 5 | grep -E 'interval|Watching'
```

---

## Troubleshooting

### If containers won't start:

```bash
# Check logs
docker logs portfolio-ui
docker logs watchtower

# Check if network exists
docker network ls | grep infra_net

# If network doesn't exist, create it:
docker network create infra_net

# Restart
docker compose -f ~/leo-portfolio/docker-compose.portfolio-ui.yml restart
```

### If old hash still showing:

```bash
# Force pull new image
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest

# Recreate container
docker stop portfolio-ui && docker rm portfolio-ui
docker compose -f ~/leo-portfolio/docker-compose.portfolio-ui.yml up -d portfolio-ui
```

---

## Success Criteria

✅ **Deployment is successful when**:
- [ ] `portfolio-ui` and `watchtower` containers running
- [ ] `curl http://localhost:8089/` returns `main-D0fKNExd.js`
- [ ] Watchtower logs show "Using a 60 second interval"
- [ ] `https://leoklemet.com/` serves new hash (after nginx update + cache purge)

---

**Next**: After deployment succeeds, test automated deployment by pushing a small change to main!
