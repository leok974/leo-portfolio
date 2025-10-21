# 🎯 Watchtower Production Deployment - READY TO EXECUTE

**Date**: October 21, 2025  
**Status**: ✅ All code complete and pushed  
**Action Required**: Deploy to production server  

---

## 📋 Quick Status

### ✅ Completed
- [x] Watchtower service configuration (`docker-compose.portfolio-prod.yml`)
- [x] Nginx proxy endpoint (`nginx.prod.conf` → `/ops/watchtower/update`)
- [x] GitHub Action workflow (`.github/workflows/redeploy-backend.yml`)
- [x] API token generated and documented
- [x] GitHub Secrets configured:
  - `WATCHTOWER_HTTP_API_TOKEN`
  - `WATCHTOWER_UPDATE_URL`
- [x] Backend `/api/dev/status` fix committed (bd31e1b, 86b6f7a)
- [x] Docker image built and pushed to GHCR
- [x] All documentation created and pushed

### ⏳ Pending (Your Action)
- [ ] Deploy files to production server
- [ ] Create `.env.production` with Watchtower token
- [ ] Run `docker compose up -d` to start Watchtower
- [ ] Test Watchtower endpoint
- [ ] Trigger force-pull via GitHub Actions
- [ ] Verify `/api/dev/status` works

---

## 🚀 DEPLOYMENT STEPS (Copy-Paste Ready)

### Quick Links to Documentation
- **Full Guide**: `WATCHTOWER_DEPLOYMENT_EXECUTION.md`
- **Commands Only**: `WATCHTOWER_QUICK_COMMANDS.md`
- **Technical Details**: `WATCHTOWER_FORCE_PULL_SETUP.md`
- **Checklist**: `WATCHTOWER_DEPLOYMENT_CHECKLIST.md`

### Step 1: Prepare Files on Production

**If server has git access**:
```bash
cd /path/to/deploy
git pull origin main
```

**Files needed**:
- `deploy/docker-compose.portfolio-prod.yml` (has watchtower service)
- `deploy/nginx/nginx.prod.conf` (has `/ops/watchtower/update` location)
- `deploy/.env.production` (create manually with token - see below)

### Step 2: Create `.env.production`

**On production server**, create/update:
```bash
cat > deploy/.env.production << 'EOF'
WATCHTOWER_HTTP_API_TOKEN=dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE
FIGMA_PAT=<get-from-github-secrets>
FIGMA_TEAM_ID=
FIGMA_TEMPLATE_KEY=
EOF
```

### Step 3: Deploy Stack

```bash
cd /path/to/deploy

# Pull latest images (including watchtower)
docker compose -f docker-compose.portfolio-prod.yml pull

# Start/refresh all services
docker compose -f docker-compose.portfolio-prod.yml up -d

# Reload nginx if needed
nginx -t && nginx -s reload || true
```

### Step 4: Verify Watchtower Running

```bash
docker ps | grep watchtower
docker logs portfolio-watchtower --tail=50
```

**Expected logs**: "HTTP API enabled on :8080", "label-enable mode"

### Step 5: Test Watchtower Endpoint

```bash
curl -X POST https://api.leoklemet.com/ops/watchtower/update \
  -H "Authorization: Bearer dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE"
```

**Expected**: JSON response (success message)

### Step 6: Force-Pull Backend

**GitHub Actions** (easiest):
1. Go to: https://github.com/leok974/leo-portfolio/actions
2. Click: "Redeploy Backend via Watchtower"
3. Click: "Run workflow" → "Run workflow"
4. Watch it complete (~2 minutes)

**Manual curl**:
```bash
curl -X POST https://api.leoklemet.com/ops/watchtower/update \
  -H "Authorization: Bearer dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE"

sleep 30  # Wait for pull + restart

curl https://api.leoklemet.com/api/ready
```

### Step 7: Verify `/api/dev/status` Works

```bash
# Check route exists
curl https://api.leoklemet.com/openapi.json | jq '.paths | has("/api/dev/status")'
# Should return: true

# Test endpoint (no auth - should deny)
curl https://api.leoklemet.com/api/dev/status | jq .
# Should return: {"ok":true,"allowed":false,"mode":"denied",...}

# Test endpoint (with auth - should allow)
curl -H "x-dev-key: a61350cef0487532f2814a54499f3baeb8f207ead09bbc0e24472911ce6e0cc9" \
  https://api.leoklemet.com/api/dev/status | jq .
# Should return: {"ok":true,"allowed":true,"mode":"token",...}
```

