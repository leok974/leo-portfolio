# One-Time Bootstrap: Watchtower + Nginx Endpoint

**Purpose**: Enable force-pull deployments via HTTP API (no SSH needed after this)  
**Time**: ~5 minutes  
**Frequency**: One-time only

---

## Prerequisites

- You are on the production host with access to the repo's `deploy/` folder
- Docker and docker-compose are installed
- You have the actual token values (WATCHTOWER_HTTP_API_TOKEN, FIGMA_PAT)

---

## Quick Overview

This bootstrap will:
1. Deploy Watchtower container with HTTP API enabled
2. Update nginx to expose `/ops/watchtower/update` endpoint
3. Configure authentication token
4. Enable one-click deployments via GitHub Actions

**After this**: No production server access needed - all deployments via GitHub Actions.

---

## Steps (Copy/Paste Ready)

### Step 1: Pull Latest Configs

```bash
cd /path/to/deploy

# Pull latest docker-compose and nginx configs
git pull origin main || true
```

### Step 2: Create Environment File

**IMPORTANT**: Replace `<REDACTED_TOKEN>` with actual token values before running!

```bash
cat > ./.env.production << 'EOF'
# Watchtower HTTP API Authentication
WATCHTOWER_HTTP_API_TOKEN=<REDACTED_TOKEN>

# Figma MCP Integration
FIGMA_PAT=<REDACTED_FIGMA>
FIGMA_TEAM_ID=
FIGMA_TEMPLATE_KEY=<YOUR_FIGMA_FILE_KEY>

# Add other production secrets as needed
# FALLBACK_API_KEY=sk-...
# CF_ACCESS_TEAM_DOMAIN=...
EOF
```

**Token Reference** (get actual values from GitHub Secrets or password manager):
- `WATCHTOWER_HTTP_API_TOKEN`: 32-byte URL-safe token for Watchtower API
- `FIGMA_PAT`: Figma Personal Access Token (starts with `figd_`)

### Step 3: Deploy Services

```bash
# Pull latest images (including watchtower)
docker compose -f docker-compose.portfolio-prod.yml pull

# Start/refresh all services (watchtower + backend + nginx)
docker compose -f docker-compose.portfolio-prod.yml up -d
```

**Expected output**:
```
[+] Running 3/3
 ✔ Container portfolio-backend     Started
 ✔ Container portfolio-nginx       Started
 ✔ Container portfolio-watchtower  Started
```

### Step 4: Reload Nginx (if host-managed)

**Only needed if nginx runs on host** (not in Docker):

```bash
nginx -t && nginx -s reload || true
```

**If nginx is containerized**: Skip this - restart handled by Step 3.

### Step 5: Verify Deployment

**Check Watchtower running**:
```bash
docker ps | grep watchtower
```

**Expected**:
```
abc123...  containrrr/watchtower:latest  Up 10 seconds  127.0.0.1:8083->8080/tcp  portfolio-watchtower
```

**Check Watchtower logs**:
```bash
docker logs portfolio-watchtower --tail=20
```

**Expected to see**:
```
level=info msg="Watchtower 1.x.x"
level=info msg="HTTP API enabled on :8080"
level=info msg="Using label-enable mode"
```

**Test Watchtower endpoint**:
```bash
curl -sS -X POST https://api.leoklemet.com/ops/watchtower/update \
  -H "Authorization: Bearer <REDACTED_TOKEN>" | jq .
```

**Expected**: JSON response (e.g., `{"status":"success"}`)  
**NOT**: `{"detail":"Not Found"}` (404)

**Test backend health**:
```bash
curl -sS https://api.leoklemet.com/api/ready | jq .
```

**Expected**: `{"status":"ready"}` or similar

---

## Verification Checklist

After completing all steps, verify:

- [ ] `docker ps | grep watchtower` shows container running
- [ ] `docker logs portfolio-watchtower` shows "HTTP API enabled"
- [ ] `curl POST /ops/watchtower/update` returns 200/204 (not 404)
- [ ] `curl GET /api/ready` returns 200
- [ ] `.env.production` file exists with correct token

---

## What This Enables

**After this bootstrap**:

✅ **One-click deployments**: GitHub Actions → "Redeploy Backend via Watchtower" → Run workflow  
✅ **Force-pull anytime**: No waiting for 5-minute auto-check  
✅ **No SSH needed**: All future deployments via HTTPS endpoint  
✅ **Automated updates**: Watchtower still checks every 5 minutes automatically  
✅ **Secure**: Token-based authentication, HTTPS only  

---

## Troubleshooting

### Watchtower container won't start

**Check**: `.env.production` has `WATCHTOWER_HTTP_API_TOKEN`
```bash
cat ./.env.production | grep WATCHTOWER
```

**Fix**: Ensure token is set, then restart:
```bash
docker compose -f docker-compose.portfolio-prod.yml restart watchtower
```

### 404 on `/ops/watchtower/update`

**Check**: Nginx config has the location
```bash
grep -A5 "/ops/watchtower/update" nginx/nginx.prod.conf
```

**Fix**: If missing, pull latest config and reload:
```bash
git pull origin main
nginx -t && nginx -s reload
# OR if containerized:
docker compose -f docker-compose.portfolio-prod.yml restart nginx
```

### 401 Unauthorized

**Check**: Token mismatch
```bash
# Server token
cat ./.env.production | grep WATCHTOWER_HTTP_API_TOKEN

# Test with exact token from file
TOKEN=$(grep WATCHTOWER_HTTP_API_TOKEN ./.env.production | cut -d= -f2)
curl -X POST https://api.leoklemet.com/ops/watchtower/update \
  -H "Authorization: Bearer $TOKEN"
```

### Backend not updating

**Check**: Backend has Watchtower label
```bash
docker inspect portfolio-backend | grep -A2 watchtower.enable
```

**Expected**: `"com.centurylinklabs.watchtower.enable": "true"`

---

## Next Steps After Bootstrap

1. **Trigger first deployment**:
   - Go to: https://github.com/leok974/leo-portfolio/actions
   - Click: "Redeploy Backend via Watchtower"
   - Click: "Run workflow"

2. **Verify deployment worked**:
   ```bash
   curl https://api.leoklemet.com/api/dev/status | jq .
   # Should return: {"ok":true,"allowed":false,...}
   # NOT: {"detail":"Not Found"}
   ```

3. **Test dev overlay**:
   - Visit: https://www.leoklemet.com/?dev_overlay=dev
   - Badge should display and show status

---

## Files Involved

- `deploy/docker-compose.portfolio-prod.yml` - Watchtower service definition
- `deploy/nginx/nginx.prod.conf` - `/ops/watchtower/update` endpoint
- `deploy/.env.production` - Secrets (WATCHTOWER_HTTP_API_TOKEN)

---

## Support Documentation

- **WATCHTOWER_DEPLOYMENT_EXECUTION.md** - Detailed deployment guide
- **WATCHTOWER_QUICK_COMMANDS.md** - Command reference
- **DEPLOYMENT_ATTEMPT_404_ANALYSIS.md** - Why this bootstrap is needed
- **BOOTSTRAP_CHECKLIST.md** - Verification checklist

---

**Status After Bootstrap**: ✅ Ready for GitHub Actions deployments  
**Time Investment**: 5 minutes now, saves hours of SSH work forever  
**Result**: One-click deployments enabled
