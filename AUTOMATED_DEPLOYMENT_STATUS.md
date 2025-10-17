# Automated Deployment Status - Ready to Deploy

**Date**: October 2024
**Version**: v0.4.0
**Status**: ✅ Ready for one-time server bootstrap

---

## Summary

All components for **zero-SSH automated deployment** are complete and committed:

✅ **Docker image built and pushed** to GHCR
✅ **Watchtower configuration** added to docker-compose
✅ **GitHub Actions workflow** created for CI/CD
✅ **Comprehensive documentation** for setup and troubleshooting

**Next Step**: One-time SSH to production server to bootstrap Watchtower.

---

## What's Ready

### 1. Docker Image (v0.4.0)

**Location**: `ghcr.io/leok974/leo-portfolio/portfolio`

**Tags**:
- `:latest` (Watchtower watches this)
- `:v0.4.0` (semantic version)
- Digest: `sha256:d9cc0f44c3afac593b0263c6c6e5b15a22671a772dc9c6d058b02362bf06bcda`

**Contains**:
- Layout feature enabled (`VITE_LAYOUT_ENABLED=1`)
- Bundle hash: `main-D0fKNExd.js`
- All 12 E2E tests passing
- Assistant panel fixes

**Verify**:
```powershell
docker pull ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0
docker run --rm ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0 cat /usr/share/nginx/html/index.html | Select-String "main-"
```

### 2. Watchtower Configuration

**File**: `deploy/docker-compose.portfolio-ui.yml`

**Features**:
- Auto-checks for new images every 60 seconds
- Label-based targeting (only updates portfolio-ui)
- Auto-cleanup of old images
- Notification support (optional)

**How It Works**:
```
Watchtower loop (every 60s):
  1. Check GHCR for ghcr.io/.../portfolio:latest
  2. Compare digest with running container
  3. If different:
     - Pull new image
     - Stop portfolio-ui
     - Start portfolio-ui with new image
     - Remove old image
```

### 3. GitHub Actions Workflow

**File**: `.github/workflows/deploy-docker.yml`

**Triggers**:
- Push to `main` branch (if portfolio files changed)
- Manual workflow dispatch

**Steps**:
1. Checkout code
2. Setup pnpm and Node.js
3. Install dependencies
4. Build portfolio with `VITE_LAYOUT_ENABLED=1`
5. Login to GHCR
6. Build Docker image (3 tags: latest, version, sha)
7. Push all tags to GHCR
8. Purge Cloudflare cache (optional, needs secrets)

**Secrets Needed** (optional):
- `CF_API_TOKEN` - Cloudflare API token for cache purging
- `CF_ZONE_ID` - Zone ID for leoklemet.com

**Status**: Workflow file created, minor warnings about missing secrets (safe to ignore until secrets added).

### 4. Documentation

**Created Guides**:

1. **WATCHTOWER_SETUP.md** (400+ lines)
   - Part 1: One-time server setup
   - Part 2: GitHub Actions configuration
   - Part 3: First deployment test
   - Monitoring, rollback, troubleshooting

2. **DOCKER_DEPLOY_INSTRUCTIONS.md** (400+ lines)
   - Quick deploy commands
   - Docker Compose method
   - Verification steps
   - Rollback procedures

3. **DEPLOY_LEOKLEMET_COM.md** (345 lines)
   - Option 1: Manual SCP
   - Option 2: Container rebuild on server
   - Option 3: GitHub Actions CD
   - Troubleshooting guide

**All guides include**:
- Step-by-step commands
- Verification steps
- Troubleshooting sections
- Rollback procedures

---

## Current Production Status

### What's Live Now

**Domain**: https://leoklemet.com
**Bundle**: `main-QESHvkic.js` ❌ (old build, layout disabled)
**Server**: `applylens-nginx-prod` container
**Port**: 80

**Issue**: Production still serving old build because:
1. Local stack updated but different from production server
2. Cloudflare cache purge doesn't update server files
3. Need to deploy new Docker image to production

### What Should Be Live

**Domain**: https://leoklemet.com
**Bundle**: `main-D0fKNExd.js` ✅ (new build, layout enabled)
**Server**: `portfolio-ui` container from GHCR
**Port**: 80

**After Bootstrap**: Watchtower will keep this auto-updated on every push to main.

---

## Deployment Plan

### Phase 1: One-Time Bootstrap (15-30 minutes)

**Goal**: Deploy Watchtower to production server

**Steps**:

1. **SSH to production server**:
   ```bash
   ssh your-production-server
   ```

2. **Create deployment directory**:
   ```bash
   mkdir -p ~/leo-portfolio
   cd ~/leo-portfolio
   ```

3. **Copy docker-compose.portfolio-ui.yml**:
   ```bash
   # Option A: Download from repo
   curl -O https://raw.githubusercontent.com/leok974/leo-portfolio/main/deploy/docker-compose.portfolio-ui.yml

   # Option B: Git clone
   git clone https://github.com/leok974/leo-portfolio.git
   cd leo-portfolio/deploy
   ```

