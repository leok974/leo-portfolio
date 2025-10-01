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
DOMAIN=assistant.ledger-mind.org
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

## Unified Host Revival: assistant.ledger-mind.org (SPA + API)

Serve the portfolio (assistant-enabled SPA) and FastAPI backend from one origin `https://assistant.ledger-mind.org` with `/api/*` proxied.

### 1. Nginx Config
See `deploy/nginx.assistant.conf`:
```
server {
	listen 80 default_server;
	server_name assistant.ledger-mind.org;
	root /usr/share/nginx/html;
	index index.html;
	location ~* \.(?:js|css|png|jpg|jpeg|gif|svg|webp|ico|woff2?)$ { access_log off; expires 30d; add_header Cache-Control "public, immutable"; try_files $uri =404; }
	location / { try_files $uri /index.html; }
	location /api/ { proxy_pass http://backend:8001/; }
	location = /ready { proxy_pass http://backend:8001/ready; }
	location = /status/summary { proxy_pass http://backend:8001/status/summary; }
	location = /_up { return 204; }
}
```

Compose volume example:
```yaml
services:
	nginx:
		volumes:
			- ./deploy/nginx.assistant.conf:/etc/nginx/conf.d/default.conf:ro
			- ./dist:/usr/share/nginx/html:ro
```

### 2. Frontend Fallback
`js/agent-status.js` probes bases in order:
1. `https://assistant.ledger-mind.org/api`
2. `https://app.ledger-mind.org/api`
3. `/api` (local)
First success sets `window.AGENT_BASE_URL`.

### 3. CORS Tightening
After cutover:
```
ALLOWED_ORIGINS=https://assistant.ledger-mind.org
```
During migration include Pages:
```
ALLOWED_ORIGINS=https://assistant.ledger-mind.org,https://leok974.github.io
```

### 4. Cloudflare / DNS
- Map hostname to tunnel or origin.
- Bypass cache: `/api/*`, `/chat/*`, `/status/*`, `/ready`, `/_up`.
- Cache immutable hashed assets.

### 5. Verification
```bash
curl -I https://assistant.ledger-mind.org
curl -s https://assistant.ledger-mind.org/api/ready
curl -s https://assistant.ledger-mind.org/status/summary | jq
```
Browser:
```js
fetch('/api/ready').then(r=>r.status)
```

### 6. CI Probe
`prod-assistant-probe.yml` ensures root + `/api/ready` + `/status/summary` stay 200.

### 7. Redirect Legacy Pages (Optional)
```html
<script>location.replace('https://assistant.ledger-mind.org'+location.pathname+location.search+location.hash);</script>
<noscript><meta http-equiv="refresh" content="0;url=https://assistant.ledger-mind.org"></noscript>
```

### 8. Rollback Plan
Temporarily force fallback base: `window.__API_BASE__='https://app.ledger-mind.org/api'` until unified host recovers.

### 9. Future Hardening
- Add probe latency & `/metrics` summary.
- Emit `X-Build-Id` header for release correlation.
- Inline critical CSS if performance budgets tighten.

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

Readiness guard: Makefile (`make tunnel-up`) and PowerShell (`tasks.ps1 tunnel` / `start-cloudflared.ps1`) now refuse to start the tunnel unless `/ready` returns 200 to avoid exposing a failing backend.

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
 - [x] CSP disallows inline scripts and styles (`script-src 'self'; style-src 'self'`) — verify after each release

## Status / CORS Troubleshooting (Assistant Host)

When the status pill or assistant dock shows perpetual "Connecting…" and DevTools shows 404 + missing CORS:

Checklist:
1. Frontend request path (Network tab) uses `/api/status/summary` (not bare `/status/summary`).
2. Ensure `ALLOWED_ORIGINS` includes your Pages origin (e.g. `https://leok974.github.io`). Service worker & caches cleared on GitHub Pages:
	```js
	navigator.serviceWorker?.getRegistrations().then(r=>r.forEach(x=>x.unregister()));
	caches?.keys().then(k=>k.forEach(c=>caches.delete(c)));
	```
