# Deploy Portfolio to leoklemet.com - Docker Method

**Status**: ✅ Image ready at `ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0`  
**Contains**: `main-D0fKNExd.js` (layout enabled, all fixes)  
**Current Live**: `main-QESHvkic.js` (old build)

---

## Quick Deploy via SSH

### Step 1: SSH to Production Server

```bash
ssh your-production-server
```

### Step 2: Pull New Image

```bash
# Pull the new portfolio image
docker pull ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0

# Or pull latest
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest
```

### Step 3: Stop and Remove Old Container

```bash
# Find the portfolio-ui container name
docker ps | grep portfolio-ui

# Stop it (replace container name as needed)
docker stop portfolio-ui
docker rm portfolio-ui
```

### Step 4: Start New Container

```bash
# Run the new image
docker run -d \
  --name portfolio-ui \
  --restart unless-stopped \
  --network infra_net \
  -p 80:80 \
  ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0

# Verify it's running
docker ps | grep portfolio-ui

# Check health
curl -s http://portfolio-ui:80/ | grep "main-"
# Should show: main-D0fKNExd.js
```

### Step 5: Verify Through Nginx

```bash
# Test through applylens-nginx-prod
docker exec applylens-nginx-prod wget -qO- http://portfolio-ui:80/ | grep "main-"
# Should show: main-D0fKNExd.js
```

### Step 6: Clear Cloudflare Cache

**From your local machine** (or server if you have CF_API_TOKEN set there):

```powershell
# Purge everything
$headers = @{ Authorization = "Bearer $env:CF_API_TOKEN" }
$zoneId = $env:CF_ZONE_ID

Invoke-RestMethod -Method Post -Headers $headers `
  -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/purge_cache" `
  -Body '{"purge_everything":true}' `
  -ContentType "application/json"
```

### Step 7: Verify Live

Wait 2-3 minutes, then:

```powershell
# Check production
curl.exe -k -s https://www.leoklemet.com/ | Select-String "main-D0fKNExd"

# Should see the script tag with new hash
```

---

## Alternative: Docker Compose Method

If your production uses docker-compose, create a `docker-compose.portfolio-ui.yml`:

```yaml
version: "3.9"

services:
  portfolio-ui:
    image: ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0
    container_name: portfolio-ui
    restart: unless-stopped
    networks:
      - infra_net
    ports:
      - "80:80"
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:80/ || exit 1"]
      interval: 30s
      timeout: 3s
      retries: 3

networks:
  infra_net:
    external: true
```

Then deploy:

```bash
# Deploy
docker-compose -f docker-compose.portfolio-ui.yml up -d

# Check logs
docker-compose -f docker-compose.portfolio-ui.yml logs -f

# Verify
curl -s http://portfolio-ui:80/ | grep "main-"
```

---

## Verification Commands

### Check Container is Running

```bash
docker ps | grep portfolio-ui
# Should show: ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0
```

### Check Files Inside Container

```bash
docker exec portfolio-ui ls -lh /usr/share/nginx/html/assets/main-*.js
# Should show: main-D0fKNExd.js
```

### Check What's Being Served

```bash
docker exec portfolio-ui cat /usr/share/nginx/html/index.html | grep "main-"
# Should show: main-D0fKNExd.js
```

### Test Direct Access

```bash
curl -s http://portfolio-ui:80/ | grep "main-"
# Expected: main-D0fKNExd.js
```

### Test Through Nginx Proxy

```bash
docker exec applylens-nginx-prod wget -qO- http://portfolio-ui:80/ | grep "main-"
# Expected: main-D0fKNExd.js
```

### Test Public URL (after cache clear)

```powershell
curl.exe -k -s https://www.leoklemet.com/ | Select-String '<script.*src="/assets/main-.*\.js"'
# Expected: main-D0fKNExd.js
```

---

## Rollback (If Needed)

If something goes wrong, you can rollback to the previous version:

