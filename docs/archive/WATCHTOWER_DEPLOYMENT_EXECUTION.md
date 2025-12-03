# Watchtower Production Deployment - Execution Guide

**Date**: October 21, 2025
**Purpose**: Deploy Watchtower HTTP API and force-pull backend with `/api/dev/status` fix
**No SSH Required**: All steps via Cloudflare/console access

---

## ✅ Pre-Deployment Verification

### Files Committed to Main
- ✅ `deploy/docker-compose.portfolio-prod.yml` - Watchtower service added
- ✅ `deploy/nginx/nginx.prod.conf` - `/ops/watchtower/update` endpoint
- ✅ `.github/workflows/redeploy-backend.yml` - Force-pull workflow
- ✅ Latest commits: 231d180, 7c16bc2, 4074c49

### GitHub Secrets Configured
- ✅ `WATCHTOWER_HTTP_API_TOKEN` - Set (updated 57 minutes ago)
- ✅ `WATCHTOWER_UPDATE_URL` - Set (updated 57 minutes ago)

### Backend Fix Ready
- ✅ `/api/dev/status` routing fix committed (bd31e1b, 86b6f7a)
- ✅ Docker image built and pushed to GHCR
- ⏳ Waiting for deployment to production

---

## 🚀 Production Deployment Steps

### Step 1: Prepare Production Files

**Required files on production host** (`/path/to/deploy/`):

1. **docker-compose.portfolio-prod.yml**
   - Pull from main branch (contains watchtower service)
   - Or copy manually from repo

2. **nginx/nginx.prod.conf**
   - Pull from main branch (contains `/ops/watchtower/update` location)
   - Or copy manually from repo

3. **.env.production**
   - Must contain:
     ```bash
     WATCHTOWER_HTTP_API_TOKEN=dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE
     FIGMA_PAT=<your-figma-token-here>
     # ... other existing secrets
     ```
   - **Action**: Create/update this file manually (gitignored)
   - **Note**: Replace `<your-figma-token-here>` with actual Figma PAT from GitHub Secrets

**Deployment method**:

**Option A: Git pull on production**
```bash
cd /path/to/deploy
git pull origin main
# Then manually create/update .env.production
```

**Option B: Copy files manually**
```bash
# Copy from local to production via Cloudflare console/upload
# - docker-compose.portfolio-prod.yml
# - nginx/nginx.prod.conf
# - .env.production (create manually with token)
```

---

### Step 2: Deploy Watchtower & Reload Stack

**On production host** (via Cloudflare console, Tunnel, or your access method):

```bash
cd /path/to/deploy

# Pull latest images (including watchtower)
docker compose -f docker-compose.portfolio-prod.yml pull

# Start/refresh all services (watchtower + backend + nginx)
docker compose -f docker-compose.portfolio-prod.yml up -d

# If nginx config is mounted, it will auto-reload
# If nginx is host-managed separately, reload it:
nginx -t && nginx -s reload || true
```

**Expected output**:
```
[+] Running 3/3
 ✔ Container portfolio-backend     Started
 ✔ Container portfolio-nginx       Started
 ✔ Container portfolio-watchtower  Started
```

---

### Step 3: Verify Watchtower Running

**Check container status**:
```bash
docker ps | grep watchtower
```

**Expected**:
```
CONTAINER ID   IMAGE                         STATUS          PORTS                      NAMES
abc123...      containrrr/watchtower:latest  Up 10 seconds   127.0.0.1:8083->8080/tcp   portfolio-watchtower
```

**Check logs**:
```bash
docker logs portfolio-watchtower --tail=50
```

**Expected output should contain**:
```
level=info msg="Watchtower 1.x.x"
level=info msg="HTTP API enabled on :8080"
level=info msg="Using label-enable mode"
level=info msg="Scheduling first run: 2025-10-21 22:XX:XX"
```

**Test local endpoint**:
```bash
curl -X POST http://127.0.0.1:8083/v1/update \
  -H "Authorization: Bearer dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE"
```

**Expected**: JSON response (e.g., `{"status":"success"}` or similar)

---

### Step 4: Test Public Endpoint (via Nginx)

**From anywhere (local machine works)**:
```bash
curl -sS -X POST https://api.leoklemet.com/ops/watchtower/update \
  -H "Authorization: Bearer dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE"
```

**Expected**: Same JSON response as local test

