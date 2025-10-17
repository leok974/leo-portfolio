# Production Deployment Checklist

**Date**: October 17, 2024
**Version**: v0.4.0
**Branch**: `portfolio-polish`

---

## ✅ Pre-Deployment Verification

### Local Build & Tests

- [x] All 12 E2E tests passing
- [x] Layout feature enabled (`VITE_LAYOUT_ENABLED=1`)
- [x] Local build contains correct hash: `main-D0fKNExd.js`
- [x] Docker image built: `ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0`
- [x] Docker image pushed to GHCR with tags: `:latest`, `:v0.4.0`
- [x] Local docker stack verified (all services healthy)

### Automation Setup

- [x] GitHub Actions workflow created (`.github/workflows/deploy-docker.yml`)
- [x] Watchtower config ready (`deploy/docker-compose.portfolio-ui.yml`)
- [x] Documentation complete:
  - [x] `DEPLOYMENT_QUICKSTART.md` - Quick reference guide
  - [x] `WATCHTOWER_SETUP.md` - Comprehensive setup guide
  - [x] `AUTOMATED_DEPLOYMENT_STATUS.md` - Status & architecture
- [x] All changes committed to `portfolio-polish` branch
- [x] Changes pushed to GitHub

---

## ⏳ Server Deployment Tasks

### One-Time Setup (SSH Required)

Follow **DEPLOYMENT_QUICKSTART.md** steps 1-8:

Follow **DEPLOYMENT_QUICKSTART.md** steps 1-8:

- [ ] **Step 1**: SSH to production server
  ```bash
  ssh your-production-server
  ```

- [ ] **Step 2**: Create deploy directory
  ```bash
  mkdir -p ~/leo-portfolio && cd ~/leo-portfolio
  ```

- [ ] **Step 3**: Download docker-compose file
  ```bash
  curl -fsSLO https://raw.githubusercontent.com/leok974/leo-portfolio/portfolio-polish/deploy/docker-compose.portfolio-ui.yml
  ```

- [ ] **Step 4** (if needed): Login to GHCR
  ```bash
  echo $GITHUB_TOKEN | docker login ghcr.io -u leok974 --password-stdin
  ```

- [ ] **Step 5**: Start services
  ```bash
  docker compose -f docker-compose.portfolio-ui.yml up -d
  ```

- [ ] **Step 6**: Update nginx config
  ```nginx
  location / {
      proxy_pass http://portfolio.int:80;
  }
  ```
  Then reload: `docker exec applylens-nginx-prod nginx -s reload`

- [ ] **Step 7**: Verify containers running
  ```bash
  docker ps | grep -E 'portfolio-ui|watchtower'
  docker logs portfolio-ui --tail 20
  docker logs watchtower --tail 20
  ```

- [ ] **Step 8**: Purge Cloudflare cache
  ```bash
  curl -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{"purge_everything":true}'
  ```

---

## ✅ Verification

### Container Health

- [ ] `portfolio-ui` container running
  ```bash
  docker ps --format 'table {{.Names}}\t{{.Status}}' | grep portfolio-ui
  ```

- [ ] `watchtower` container running
  ```bash
  docker ps --format 'table {{.Names}}\t{{.Status}}' | grep watchtower
  ```

- [ ] Health check passing
  ```bash
  docker inspect portfolio-ui | grep -A10 Health
  ```

### Build Hash Verification

- [ ] Container serves correct hash
  ```bash
  docker exec portfolio-ui cat /usr/share/nginx/html/index.html | grep -oE 'main-[A-Za-z0-9_-]+\.js'
  # Expected: main-D0fKNExd.js
  ```

- [ ] Direct access works
  ```bash
  curl -s http://localhost:8089/ | grep -oE 'main-[A-Za-z0-9_-]+\.js'
  # Expected: main-D0fKNExd.js
  ```

