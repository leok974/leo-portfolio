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
| `deploy/docker-compose.full.yml` | (Legacy) previously added separate frontend + edge; now unified build in prod compose |
| `deploy/Dockerfile.frontend` | Multi-target (static or Vite) edge + SPA build + API proxy |
| `assistant_api/Dockerfile` | FastAPI backend multi-stage (wheels + slim runtime) |

Port Remap Note: Production compose maps edge to host `8080` (HTTP) / `8443` (HTTPS) instead of privileged 80/443 to reduce conflicts on developer laptops. Adjust in `deploy/docker-compose.prod.yml` if deploying to a clean server and binding low ports with CAP_NET_BIND.

## Quick Start (Full Stack)
```bash
cd deploy
# build and run all services
docker compose -f docker-compose.full.yml up -d --build

# pull/update primary model
docker exec -it $(docker ps -qf "name=ollama") bash -lc "ollama pull qwen2.5:7b-instruct-q4_K_M"
```

Access:
- Edge: http://127.0.0.1:8080 (prod compose remap)
- Backend direct (internal): `backend:8000`
- Ollama (host mapped): http://127.0.0.1:11435

## Health & Validation
```bash
curl -s http://127.0.0.1:8080/healthz
curl -s http://127.0.0.1:8080/api/ready
curl -s http://127.0.0.1:8080/api/metrics
curl -N -X POST http://127.0.0.1:8080/chat/stream -H 'Content-Type: application/json' -d '{"messages":[{"role":"user","content":"Ping"}]}'
```

## Integrated Edge / Frontend
The `nginx` service now builds from `deploy/Dockerfile.frontend` embedding the static site directly into the proxy layer. Two targets:

| Target | Purpose |
|--------|---------|
| `frontend-static-final` | Copies existing repo root files (no Node build) |
| `frontend-vite-final` | Runs Node build (expects `package.json` + `npm run build` producing `dist/`) |

Switch targets by editing `docker-compose.prod.yml` service build target. Adjust `FRONTEND_DIR` if your source moves.

Nginx config (`deploy/nginx.conf`) provides:
- Long-cache assets (`Cache-Control: immutable`)
- SPA fallback (`try_files $uri /index.html`)
- `/api/`, `/chat/stream`, `/llm/`, `/status/` proxy pass-through
- SSE buffering disabled on streaming path

### Convenience Shortcuts
For local production-mode runs from repo root:

Make targets:
```
make prod-up        # start prod stack (deploy/docker-compose.prod.yml)
make prod-logs      # tail logs
make prod-down      # stop stack
make prod-rebuild   # rebuild images + recreate
```

PowerShell tasks (via `tasks.ps1`):
```
pwsh -File .\tasks.ps1 prod          # same as ProdUp
pwsh -File .\tasks.ps1 prod-logs
pwsh -File .\tasks.ps1 prod-down
pwsh -File .\tasks.ps1 prod-rebuild
```

These wrap the explicit `docker compose -f deploy/docker-compose.prod.yml ...` commands to speed iteration.

## GitHub Pages (Legacy Option)
You can still host the static site on Pages, but the default deployment path is now the integrated nginx container. Keep `ALLOWED_ORIGINS` updated to include whichever origin(s) you serve from.

## Custom Domain

## Cloudflare Tunnel (Optional Public Exposure)

Use a Cloudflare Tunnel to expose the backend (and optionally the nginx edge) without opening inbound firewall ports. Prefer a named tunnel with a DNS route for stability.

### 1. Create Tunnel & Token
Via Cloudflare dashboard (Access -> Tunnels) create a tunnel and copy the token (long JWT‑like string). Store it locally at `secrets/cloudflared_token` (not committed) or as a secret in your deployment platform.

```
secrets/
	cloudflared_token   # contains single-line token
```

### 2. Compose Override Service
Create `deploy/docker-compose.tunnel.override.yml` (optional override) to run cloudflared sidecar on the same network. It will proxy to `backend:8000` (or `nginx:80` if you want full site exposure). Example:

```yaml
services:
	cloudflared:
		image: cloudflare/cloudflared:latest
		command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
		restart: unless-stopped
		environment:
			- TUNNEL_TRANSPORT_PROTOCOL=auto
		depends_on:
			- backend
		# If you want to expose the full edge instead of raw backend, change url in Cloudflare config or use ingress rules.
```

Launch with:
```bash
export CLOUDFLARE_TUNNEL_TOKEN=$(cat secrets/cloudflared_token)
docker compose -f deploy/docker-compose.prod.yml -f deploy/docker-compose.tunnel.override.yml up -d cloudflared
```

### 3. Derive Stable Origin
Once the tunnel connects, Cloudflare assigns your configured hostname (e.g. `assistant.example.com`). Set:
```bash
export DOMAIN=assistant.example.com
```
or append to `ALLOWED_ORIGINS` if you prefer explicit control. Then restart backend:
```bash
docker compose up -d backend
```
Verify:
```bash
curl http://127.0.0.1:8001/status/cors | jq
```

### 4. PowerShell Helper (Local Dev)
You can automate token export + container run (see `scripts/start-cloudflared.ps1` if added):
```powershell
./scripts/start-cloudflared.ps1 -Mode backend
```
Modes could map to backend (8001) or edge (8080) if you extend the script.

### 5. Security Notes
- Do not bake the token into an image or commit it to Git.
- Rotate the tunnel token in Cloudflare if it leaks; old one invalidates immediately.
- Use Cloudflare Access policies (Zero Trust) for additional protection if exposing non-public endpoints.

### 6. Troubleshooting
- If `/status/cors` lacks your tunnel hostname, ensure `DOMAIN` or `ALLOWED_ORIGINS` env was set before container start.
- SSE buffering: Cloudflare generally supports SSE; if issues arise, confirm response headers and disable any cache rule for the path.

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

## Fast Fallback / Warm Startup

Large model pulls can delay first response minutes. Two environment flags optimize startup:

| Variable | Effect |
|----------|--------|
| `MODEL_WAIT_MAX_SECONDS=15` | Bound wait for Ollama API + model tag; continue after timeout (status shows warming) |
| `DISABLE_PRIMARY=1` | Skip model wait entirely; service starts with `llm.path=fallback` |

Example (override compose):
```yaml
services:
	backend:
		environment:
			- DISABLE_PRIMARY=1
			- MODEL_WAIT_MAX_SECONDS=15
```

To re-enable primary later, remove `DISABLE_PRIMARY` and ensure `PRIMARY_MODEL` is pulled (`docker exec ollama ollama pull <model>`). Status will transition `down → warming → primary`.

### Example Override File
See `deploy/docker-compose.override.example.yml` (committed) for documented environment knobs you can copy locally (rename to `docker-compose.prod.override.yml` and adjust). This pattern keeps experimental tuning out of source control.

### Warm Transition Test Script
Script: `scripts/test-warm-transition.ps1`

Usage (after unsetting `DISABLE_PRIMARY`):
```powershell
pwsh ./scripts/test-warm-transition.ps1 -BaseUrl "http://localhost:8080" -MaxSeconds 420
```
Outputs a timestamped stream of `llm.path` state transitions and exits 0 only after `primary` + `ready=true`.
