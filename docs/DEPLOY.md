# Deploy Guide

> Draft. Consolidates deployment notes from `deploy/README.md` and adds full-stack + edge proxy guidance.

## Prerequisites
- Docker & Docker Compose v2
- (Optional) Domain & DNS (A/AAAA records or Cloudflare Tunnel)
- OpenAI (fallback) API key stored securely (not committed)

## Secrets & Env
| Secret | Purpose | Injection |
|--------|---------|-----------|
| `openai_api_key` (Docker secret) | Fallback OpenAI model auth | `secrets/` file mounted or swarm/compose secret |
| `FALLBACK_API_KEY` env | Alternate fallback injection | Runtime env var (dev) |

Backend `.env.prod` example:
```
RAG_DB=./data/rag.sqlite
RAG_REPOS=leok974/ledger-mind,leok974/leo-portfolio
EMBED_MODEL_QUERY=openai/text-embedding-3-large
OPENAI_BASE_URL=http://ollama:11434/v1
OPENAI_MODEL=qwen2.5:7b-instruct-q4_K_M
FALLBACK_BASE_URL=https://api.openai.com/v1
FALLBACK_MODEL=gpt-4o-mini
ALLOWED_ORIGINS=https://leok974.github.io,http://localhost:8080
```

## Compose Files
| File | Purpose |
|------|---------|
| `deploy/docker-compose.yml` | Core stack (ollama + backend + nginx proxy) |
| `deploy/docker-compose.full.yml` | Adds standalone frontend + edge proxy |
| `deploy/Dockerfile.frontend` | Static-first nginx image (optional future Node build) |
| `assistant_api/Dockerfile` | FastAPI backend multi-stage (wheels + slim runtime) |

## Quick Start (Full Stack)
```bash
cd deploy
# build and run all services
docker compose -f docker-compose.full.yml up -d --build

# pull/update primary model
docker exec -it $(docker ps -qf "name=ollama") bash -lc "ollama pull qwen2.5:7b-instruct-q4_K_M"
```

Access:
- Edge: http://127.0.0.1:8080
- Backend direct (internal): `backend:8000`
- Ollama (host mapped): http://127.0.0.1:11435

## Health & Validation
```bash
curl -s http://127.0.0.1:8080/healthz
curl -s http://127.0.0.1:8080/api/ready
curl -s http://127.0.0.1:8080/api/metrics
curl -N -X POST http://127.0.0.1:8080/chat/stream -H 'Content-Type: application/json' -d '{"messages":[{"role":"user","content":"Ping"}]}'
```

## Edge Proxy Notes
`deploy/edge/nginx.conf`:
- `proxy_buffering off` on `/chat/stream` (SSE)
- CORS allowlist dynamic via map
- Static cache headers for immutable assets

## GitHub Pages Frontend
1. Build nothing (static only); push to `main`.
2. Enable Pages → GitHub Actions workflow handles deployment.
3. Set `ALLOWED_ORIGINS` to include the Pages URL.

## Custom Domain
- Add CNAME in repo (or configure Pages settings).
- Update DNS provider with CNAME pointing at `<user>.github.io` OR A/AAAA via Cloudflare proxy.
- If using edge on VPS, terminate TLS at Cloudflare or at nginx (add cert + listen 443 block).

## Production Hardening Checklist
- [ ] Non-root backend user verified (`id` inside container)
- [ ] Secrets only available at runtime
- [ ] `/metrics` scraped over internal network only (optional restriction)
- [ ] Models pre-pulled to avoid cold start
- [ ] Healthchecks green before traffic
- [ ] Rate limit configured (future) for `/chat` burst control

## Updating Services
```bash
# Rebuild backend only
cd deploy
docker compose -f docker-compose.full.yml build backend

# Rolling restart
docker compose -f docker-compose.full.yml up -d backend
```

## Cleanup
```bash
docker compose -f docker-compose.full.yml down --volumes --remove-orphans
```

## TODO
- Add automated GHCR image publish workflow
- Synthesize architecture diagram (Mermaid)
- Add rate limit + client IP logging in edge config