3. Cloudflare Tunnel mapping: `assistant.ledger-mind.org` → named tunnel → service `http://nginx:80` (same stack as primary site).
4. Nginx config includes both `/api/status/summary` (preferred) and legacy `/status/summary` blocks with CORS.
5. Curl (edge):
	```bash
	curl -is -H "Origin: https://leok974.github.io" https://assistant.ledger-mind.org/api/status/summary | sed -n '1,20p'
	```
	Expect `200` and `Access-Control-Allow-Origin: https://leok974.github.io`.
6. If 404 without CORS: hostname not hitting patched edge (stale tunnel or DNS). Update public hostname entry.

Status Endpoint Guarantee:
- `/status/summary` is always routed (backend + edge); it should never 404. If unhealthy you receive a 503 JSON body with `ok:false`.
Frontend Fallback Logic:
- The status pill now attempts `/status/summary`, then `/llm/health`, then `/ready` to tolerate partial outages or legacy cache layers.
Deprecation Note:
- Legacy direct `/status/summary` remains for dashboards; primary preferred path behind edge is `/api/status/summary`.


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

## Cloudflare Tunnel (Managed / Token)
Use the connector token from Zero Trust → Tunnels → <your tunnel> → **Connect** → "Run a connector". Copy only the value after `--token` (single line, no quotes, typically JWT-like with multiple `.`).

### Compose (Integrated Service – Token + UUID Mode)
`deploy/docker-compose.prod.yml` includes an integrated service using the final working pattern (token + UUID + global flag ordering):
```yaml
services:
	cloudflared-portfolio:
		image: cloudflare/cloudflared:latest
		restart: unless-stopped
		# --no-autoupdate must precede the subcommand; UUID supplied last
		command: ["--no-autoupdate","tunnel","run","--token","${CLOUDFLARE_TUNNEL_TOKEN}","${CLOUDFLARE_TUNNEL_UUID}"]
		depends_on: [nginx]
		environment:
			- TUNNEL_TRANSPORT_PROTOCOL=auto
 		volumes:
			- ../cloudflared:/etc/cloudflared:ro   # optional (dashboard-managed ingress); keep if you later switch to config
```

### Environment (.env or shell)
```
CLOUDFLARE_TUNNEL_TOKEN=<paste-one-line-token>
CLOUDFLARE_TUNNEL_UUID=<existing-tunnel-uuid>
```
Or load from a local secrets file (PowerShell):
```powershell
$env:CLOUDFLARE_TUNNEL_TOKEN = (Get-Content secrets/cloudflared_token -Raw).Trim()
docker compose -f deploy/docker-compose.prod.yml up -d cloudflared-portfolio
```

### Public Hostname Mapping
In Cloudflare Zero Trust → Tunnels → <your tunnel> → Public Hostnames add:
```
Hostname: assistant.<your-domain>
Service:  http://nginx:80
```
Then test:
```bash
curl -I https://portfolio.<your-domain>/
curl -s https://portfolio.<your-domain>/api/ready
```

### Verification Checklist
- Logs show multiple `Registered tunnel connection` lines.
- No "invalid token" or auth errors.
- Hitting the hostname returns the SPA and `/api/status/summary` JSON.

### Troubleshooting
| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `Provided Tunnel token is not valid` | Truncated / wrong token (secret vs connector) | Re-copy connector token from Connect screen |
| `tunnel not found` | Deleted or different tunnel | Regenerate token in selected tunnel |

## Prebuilt Backend Image (GHCR)
Instead of building locally, pull a published multi-arch image from GitHub Container Registry.

### CI Publishing
Workflow `.github/workflows/publish-backend.yml` pushes two tags on every `main` commit:
- `:main` (rolling latest on default branch)
- `:sha-<short>` (immutable reference for rollbacks)

### Override Compose
Use `deploy/docker-compose.ghcr.override.yml` to replace the backend build with an image reference:
```yaml
services:
	backend:
		image: ghcr.io/${GH_REPO:-<owner>/<repo>}/backend:${BACKEND_TAG:-main}
		pull_policy: always
```

### Pull & Run (PowerShell)
```powershell
$remote = git remote get-url origin
if ($remote -match "github.com[:/](.+?)/(.+?)(\.git)?$") { $env:GH_REPO = "$($matches[1])/$($matches[2])" } else { $env:GH_REPO = "<owner>/<repo>" }
$env:BACKEND_TAG = "main"   # or "sha-$(git rev-parse --short HEAD)"
docker compose -f deploy/docker-compose.prod.yml -f deploy/docker-compose.ghcr.override.yml pull backend
docker compose -f deploy/docker-compose.prod.yml -f deploy/docker-compose.ghcr.override.yml up -d backend
```

