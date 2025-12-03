# AGENT GUIDE

> **Quick Decision Tree**:  
> 🎨 **Frontend work?** → `apps/{portfolio-ui,siteagent-ui}/src/`  
> 🔧 **Backend/API?** → `assistant_api/main.py` + `assistant_api/routes/`  
> 🚀 **Deploy/Infra?** → `RUNBOOKS/DEPLOY.md` + `docker-compose.prod.yml`  
> 🐛 **Incident/Debug?** → `RUNBOOKS/ONCALL.md` + health checks below  
> 🤖 **Agent tools?** → `agent/tools/` + agent integration points below

## Entry Points
- **Portfolio Web UI**: `apps/portfolio-ui/src/main.tsx` (Preact + Vite)
- **SiteAgent UI**: `apps/siteagent-ui/src/main.tsx` (internal tools)
- **Backend API**: `assistant_api/main.py` (FastAPI app with CORS, routers)
- **Agent Tools**: `agent/tools/` (brand card, SEO, orchestration)
- **E2E Tests**: `tests/e2e/*.spec.ts` (Playwright tests)
- **Backend Tests**: `tests/` (pytest unit/integration tests)

## Quick Health Checks

**Is everything alive?**
```bash
# Frontend (should return HTML)
curl -I https://leoklemet.com/

# Backend health (should return 200 OK)
curl https://api.leoklemet.com/api/ready

# Backend detailed status
curl https://api.leoklemet.com/api/dev/status

# Local dev backend
curl http://localhost:8001/api/ready

# Check Docker containers
docker ps | grep -E "portfolio|ollama|watchtower"

# Check backend logs (last 50 lines)
docker logs portfolio-backend --tail 50 --follow
```

**Common "is it working?" checks:**
- ✅ **Frontend loads**: https://leoklemet.com/ returns 200
- ✅ **API responds**: https://api.leoklemet.com/api/ready returns `{"status":"ok"}`
- ✅ **Chat works**: `/chat/stream` returns SSE events
- ✅ **LLM available**: `/llm/primary/ping` returns model info

## Commands
```bash
# Install dependencies
pnpm install

# Portfolio dev server
pnpm run dev:portfolio              # → http://localhost:5174

# SiteAgent dev server  
pnpm run dev                         # → http://localhost:5173

# Backend API dev
uvicorn assistant_api.main:app --reload --port 8001

# Run all tests
pnpm test                            # Vitest unit tests
pytest -q                            # Python backend tests
pnpm test:e2e                        # Playwright E2E tests

# Build for production
pnpm run build:portfolio             # → dist-portfolio/
pnpm run build:siteagent             # → dist-siteagent/
```

## Config
**Environment variables required** (see `.env.example`):
- `OPENAI_API_KEY` — OpenAI/Ollama API key
- `FIGMA_PAT`, `FIGMA_TEMPLATE_KEY`, `FIGMA_TEAM_ID` — Figma brand card export
- `CLOUDFLARE_*` — Tunnel, DNS, cache config
- `WATCHTOWER_HTTP_API_TOKEN` — Auto-deployment trigger

**Never commit secrets**. Use `.env.*` files (gitignored).

## Architecture

### Data Flow (User → Response)
```
1. User → https://leoklemet.com/
2. Cloudflare Tunnel → nginx (port 80 in container)
3. nginx → serves dist-portfolio/ OR proxies /api/* to backend
4. Backend (FastAPI) → processes request
5. Backend → Ollama (local LLM) OR OpenAI (fallback)
6. Response ← SSE stream (for chat) OR JSON (for API calls)
```

### Frontend (Preact + Vite + Tailwind)
- **Portfolio UI**: Public-facing site at `leoklemet.com`
- **SiteAgent UI**: Internal agent tools (RAG, brand card, SEO)
- Both use shadcn/ui components, dark-first theme
- Proxies `/api/*`, `/chat/*`, `/agent/*` to backend

### Backend (FastAPI + Python)
- **Chat endpoints**: `/chat`, `/chat/stream` (SSE)
- **Agent tools**: `/agent/brand/card`, `/agent/brand/templates`
- **RAG**: `/api/rag/query` (SQLite embeddings)
- **Admin**: `/admin/*` (HMAC cookie auth)
- **Health**: `/api/ready`, `/api/dev/status`

### Deployment (Docker + Cloudflare Tunnel)
- **Prod**: Docker Compose on VPS behind Cloudflare Tunnel
- **Nginx**: Reverse proxy (`/api/` → backend, `/ops/watchtower/` → Watchtower)
- **Watchtower**: Auto-pulls `ghcr.io/leok974/leo-portfolio/backend:latest`
- **GitHub Actions**: Self-hosted runner (`self-hosted,prod,deploy`)

