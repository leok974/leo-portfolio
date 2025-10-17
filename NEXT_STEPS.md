# Next Steps: Deploy Portfolio to Production Server

## Current Status ✅

- ✅ Portfolio image built and pushed to GHCR
  - Image: `ghcr.io/leok974/leo-portfolio/portfolio:latest`
  - Digest: `sha256:6725055310e66c163c8de146c72d9d33aa7d9c4f00b259537b47091e7e77bc9e`
- ✅ Tested locally on port 8090 (all smoke tests passing)
- ✅ Diagnostics scripts ready (`diagnose-server.sh`, `diagnose-server.ps1`)
- ✅ Documentation complete

## Production Deployment Options

You have **2 paths** for production deployment:

### Option A: Docker Image Deployment (Recommended) 🐳

This uses the containerized portfolio image you just built.

**Pros:**
- ✅ Auto-updates via Watchtower (every 5 minutes)
- ✅ Consistent with local testing
- ✅ Easy rollbacks
- ✅ Self-contained

**Cons:**
- Requires Docker on production server
- Need to configure Docker networking

### Option B: Static File Deployment 📁

This deploys the built files directly to nginx.

**Pros:**
- ✅ Simpler nginx configuration
- ✅ No Docker networking complexity
- ✅ Direct file serving (faster)

**Cons:**
- Manual updates required
- No automatic deployment

---

## 🚀 RECOMMENDED: Option A - Docker Image Deployment

### Step 1: Run Diagnostics on Production Server

First, check the current server state:

```bash
# Copy diagnostics script to server
scp deploy/diagnose-server.sh user@your-server:/tmp/

# SSH to server
ssh user@your-server

# Run diagnostics
chmod +x /tmp/diagnose-server.sh
bash /tmp/diagnose-server.sh
```

**Expected issues to fix:**
- Portfolio container not running → Deploy it!
- Network isolation → Connect to `infra_net`
- Wrong image → Pull latest from GHCR

### Step 2: Deploy Portfolio Container

On your production server:

```bash
# Pull the latest image from GHCR
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest

# Stop and remove old container (if exists)
docker stop portfolio-ui 2>/dev/null || true
docker rm portfolio-ui 2>/dev/null || true

# Run portfolio container
docker run -d \
  --name portfolio-ui \
  --restart unless-stopped \
  --network infra_net \
  --network-alias portfolio.int \
  -p 8089:80 \
  ghcr.io/leok974/leo-portfolio/portfolio:latest

# Verify it's running
docker ps | grep portfolio
docker logs portfolio-ui --tail=20
```

### Step 3: Update Nginx Configuration

Your nginx needs to route to `http://portfolio.int:80`.

**Check current nginx config:**
```bash
# Find your nginx container
docker ps | grep nginx

# Check config
docker exec <nginx-container> cat /etc/nginx/conf.d/default.conf | grep -A 5 "location /"
```

**Add portfolio route to nginx config:**
```nginx
# Add this AFTER /chat, /api routes but BEFORE any other location / block
location / {
    proxy_pass http://portfolio.int:80;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

**Reload nginx:**
```bash
docker exec <nginx-container> nginx -t  # Test config
docker exec <nginx-container> nginx -s reload  # Reload if OK
```

### Step 4: Update Cloudflare Tunnel (if needed)

Verify tunnel routes `assistant.ledger-mind.org` to your nginx:

```bash
# Check tunnel config
docker logs infra-cloudflared-1 --tail=100 | grep assistant.ledger-mind.org

# If not configured, update tunnel config and restart
docker restart infra-cloudflared-1
```

### Step 5: Run Diagnostics Again

```bash
bash /tmp/diagnose-server.sh
```

**All checks should pass:**
1. ✅ Cloudflare Tunnel connected
2. ✅ Nginx healthy
3. ✅ Portfolio container running
4. ✅ Nginx can reach portfolio.int:80
5. ✅ Correct image running
6. ✅ Containers on same network
7. ✅ DNS resolves portfolio.int
8. ✅ Nginx config has portfolio routes
9. ✅ Tunnel routes correctly

### Step 6: Test Production URL

```bash
# From server
curl -I https://assistant.ledger-mind.org

# Should return: HTTP/2 200
```

**From browser:**
1. Open: https://assistant.ledger-mind.org
2. Check console (F12) - no errors
3. Verify all assets load
4. Test Calendly widget
5. Test resume download buttons

### Step 7: Configure Watchtower (Auto-Updates)

If not already configured:

```bash
# Check if Watchtower is running
docker ps | grep watchtower

# If not, deploy it
docker run -d \
  --name watchtower \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  --interval 300 \
  --cleanup \
  portfolio-ui

