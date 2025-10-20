# 🔴 Site Down - Diagnosis & Recovery Steps

**Date:** October 20, 2025 16:15 UTC
**Issue:** HTTP 530 error from Cloudflare (Origin server not responding)

---

## 🔍 Current Status

### ✅ What's Working
- ✅ DNS resolves correctly (104.21.48.10, 172.67.175.179)
- ✅ Cloudflare proxy is active (CF-RAY: 9919cfb6bb742419-IAD)
- ✅ Latest Docker image built successfully (workflow 18657678691 at 15:57 UTC)
- ✅ GitHub Actions workflows all passing

### ❌ What's Broken
- ❌ **HTTP 530 Error** - Cloudflare cannot reach your origin server
- ❌ Docker container not responding (or not running)
- ❌ Cloudflare Tunnel may be down

---

## 🚨 Root Cause: Docker Container Not Running

**Error Code:** HTTP 530 (Cloudflare error: origin unreachable)

This means one of:
1. **Docker container stopped/crashed** - Most likely
2. **Cloudflare Tunnel is down** - Check tunnel status
3. **Docker networking issue** - Container can't bind port
4. **Watchtower failed to pull** - New image not deployed

---

## 🔧 Recovery Steps (Prioritized)

### Step 1: Check Docker Container Status 🔴 **CRITICAL**

**SSH to your production server** and run:

```bash
# Check if portfolio container is running
docker ps | grep portfolio

# If not running, check stopped containers
docker ps -a | grep portfolio

# Check container logs
docker logs portfolio --tail 50

# Check Watchtower logs
docker logs watchtower --tail 50
```

**Expected:** Container `portfolio` should be running, healthy status

---

### Step 2: Check Cloudflare Tunnel Status

```bash
# If using cloudflared as a service
systemctl status cloudflared

# Or check Docker tunnel (if running in container)
docker ps | grep cloudflared

# Check tunnel logs
journalctl -u cloudflared -n 50
# OR
docker logs cloudflared --tail 50
```

**Expected:** Tunnel should be "connected" and routing traffic

---

### Step 3: Restart Docker Container

If container stopped, restart it:

```bash
# Option A: Restart existing container
docker restart portfolio

# Option B: Pull latest image and restart
docker compose -f /path/to/docker-compose.portfolio-image.yml pull
docker compose -f /path/to/docker-compose.portfolio-image.yml up -d

# Check health
docker ps
docker logs portfolio --tail 20
```

**Wait 30 seconds**, then test:
```bash
curl -I https://www.leoklemet.com
```

---

### Step 4: Manual Image Pull (If Watchtower Failed)

```bash
# Pull latest image manually
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest

# Verify digest matches workflow output
docker images ghcr.io/leok974/leo-portfolio/portfolio:latest

# Restart container
docker compose -f /path/to/docker-compose.portfolio-image.yml up -d --force-recreate
```

**Latest Image:**
- Workflow: 18657678691 (October 20, 2025 15:57 UTC)
- Includes: Fixed nginx `/api/` proxy configuration

---

### Step 5: Check Docker Networking

```bash
# Verify container is on correct network
docker network inspect web

# Verify container can reach internet (if needed for backend proxy)
docker exec portfolio curl -I https://assistant.ledger-mind.org

# Check nginx is running inside container
docker exec portfolio ps aux | grep nginx
```

---

### Step 6: Check Cloudflare Tunnel Configuration

In Cloudflare Dashboard → Zero Trust → Access → Tunnels:

1. Verify tunnel status is "Healthy" (green)
2. Check public hostname routes:
   - `www.leoklemet.com` → `http://portfolio:80` (or your Docker network)
   - `assistant.ledger-mind.org` → Same origin
3. Verify tunnel is routing to correct Docker container

**Common Issues:**
- Tunnel pointing to wrong container name
- Network mismatch between tunnel and container
- Tunnel connector crashed

---

## 🎯 Quick Recovery Commands

**If you just need the site back up quickly:**