4. **Start services**:
   ```bash
   docker compose -f docker-compose.portfolio-ui.yml up -d
   ```

5. **Verify running**:
   ```bash
   docker ps | grep -E "portfolio-ui|watchtower"
   docker logs portfolio-ui
   docker logs watchtower
   ```

6. **Update nginx config** (if needed):
   ```nginx
   # In nginx config
   location / {
       proxy_pass http://portfolio-ui:80;
   }
   ```

   ```bash
   docker exec applylens-nginx-prod nginx -s reload
   ```

7. **Test**:
   ```bash
   curl -s http://portfolio-ui:80/ | grep "main-"
   # Should show: main-D0fKNExd.js
   ```

8. **Clear Cloudflare cache**:
   ```powershell
   # From local machine
   curl.exe -X POST "https://api.cloudflare.com/client/v4/zones/$env:CF_ZONE_ID/purge_cache" `
     -H "Authorization: Bearer $env:CF_API_TOKEN" `
     -H "Content-Type: application/json" `
     --data '{"purge_everything":true}'
   ```

9. **Verify live**:
   ```powershell
   # Wait 2-3 minutes, then:
   curl.exe -k -s https://leoklemet.com/ | Select-String "main-"
   # Should show: main-D0fKNExd.js
   ```

**Result**: Production now running v0.4.0, Watchtower watching for updates.

### Phase 2: Configure GitHub Secrets (5 minutes, optional)

**Goal**: Enable Cloudflare cache purging in CI

**Steps**:

1. Go to: https://github.com/leok974/leo-portfolio/settings/secrets/actions

2. Add secrets:
   - `CF_API_TOKEN` - Get from Cloudflare dashboard
   - `CF_ZONE_ID` - Get from `CLOUDFLARE_CONFIG_COMPLETE.md`

3. Test workflow:
   ```bash
   # Push a small change to trigger CI
   git commit --allow-empty -m "test: trigger CI pipeline"
   git push origin main
   ```

4. Watch at: https://github.com/leok974/leo-portfolio/actions

**Result**: CI will auto-purge Cloudflare cache after pushing images.

### Phase 3: Test Automated Deployment (10 minutes)

**Goal**: Verify end-to-end automation works

**Steps**:

1. **Make a small change locally**:
   ```typescript
   // apps/portfolio-ui/src/components/Footer.tsx
   // Update copyright year or add a comment
   ```

2. **Commit and push**:
   ```bash
   git add .
   git commit -m "test: verify automated deployment"
   git push origin main
   ```

3. **Watch CI** (2-3 minutes):
   - Go to: https://github.com/leok974/leo-portfolio/actions
   - Wait for build to complete

4. **Watch Watchtower** (60 seconds):
   ```bash
   # SSH to server
   docker logs -f watchtower

   # Should show:
   # "Found new image for portfolio-ui"
   # "Stopping portfolio-ui"
   # "Pulling new image"
   # "Starting portfolio-ui"
   ```

5. **Verify live** (~3-4 minutes total):
   ```powershell
   curl.exe -k -s https://leoklemet.com/ | Select-String "main-"
   # Should show new hash
   ```

**Result**: Confirmed that `git push` → auto-deploy works!

---

## Expected Timeline

### From Push to Live

```
T+0:00    git push origin main
T+0:05    GitHub Actions starts
T+0:30    Dependencies installed
T+1:00    Portfolio built
T+1:30    Docker image built
T+2:00    Pushed to GHCR (3 tags)
T+2:30    Cloudflare cache purged (if secrets configured)
T+2:30    CI complete ✓
T+3:00    Watchtower detects new image
T+3:10    Pulls new image
T+3:20    Restarts portfolio-ui
T+3:30    New version live at leoklemet.com ✓
```

**Total**: ~3-4 minutes from push to live 🚀

### Future Deploys (After Bootstrap)

No SSH needed! Just:

```bash
git add .
git commit -m "feat: update portfolio"
git push origin main
```

Then wait 3-4 minutes. Done!

---

## Rollback Procedure

### Option 1: Push Old Tag as Latest (No SSH)

```bash
# Find version to rollback to
# https://github.com/leok974/leo-portfolio/pkgs/container/leo-portfolio%2Fportfolio

# Pull old version
docker pull ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0

# Tag as latest
docker tag ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0 \
           ghcr.io/leok974/leo-portfolio/portfolio:latest

# Login and push
echo $GITHUB_TOKEN | docker login ghcr.io -u leok974 --password-stdin
docker push ghcr.io/leok974/leo-portfolio/portfolio:latest
```

Watchtower will auto-deploy old version in ~60 seconds.

### Option 2: Manual Restart (One-time SSH)

```bash
ssh your-server

docker stop portfolio-ui && docker rm portfolio-ui

docker run -d \
  --name portfolio-ui \
  --restart unless-stopped \
  --network infra_net \
  --label com.centurylinklabs.watchtower.enable=true \
  -p 80:80 \
  ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0
```

### Option 3: Disable Watchtower

```bash
ssh your-server
docker stop watchtower

