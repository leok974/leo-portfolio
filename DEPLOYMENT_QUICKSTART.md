# Production Deployment Quickstart

**One-time setup**: 15-30 minutes
**Future deploys**: Just `git push` (3-4 min automated)

---

## Prerequisites

- ✅ Docker image built: `ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0`
- ✅ GitHub Actions workflow: `.github/workflows/deploy-docker.yml`
- ✅ Watchtower config: `deploy/docker-compose.portfolio-ui.yml`
- ⏳ SSH access to production server (last time!)

---

## One-Time Server Setup (SSH Once)

### 1. SSH to Production

```bash
ssh your-production-server
```

### 2. Create Deploy Directory & Download Compose

```bash
mkdir -p ~/leo-portfolio && cd ~/leo-portfolio
curl -fsSLO https://raw.githubusercontent.com/leok974/leo-portfolio/portfolio-polish/deploy/docker-compose.portfolio-ui.yml
```

### 3. Login to GHCR (if repo is private)

```bash
# Skip this if your image is public
echo $GITHUB_TOKEN | docker login ghcr.io -u leok974 --password-stdin
```

### 4. Start Services

```bash
docker compose -f docker-compose.portfolio-ui.yml up -d
```

**This starts**:
- `portfolio-ui` from `ghcr.io/leok974/leo-portfolio/portfolio:latest`
- `watchtower` that checks every 60s for new `:latest` and auto-restarts

### 5. Update Nginx Config

Point nginx to the new `portfolio-ui` container:

```nginx
# In your nginx config
location / {
    proxy_pass http://portfolio.int:80;
    # or http://portfolio-ui:80 if using container name
}
```

Reload nginx:

```bash
docker exec applylens-nginx-prod nginx -s reload
# or however you reload your nginx
```

### 6. Verify Running

```bash
# Check containers
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep -E 'portfolio-ui|watchtower'

# Check logs
docker logs portfolio-ui --tail 20
docker logs watchtower --tail 20

# Test directly
curl -s http://localhost:8089/ | grep -oE 'main-[A-Za-z0-9_-]+\.js'
# Should show: main-D0fKNExd.js
```

### 7. Purge Cloudflare Cache

```bash
# From local machine or server with CF_API_TOKEN set
curl -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

Or use Cloudflare dashboard: Cache > Purge Everything

### 8. Verify Live

```bash
# Check what's live
curl -s https://leoklemet.com/ | grep -oE 'main-[A-Za-z0-9_-]+\.js' | head -1
# Should show: main-D0fKNExd.js (or newer)
```

**✅ Setup complete!** You won't need SSH anymore.

---

## After Setup: Hands-Free Deploys

### How It Works

```
1. git push origin main
   ↓
2. GitHub Actions builds dist-portfolio/ (VITE_LAYOUT_ENABLED=1)
   ↓
3. Builds Docker image, pushes as :latest, :v{version}, :{sha}
   ↓
4. Watchtower detects new :latest (within 60s)
   ↓
5. Pulls new image, restarts portfolio-ui
   ↓
6. Live at leoklemet.com (~3-4 min total)
```

### Deploy Example

```bash
# Make changes locally
git add .
git commit -m "feat: update portfolio design"
git push origin main

# Wait 3-4 minutes... ☕
# Check GitHub Actions: https://github.com/leok974/leo-portfolio/actions

# Verify live
curl -s https://leoklemet.com/ | grep -oE 'main-[A-Za-z0-9_-]+\.js'
```

**No SSH needed!** 🚀

---

## Optional: Enable Auto Cache Purging

Add secrets to GitHub repository for automatic Cloudflare cache purging:

1. Go to: https://github.com/leok974/leo-portfolio/settings/secrets/actions
2. Add secrets:
   - `CF_API_TOKEN` - Your Cloudflare API token (Zone.Cache Purge permission)
   - `CF_ZONE_ID` - Zone ID for leoklemet.com

After adding these, the workflow will auto-purge Cloudflare cache on every deploy.

---

## Monitoring

### Check Container Status

```bash
# What's running
docker ps | grep portfolio-ui

# When was it last updated
docker inspect portfolio-ui --format='{{.State.StartedAt}}'

# What image version
docker inspect portfolio-ui | grep Image
```

### Watch Watchtower Logs

```bash
# Real-time monitoring
docker logs -f watchtower

# Last updates
docker logs watchtower --tail 50 --since 1h
```

### Verify Deployment

```bash
# What's in the container
docker exec portfolio-ui cat /usr/share/nginx/html/index.html | grep -oE 'main-[A-Za-z0-9_-]+\.js'

# What's being served
curl -s http://localhost:8089/ | grep -oE 'main-[A-Za-z0-9_-]+\.js'

# What's live
curl -s https://leoklemet.com/ | grep -oE 'main-[A-Za-z0-9_-]+\.js'
```

---

## Rollback (No SSH Needed!)

### Option 1: Push Old Version as Latest

```bash
# Pull the version you want to rollback to
docker pull ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0