```bash
# Emergency restart (one-liner)
docker restart portfolio && sleep 5 && curl -I https://www.leoklemet.com

# Nuclear option (recreate everything)
cd /path/to/compose/files
docker compose -f docker-compose.portfolio-image.yml down
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest
docker compose -f docker-compose.portfolio-image.yml up -d
docker logs portfolio -f
```

---

## 📊 Verification After Recovery

### 1. Test Site is Up
```bash
curl -I https://www.leoklemet.com
# Expected: HTTP/2 200 OK (not 530)
```

### 2. Test Backend Proxy (If Enabled)
```bash
curl https://www.leoklemet.com/api/ready
# Expected: {"status":"ok","timestamp":"..."}
```

### 3. Browser Test
1. Open https://www.leoklemet.com
2. Check browser console (F12) - no errors
3. Verify page loads correctly

---

## 🔍 Common Causes & Solutions

### Cause 1: Watchtower Didn't Pull New Image
**Symptoms:** Old image still running, new features missing
**Solution:**
```bash
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest
docker compose up -d --force-recreate
```

### Cause 2: Docker Out of Disk Space
**Symptoms:** Container crashes, "no space left on device"
**Solution:**
```bash
docker system df  # Check disk usage
docker system prune -af  # Clean up (WARNING: removes unused images)
```

### Cause 3: Nginx Config Error
**Symptoms:** Container starts but crashes immediately
**Solution:**
```bash
# Check nginx config syntax
docker run --rm ghcr.io/leok974/leo-portfolio/portfolio:latest nginx -t

# View nginx error logs
docker logs portfolio 2>&1 | grep nginx
```

### Cause 4: Port Already in Use
**Symptoms:** Container fails to start, "port already allocated"
**Solution:**
```bash
# Find process using port 80
netstat -tlnp | grep :80
# Kill conflicting process or change container port mapping
```

### Cause 5: Cloudflare Tunnel Crash/Restart
**Symptoms:** Tunnel shows "Unhealthy" in dashboard
**Solution:**
```bash
# Restart tunnel
systemctl restart cloudflared
# OR
docker restart cloudflared

# Check tunnel connection
cloudflared tunnel info
```

---

## 🚀 Prevention: Enable Monitoring

### Add Healthcheck Monitoring
```yaml
# In docker-compose.yml
services:
  portfolio:
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:80/"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
```

### Add Restart Policy
```yaml
services:
  portfolio:
    restart: unless-stopped  # Already configured ✅
```

### Enable Watchtower Notifications (Optional)
```yaml
services:
  watchtower:
    environment:
      - WATCHTOWER_NOTIFICATIONS=email
      - WATCHTOWER_NOTIFICATION_EMAIL_TO=your@email.com
```

---

## 📞 Emergency Contact Points

### Check Cloudflare Status
- https://www.cloudflarestatus.com/

### Check GitHub Container Registry
```bash
# Verify image exists
curl -s https://ghcr.io/v2/leok974/leo-portfolio/portfolio/tags/list
```

### Check GitHub Actions Status
```bash
gh run list --workflow=refresh-content.yml --limit 1
```

---

## 📝 After Recovery Checklist

- [ ] Site loads at https://www.leoklemet.com
- [ ] No 530 errors
- [ ] Docker container shows "healthy" status
- [ ] Cloudflare Tunnel shows "connected"
- [ ] Backend `/api/ready` responds (if enabled)
- [ ] Check nginx logs for errors
- [ ] Verify Watchtower is running
- [ ] Document what caused the outage

---

## 🔄 Next Steps After Site is Up

1. **Check Watchtower logs** - Why didn't it auto-update?
2. **Review container logs** - Look for crash patterns
3. **Monitor for 24 hours** - Ensure stability
4. **Set up alerting** - Get notified before users complain

---

**Status:** 🔴 **ACTION REQUIRED**
**Priority:** 🚨 **URGENT**

**First Command to Run:**
```bash
ssh your-server
docker ps | grep portfolio
```

If container isn't running, start with Step 3 (restart).

---

**Last Known Good State:**
- Workflow 18657678691 completed successfully at 15:57 UTC
- Docker image built and pushed to GHCR
- Site was accessible before image update (presumably)
