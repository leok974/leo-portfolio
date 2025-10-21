# Watchtower Force-Pull Implementation Complete

**Date**: October 21, 2025  
**Status**: ✅ Code Complete - Awaiting Production Deployment  
**Commits**: 
- `4074c49` - feat: Add Watchtower HTTP API for force-pull deployments
- `7c16bc2` - docs: Add Watchtower deployment checklist for production

## Summary

Successfully implemented Watchtower HTTP API for force-pulling backend updates without SSH access. This enables one-click deployments via GitHub Actions or manual curl commands.

## What Was Built

### 1. Watchtower Container (Docker Compose)
**File**: `deploy/docker-compose.portfolio-prod.yml`

Added `watchtower` service with:
- HTTP API enabled on port 8083 (localhost only)
- Label-based container monitoring
- 5-minute automatic check interval
- Immediate update via HTTP POST endpoint
- Token-based authentication
- Automatic cleanup of old images

### 2. Nginx Proxy Endpoint
**File**: `deploy/nginx/nginx.prod.conf`

Added `/ops/watchtower/update` location that:
- Proxies to Watchtower HTTP API (127.0.0.1:8083)
- Forwards Authorization header
- Accessible via `https://api.leoklemet.com/ops/watchtower/update`
- Secured by Bearer token authentication

### 3. GitHub Action Workflow
**File**: `.github/workflows/redeploy-backend.yml`

Created **Redeploy Backend via Watchtower** workflow:
- Manual trigger via workflow_dispatch
- Posts to Watchtower endpoint with token
- Waits for backend to become healthy
- Verifies routes in OpenAPI schema
- Tests `/api/dev/status` endpoint
- Comprehensive error handling and logging

### 4. Environment Configuration
**File**: `deploy/.env.production` (gitignored)

Generated strong API token:
```bash
WATCHTOWER_HTTP_API_TOKEN=dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE
```

### 5. GitHub Secrets
Configured via `gh secret set`:
- `WATCHTOWER_HTTP_API_TOKEN` - API authentication token
- `WATCHTOWER_UPDATE_URL` - Full endpoint URL

### 6. Documentation
Created comprehensive guides:
- `WATCHTOWER_FORCE_PULL_SETUP.md` - Technical setup documentation
- `WATCHTOWER_DEPLOYMENT_CHECKLIST.md` - Production deployment steps

## How It Works

### Architecture Flow
```
Developer triggers GitHub Action
    ↓
GitHub Actions runner executes workflow
    ↓
POST https://api.leoklemet.com/ops/watchtower/update
    ↓
Cloudflare → nginx → Watchtower (localhost:8083)
    ↓
Watchtower authenticates token
    ↓
Watchtower checks GHCR for new images
    ↓
Pulls latest :latest tags for labeled containers
    ↓
Restarts containers with new images
    ↓
Backend running with latest code
```

### Monitored Containers
Containers with label `com.centurylinklabs.watchtower.enable: "true"`:
- ✅ `portfolio-backend` (FastAPI)
- ✅ `portfolio-nginx` (frontend)

### Update Trigger Options

**Option 1: GitHub Actions** (Recommended)
```
1. Go to: https://github.com/leok974/leo-portfolio/actions
2. Select: "Redeploy Backend via Watchtower"
3. Click: "Run workflow" → "Run workflow"
4. Watch automated deployment
```

**Option 2: Manual curl**
```bash
curl -sS -X POST https://api.leoklemet.com/ops/watchtower/update \
  -H "Authorization: Bearer dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE"
```

**Option 3: Automatic** (Existing)
- Watchtower checks every 5 minutes
- Auto-pulls and restarts if new image available

## Security Features

✅ **Token Authentication**: 32-byte URL-safe random token  
✅ **HTTPS Only**: Endpoint only accessible via HTTPS  
✅ **Localhost Binding**: Watchtower port not exposed to internet  
✅ **No Public Access**: Only via Cloudflare reverse proxy  
✅ **Bearer Token**: Standard OAuth 2.0 authentication pattern  
✅ **Secret Management**: Token stored in GitHub Secrets and .env file  

## Production Deployment Steps

### Prerequisites
- Docker Compose running on production server
- Access to update compose files and env files
- Nginx config deployment method

### Deployment Checklist

1. ✅ **Code pushed to GitHub** (commits 4074c49, 7c16bc2)
2. ⏳ **Deploy `.env.production`** with token to server
3. ⏳ **Deploy updated `docker-compose.portfolio-prod.yml`**
4. ⏳ **Deploy updated `nginx.prod.conf`**
5. ⏳ **Restart Docker Compose stack**
6. ⏳ **Verify Watchtower container running**
7. ⏳ **Test manual trigger locally**
8. ⏳ **Test via nginx proxy endpoint**
9. ⏳ **Test GitHub Action workflow**

### Quick Deploy Commands
```bash
# On production server
cd /path/to/deploy

# Pull latest configs
git pull origin main

# Deploy .env.production (manually or via secret deployment)
# (contains WATCHTOWER_HTTP_API_TOKEN)

# Restart stack with new Watchtower service
docker compose -f docker-compose.portfolio-prod.yml up -d

# Verify
docker ps | grep watchtower
docker logs portfolio-watchtower

# Test
curl -X POST https://api.leoklemet.com/ops/watchtower/update \
  -H "Authorization: Bearer dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE"
```

## Immediate Use Case

This Watchtower setup solves the **current blocker**:

