# AGENT GUIDE

## Entry Points
- **Portfolio Web UI**: `apps/portfolio-ui/src/main.tsx`
- **SiteAgent UI**: `apps/siteagent-ui/src/main.tsx`
- **Backend API**: `assistant_api/main.py` (FastAPI)
- **Agent Tools**: `agent/tools/` (brand card, SEO, orchestration)
- **Cron/Workers**: `assistant_api/cron/` (if scheduled tasks)

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

**502 Bad Gateway**
- Backend unhealthy or crashed
- Check `docker logs portfolio-backend`
- Common: model not loaded, import error, env var missing

**Chat stream hangs**
- Ollama model loading slowly (first request after restart)
- Fallback to OpenAI if `DISABLE_PRIMARY=1`
- Check `/llm/primary/ping` for model status

**Figma export fails**
- Invalid `FIGMA_PAT` or template key
- Check `/agent/brand/templates` returns valid data
- Verify Figma API rate limits not exceeded

**Tests flaky**
- Move to `tests/_quarantine/` with `xfail`
- Add retry logic if network-dependent
- Check for race conditions (async timing)