```bash
# Find the old image tag (check docker images or your notes)
docker images | grep portfolio

# Run the old version
docker stop portfolio-ui
docker rm portfolio-ui
docker run -d \
  --name portfolio-ui \
  --restart unless-stopped \
  --network infra_net \
  -p 80:80 \
  ghcr.io/leok974/leo-portfolio/portfolio:old-tag
```

Or if you have the old container:

```bash
# List stopped containers
docker ps -a | grep portfolio-ui

# Start the old one
docker start <old-container-id>
```

---

## Image Details

### What's in v0.4.0

- ✅ Layout feature enabled (`VITE_LAYOUT_ENABLED=1`)
- ✅ Fixed Playwright tests (12/12 passing)
- ✅ All OG meta tags use `leoklemet.com` domain
- ✅ CSP nonces in place
- ✅ Bundle hash: `main-D0fKNExd.js`

### Previous Version

- Bundle hash: `main-QESHvkic.js` (currently live)
- Layout feature disabled
- Old meta tags

---

## Troubleshooting

### Issue: Can't Pull Image

**Error**: `unauthorized: authentication required`

**Solution**: Login to GitHub Container Registry first:

```bash
# Create a GitHub Personal Access Token with read:packages scope
# Then login
echo $GITHUB_TOKEN | docker login ghcr.io -u your-github-username --password-stdin
```

### Issue: Port 80 Already in Use

**Error**: `port is already allocated`

**Solution**: Check what's using port 80:

```bash
docker ps | grep ":80"
# Stop the conflicting container or use a different port
docker run -p 8080:80 ...  # Use 8080 instead
```

Then update nginx config to proxy to `portfolio-ui:8080` instead.

### Issue: Container Starts But Shows Old Files

**Cause**: Volume mount overriding image files

**Check**:
```bash
docker inspect portfolio-ui | grep -A 10 Mounts
```

**Solution**: Remove any volume mounts and restart:
```bash
docker run -d --name portfolio-ui \
  --network infra_net \
  -p 80:80 \
  ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0
  # No -v flags!
```

### Issue: Still Serving Old Hash After Deploy

**Possible causes**:
1. Cloudflare cache not cleared → Clear cache (see Step 6)
2. Browser cache → Hard refresh (Ctrl+Shift+R)
3. Container not actually updated → Check container logs

**Verify container**:
```bash
docker exec portfolio-ui cat /usr/share/nginx/html/index.html | grep "main-"
```

If it shows old hash, container wasn't updated properly.

---

## Post-Deployment Checklist

- [ ] Container running: `docker ps | grep portfolio-ui`
- [ ] Correct image: `ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0`
- [ ] Files inside container: `main-D0fKNExd.js`
- [ ] Direct access works: `curl http://portfolio-ui:80/`
- [ ] Through nginx proxy: Works from `applylens-nginx-prod`
- [ ] Cloudflare cache cleared
- [ ] Public URL updated: `https://www.leoklemet.com/`
- [ ] New hash visible: `main-D0fKNExd.js`
- [ ] Backend API works: `/agent/dev/status` returns JSON
- [ ] Layout feature works: Check assistant panel

---

## Summary

**What you have now**:
- ✅ Docker image built: `ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0`
- ✅ Image pushed to GitHub Container Registry
- ✅ Contains new build with layout enabled
- ✅ Ready to deploy to production

**To make it live**:
1. SSH to production server
2. Pull image: `docker pull ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0`
3. Stop old container: `docker stop portfolio-ui && docker rm portfolio-ui`
4. Start new container: `docker run -d --name portfolio-ui --network infra_net -p 80:80 ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0`
5. Clear Cloudflare cache
6. Verify: `curl.exe -k -s https://www.leoklemet.com/ | Select-String "main-D0fKNExd"`

**Time to live**: ~5 minutes (deploy container + cache propagation)

---

**Related Docs**:
- `FINALIZATION_COMPLETE_OCT17.md` - What changed in this release
- `DEPLOY_LEOKLEMET_COM.md` - Alternative deployment methods
- `CLOUDFLARE_CONFIG_COMPLETE.md` - Cache rules and troubleshooting