If the package is private, login first:
```powershell
docker login ghcr.io -u <github-username> -p <PAT_with_read:packages>
```

### When to Rebuild Locally
Rebuild only when:
- Modifying `assistant_api/requirements.*`
- Changing base image or Python version
- Development iteration before committing to main

Otherwise prefer pulling to skip the wheels + dependency resolution layers.

### Tag Strategy
- Roll forward normally with `:main`.
- Pin deployments / canaries with an immutable `:sha-<short>` tag.

### Common Errors
| Error | Cause | Fix |
|-------|-------|-----|
| `denied` on pull | Image not published or no auth | Ensure CI run completed; docker login to ghcr.io |
| Manifest unknown | Tag mismatch | Confirm tag list in GHCR UI matches BACKEND_TAG |
| Slow local build | Cache miss | Use buildx cache-from/to (see Operations or README tips) |

### CORS verification
We validate cross-origin access for status endpoints from GitHub Pages and the app domain.

Manual (inside nginx container):
```bash
docker compose -f deploy/docker-compose.prod.yml exec nginx sh -lc \
	'curl -is -H "Origin: https://leok974.github.io" http://localhost/api/status/summary | sed -n "1,40p"'
docker compose -f deploy/docker-compose.prod.yml exec nginx sh -lc \
	'curl -is -X OPTIONS -H "Origin: https://leok974.github.io" -H "Access-Control-Request-Method: GET" http://localhost/api/status/summary | sed -n "1,40p"'
```
Expected headers: `Access-Control-Allow-Origin: https://leok974.github.io`, `Vary: Origin`, and `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`.

CI workflow `cors-verify.yml` performs the same GET + OPTIONS probes against the public hostname and tolerates either `204` (preferred) or `200` for OPTIONS depending on interception layer.
| Looping reconnect without auth errors | Network egress blocked (443/7844) | Allow outbound TCP:443 (and optionally UDP:7844) |

### Same-Origin API Calls
After hostname works, set `API_BASE='/api'` on the frontend (already proxied by nginx) so CORS is unnecessary.

### Infra-as-Code Alternative
You can instead provision a `cloudflared` named tunnel with `config.yml` + credentials JSON committed to an ops repo and mount them. Token method kept for minimal friction here.

### Token Sanitation Helper
Run the helper script to trim and export the token safely (avoids stray CR/LF):
```powershell
pwsh ./scripts/sanitize-cloudflared-token.ps1
docker compose -f deploy/docker-compose.prod.yml up -d cloudflared-portfolio
```

### Automatic DOMAIN → CORS Origins
If you set `DOMAIN=portfolio.example.com` the backend derives and appends:
```
https://portfolio.example.com
http://portfolio.example.com
https://www.portfolio.example.com
http://www.portfolio.example.com
```
Only entries not already in `ALLOWED_ORIGINS` are added. This keeps configs minimal while preserving explicit overrides.

### Existing Named Tunnel Helper
If you already have a tunnel UUID (e.g., created previously in Cloudflare dashboard) you can generate credentials + config + DNS in one go (legacy / credentials-file mode — token+UUID mode above is simpler now):
```powershell
pwsh ./scripts/cloudflared-gen-creds.ps1 -Uuid <TUNNEL_UUID> -Hostname assistant.example.com
```
The script will:
1. Run `tunnel login` if `cloudflared/cert.pem` is missing.
2. Create (or refresh) `<UUID>.json` credentials. (NOTE: Newer cloudflared versions removed `tunnel credentials create`; the script auto‑falls back to retrieving a connector token and synthesizing a minimal credentials JSON.)
3. Write/update `cloudflared/config.yml` with ingress to `http://nginx:80` and metrics.
4. Add DNS route (CNAME → `<UUID>.cfargotunnel.com`).
5. Recreate the `cloudflared-portfolio` service via compose and tail logs.

After success you should see repeated `Registered tunnel connection` lines and your site available at the hostname (e.g. `assistant.ledger-mind.org`) with `/api/*` served same-origin.