**Problem**: `/api/dev/status` fix pushed to GHCR but not deployed to production
- ✅ Code fixed in commits bd31e1b, 86b6f7a
- ✅ Docker image built and pushed (sha256:a55422196d63293d54075df7b1885c2c7bddfd20c67878f79b54507b7685affc)
- ❌ Production still returns 404
- ❌ No SSH access to manually restart containers

**Solution**: Once Watchtower is deployed, trigger immediate pull:
1. Deploy Watchtower to production (steps above)
2. Run GitHub Action: "Redeploy Backend via Watchtower"
3. Backend pulls latest image with `/api/dev/status` fix
4. Backend restarts automatically
5. Endpoint immediately available

## Testing Plan

After production deployment:

### 1. Verify Watchtower Running
```bash
docker ps | grep watchtower
# Expected: portfolio-watchtower container running
```

### 2. Check Watchtower Logs
```bash
docker logs portfolio-watchtower --tail=50
# Expected: "HTTP API enabled on :8080"
```

### 3. Test Local Endpoint
```bash
curl -X POST http://127.0.0.1:8083/v1/update \
  -H "Authorization: Bearer <token>"
# Expected: JSON success response
```

### 4. Test Public Endpoint
```bash
curl -X POST https://api.leoklemet.com/ops/watchtower/update \
  -H "Authorization: Bearer <token>"
# Expected: Same JSON success response
```

### 5. Test GitHub Action
- Trigger "Redeploy Backend via Watchtower" workflow
- Verify all steps succeed:
  - ✅ Trigger Watchtower update
  - ✅ Wait for backend healthy
  - ✅ Verify routes
  - ✅ Test endpoint

### 6. Verify Backend Updated
```bash
curl https://api.leoklemet.com/api/dev/status
# Expected: {"ok":true,"allowed":false,"mode":"denied",...}
# NOT: {"detail":"Not Found"}
```

### 7. Check OpenAPI Schema
```bash
curl https://api.leoklemet.com/openapi.json | jq '.paths | keys | map(select(test("dev")))'
# Expected: ["/agent/dev/...", "/api/dev/status"]
```

## Monitoring & Maintenance

### Check Update History
```bash
docker logs portfolio-watchtower | grep "Found new"
```

### Force Update Anytime
```bash
# Via GitHub Actions
Actions → Redeploy Backend via Watchtower → Run workflow

# Via curl
curl -X POST https://api.leoklemet.com/ops/watchtower/update \
  -H "Authorization: Bearer <token>"
```

### Rotate Token
```bash
# 1. Generate new token
python -c "import secrets; print(secrets.token_urlsafe(32))"

# 2. Update .env.production
vim deploy/.env.production

# 3. Update GitHub Secret
gh secret set WATCHTOWER_HTTP_API_TOKEN --body "<new-token>"

# 4. Restart Watchtower
docker compose -f docker-compose.portfolio-prod.yml restart watchtower
```

## Benefits

✅ **No SSH Required**: Deployments via HTTP API only  
✅ **One-Click Deployments**: GitHub Actions button click  
✅ **Secure**: Token-based authentication, HTTPS only  
✅ **Automated**: Still checks every 5 minutes automatically  
✅ **Fast**: Immediate pull on demand, no waiting  
✅ **Monitored**: GitHub Actions provides deployment logs  
✅ **Safe**: Health checks ensure backend is ready  

## Files Changed

### New Files
- `.github/workflows/redeploy-backend.yml` - GitHub Action workflow
- `WATCHTOWER_FORCE_PULL_SETUP.md` - Technical documentation
- `WATCHTOWER_DEPLOYMENT_CHECKLIST.md` - Deployment guide

### Modified Files
- `deploy/docker-compose.portfolio-prod.yml` - Added watchtower service
- `deploy/nginx/nginx.prod.conf` - Added /ops/watchtower/update endpoint
- `deploy/.env.production` - Added WATCHTOWER_HTTP_API_TOKEN (gitignored)

### GitHub Secrets Configured
- `WATCHTOWER_HTTP_API_TOKEN` - API authentication
- `WATCHTOWER_UPDATE_URL` - Endpoint URL

## Next Steps

1. **Deploy to Production** (see `WATCHTOWER_DEPLOYMENT_CHECKLIST.md`)
2. **Test Force-Pull** - Trigger update for current `/api/dev/status` fix
3. **Verify Endpoint** - Confirm `/api/dev/status` returns 200
4. **Document** - Update deployment runbook with Watchtower usage
5. **Monitor** - Watch first automated update cycle

## Related Documentation

- `WATCHTOWER_FORCE_PULL_SETUP.md` - Detailed technical setup
- `WATCHTOWER_DEPLOYMENT_CHECKLIST.md` - Production deployment steps
- `NIGHTLY_SECRET_DEPLOYMENT.md` - Automated secret deployment
- `deploy/docker-compose.portfolio-prod.yml` - Production compose file
- `.github/workflows/redeploy-backend.yml` - Deployment workflow

## Success Criteria

After production deployment, the following should work:

1. ✅ GitHub Action triggers Watchtower
2. ✅ Watchtower pulls latest images
3. ✅ Backend restarts with new code
4. ✅ Health checks pass
5. ✅ Routes verified in OpenAPI
6. ✅ `/api/dev/status` returns 200
7. ✅ No manual SSH/docker commands needed

---

**Status**: Ready for production deployment  
**Action Required**: Deploy updated files to production server and test  
**Blocked By**: Production server access (for initial setup)  
**Unblocks**: Immediate force-pull of `/api/dev/status` fix and all future deployments
