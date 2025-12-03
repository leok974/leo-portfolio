# Watchtower Deployment Checklist

## Production Server Setup Steps

After pushing the Watchtower configuration, deploy these changes to production:

### 1. Update Docker Compose File

**On production server**:
```bash
# Pull latest compose file
cd /path/to/deploy
git pull origin main  # or download the updated file

# Or manually update docker-compose.portfolio-prod.yml with the new watchtower service
```

### 2. Deploy Environment Variables

**Create/Update** `deploy/.env.production` with:
```bash
WATCHTOWER_HTTP_API_TOKEN=dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE
```

**Note**: This file is gitignored. You must create it manually on the server or use the nightly secret deployment workflow.

### 3. Update Nginx Configuration

**Deploy** the updated `deploy/nginx/nginx.prod.conf` with the new `/ops/watchtower/update` location.

**Options**:
- If nginx config is in a Docker volume, rebuild the nginx image
- If nginx runs separately, copy the new config and reload:
  ```bash
  nginx -t  # test config
  nginx -s reload
  ```

### 4. Start Updated Stack

```bash
cd /path/to/deploy
docker compose -f docker-compose.portfolio-prod.yml pull
docker compose -f docker-compose.portfolio-prod.yml up -d
```

**This will**:
- Pull Watchtower image
- Start Watchtower container
- Keep existing backend/nginx running
- Watchtower begins monitoring

### 5. Verify Watchtower is Running

```bash
docker ps | grep watchtower
# Should show: portfolio-watchtower

docker logs portfolio-watchtower
# Should show: "Watchtower 1.x.x" and "HTTP API enabled on :8080"
```

### 6. Test Manual Trigger (Local)

**From production server**:
```bash
curl -sS -X POST http://127.0.0.1:8083/v1/update \
  -H "Authorization: Bearer dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE"
```

**Expected**: JSON response indicating update check started

### 7. Test via Nginx Proxy

**From anywhere**:
```bash
curl -sS -X POST https://api.leoklemet.com/ops/watchtower/update \
  -H "Authorization: Bearer dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE"
```

**Expected**: Same JSON response as local test

### 8. Test GitHub Action Workflow

1. Go to: https://github.com/leok974/leo-portfolio/actions
2. Select: **Redeploy Backend via Watchtower**
3. Click: **Run workflow** → **Run workflow**
4. Watch the workflow execute

**Expected**:
- ✅ Trigger Watchtower update
- ✅ Wait for backend to be healthy
- ✅ Verify routes
- ✅ Test endpoint

## Current Status

### ✅ Completed
- [x] Watchtower service added to compose file
- [x] Token generated and documented
- [x] Nginx proxy endpoint configured
- [x] GitHub Action workflow created
- [x] GitHub Secrets configured:
  - `WATCHTOWER_HTTP_API_TOKEN`
  - `WATCHTOWER_UPDATE_URL`
- [x] Changes committed and pushed

### ⏳ Pending (Production Deployment)
- [ ] Deploy `.env.production` with token
- [ ] Deploy updated `docker-compose.portfolio-prod.yml`
- [ ] Deploy updated `nginx.prod.conf`
- [ ] Restart Docker Compose stack
- [ ] Verify Watchtower running
- [ ] Test manual trigger
- [ ] Test GitHub Action workflow

## Quick Commands Reference

### Deploy .env.production
```bash
# Option 1: Use nightly deployment workflow (recommended)
# Wait for next 3 AM UTC run, or trigger manually

# Option 2: Manual deployment
scp deploy/.env.production user@server:/path/to/deploy/.env.production
```

### Restart Stack
```bash
docker compose -f docker-compose.portfolio-prod.yml up -d
```

### Check Watchtower Status
```bash
docker logs portfolio-watchtower --tail=50
```

### Force Update Now
```bash
curl -X POST https://api.leoklemet.com/ops/watchtower/update \
  -H "Authorization: Bearer dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE"
```

### Verify Backend Updated
```bash
curl https://api.leoklemet.com/api/ready
curl https://api.leoklemet.com/openapi.json | jq '.paths | keys | map(select(test("dev")))'
```

## Troubleshooting

### Watchtower won't start
```bash
# Check logs
docker logs portfolio-watchtower

# Common issues:
# - Missing WATCHTOWER_HTTP_API_TOKEN in .env.production
# - Docker socket permission denied
# - Port 8083 already in use
```

### 401 Unauthorized
```bash
# Token mismatch - verify token matches in:
cat deploy/.env.production | grep WATCHTOWER
gh secret list | grep WATCHTOWER

# If different, update and restart
docker compose -f docker-compose.portfolio-prod.yml restart watchtower
```

### Update not triggering
```bash
# Manual pull and restart
docker compose -f docker-compose.portfolio-prod.yml pull backend
docker compose -f docker-compose.portfolio-prod.yml up -d backend
```

## Success Criteria

After deployment, you should be able to:

1. ✅ Run GitHub Action to trigger update
2. ✅ Backend automatically pulls latest image
3. ✅ Backend restarts with new code
4. ✅ `/api/dev/status` endpoint works
5. ✅ No manual SSH/docker commands needed

## Next Steps

Once deployed and tested:

1. Test force-pull for the current `/api/dev/status` fix
2. Verify endpoint returns 200 (not 404)
3. Document in deployment runbook
4. Consider adding webhook triggers for auto-deploy on push
