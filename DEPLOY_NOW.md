# 🚀 Deploy to Production - Execute Now

**Version**: v0.4.0
**Date**: October 17, 2024
**Status**: ✅ READY TO DEPLOY

---

## 📋 Pre-Flight Check

✅ **All systems ready**:
- [x] Docker image v0.4.0 pushed to GHCR
- [x] GitHub Actions workflow configured
- [x] Watchtower setup ready
- [x] Documentation complete
- [x] All code committed and pushed to `portfolio-polish`

✅ **Current production status**:
- Domain: https://leoklemet.com/
- Current hash: `main-QESHvkic.js` (old)
- Target hash: `main-D0fKNExd.js` (new)

---

## 🎯 Deployment Steps (Copy-Paste Ready)

### Step 1: SSH to Production Server

```bash
ssh your-production-server
```

> **Note**: This is the LAST time you'll need SSH for deployments! 🎉

---

### Step 2: Create Deployment Directory

```bash
mkdir -p ~/leo-portfolio && cd ~/leo-portfolio
```

---

### Step 3: Download Watchtower Config

```bash
curl -fsSLO https://raw.githubusercontent.com/leok974/leo-portfolio/portfolio-polish/deploy/docker-compose.portfolio-ui.yml
```

**Verify download**:
```bash
ls -lh docker-compose.portfolio-ui.yml
cat docker-compose.portfolio-ui.yml | head -20
```

---

### Step 4: Login to GHCR (If Repo is Private)

**Skip this if your image is public** (recommended for faster deploys).

If needed:
```bash
# Option A: Using GITHUB_TOKEN environment variable
echo $GITHUB_TOKEN | docker login ghcr.io -u leok974 --password-stdin

# Option B: Using GitHub CLI
gh auth token | docker login ghcr.io -u leok974 --password-stdin
```

**Verify login**:
```bash
docker pull ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0
```

---

### Step 5: Start Portfolio + Watchtower

```bash
docker compose -f docker-compose.portfolio-ui.yml up -d
```

**Expected output**:
```
✔ Network infra_net       Created
✔ Container portfolio-ui  Started
✔ Container watchtower    Started
```

---

### Step 6: Verify Containers Running

```bash
# Check both containers are up
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep -E 'NAMES|portfolio-ui|watchtower'

# Check portfolio-ui logs
docker logs portfolio-ui --tail 20

# Check watchtower logs
docker logs watchtower --tail 20
```

**Expected in watchtower logs**:
```
"Watchtower started"
"Using a 60 second interval"
"Watching portfolio-ui"
```

---

### Step 7: Test Direct Access

```bash
# Test the container directly
curl -s http://localhost:8089/ | grep -oE 'main-[A-Za-z0-9_-]+\.js'
```

**Expected output**: `main-D0fKNExd.js`

---

### Step 8: Update Nginx Configuration

**Check current nginx config**:
```bash
# If nginx is in a container
docker exec applylens-nginx-prod cat /etc/nginx/conf.d/default.conf | grep -A5 "location /"

# If nginx is on host
cat /etc/nginx/sites-enabled/default | grep -A5 "location /"
```

**Update to proxy to portfolio-ui**:

Edit the nginx config to include:
```nginx
location / {
    proxy_pass http://portfolio.int:80;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

**Reload nginx**:
```bash
# If nginx is in a container
docker exec applylens-nginx-prod nginx -t
docker exec applylens-nginx-prod nginx -s reload

# If nginx is on host
sudo nginx -t
sudo systemctl reload nginx
```

---

### Step 9: Test Through Nginx

```bash
# Test from server
curl -s http://localhost/ | grep -oE 'main-[A-Za-z0-9_-]+\.js'

# Or if nginx is listening on a different port
curl -s http://localhost:80/ | grep -oE 'main-[A-Za-z0-9_-]+\.js'
```

**Expected output**: `main-D0fKNExd.js`

---

### Step 10: Purge Cloudflare Cache

**From your local machine** (or from server if CF credentials are there):

```bash
# Set your credentials
export CF_API_TOKEN="your-cloudflare-api-token"
export CF_ZONE_ID="your-zone-id"

# Purge cache
curl -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

**Expected response**:
```json
{
  "success": true,
  "errors": [],
  "messages": [],
  "result": {
    "id": "..."
  }
}
```

**Alternative**: Use Cloudflare Dashboard:
1. Go to: https://dash.cloudflare.com/
2. Select your domain (leoklemet.com)
3. Go to: Caching > Configuration
4. Click: "Purge Everything"

---

### Step 11: Verify Production Site

**Wait 2-3 minutes** for Cloudflare cache to clear, then:

```bash
# From local machine
curl -s https://leoklemet.com/ | grep -oE 'main-[A-Za-z0-9_-]+\.js' | head -1
```

**Expected output**: `main-D0fKNExd.js`

**Also test in browser**:
1. Open: https://leoklemet.com/
2. Open DevTools (F12)
3. Check Console for errors (should be none)
4. Check Network tab for `main-D0fKNExd.js` being loaded
5. Verify layout feature is visible