### Step 8: Test Dev Overlay in Browser

Visit:
```
https://www.leoklemet.com/?dev_overlay=dev
```

**Expected**: Badge displays and shows `allowed: true`

---

## 🎉 SUCCESS CRITERIA

After completing all steps, all of these should work:

```bash
# 1. Watchtower running
docker ps | grep watchtower
✅ Container "portfolio-watchtower" running

# 2. Endpoint accessible
curl -X POST https://api.leoklemet.com/ops/watchtower/update -H "Authorization: Bearer <token>"
✅ Returns JSON success

# 3. Backend healthy
curl https://api.leoklemet.com/api/ready
✅ Returns {"status":"ready"}

# 4. Route exists
curl https://api.leoklemet.com/openapi.json | jq '.paths | has("/api/dev/status")'
✅ Returns true

# 5. Endpoint works
curl https://api.leoklemet.com/api/dev/status
✅ Returns {"ok":true,"allowed":false,...}

# 6. GitHub Action succeeds
Actions → "Redeploy Backend via Watchtower" → Run workflow
✅ All steps pass
```

---

## 🔧 Troubleshooting Quick Reference

| Issue | Quick Fix |
|-------|-----------|
| **401 Unauthorized** | Check token in `.env.production` matches GitHub Secret |
| **404 Not Found** | Verify nginx config has `/ops/watchtower/update` location |
| **Backend not updating** | Run: `docker compose pull backend && docker compose up -d backend` |
| **Watchtower won't start** | Check `.env.production` has `WATCHTOWER_HTTP_API_TOKEN` |

**Full troubleshooting**: See `WATCHTOWER_DEPLOYMENT_EXECUTION.md`

---

## 📊 What This Achieves

✅ **No SSH Required** - Deploy via HTTP API  
✅ **One-Click Deployments** - GitHub Actions button  
✅ **Immediate Force-Pull** - No waiting for 5-min interval  
✅ **Fixes Current Blocker** - `/api/dev/status` 404 → 200  
✅ **Automated Updates** - Still checks every 5 minutes  
✅ **Secure** - Token authentication, HTTPS only  

---

## 🔗 Resources

### Documentation (in this repo)
- `WATCHTOWER_DEPLOYMENT_EXECUTION.md` - Full deployment guide
- `WATCHTOWER_QUICK_COMMANDS.md` - Command reference
- `WATCHTOWER_FORCE_PULL_SETUP.md` - Technical architecture
- `WATCHTOWER_DEPLOYMENT_CHECKLIST.md` - Detailed checklist
- `WATCHTOWER_IMPLEMENTATION_COMPLETE.md` - Summary

### GitHub
- **Workflow**: https://github.com/leok974/leo-portfolio/actions/workflows/redeploy-backend.yml
- **Latest Commits**: 859acf1, 231d180, 7c16bc2, 4074c49

### Production Endpoints
- **Watchtower Trigger**: `POST https://api.leoklemet.com/ops/watchtower/update`
- **Backend Health**: `GET https://api.leoklemet.com/api/ready`
- **Dev Status**: `GET https://api.leoklemet.com/api/dev/status`
- **OpenAPI**: `GET https://api.leoklemet.com/openapi.json`

---

## 💡 Copy-Paste Token Reference

**Watchtower API Token**:
```
dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE
```

**Dev Overlay Key** (for testing):
```
a61350cef0487532f2814a54499f3baeb8f207ead09bbc0e24472911ce6e0cc9
```

---

## ⏱️ Estimated Time

- **Initial deployment**: 10-15 minutes
- **Force-pull via Actions**: 2-3 minutes
- **Verification**: 5 minutes
- **Total**: ~20-25 minutes

---

## 🎯 Next Action

**YOU**: Execute deployment steps on production server

**Start here**: Step 1 in `WATCHTOWER_QUICK_COMMANDS.md`

**OR use full guide**: `WATCHTOWER_DEPLOYMENT_EXECUTION.md`

---

**Status**: READY TO DEPLOY ✅  
**Blocker**: Requires production server access to run docker compose commands  
**Result**: Once deployed, `/api/dev/status` will work and you can force-pull anytime via GitHub Actions