### Networks (Docker internal)
- `portfolio.int` — frontend nginx
- `portfolio-api.int` — backend API
- `ollama:11434` — local LLM (or fallback to OpenAI)

## Conventions
- **Monorepo**: pnpm workspaces (`apps/*`, `packages/*`)
- **TypeScript paths**: `@/` aliases to `apps/*/src/`
- **Component library**: shadcn/ui + Tailwind v4
- **Code style**: ESLint + Prettier (auto-format on commit)
- **Branch strategy**: `main` (protected), feature branches, PR required
- **Agent artifacts**: `agent_artifacts/` (gitignored, generated outputs)

## What NOT to Touch
- `/docs/archive/*` — historical docs, do not modify
- Alembic migrations already applied (`alembic/versions/*` → `alembic stamp`)
- `.github/workflows/` — CI/CD config (modify with care)
- `pnpm-lock.yaml` — managed by pnpm, do not hand-edit

## Key Files
- `README.md` — Project overview, quick start
- `ARCHITECTURE.md` — High-level system design
- `RUNBOOKS/DEPLOY.md` — Deployment procedures
- `RUNBOOKS/ONCALL.md` — Incident response
- `.github/CONTRIBUTING.md` — PR guidelines, commands
- `package.json` — All npm scripts defined here
- `docker-compose.prod.yml` — Production stack definition

## Testing Strategy
- **Unit**: Vitest for frontend, pytest for backend
- **E2E**: Playwright for critical flows (admin auth, chat, brand card)
- **Smoke**: Fast subset tagged `@smoke` for PR checks
- **Quarantine**: Flaky tests in `tests/_quarantine/` (xfail)

## Common Workflows

### Add new agent tool
1. Create tool in `agent/tools/<name>/`
2. Add FastAPI route in `assistant_api/routes/agent.py`
3. Add E2E test in `tests/e2e/agent-<name>.spec.ts`
4. Update this guide if config needed

### Deploy to prod
1. Merge PR to `main`
2. GitHub Actions builds `ghcr.io/leok974/leo-portfolio/backend:latest`
3. Approve prod deployment in Actions UI
4. Watchtower auto-pulls new image and restarts
5. Health check `/api/ready` confirms success

### Debug prod issues
- SSH to prod: `ssh user@prod-host` (via Cloudflare Tunnel)
- Check logs: `docker logs portfolio-backend --tail 100`
- Health status: `curl https://api.leoklemet.com/api/ready`
- Dev overlay: `https://www.leoklemet.com` (shows live backend status)

## Agent Integration Points

### Brand Card Export
- **Endpoint**: `POST /agent/brand/card`
- **Payload**: `{"theme": "dark", "variant": "default"}`
- **Output**: `agent_artifacts/cards/brand-card-<timestamp>.svg`
- **Templates**: Loaded from Figma via `FIGMA_TEMPLATE_KEY`

### RAG Query
- **Endpoint**: `POST /api/rag/query`
- **Payload**: `{"query": "...", "top_k": 5}`
- **Returns**: Relevant document chunks with metadata
- **Index**: SQLite DB at `data/rag.sqlite` (embeddings cached)

### SEO Tools
- **Validate**: `POST /agent/seo/validate` (checks meta, schema, OG)
- **Tune**: `POST /agent/seo/tune` (auto-improves meta descriptions)
- **Artifacts**: `agent_artifacts/seo/<task>-<timestamp>.json`

## Troubleshooting

### 502 Bad Gateway
**Symptoms**: Frontend shows "Bad Gateway" error, `/api/*` requests fail

**Diagnosis**:
```bash
# 1. Is backend container running?
docker ps | grep portfolio-backend

# 2. Check backend logs for crashes
docker logs portfolio-backend --tail 100

# 3. Check backend health endpoint
curl http://localhost:8001/api/ready  # from prod host
```

**Common causes**:
- ❌ Backend crashed (import error, uncaught exception)
- ❌ Ollama model not loaded (`/llm/primary/ping` fails)
- ❌ Missing env var (check `docker-compose.prod.yml` env section)
- ❌ Port 8001 not listening (backend failed to start)

**Fix**:
```bash
# Restart backend container
docker restart portfolio-backend

# View startup logs
docker logs portfolio-backend --follow

# If model issue, force model pull
docker exec portfolio-ollama ollama pull qwen2.5:7b-instruct-q4_K_M
```

### Chat Stream Hangs
**Symptoms**: `/chat/stream` returns headers but no SSE events, browser spinner forever

