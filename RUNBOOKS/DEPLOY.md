# Deployment Runbook

## Quick Reference
- **Production URL**: https://www.leoklemet.com
- **API URL**: https://api.leoklemet.com
- **Deploy Method**: GitHub Actions → Watchtower
- **Health Check**: `curl https://api.leoklemet.com/api/ready`

## Prerequisites
- GitHub `main` branch is green (all checks passed)
- Self-hosted runner is online (`self-hosted,prod,deploy`)
- Secrets configured in GitHub `production` environment
- Watchtower running on prod host

## Deployment Steps

### 1. Check Runner Status
```bash
gh api repos/leok974/leo-portfolio/actions/runners \
  --jq '.runners[] | select(.labels[].name | contains("prod"))'
```
Expected: `status: "online"`

### 2. Bootstrap Watchtower (First Time Only)
```bash
gh workflow run bootstrap-watchtower.yml
gh run list --workflow "Bootstrap Watchtower" --limit 1
```
- Approve deployment in GitHub Actions UI
- Verify: `curl -X POST https://api.leoklemet.com/ops/watchtower/update -H "Authorization: Bearer $WATCHTOWER_TOKEN"`

### 3. Deploy Backend
```bash
gh workflow run redeploy-backend.yml
gh run list --workflow "Redeploy Backend" --limit 1
```
- Approve deployment in GitHub Actions UI
- Wait ~30s for image pull + restart

### 4. Verify Health
```bash
# Backend ready
curl https://api.leoklemet.com/api/ready

# Dev overlay status
curl https://api.leoklemet.com/api/dev/status

# OpenAPI spec
curl https://api.leoklemet.com/openapi.json | jq '.paths | keys'
```

Expected responses:
- `/api/ready` → `{"status": "ready"}`
- `/api/dev/status` → `{"ok": true, "allowed": false}`
- OpenAPI includes `/agent/brand/card`, `/chat`, `/chat/stream`

## Rollback
If deployment fails:

```bash
# SSH to prod host (via Cloudflare Tunnel)
ssh user@prod-host

# Check running containers
docker ps

# View backend logs
docker logs portfolio-backend --tail 100

# Rollback to previous image
docker tag ghcr.io/leok974/leo-portfolio/backend:previous ghcr.io/leok974/leo-portfolio/backend:latest
docker restart portfolio-backend
```

## Common Issues

### 502 Bad Gateway
- Backend failed healthcheck
- Check logs: `docker logs portfolio-backend`
- Common causes: missing env var, model not loaded, import error

### Watchtower 404
- Watchtower not running or nginx misconfigured
- Check nginx proxy: `/ops/watchtower/` → `http://watchtower:8080/`
- Restart Watchtower: `docker restart watchtower`

### Model Not Loading
- Ollama model `gpt-oss:20b` missing
- Check: `docker exec portfolio-ollama ollama list`
- Pull model: `docker exec portfolio-ollama ollama pull gpt-oss:20b`

## Environment Secrets
(Configured in GitHub → Settings → Environments → production)
- `WATCHTOWER_HTTP_API_TOKEN`
- `FIGMA_PAT`, `FIGMA_TEMPLATE_KEY`, `FIGMA_TEAM_ID`
- `OPENAI_API_KEY`
- `CLOUDFLARE_TUNNEL_TOKEN`

**Never commit these values**. Rotate if exposed.
