# Automated Deployment Setup - Watchtower + GitHub Actions

**Goal**: Zero-SSH deploys. Push to `main` → CI builds image → Watchtower auto-deploys in ~60s.

---

## Part 1: One-Time Server Setup (SSH Once)

### Step 1: SSH to Production Server

```bash
ssh your-production-server
```

### Step 2: Create Deployment Directory

```bash
mkdir -p ~/leo-portfolio
cd ~/leo-portfolio
```

### Step 3: Copy docker-compose.portfolio-ui.yml

Create `docker-compose.portfolio-ui.yml` with this content:

```yaml
version: "3.8"

networks:
  infra_net:
    external: true

services:
  portfolio-ui:
    image: ghcr.io/leok974/leo-portfolio/portfolio:latest
    container_name: portfolio-ui
    restart: unless-stopped
    networks: [infra_net]
    ports:
      - "80:80"
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:80/ || exit 1"]
      interval: 30s
      timeout: 3s
      retries: 3
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  watchtower:
    image: containrrr/watchtower
    container_name: watchtower
    restart: unless-stopped
    networks: [infra_net]
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: >
      --label-enable
      --cleanup
      --interval 60
      portfolio-ui
    environment:
      - WATCHTOWER_NOTIFICATIONS=${WATCHTOWER_NOTIFICATION_URL:-}
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

Or download from repo:

```bash
curl -O https://raw.githubusercontent.com/leok974/leo-portfolio/main/deploy/docker-compose.portfolio-ui.yml
```

### Step 4: Login to GitHub Container Registry (if repo is private)

```bash
# Create GitHub Personal Access Token with read:packages scope
# https://github.com/settings/tokens

echo YOUR_GITHUB_TOKEN | docker login ghcr.io -u leok974 --password-stdin
```

**Note**: If your image is public (recommended), skip this step.

### Step 5: Start Services

```bash
docker compose -f docker-compose.portfolio-ui.yml up -d
```

### Step 6: Verify Running

```bash
# Check containers
docker ps | grep -E "portfolio-ui|watchtower"

# Check portfolio-ui health
curl -s http://localhost:80/ | grep "main-"

# Check Watchtower logs
docker logs -f watchtower
# Should show: "Watchtower started" and "Watching portfolio-ui"
```

### Step 7: Update Nginx Config (if needed)

If your `applylens-nginx-prod` needs to be updated to point to the new container:

```bash
# Inside nginx container or in config file
# Change proxy_pass to:
location / {
    proxy_pass http://portfolio-ui:80;
}

# Reload nginx
docker exec applylens-nginx-prod nginx -s reload
```

### Step 8: Test End-to-End

```bash
# Test directly
curl -s http://portfolio-ui:80/ | grep "main-"

# Test through nginx
docker exec applylens-nginx-prod wget -qO- http://portfolio-ui:80/ | grep "main-"

# Test public URL (may need cache clear first)
curl -s https://leoklemet.com/ | grep "main-"
```

**✅ Server setup complete!** You won't need SSH anymore for deployments.

---

## Part 2: GitHub Actions Workflow

The workflow is already created at `.github/workflows/deploy-docker.yml`.

### What It Does

1. **Triggers on**:
   - Push to `main` branch
   - Changes to portfolio-ui files
   - Manual workflow dispatch

2. **Builds**:
   - Installs pnpm dependencies
   - Builds portfolio with `VITE_LAYOUT_ENABLED=1`
   - Creates Docker image from `Dockerfile.portfolio`

3. **Pushes** three tags:
   - `:latest` (Watchtower watches this)
   - `:v{version}` (from package.json)
   - `:{sha}` (git commit sha for rollback)

4. **Purges Cloudflare cache** (optional, if secrets configured)

5. **Watchtower detects** new `:latest` tag within 60s and auto-deploys

### Configure Secrets (Optional)

For Cloudflare cache purging, add these to GitHub repo secrets:

1. Go to: https://github.com/leok974/leo-portfolio/settings/secrets/actions
2. Click "New repository secret"
3. Add:
   - `CF_API_TOKEN` - Your Cloudflare API token
   - `CF_ZONE_ID` - Your leoklemet.com zone ID

**To get these**:

```powershell
# Zone ID
$env:CF_ZONE_ID  # Should be set from CLOUDFLARE_CONFIG_COMPLETE.md