**Diagnosis**:
```bash
# 1. Check Ollama model status
curl http://localhost:8001/llm/primary/ping

# 2. Test Ollama directly
docker exec portfolio-ollama ollama list
docker exec portfolio-ollama ollama run qwen2.5:7b-instruct-q4_K_M "Hello"

# 3. Check nginx SSE buffering (should be off)
grep -r "proxy_buffering off" deploy/nginx.conf
```

**Common causes**:
- ⏱️ Ollama loading model on first request (30-60s delay normal)
- ❌ Wrong model name (backend expects `gpt-oss:20b`, container has `qwen2.5:7b-instruct-q4_K_M`)
- ❌ Nginx buffering SSE (must set `proxy_buffering off` for `/chat/stream`)
- ❌ OpenAI API key invalid (if using fallback mode)

**Fix**:
```bash
# Use fallback mode (OpenAI)
docker exec portfolio-backend env | grep DISABLE_PRIMARY
# If not set, restart with DISABLE_PRIMARY=1

# Or pull correct model
docker exec portfolio-ollama ollama pull gpt-oss:20b
```

### Figma Export Fails
**Symptoms**: `/agent/brand/card` returns 500, "FIGMA_PAT not configured" error

**Diagnosis**:
```bash
# 1. Check Figma env vars
docker exec portfolio-backend env | grep FIGMA

# 2. Test Figma API access
curl -H "X-Figma-Token: $FIGMA_PAT" \
  https://api.figma.com/v1/files/$FIGMA_TEMPLATE_KEY

# 3. Check template endpoint
curl http://localhost:8001/agent/brand/templates
```

**Common causes**:
- ❌ `FIGMA_PAT` not set or expired
- ❌ `FIGMA_TEMPLATE_KEY` wrong or file deleted
- ❌ Figma API rate limit hit (429 responses)

**Fix**:
```bash
# Rotate Figma token (see RUNBOOKS/DEPLOY.md)
# Update deploy/.env.production with new FIGMA_PAT
# Restart backend
docker restart portfolio-backend
```

### Tests Flaky
**Symptoms**: E2E tests pass/fail inconsistently, timeouts, race conditions

**What to do**:
1. **Move to quarantine**: `tests/_quarantine/` with `xfail` marker
2. **Add retry logic**: Use `test.retry(3)` in Playwright
3. **Increase timeouts**: Check for 5s defaults, bump to 10s if network-dependent
4. **Fix race conditions**: Add explicit waits (`waitForSelector`, not `sleep`)

```typescript
// Bad: race condition
await page.click('#submit');
expect(await page.locator('.result').textContent()).toBe('Done');

// Good: explicit wait
await page.click('#submit');
await page.waitForSelector('.result');
expect(await page.locator('.result').textContent()).toBe('Done');
```

### Python Import Errors After Cleanup
**Symptoms**: `ImportError: cannot import name 'X' from 'assistant_api.Y'`

**Common causes**:
- ❌ Empty `__init__.py` files (zero-byte files from audit cleanup)
- ❌ Circular imports
- ❌ Missing module in `assistant_api/`

**Fix**:
```bash
# Check for zero-byte files
find assistant_api -type f -name "*.py" -empty

# Restore from git if accidentally emptied
git checkout HEAD -- assistant_api/<file>.py

# Re-run tests to verify
pytest -q -k "not brand_card"
```

## Common Pitfalls

### ⚠️ "I changed code but production didn't update"
- GitHub Actions built new image but Watchtower hasn't pulled yet (runs every 5min)
- Force update: `curl -H "Authorization: Bearer $WATCHTOWER_TOKEN" https://api.leoklemet.com/ops/watchtower/v1/update`
- Check Watchtower logs: `docker logs watchtower --tail 50`

### ⚠️ "pnpm install fails with lockfile mismatch"
- Lockfile was edited locally (never hand-edit `pnpm-lock.yaml`)
- Fix: `pnpm install --no-frozen-lockfile` (regenerates lockfile)
- Commit the updated lockfile

### ⚠️ "Docker build fails: pnpm command not found"
- Missing `corepack enable` in Dockerfile
- Check `deploy/Dockerfile.frontend` has `RUN corepack enable pnpm`

### ⚠️ "E2E tests fail with 401 Unauthorized"
- Admin HMAC cookie not set or expired
- Check `.auth/admin.json` exists (created by `tests/e2e/auth.setup.ts`)
- Verify `ADMIN_EMAILS` in backend includes test email

### ⚠️ "Audit finds unused code but it's actually used"
- False positive from knip/depcheck (common with dynamic imports)
- Add to ignore list in `.knip.json` or `depcheck` config
- Document why it's needed (comment in code)