# Now manual control of portfolio-ui
# Re-enable later:
docker start watchtower
```

---

## Monitoring

### Check Deployment Status

```bash
# Container status
docker ps | grep portfolio-ui

# What's running
docker inspect portfolio-ui | grep Image

# When was it updated
docker inspect portfolio-ui --format='{{.State.StartedAt}}'

# Watchtower logs
docker logs watchtower --tail 50
```

### Verify Version Live

```bash
# Direct container check
docker exec portfolio-ui cat /usr/share/nginx/html/index.html | grep "main-"

# Through nginx
docker exec applylens-nginx-prod wget -qO- http://portfolio-ui:80/ | grep "main-"

# Public URL
curl -s https://leoklemet.com/ | grep "main-"
```

### CI/CD Status

- **Actions**: https://github.com/leok974/leo-portfolio/actions
- **Packages**: https://github.com/leok974/leo-portfolio/pkgs/container/leo-portfolio%2Fportfolio
- **Commits**: https://github.com/leok974/leo-portfolio/commits/main

---

## Troubleshooting

### Watchtower Not Detecting

```bash
# Check interval
docker logs watchtower | grep interval

# Check labels
docker inspect portfolio-ui | grep -A5 Labels

# Force check
docker kill --signal=SIGUSR1 watchtower
docker logs -f watchtower
```

### Image Not Pulling

```bash
# Test network
docker exec watchtower ping -c3 ghcr.io

# Manual pull
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest
```

### Old Version Still Live

```bash
# Check what's running
docker inspect portfolio-ui | grep Image

# Force update
docker stop portfolio-ui && docker rm portfolio-ui
docker compose -f docker-compose.portfolio-ui.yml up -d portfolio-ui
```

### CI Build Fails

1. Go to: https://github.com/leok974/leo-portfolio/actions
2. Click failed workflow
3. Expand failed step
4. Check logs

**Common issues**:
- `dist-portfolio` not built → Check build step
- Permission denied → Check GITHUB_TOKEN permissions
- Image too large → Check .dockerignore

---

## What You Get

### Before (Manual Deploys)

```
1. Build locally
2. SCP to server or rebuild on server
3. SSH to restart nginx
4. Clear Cloudflare cache
5. Verify live
```

**Time**: 15-30 minutes
**Requires**: SSH access, manual commands, verification
**Error-prone**: Forgot a step? Didn't clear cache? Wrong files?

### After (Automated)

```
1. git push origin main
2. Wait 3-4 minutes
3. Verify live
```

**Time**: 3-4 minutes
**Requires**: Nothing (happens automatically)
**Reliable**: Same process every time, logged, monitored

---

## Next Actions

### Immediate (You)

1. ✅ Review this document
2. ✅ Review WATCHTOWER_SETUP.md for detailed steps
3. ⏳ SSH to production server (one time)
4. ⏳ Follow Phase 1 steps to bootstrap Watchtower
5. ⏳ Verify production shows new hash (main-D0fKNExd.js)

### Short-term (Optional)

1. ⏳ Add GitHub secrets (CF_API_TOKEN, CF_ZONE_ID)
2. ⏳ Test automated deployment (Phase 3)
3. ⏳ Set up Watchtower notifications (Slack/Discord)

### Long-term (Enhancements)

1. Add E2E tests to CI (run before building image)
2. Add smoke tests after deployment
3. Set up monitoring/alerting for failed deployments
4. Document rollback SOP

---

## Files Reference

**Automation**:
- `.github/workflows/deploy-docker.yml` - CI/CD workflow
- `deploy/docker-compose.portfolio-ui.yml` - Watchtower config
- `Dockerfile.portfolio` - Single-stage build

**Documentation**:
- `WATCHTOWER_SETUP.md` - Complete automation guide
- `DOCKER_DEPLOY_INSTRUCTIONS.md` - Manual Docker deployment
- `DEPLOY_LEOKLEMET_COM.md` - SCP deployment method
- `AUTOMATED_DEPLOYMENT_STATUS.md` - This file

**Version Info**:
- `FINALIZATION_COMPLETE_OCT17.md` - What's in v0.4.0
- `DEPLOYMENT_V0.4.0_SUCCESS.md` - Local deployment summary
- `CHANGELOG.md` - Version history

---

## Summary

**Status**: ✅ **READY TO DEPLOY**

All components for automated deployment are:
- ✅ Built
- ✅ Tested locally
- ✅ Pushed to GHCR
- ✅ Documented
- ✅ Committed to repo

**Blocking**: One-time SSH to production server to bootstrap Watchtower

**After Bootstrap**: Zero-SSH deployments forever! Just `git push` and wait 3-4 minutes.

**Questions?** See:
- **Setup**: `WATCHTOWER_SETUP.md`
- **Troubleshooting**: `DOCKER_DEPLOY_INSTRUCTIONS.md`
- **Manual fallback**: `DEPLOY_LEOKLEMET_COM.md`

🚀 **Ready when you are!**