# API Token - create at:
# https://dash.cloudflare.com/profile/api-tokens
# Use "Edit zone DNS" template or create custom with:
# - Zone.Cache Purge
# - Zone.Zone Settings Read
```

If you don't add these secrets, the workflow will skip cache purging (not critical).

---

## Part 3: First Deployment

### Trigger the Workflow

**Option A: Push to main**

```bash
git push origin main
```

**Option B: Manual trigger**

1. Go to: https://github.com/leok974/leo-portfolio/actions/workflows/deploy-docker.yml
2. Click "Run workflow"
3. Select `main` branch
4. Click "Run workflow"

### Watch the Build

1. Go to: https://github.com/leok974/leo-portfolio/actions
2. Click on the running workflow
3. Watch the build steps (should take ~2-3 minutes)

### Watch Auto-Deploy

After CI finishes:

```bash
# SSH to server (or check logs remotely if you have access)
docker logs -f watchtower

# You should see:
# "Found new image for portfolio-ui"
# "Stopping portfolio-ui"
# "Pulling new image"
# "Starting portfolio-ui"
# "Completed"
```

### Verify Live

After ~60-90 seconds:

```powershell
# Check what's live
curl.exe -k -s https://leoklemet.com/ | Select-String '<script.*src="/assets/main-.*\.js"'

# Should show: main-D0fKNExd.js (or newer)
```

---

## How Future Deploys Work

1. **Make changes** to portfolio code locally
2. **Commit and push** to `main`:
   ```bash
   git add .
   git commit -m "feat: update portfolio"
   git push origin main
   ```
3. **Wait 2-3 minutes** for CI to build and push image
4. **Wait 60 seconds** for Watchtower to detect and deploy
5. **Verify** at https://leoklemet.com/

**Total time**: ~3-4 minutes from push to live 🚀

**No SSH needed!**

---

## Monitoring & Verification

### Check Watchtower Status

```bash
# View logs
docker logs watchtower

# Tail logs
docker logs -f watchtower --since 10m

# Check last update
docker inspect portfolio-ui | grep -A5 "Created"
```

### Check What's Running

```bash
# Container status
docker ps | grep portfolio-ui

# Image version
docker inspect portfolio-ui | grep Image

# When was it updated
docker inspect portfolio-ui --format='{{.State.StartedAt}}'
```

### Verify Build Hash

```bash
# What's in the container
docker exec portfolio-ui cat /usr/share/nginx/html/index.html | grep "main-"

# What's being served
curl -s http://portfolio-ui:80/ | grep "main-"

# What's live
curl -s https://leoklemet.com/ | grep "main-"
```

---

## Rollback

### Option A: Push Old Tag as Latest (No SSH)

If you need to rollback to a previous version:

```bash
# Find the version you want
# Check: https://github.com/leok974/leo-portfolio/pkgs/container/leo-portfolio%2Fportfolio

# Pull old version
docker pull ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0

# Tag it as latest
docker tag ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0 ghcr.io/leok974/leo-portfolio/portfolio:latest

# Push (requires GITHUB_TOKEN with write:packages)
echo $GITHUB_TOKEN | docker login ghcr.io -u leok974 --password-stdin
docker push ghcr.io/leok974/leo-portfolio/portfolio:latest
```

Watchtower will detect and deploy the old version in ~60s.

### Option B: Manual Container Restart (One-time SSH)

```bash
# SSH to server
ssh your-server

# Stop current
docker stop portfolio-ui
docker rm portfolio-ui

# Run specific version
docker run -d \
  --name portfolio-ui \
  --restart unless-stopped \
  --network infra_net \
  --label com.centurylinklabs.watchtower.enable=true \
  -p 80:80 \
  ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0