- [ ] Production site shows new hash
  ```bash
  curl -s https://leoklemet.com/ | grep -oE 'main-[A-Za-z0-9_-]+\.js'
  # Expected: main-D0fKNExd.js (or newer)
  ```

### Functional Testing

- [ ] Homepage loads: https://leoklemet.com/
- [ ] Layout feature visible (if applicable)
- [ ] Assistant panel works
- [ ] Navigation functional
- [ ] All assets load (no 404s in DevTools)

---

## 🔄 Post-Deployment: Test Automation

### Test Automated Deployment

- [ ] Make a small change locally (e.g., update a comment)
- [ ] Commit and push to `main`
  ```bash
  git add .
  git commit -m "test: verify automated deployment"
  git push origin main
  ```

- [ ] Watch GitHub Actions
  - [ ] Go to: https://github.com/leok974/leo-portfolio/actions
  - [ ] Verify workflow starts
  - [ ] Verify build completes (~2-3 min)

- [ ] Watch Watchtower (on server)
  ```bash
  docker logs -f watchtower
  # Should see: "Found new image", "Stopping", "Pulling", "Starting"
  ```

- [ ] Verify new hash live (~3-4 min total)
  ```bash
  curl -s https://leoklemet.com/ | grep -oE 'main-[A-Za-z0-9_-]+\.js'
  # Should show newer hash
  ```

---

## 🎯 Optional Enhancements

### GitHub Secrets (for auto cache purging)

- [ ] Go to: https://github.com/leok974/leo-portfolio/settings/secrets/actions
- [ ] Add `CF_API_TOKEN` (Cloudflare API token with Zone.Cache Purge permission)
- [ ] Add `CF_ZONE_ID` (Zone ID for leoklemet.com)
- [ ] Test: Push to main, verify workflow purges cache automatically

### Watchtower Notifications

- [ ] Set up Slack/Discord webhook
- [ ] Add to `docker-compose.portfolio-ui.yml`:
  ```yaml
  environment:
    - WATCHTOWER_NOTIFICATION_URL=slack://TOKEN@CHANNEL
  ```
- [ ] Restart Watchtower

---

## 📊 Success Criteria

### Deployment Complete When:

✅ **Production Site**:
- [ ] https://leoklemet.com/ serves new build hash
- [ ] Layout feature enabled
- [ ] All E2E test scenarios work
- [ ] No console errors

✅ **Automation Working**:
- [ ] `portfolio-ui` running from `:latest` tag
- [ ] `watchtower` checking every 60s
- [ ] GitHub Actions workflow successful
- [ ] Test deployment (push to main) works

✅ **No SSH Needed**:
- [ ] Future deploys via `git push` only
- [ ] Watchtower auto-updates within 60s

---

## 🚨 Rollback Plan

### Quick Rollback (No SSH)

```bash
docker pull ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0
docker tag ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0 ghcr.io/leok974/leo-portfolio/portfolio:latest
docker push ghcr.io/leok974/leo-portfolio/portfolio:latest
```

---

## 📝 Quick Reference

**Production**: https://leoklemet.com/
**GitHub Actions**: https://github.com/leok974/leo-portfolio/actions
**Docker Images**: https://github.com/leok974/leo-portfolio/pkgs/container/leo-portfolio%2Fportfolio

**Guides**:
- `DEPLOYMENT_QUICKSTART.md` ← Start here!
- `WATCHTOWER_SETUP.md` - Detailed setup
- `AUTOMATED_DEPLOYMENT_STATUS.md` - Architecture

**Timeline**:
- Initial setup: 15-30 minutes (one-time)
- Future deploys: 3-4 minutes (automated)
- Rollback: ~60 seconds (no SSH)

---

## ✅ Sign-Off

**Deployment completed by**: _________________

**Date**: _________________

**Production hash verified**: _________________

**Automated deployment tested**: [ ] Yes [ ] No

---

**Status**: Ready for deployment! 🚀