**If 401 Unauthorized**: Token mismatch (see troubleshooting)
**If 404 Not Found**: Nginx config not loaded (see troubleshooting)
**If 502 Bad Gateway**: Watchtower not running on 127.0.0.1:8083

---

### Step 5: Force-Pull Backend (Trigger Update)

**Option A: GitHub Actions (Recommended)**

1. Go to: https://github.com/leok974/leo-portfolio/actions
2. Select workflow: **"Redeploy Backend via Watchtower"**
3. Click: **"Run workflow"** dropdown
4. Select branch: `main`
5. Click: **"Run workflow"** button
6. Watch the workflow execute (takes ~2-3 minutes)

**Workflow steps**:
- ✅ Trigger Watchtower update (POST to endpoint)
- ✅ Wait for backend to be healthy (polls `/api/ready`)
- ✅ Verify routes (checks OpenAPI schema)
- ✅ Test endpoint (validates `/api/dev/status`)

**Option B: Manual curl**
```bash
# Trigger update
curl -sS -X POST https://api.leoklemet.com/ops/watchtower/update \
  -H "Authorization: Bearer dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE"

# Wait 30 seconds for pull + restart
sleep 30

# Check health
curl -sS https://api.leoklemet.com/api/ready | jq .
```

---

### Step 6: Verify `/api/dev/status` Fix Deployed

**1. Health check**:
```bash
curl -sS https://api.leoklemet.com/api/ready | jq .
```

**Expected**:
```json
{"status": "ready"}
```

**2. Check OpenAPI schema**:
```bash
curl -sS https://api.leoklemet.com/openapi.json | jq '.paths | keys | map(select(test("dev")))'
```

**Expected** (should now include `/api/dev/status`):
```json
[
  "/agent/dev/disable",
  "/agent/dev/enable",
  "/agent/dev/status",
  "/api/dev/status"    ← NEW!
]
```

**3. Test `/api/dev/status` endpoint**:

**Without auth header** (should deny):
```bash
curl -sS https://api.leoklemet.com/api/dev/status | jq .
```

**Expected**:
```json
{
  "ok": true,
  "allowed": false,
  "mode": "denied",
  "source": "none",
  "ts": "2025-10-21T22:30:15Z"
}
```

**With auth header** (should allow):
```bash
curl -sS https://api.leoklemet.com/api/dev/status \
  -H "x-dev-key: a61350cef0487532f2814a54499f3baeb8f207ead09bbc0e24472911ce6e0cc9" | jq .
```

**Expected**:
```json
{
  "ok": true,
  "allowed": true,
  "mode": "token",
  "source": "dev_overlay_key",
  "ts": "2025-10-21T22:30:20Z"
}
```

**4. Test dev overlay in browser**:
```
https://www.leoklemet.com/?dev_overlay=dev
```

**Expected**: Dev overlay badge should display and show `allowed: true`

---

## 🔧 Troubleshooting

### Issue: `401 Unauthorized` on `/ops/watchtower/update`

**Cause**: Token mismatch between:
- Server: `deploy/.env.production` (Watchtower expects)
- GitHub: `WATCHTOWER_HTTP_API_TOKEN` (workflow sends)

**Fix**:
```bash
# On production server
cat deploy/.env.production | grep WATCHTOWER_HTTP_API_TOKEN
# Should output: WATCHTOWER_HTTP_API_TOKEN=dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE

# If different, update .env.production
vim deploy/.env.production

# Restart Watchtower
docker compose -f docker-compose.portfolio-prod.yml restart watchtower

# Verify
docker logs portfolio-watchtower --tail=20
```

---

### Issue: `/ops/watchtower/update` returns `404 Not Found`

**Cause**: Nginx config not loaded or missing `/ops/watchtower/update` location

**Fix**:
```bash
# Check nginx config has the location
grep -A5 "/ops/watchtower/update" deploy/nginx/nginx.prod.conf

# If missing, pull latest config
git pull origin main

# Reload nginx
nginx -t
nginx -s reload

# Or if nginx is containerized
docker compose -f docker-compose.portfolio-prod.yml restart nginx
```

---

### Issue: Backend didn't update / still returns 404

**Cause**: Image unchanged, label missing, or Watchtower didn't pull

