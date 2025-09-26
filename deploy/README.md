# Deployment – assistant_api + Ollama + Nginx

## Prereqs
- Docker & Docker Compose
- A domain (optional) pointing to this host (A/AAAA records)
- Secrets available as env vars or Docker secrets:
  - `FALLBACK_API_KEY` (OpenAI)
  - (optional) `OPENAI_API_KEY` if you also use OpenAI embeddings elsewhere

## Files
- `assistant_api/Dockerfile` – builds Python backend
- `deploy/docker-compose.yml` – ollama, backend, nginx
- `deploy/nginx.conf` – CORS/SSE/rate limit proxy
- `assistant_api/.env.prod` – runtime config for backend (not committed)
- `data/rag.sqlite` – shipped vector DB (mounted)

## One-time setup
```bash
# 1) Place your vector DB
mkdir -p data
# copy your prebuilt data/rag.sqlite here

# 2) Create assistant_api/.env.prod (sample)
cat > assistant_api/.env.prod <<'ENV'
RAG_DB=./data/rag.sqlite
RAG_REPOS=leok974/ledger-mind,leok974/leo-portfolio
EMBED_MODEL_QUERY=openai/text-embedding-3-large
OPENAI_BASE_URL=http://ollama:11434/v1
OPENAI_MODEL=qwen2.5:7b-instruct-q4_K_M
OPENAI_API_KEY_OLLAMA=ollama
FALLBACK_BASE_URL=https://api.openai.com/v1
FALLBACK_MODEL=gpt-4o-mini
# FALLBACK_API_KEY is supplied via host env or docker secrets (DO NOT COMMIT)
ALLOWED_ORIGINS=https://leok974.github.io,https://app.ledger-mind.org,http://localhost:4173
ENV

# 3) Build & start
cd deploy
docker compose up -d --build

# 4) Pull primary Ollama model
docker exec -it $(docker ps -qf "name=ollama") bash -lc "ollama pull qwen2.5:7b-instruct-q4_K_M"

# Sanity checks
curl -s http://127.0.0.1/ready
curl -s http://127.0.0.1/llm/health
curl -s http://127.0.0.1/metrics
curl -N -X POST http://127.0.0.1/chat/stream \
  -H "Content-Type: application/json" \
  -d '{ "messages":[{"role":"user","content":"Explain the portfolio assistant chip"}] }'
```

## TLS (two easy paths)

- Behind Cloudflare: keep Compose ports bound to localhost; expose via a Cloudflare Tunnel; enable HTTPS/HSTS at Cloudflare.
- Let’s Encrypt on box: add a 443 server block and use certbot (DNS-01 or webroot). Remember to allow only your frontends in CORS.

## CSP (frontend)
```
default-src 'self';
connect-src 'self' https://api.openai.com https://app.ledger-mind.org http://localhost:8000 http://localhost:80 wss:;
img-src 'self' data: blob:;
style-src 'self' 'unsafe-inline';
script-src 'self';
```

## Ops

- Health: GET /llm/health → Ollama status + whether OpenAI key is set
- Metrics: GET /metrics → { req, 5xx, tok_in, tok_out, p95_ms, providers }
- RAG: POST /api/rag/query {question,k}
- Chat: POST /chat or POST /chat/stream (SSE emits event: meta with _served_by)

## Failure modes

- Ollama down → automatic fallback to OpenAI (200)
- Both down → friendly 503 JSON (never raw 500)
- Missing rag.sqlite → /api/rag/query returns empty matches (check volume)

## Secrets

Provide FALLBACK_API_KEY at runtime, not in .env.prod.
Rotate any previously exposed keys immediately in your provider dashboard.

---

# GitHub Action: build & push backend image (GHCR)
Save as `.github/workflows/build-backend.yml`:
```yaml
name: Build & Push Backend

on:
  push:
    branches: [ main ]
    paths:
      - "assistant_api/**"
      - ".github/workflows/build-backend.yml"
      - "assistant_api/requirements.txt"
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    env:
      IMAGE_NAME: ghcr.io/${{ github.repository_owner }}/assistant-api
    steps:
      - uses: actions/checkout@v4

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.repository_owner }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata (tags, labels)
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=sha
            type=semver,pattern={{version}}

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: ./assistant_api
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

The deploy host can then pull `ghcr.io/<you>/assistant-api:<tag>` in docker-compose.yml instead of building locally.

## Optional: protected server-side ingest

If you want to ingest on the server (instead of shipping rag.sqlite), add:

- Env: `RAG_INGEST_TOKEN=<long_random>`
- Route: `POST /api/rag/ingest` checks header `Authorization: Bearer <token>`
- Add a GitHub Action in each indexed repo to curl this endpoint on push to main.

## Quick hardening checklist

- CORS allowlist matches your real domains (`leok974.github.io` already configured).
- `FALLBACK_API_KEY` not in repo; provided via secrets/env.
- Nginx limits in place (limit_req, limit_conn) and SSE buffering off.
- `/metrics` returns sane numbers after a quick load test.
- UI badge flips to fallback when you stop the Ollama container.
- Rotate any previously exposed OpenAI keys.

## Compose healthcheck example

The `backend` service includes a healthcheck using the new readiness endpoint:

```
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/ready"]
  interval: 30s
  timeout: 5s
  retries: 3
```

---

## Full Stack (Frontend + Backend + Ollama)

A combined compose file `docker-compose.full.yml` adds a standalone `frontend` container (nginx) that serves the static portfolio separately from the reverse proxy layer. Use this when you want to preview both layers without binding your host Node/browser-sync dev setup.

### File Summary

- `deploy/Dockerfile.frontend` – copies static assets into an nginx image (port 8080 internally)
- `deploy/docker-compose.full.yml` – services: `ollama`, `backend`, `frontend`

### Run
```bash
cd deploy
docker compose -f docker-compose.full.yml up -d --build
```

### Access
- Backend API (direct): http://127.0.0.1:8000 (if you publish a port) or via existing nginx if you add it
- Static frontend: http://127.0.0.1:8080

> Note: The default full file does not include the edge `nginx` proxy from the simpler stack; you can layer it by adding `-f docker-compose.yml -f docker-compose.full.yml` if you want unified routing.

### Tear down
```bash
docker compose -f docker-compose.full.yml down
```

### Extending
- Add cache busting or a build step (Vite, etc.) by replacing the first stage with a Node builder, then copying `dist/`.
- Introduce an edge proxy that serves `/` (static) and `/api` or `/chat` to backend; currently the demo keeps them independent.

---