---

### Step 12: Health Check

```bash
# Check container health
docker inspect portfolio-ui --format='{{.State.Health.Status}}'
# Expected: healthy

# Check when it started
docker inspect portfolio-ui --format='{{.State.StartedAt}}'

# Check what image it's using
docker inspect portfolio-ui | grep Image
# Expected: ghcr.io/leok974/leo-portfolio/portfolio:latest or sha256:d9cc0f44...
```

---

## ✅ Deployment Complete!

If all steps passed, you now have:
- ✅ Portfolio v0.4.0 running on production
- ✅ Watchtower monitoring for updates every 60s
- ✅ New build hash (`main-D0fKNExd.js`) live at leoklemet.com
- ✅ Layout feature enabled
- ✅ Automated deployment pipeline active

---

## 🧪 Test Automated Deployment (Optional)

Now test the full automation by making a small change:

### On Local Machine:

```bash
# Make a tiny change (update a comment or version)
echo "// Test automated deployment" >> apps/portfolio-ui/src/main.tsx

# Commit and push
git add .
git commit -m "test: verify automated deployment pipeline"
git push origin main
```

### Watch the Magic:

1. **GitHub Actions** (2-3 min):
   - Go to: https://github.com/leok974/leo-portfolio/actions
   - Watch the workflow build and push

2. **Watchtower** (60s after CI completes):
   ```bash
   # SSH to server and watch
   docker logs -f watchtower
   ```
   You should see:
   ```
   Found new ghcr.io/leok974/leo-portfolio/portfolio:latest
   Stopping /portfolio-ui
   Pulling new image
   Starting /portfolio-ui
   ```

3. **Verify Live** (~3-4 min total):
   ```bash
   curl -s https://leoklemet.com/ | grep -oE 'main-[A-Za-z0-9_-]+\.js'
   # Should show a NEW hash!
   ```

---

## 📊 What Happens Next?

### Future Deployments (No SSH!)

```bash
# Just this:
git push origin main

# Wait 3-4 minutes...
# ✅ Live on production!
```

**Timeline**:
- T+0:00 - Push to GitHub
- T+0:30 - CI: Install dependencies
- T+1:00 - CI: Build portfolio
- T+1:30 - CI: Build Docker image
- T+2:00 - CI: Push to GHCR
- T+2:30 - CI: Complete ✓
- T+3:00 - Watchtower: Detect new image
- T+3:30 - Watchtower: Deploy ✓

**Total: ~3-4 minutes** 🚀

---

## 🔧 Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs portfolio-ui
docker logs watchtower

# Check if port is in use
sudo netstat -tlnp | grep :8089

# Restart
docker compose -f ~/leo-portfolio/docker-compose.portfolio-ui.yml restart
```

### Old Hash Still Showing

```bash
# Force pull new image
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest

# Force recreate container
docker stop portfolio-ui && docker rm portfolio-ui
docker compose -f ~/leo-portfolio/docker-compose.portfolio-ui.yml up -d portfolio-ui
```

### Watchtower Not Detecting

```bash
# Force immediate check
docker kill --signal=SIGUSR1 watchtower

# Check logs
docker logs -f watchtower
```

### Nginx Not Proxying

```bash
# Check nginx can reach container
docker exec applylens-nginx-prod ping -c3 portfolio.int

# Or try container name
docker exec applylens-nginx-prod ping -c3 portfolio-ui

# Check network
docker network inspect infra_net
```

---

## 🚨 Rollback (If Needed)

### Quick Rollback (No SSH Required!)

From your local machine:

```bash
# Pull old version
docker pull ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0

# Tag as latest
docker tag ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0 \
           ghcr.io/leok974/leo-portfolio/portfolio:latest

# Push (requires write:packages permission)
echo $GITHUB_TOKEN | docker login ghcr.io -u leok974 --password-stdin
docker push ghcr.io/leok974/leo-portfolio/portfolio:latest
```

**Watchtower will auto-deploy the old version in ~60 seconds!**

---

## 📞 Need Help?

**Documentation**:
- Quick Reference: `DEPLOYMENT_QUICKSTART.md`
- Detailed Guide: `WATCHTOWER_SETUP.md`
- Checklist: `DEPLOYMENT_CHECKLIST.md`
- Architecture: `AUTOMATED_DEPLOYMENT_STATUS.md`

**Resources**:
- GitHub Actions: https://github.com/leok974/leo-portfolio/actions
- Docker Images: https://github.com/leok974/leo-portfolio/pkgs/container/leo-portfolio%2Fportfolio
- Watchtower Docs: https://containrrr.dev/watchtower/

---

## ✨ Summary

**You're deploying**:
- Version: v0.4.0
- Hash: `main-D0fKNExd.js`
- Features: Layout enabled, all tests passing
- Method: Watchtower + GitHub Actions automation

**Time estimate**: 15-30 minutes for initial setup

**After this**: Just `git push` for future deploys (3-4 min)

---

**Ready? Start with Step 1!** 🚀

Good luck! You've got this! 💪