```

### Option C: Disable Watchtower Temporarily

```bash
# SSH to server
docker stop watchtower

# Now portfolio-ui won't auto-update
# You can manually update when ready:
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest
docker stop portfolio-ui && docker rm portfolio-ui
docker compose -f docker-compose.portfolio-ui.yml up -d portfolio-ui

# Re-enable watchtower
docker start watchtower
```

---

## Troubleshooting

### Watchtower Not Detecting Updates

**Check interval**:
```bash
docker logs watchtower | grep -i interval
# Should show: "Using a 60 second interval"
```

**Check labels**:
```bash
docker inspect portfolio-ui | grep -A5 Labels
# Should have: com.centurylinklabs.watchtower.enable=true
```

**Force check**:
```bash
# Send SIGUSR1 to force immediate check
docker kill --signal=SIGUSR1 watchtower
docker logs -f watchtower
```

### Image Not Pulling

**Check network**:
```bash
docker exec watchtower ping -c3 ghcr.io
```

**Check auth** (if private repo):
```bash
docker exec watchtower cat /root/.docker/config.json
# Should have ghcr.io credentials
```

**Manual test**:
```bash
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest
# If this fails, watchtower will fail too
```

### Old Version Still Running

**Check image**:
```bash
docker inspect portfolio-ui | grep Image
# Should show: ghcr.io/leok974/leo-portfolio/portfolio:latest
```

**Check when started**:
```bash
docker inspect portfolio-ui --format='{{.State.StartedAt}}'
# Should be recent (after CI run)
```

**Force update**:
```bash
docker stop portfolio-ui && docker rm portfolio-ui
docker compose -f docker-compose.portfolio-ui.yml up -d portfolio-ui
```

### CI Build Fails

**Check workflow**:
https://github.com/leok974/leo-portfolio/actions

**Common issues**:
- `dist-portfolio` not built → Check build step logs
- Permission denied on push → Check GITHUB_TOKEN permissions
- Image too large → Check .dockerignore

**View build logs**:
1. Go to failed workflow
2. Click on failed step
3. Expand logs

---

## Notifications (Optional)

Add Slack/Discord/Email notifications when Watchtower updates:

### Slack

```yaml
# In docker-compose.portfolio-ui.yml, add to watchtower environment:
environment:
  - WATCHTOWER_NOTIFICATION_URL=slack://TOKEN@CHANNEL
```

### Discord

```yaml
environment:
  - WATCHTOWER_NOTIFICATION_URL=discord://TOKEN@CHANNEL
```

### Email

```yaml
environment:
  - WATCHTOWER_NOTIFICATION_URL=smtp://username:password@host:port/?from=FROM&to=TO
```

See: https://containrrr.dev/watchtower/notifications/

---

## Summary

### What You Have Now

✅ **Watchtower** running on server, checking every 60s
✅ **GitHub Actions** workflow building and pushing images
✅ **Automated pipeline**: push → build → deploy (no SSH)
✅ **Rollback capability**: push old tag or manual restart

### Deployment Flow

```
1. git push origin main
   ↓
2. GitHub Actions builds portfolio
   ↓
3. Pushes ghcr.io/.../portfolio:latest
   ↓
4. Watchtower detects new image (~60s)
   ↓
5. Pulls and restarts portfolio-ui
   ↓
6. Live at leoklemet.com (~3-4min total)
```

### Next Steps

1. ✅ SSH to server and run Part 1 (one-time setup)
2. ✅ Verify Watchtower is running
3. ✅ Trigger first CI deployment (push to main or manual)
4. ✅ Watch auto-deploy in action
5. ✅ Verify live site updated

**After this, you'll never need SSH for deployments again!** 🎉

---

**Related Docs**:
- `.github/workflows/deploy-docker.yml` - CI workflow
- `deploy/docker-compose.portfolio-ui.yml` - Server config
- `DOCKER_DEPLOY_INSTRUCTIONS.md` - Manual deployment method
- `FINALIZATION_COMPLETE_OCT17.md` - What's in v0.4.0
