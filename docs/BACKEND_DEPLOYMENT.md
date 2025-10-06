# Backend Deployment to assistant.ledger-mind.org

## Automatic Deployment (Recommended)

Every push to `main` triggers the `publish-backend.yml` GitHub Action which:

1. ✅ Runs Python tests (`pytest`)
2. ✅ Builds multi-arch Docker image (linux/amd64, linux/arm64)
3. ✅ Pushes to GitHub Container Registry: `ghcr.io/leok974/leo-portfolio/backend:main`

### Monitoring Deployments

```powershell
# Check workflow status
gh run list --workflow="publish-backend.yml" --limit 5

# Watch live progress
gh run watch

# View logs
gh run view --log
```

### Deploying to Production Server

Once the GitHub Action completes:

```bash
# SSH into your server
ssh your-server

# Navigate to deployment directory
cd /path/to/deploy

# Pull latest image
docker compose pull backend

# Restart backend service
docker compose up -d backend

# Verify deployment
curl -s https://assistant.ledger-mind.org/api/ready
curl -s https://assistant.ledger-mind.org/api/status/summary

# Check logs
docker compose logs -f backend --tail=50
```

## Manual Deployment (Advanced)

For immediate deployment without waiting for GitHub Actions:

### Option 1: Using the deploy script

```powershell
# Build and push (requires Docker login to GHCR)
docker login ghcr.io -u leok974
./deploy-backend.ps1 -Push
```

### Option 2: Manual Docker commands

```powershell
# Build for your server's architecture
docker buildx build `
    --platform linux/amd64 `
    -f deploy/Dockerfile.backend `
    -t ghcr.io/leok974/leo-portfolio/backend:main `
    --push `
    .
```

## Deployment Checklist

- [ ] **Code changes committed and pushed to `main`**
- [ ] **GitHub Action workflow completed successfully**
  - Check: https://github.com/leok974/leo-portfolio/actions
- [ ] **Docker image available in GHCR**
  - Check: https://github.com/leok974/leo-portfolio/pkgs/container/leo-portfolio%2Fbackend
- [ ] **SSH into production server**
- [ ] **Pull latest image**: `docker compose pull backend`
- [ ] **Restart service**: `docker compose up -d backend`
- [ ] **Verify health endpoints**:
  - `/api/ready` - Returns 200 when ready
  - `/api/status/summary` - Shows Ollama/OpenAI/RAG status
  - `/api/llm/health` - LLM provider health
  - `/metrics` - Prometheus metrics
- [ ] **Test critical functionality**:
  - Chat endpoint: `/chat/stream`
  - RAG query: `/api/rag/query`
  - Analytics: `/api/analytics/collect`
- [ ] **Monitor logs**: `docker compose logs -f backend --tail=100`
- [ ] **Verify frontend connectivity** at https://leok974.github.io/leo-portfolio/

## Environment Configuration

Backend reads from `assistant_api/.env.prod` on the server:

```bash
RAG_DB=./data/rag.sqlite
RAG_REPOS=leok974/ledger-mind,leok974/leo-portfolio
EMBED_MODEL_QUERY=openai/text-embedding-3-large
OPENAI_BASE_URL=http://ollama:11434/v1
OPENAI_MODEL=qwen2.5:7b-instruct-q4_K_M
OPENAI_API_KEY_OLLAMA=ollama
FALLBACK_BASE_URL=https://api.openai.com/v1
FALLBACK_MODEL=gpt-4o-mini
ALLOWED_ORIGINS=https://leok974.github.io,https://app.ledger-mind.org,http://localhost:4173
```

**IMPORTANT**: `FALLBACK_API_KEY` must be set as an environment variable or Docker secret (not in .env.prod).

## Troubleshooting

### Workflow fails on tests
```powershell
# Run tests locally
cd assistant_api
python -m pytest
```

### Image push fails (authentication)
```powershell
# Login to GHCR with Personal Access Token
docker login ghcr.io -u leok974
# Paste token when prompted (needs packages:write scope)
```

### Backend not starting on server
```bash
# Check logs
docker compose logs backend --tail=100

# Check environment
docker compose exec backend printenv | grep -E "(OPENAI|RAG|FALLBACK)"

# Verify volume mounts
docker compose exec backend ls -la /app/data/

# Test database
docker compose exec backend python -c "from assistant_api.db import get_db; list(get_db().execute('SELECT COUNT(*) FROM chunks'))"
```

### CORS errors from frontend
- Verify `ALLOWED_ORIGINS` includes your frontend URL
- Check nginx CORS headers: `docker compose exec nginx cat /etc/nginx/nginx.conf | grep -A 10 cors`
- Test directly: `curl -H "Origin: https://leok974.github.io" -i https://assistant.ledger-mind.org/api/ready`

### High latency or timeouts
```bash
# Check Ollama status
docker compose exec backend curl -s http://ollama:11434/api/tags

# Warm up model
curl -X POST https://assistant.ledger-mind.org/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hi"}]}'

# Check metrics
curl -s https://assistant.ledger-mind.org/metrics | jq '.p95_ms'
```

## Rollback

If the new version has issues:

```bash
# Check previous image tags
docker images ghcr.io/leok974/leo-portfolio/backend

# Rollback to specific SHA
docker compose stop backend
docker tag ghcr.io/leok974/leo-portfolio/backend:sha-a81bbc8 ghcr.io/leok974/leo-portfolio/backend:main
docker compose up -d backend

# Or pull previous main
docker pull ghcr.io/leok974/leo-portfolio/backend:sha-<previous-commit>
```

## Post-Deployment Validation

Run smoke tests from local machine:

```powershell
# Test all critical endpoints
./scripts/smoke.ps1

# Test public smoke tests
./scripts/smoke-public.ps1

# Run E2E tests against production
npm run test:e2e -- --grep "@production"
```

## Security Notes

- Backend runs as non-root user `appuser` (UID 1001)
- CORS restricted to allowed origins only
- API keys stored as environment variables, never committed
- TLS via Cloudflare Tunnel or Let's Encrypt
- Rate limiting enforced by nginx
- Docker containers use read-only root filesystem where possible

---

**Last Updated**: October 5, 2025
**Maintainer**: leok974