**Check 1: Backend has Watchtower label**
```bash
docker inspect portfolio-backend | jq '.[0].Config.Labels["com.centurylinklabs.watchtower.enable"]'
# Should output: "true"
```

**Check 2: Latest image exists in GHCR**
```bash
# On local machine
gh api /user/packages/container/leo-portfolio%2Fbackend/versions | jq '.[0].metadata.container.tags[]'
# Should show: ["latest", "main", "sha-86b6f7a"]
```

**Check 3: Force manual pull**
```bash
# On production server
docker compose -f docker-compose.portfolio-prod.yml pull backend
docker compose -f docker-compose.portfolio-prod.yml up -d backend

# Check logs
docker logs portfolio-backend --tail=50
```

**Check 4: Verify image digest**
```bash
docker inspect portfolio-backend | jq '.[0].Image'
# Compare with GHCR digest
```

---

### Issue: Watchtower container won't start

**Cause**: Missing token, Docker socket permission, port conflict

**Check 1: Token in .env.production**
```bash
cat deploy/.env.production | grep WATCHTOWER
# Must have: WATCHTOWER_HTTP_API_TOKEN=<token>
```

**Check 2: Docker socket accessible**
```bash
ls -l /var/run/docker.sock
# Should have: srw-rw---- 1 root docker
```

**Check 3: Port 8083 not in use**
```bash
netstat -tuln | grep 8083
# Should be empty or show Docker binding
```

**Check logs**:
```bash
docker logs portfolio-watchtower
```

---

## 📊 Post-Deployment Monitoring

### Check Watchtower Activity
```bash
# View update checks
docker logs portfolio-watchtower | grep "Found new"

# View last update
docker logs portfolio-watchtower --tail=20
```

### Monitor Backend Health
```bash
# Continuous health check
watch -n 5 'curl -sS https://api.leoklemet.com/api/ready | jq .'
```

### Check Container Uptime
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
```

---

## 🎯 Success Criteria Checklist

After completing all steps, verify:

- [ ] Watchtower container running (`docker ps | grep watchtower`)
- [ ] Watchtower logs show "HTTP API enabled on :8080"
- [ ] Local endpoint responds: `curl http://127.0.0.1:8083/v1/update`
- [ ] Public endpoint responds: `curl https://api.leoklemet.com/ops/watchtower/update`
- [ ] GitHub Action "Redeploy Backend" succeeds
- [ ] Backend returns 200: `curl https://api.leoklemet.com/api/ready`
- [ ] OpenAPI shows `/api/dev/status` route
- [ ] Endpoint works: `curl https://api.leoklemet.com/api/dev/status`
- [ ] Returns denied without auth, allowed with `x-dev-key` header
- [ ] Dev overlay badge displays on `/?dev_overlay=dev`

---

## 🔄 Future Use

### One-Click Deployments

Whenever backend code changes:

1. **Automatic** (every 5 minutes):
   - Watchtower auto-checks GHCR
   - Pulls and restarts if new image

2. **Manual** (immediate):
   - GitHub Actions → "Redeploy Backend via Watchtower" → Run workflow
   - Or: `curl -X POST https://api.leoklemet.com/ops/watchtower/update -H "Authorization: Bearer <token>"`

### Monitoring

```bash
# Check for updates
docker logs portfolio-watchtower | grep "Found new"

# Force update check
curl -X POST https://api.leoklemet.com/ops/watchtower/update \
  -H "Authorization: Bearer dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE"
```

---

## 📚 Related Documentation

- **WATCHTOWER_FORCE_PULL_SETUP.md** - Technical architecture and setup
- **WATCHTOWER_DEPLOYMENT_CHECKLIST.md** - Detailed deployment checklist
- **WATCHTOWER_IMPLEMENTATION_COMPLETE.md** - Implementation summary
- **NIGHTLY_SECRET_DEPLOYMENT.md** - Automated secret deployment

---

## 🎉 What This Achieves

✅ **No SSH Required** - All updates via HTTP API
✅ **One-Click Deployments** - GitHub Actions button
✅ **Immediate Updates** - Force-pull on demand
✅ **Automated Updates** - 5-minute check interval
✅ **Secure** - Token-based authentication
✅ **Monitored** - Logs and health checks
✅ **Safe** - Health checks before declaring success

---

**Current Status**: Ready to deploy
**Next Action**: Execute Step 1 (prepare production files)
**Estimated Time**: 10-15 minutes total