# Tag it as latest
docker tag ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0 \
           ghcr.io/leok974/leo-portfolio/portfolio:latest

# Login and push (needs GITHUB_TOKEN with write:packages)
echo $GITHUB_TOKEN | docker login ghcr.io -u leok974 --password-stdin
docker push ghcr.io/leok974/leo-portfolio/portfolio:latest
```

Watchtower will detect and deploy the old version in ~60 seconds.

### Option 2: Manual Container Restart (One SSH)

```bash
ssh your-server

# Stop and remove current
docker stop portfolio-ui && docker rm portfolio-ui

# Run specific version
docker run -d \
  --name portfolio-ui \
  --restart unless-stopped \
  --network infra_net \
  --label com.centurylinklabs.watchtower.enable=true \
  -p 8089:80 \
  ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0
```

### Option 3: Disable Auto-Updates Temporarily

```bash
ssh your-server

# Stop watchtower
docker stop watchtower

# Now you have manual control
# Re-enable later:
docker start watchtower
```

---

## Troubleshooting

### Watchtower Not Detecting Updates

```bash
# Check interval setting
docker logs watchtower | grep -i interval
# Should show: "Using a 60 second interval"

# Check labels on portfolio-ui
docker inspect portfolio-ui | grep -A5 Labels
# Should have: com.centurylinklabs.watchtower.enable=true

# Force immediate check
docker kill --signal=SIGUSR1 watchtower
docker logs -f watchtower
```

### Image Pull Fails

```bash
# Test manually
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest

# Check network from container
docker exec watchtower ping -c3 ghcr.io

# Check auth (if private repo)
docker exec watchtower cat /root/.docker/config.json
```

### Old Version Still Running

```bash
# Force update
docker stop portfolio-ui && docker rm portfolio-ui
docker compose -f ~/leo-portfolio/docker-compose.portfolio-ui.yml up -d portfolio-ui

# Verify
docker logs portfolio-ui --tail 20
```

### CI Build Fails

Check workflow runs: https://github.com/leok974/leo-portfolio/actions

Common issues:
- Missing dependencies → Check `pnpm install` step
- Build errors → Check `pnpm run build:portfolio` step
- Push denied → Check GITHUB_TOKEN permissions (packages: write)

---

## Timeline Reference

### Initial Setup (One-Time)

- T+0:00 - SSH to server
- T+0:05 - Download docker-compose.yml
- T+0:10 - Start services
- T+0:15 - Update nginx config
- T+0:20 - Verify & purge cache
- **Total: 15-30 min**

### Future Deploys (Automated)

- T+0:00 - `git push origin main`
- T+0:30 - GitHub Actions: dependencies installed
- T+1:00 - GitHub Actions: portfolio built
- T+1:30 - GitHub Actions: Docker image built
- T+2:00 - GitHub Actions: pushed to GHCR (3 tags)
- T+2:30 - GitHub Actions: cache purged (optional)
- T+3:00 - Watchtower: detected new image
- T+3:30 - Watchtower: pulled & restarted container
- **Total: ~3-4 min from push to live** 🚀

---

## Useful Commands

```bash
# Watch deployment happen
docker logs -f watchtower

# Check what version is running
docker exec portfolio-ui cat /usr/share/nginx/html/index.html | grep main-

# See all portfolio images available
docker images | grep portfolio

# Clean up old images (Watchtower does this automatically)
docker image prune -f

# Restart everything
docker compose -f ~/leo-portfolio/docker-compose.portfolio-ui.yml restart

# Stop everything
docker compose -f ~/leo-portfolio/docker-compose.portfolio-ui.yml down

# View compose config
docker compose -f ~/leo-portfolio/docker-compose.portfolio-ui.yml config
```

---

## Resources

- **GitHub Actions**: https://github.com/leok974/leo-portfolio/actions
- **Docker Images**: https://github.com/leok974/leo-portfolio/pkgs/container/leo-portfolio%2Fportfolio
- **Watchtower Docs**: https://containrrr.dev/watchtower/

**Detailed Guides**:
- `WATCHTOWER_SETUP.md` - Comprehensive setup guide (500+ lines)
- `AUTOMATED_DEPLOYMENT_STATUS.md` - Complete status & architecture
- `DOCKER_DEPLOY_INSTRUCTIONS.md` - Manual deployment fallback
- `DEPLOY_LEOKLEMET_COM.md` - SCP deployment method

---

## Summary

**Status**: ✅ Ready for one-time server setup

**What You Get**:
- ✅ Automated deployments (just `git push`)
- ✅ No SSH needed after initial setup
- ✅ Version tracking (every commit gets :sha tag)
- ✅ Easy rollback (no downtime)
- ✅ Auto-cleanup of old images
- ✅ 3-4 minute deploys

**Next Steps**:
1. SSH to production server (steps 1-8 above)
2. Verify live site shows new hash
3. Celebrate automated deploys! 🎉

**Questions?** See the detailed guides listed above.