# Check logs
docker logs watchtower --tail=50
```

**How Watchtower works:**
- Checks GHCR every 5 minutes
- Pulls new `:latest` tag if digest changed
- Automatically restarts container with new image
- No manual intervention needed!

---

## 📁 ALTERNATIVE: Option B - Static File Deployment

If you prefer traditional static file serving:

### Step 1: Build Portfolio

```powershell
# On your Windows machine
npm run build:portfolio
```

### Step 2: Deploy Files to Server

```powershell
# Using deployment script
.\deploy\deploy-to-server.ps1 -ServerHost your-server.com -ServerUser root

# Or manually
scp -r dist-portfolio/* user@your-server:/var/www/portfolio/
```

### Step 3: Configure Nginx

```bash
# Upload nginx config
scp deploy/nginx.assistant-server.conf user@your-server:/etc/nginx/sites-available/assistant.conf

# Enable and reload
sudo ln -sf /etc/nginx/sites-available/assistant.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 4: Test

```bash
# From server
curl -I http://127.0.0.1:8080/

# From browser
https://assistant.ledger-mind.org
```

**Future updates:**
- Rebuild: `npm run build:portfolio`
- Deploy: `.\deploy\deploy-to-server.ps1` or manual rsync

---

## 🎯 Recommended Flow Summary

**For Docker deployment (recommended):**

1. **Diagnose**: Run `diagnose-server.sh` on production
2. **Deploy container**: Pull and run portfolio image
3. **Configure nginx**: Add portfolio.int route
4. **Test**: Run diagnostics again, verify all ✅
5. **Verify**: Test https://assistant.ledger-mind.org in browser
6. **Enable auto-updates**: Configure Watchtower

**For static file deployment:**

1. **Build**: `npm run build:portfolio`
2. **Deploy**: `.\deploy\deploy-to-server.ps1`
3. **Verify**: Test in browser

---

## Common Issues & Solutions

### Issue: 502 Bad Gateway

**Cause:** Nginx can't reach portfolio container

**Fix:**
```bash
# Ensure same network
docker network connect infra_net portfolio-ui
docker restart portfolio-ui

# Verify connectivity
docker exec <nginx-container> curl -I http://portfolio.int:80/
```

### Issue: Wrong Image Running

**Fix:**
```bash
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest
docker stop portfolio-ui && docker rm portfolio-ui
# Re-run docker run command from Step 2
```

### Issue: Assets Not Loading (404s)

**Cause:** Wrong base path or CORS

**Fix:**
- Docker: Should work (same-origin via nginx proxy)
- Static: Verify nginx config has correct `root /var/www/portfolio;`

### Issue: Watchtower Not Updating

**Fix:**
```bash
# Check Watchtower logs
docker logs watchtower --tail=100

# Verify it's monitoring correct container
docker inspect watchtower | grep -A 5 portfolio-ui

# Restart Watchtower
docker restart watchtower
```

---

## Next Action

**Choose your path:**

- **Path A (Docker)**: Run `diagnose-server.sh` on your production server
- **Path B (Static)**: Run `.\deploy\deploy-to-server.ps1` from Windows

**Need help deciding?**
- Use **Docker** if you want automatic updates and consistency
- Use **Static** if you want simplicity and direct nginx serving

---

## Documentation References

- **Complete Guide**: `DEPLOY_IMAGE.md` (400+ lines)
- **Quick Reference**: `QUICK_DEPLOY_REFERENCE.md`
- **Server Deployment**: `DEPLOY_TO_SERVER.md`
- **Diagnostics Guide**: `deploy/DIAGNOSTICS_QUICKREF.md`
- **Nginx Config Example**: `deploy/nginx.portfolio-reverse-proxy.conf`

---

## Support Commands

**Check container status:**
```bash
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
```

**Check container logs:**
```bash
docker logs portfolio-ui --tail=100 -f
```

**Check nginx logs:**
```bash
docker logs <nginx-container> --tail=100 -f
```

**Test connectivity:**
```bash
docker exec <nginx-container> curl -I http://portfolio.int:80/
```

**Verify image digest:**
```bash
docker inspect portfolio-ui --format='{{.Image}}'
```

---

## Success Criteria

✅ **Deployment is successful when:**

1. `diagnose-server.sh` shows all 10 checks passing (or all relevant checks for your setup)
2. `https://assistant.ledger-mind.org` loads without errors
3. Browser console (F12) shows no errors
4. All assets load (check Network tab)
5. Calendly widget displays correctly
6. Resume download buttons work (if enabled)
7. Chat/API routes work (if layout enabled)

🎉 **You're done!**

Future updates happen automatically via Watchtower (Docker) or manual deploy (Static).
