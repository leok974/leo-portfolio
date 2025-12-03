# On-Call Runbook

## Incident Response

### 1. Site Down
**Symptoms**: www.leoklemet.com unreachable

**Quick Checks**:
```bash
# Check Cloudflare Tunnel status
curl https://api.leoklemet.com/health

# SSH to prod host
ssh user@prod-host

# Check all containers
docker ps -a
```

**Common Causes**:
- Cloudflare Tunnel crashed → restart container
- Nginx crashed → restart container
- Out of disk space → clean up logs/artifacts

**Resolution**:
```bash
# Restart services
docker restart cloudflared nginx portfolio-backend

# Check logs
docker logs cloudflared --tail 50
docker logs nginx --tail 50
```

### 2. Chat/API Not Responding
**Symptoms**: 502/504 errors on `/chat` or `/api/*`

**Quick Checks**:
```bash
curl https://api.leoklemet.com/api/ready
curl https://api.leoklemet.com/llm/primary/ping
```

**Common Causes**:
- Backend crashed → check logs, restart
- Ollama model timeout → increase timeout or fallback to OpenAI
- Out of memory → check `docker stats`

**Resolution**:
```bash
# Check backend health
docker logs portfolio-backend --tail 100

# Restart backend
docker restart portfolio-backend

# Enable OpenAI fallback if Ollama slow
docker exec portfolio-backend env DISABLE_PRIMARY=1
```

### 3. Slow Response Times
**Symptoms**: Requests taking >5s

**Quick Checks**:
```bash
# Check container resource usage
docker stats --no-stream

# Check Ollama model loaded
docker exec portfolio-ollama ollama ps
```

**Common Causes**:
- Ollama model loading (first request after restart)
- High CPU/memory usage
- Disk I/O bottleneck

**Resolution**:
```bash
# Warm up model
curl -X POST https://api.leoklemet.com/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"hi"}]}'

# Scale resources if needed (Docker Compose)
docker-compose -f docker-compose.prod.yml up -d --scale backend=2
```

### 4. Deployment Failures
**Symptoms**: GitHub Actions workflow fails

**Quick Checks**:
- Check runner status: `gh api repos/leok974/leo-portfolio/actions/runners`
- View workflow logs in GitHub UI
- Check Watchtower logs: `docker logs watchtower`

**Common Causes**:
- Runner offline → SSH to prod, restart runner container
- Watchtower auth failed → verify `WATCHTOWER_HTTP_API_TOKEN`
- Image pull failed → check GHCR authentication

**Resolution**:
```bash
# Restart runner
docker restart gh-runner-prod

# Manually trigger Watchtower
curl -X POST https://api.leoklemet.com/ops/watchtower/update \
  -H "Authorization: Bearer $WATCHTOWER_TOKEN"

# Manual deploy (last resort)
docker pull ghcr.io/leok974/leo-portfolio/backend:latest
docker restart portfolio-backend
```

## Monitoring

### Health Endpoints
- `GET /api/ready` → Backend alive
- `GET /api/dev/status` → Dev overlay status
- `GET /llm/primary/ping` → Ollama model status
- `GET /metrics` → Prometheus metrics (if enabled)

### Logs
```bash
# Backend
docker logs portfolio-backend -f

# Nginx
docker logs nginx -f

# Cloudflare Tunnel
docker logs cloudflared -f

# All services
docker-compose -f docker-compose.prod.yml logs -f
```

### Metrics Dashboard
- Grafana (if deployed): https://grafana.leoklemet.com
- Cloudflare Analytics: https://dash.cloudflare.com

## Escalation
1. Check GitHub Issues for known problems
2. Review recent PRs/deployments
3. Contact @leok974 if persistent

## Useful Commands
```bash
# Quick health check
curl -s https://api.leoklemet.com/api/ready | jq

# Restart all services
docker-compose -f docker-compose.prod.yml restart

# View resource usage
docker stats --no-stream

# Clean up old images
docker image prune -a -f

# Backup database
docker exec portfolio-backend sqlite3 data/rag.sqlite ".backup data/rag-backup-$(date +%Y%m%d).sqlite"
```