### Token + UUID vs Credentials JSON
| Mode | When to Use | Requirements | Compose Command Pattern |
|------|-------------|--------------|-------------------------|
| Token + UUID | Fast, dashboard-managed ingress (recommended) | Connector token + tunnel UUID | `["--no-autoupdate","tunnel","run","--token","${CLOUDFLARE_TUNNEL_TOKEN}","${CLOUDFLARE_TUNNEL_UUID}"]` |
| Credentials JSON | IaC / static config repo, offline provisioning | `cert.pem` + `<UUID>.json` + `config.yml` | `["tunnel","--config","/etc/cloudflared/config.yml","run"]` |

If switching from token mode to credentials mode later: create credentials (older image if needed), write `config.yml` with ingress rules, mount directory, and change the command back to the config-based form.

If you prefer the legacy JSON generation and have issues with synthesized credentials, pin an earlier image (e.g. `cloudflare/cloudflared:2024.8.2`) in both the helper script `-Image` parameter and your compose service, then re-run the helper to produce an authentic `<UUID>.json`.

## Tunnel Quickstart (Token + UUID)
Fast path assuming you already created a tunnel and assigned `assistant.ledger-mind.org` in the dashboard:
```powershell
# 1. Copy env template
Copy-Item .env.deploy.example .env

# 2. Edit .env to insert real CLOUDFLARE_TUNNEL_TOKEN (leave UUID)

# 3. Export into current session (PowerShell) or let compose read automatic .env
$env:CLOUDFLARE_TUNNEL_TOKEN = (Select-String -Path .env -Pattern '^CLOUDFLARE_TUNNEL_TOKEN=').Line.Split('=')[1]
$env:CLOUDFLARE_TUNNEL_UUID  = (Select-String -Path .env -Pattern '^CLOUDFLARE_TUNNEL_UUID=').Line.Split('=')[1]

# 4. Start stack (prod compose)
docker compose -f deploy/docker-compose.prod.yml up -d --build

# 5. Validate
curl https://assistant.ledger-mind.org/api/ready
```

## QUIC Buffer Warning
Log line:
```
failed to sufficiently increase receive buffer size (was: 208 kiB, wanted: 7168 kiB, got: 416 kiB)
```
This is a benign warning from the QUIC library about UDP buffer limits on the host. It can be ignored for typical web workloads. To tune on Linux hosts you can raise sysctls:
```bash
sudo sysctl -w net.core.rmem_max=2500000
sudo sysctl -w net.core.rmem_default=2500000
```
Not required on Windows dev environments.

## Environment Template
See `.env.deploy.example` for a curated set of recommended variables (domain, tunnel token/UUID, models, RAG settings). Copy it to `.env`, customize secrets, and keep the original example file committed for reference.

## Optional Polish Additions

### Development Requirements
`requirements-dev.txt` provides pytest + tooling. Install during CI:
```bash
pip install -r assistant_api/requirements.txt -r requirements-dev.txt
pytest -q
```

### Build ID Header
`deploy/nginx.assistant.conf` adds:
```
add_header X-Build-ID "$BUILD_ID" always;
```
Inject a build id (short commit SHA) via a build arg or envsubst.
```bash
docker build --build-arg BUILD_ID=$(git rev-parse --short HEAD) -t site:$(git rev-parse --short HEAD) .
curl -Is https://assistant.ledger-mind.org | grep X-Build-ID
```

### GitHub Pages Redirect Stub
`pages-redirect.html` can be deployed at the legacy Pages path to forward users:
```html
<script>location.replace('https://assistant.ledger-mind.org'+location.pathname+location.search+location.hash);</script>
<noscript><meta http-equiv="refresh" content="0;url=https://assistant.ledger-mind.org"></noscript>
```

### Probe Artifact Surfacing
`prod-assistant-probe.yml` writes `probe.json`. Future: push summary to a branch badge or ingest into external metrics.

### Observability Enhancements
- Capture latency: `curl -w '%{time_total}'` in probe job and store in JSON.
- Synthetic chat POST probe verifying end-to-end LLM path.
- Emit `X-Served-By` (container/id) header in backend for multi-instance diff.

### Testing Expansion
- Add shape/assert tests for `/status/summary` keys.
- Playwright future: Validate pill class transitions with primary vs fallback model states.

