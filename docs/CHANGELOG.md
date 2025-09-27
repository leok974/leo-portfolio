# Changelog

All notable changes to this project will be documented here.
Format: Keep / Semantic Versioning (MAJOR.MINOR.PATCH). Dates in ISO (YYYY-MM-DD).

## [Unreleased]

### Added
- Unified frontend + edge nginx container via multi-target `deploy/Dockerfile.frontend` (targets: `frontend-static-final`, `frontend-vite-final`).
- Production convenience shortcuts: Makefile targets (`prod-up`, `prod-down`, `prod-logs`, `prod-rebuild`) and PowerShell tasks (`prod`, `prod-logs`, `prod-down`, `prod-rebuild`).
- Vite scaffolding (`package.json` scripts, `vite.config.ts`) and switched prod compose target to `frontend-vite-final`.

### Changed
- `docker-compose.prod.yml`: `nginx` service now builds integrated image (serves SPA + proxies API) replacing separate static frontend path.
- Simplified `deploy/nginx.conf` to serve SPA (history fallback) and proxy `/api/`, `/chat/stream`, diagnostics endpoints.

### Deprecated
- Separate `frontend` container pattern (legacy compose mode retained only for reference).

### Docs
- Updated `DEPLOY.md` for integrated edge targets.
- Updated `ARCHITECTURE.md` to reflect unified edge.

### Added
- **README:** “Model selection & warming” section explaining `PRIMARY_MODEL`, `llm.path` states (`down`→`warming`→`primary`), readiness vs. status, and local-model fallback.
- **Entrypoint:** Timeout-based model warmup control via `MODEL_WAIT_MAX_SECONDS` with early continue (non-blocking startup) and opt-out fast path `DISABLE_PRIMARY=1`.
- **Status:** Optional environment flags `STATUS_RAG_VIA_HTTP=1` and `RAG_PROBE_TIMEOUT` (seconds) to force legacy HTTP RAG probe for diagnostics.
- **Deploy:** Example override file (`deploy/docker-compose.override.example.yml`) documenting tuning knobs.
- **Scripts:** `test-warm-transition.ps1` for observing `llm.path` transition (`down→warming→primary`).
- **CI/CD:** GHCR multi-arch publish workflow (`publish-backend.yml`) pushing `backend` image (tags: main, semantic tags, SHA) to `ghcr.io`.
- **Tests:** `test_status_rag.py` covering status heuristic (primary vs warming, rag ok, missing index).
- **CI/CD:** Publish workflow now gated by passing backend tests (tests job must succeed before image build/push).
- **CI/CD:** Test job pip cache (actions/cache) for faster iterative runs.

### Changed
- **status/summary:** Unified OpenAI detection; explicit `warming` state when Ollama is up but model tag not present.
- **RAG health:** Reports `ok: true` with `mode: local-fallback` when cloud embeddings are absent, preventing false negatives.
- **smoke.ps1:** Auto-detects `/api` prefix vs root; prints a note when `llm.path=warming`.
- **RAG health (internal):** Direct in‑process probe (SQLite + embedding dimension heuristic) replaces prior internal HTTP POST to `/api/rag/query` (more reliable behind edge / during partial outages).
- **Docker (prod compose):** Edge nginx host ports remapped `80→8080` and `443→8443` to avoid local conflicts.

### Fixed
- Consistent `openai: configured|not_configured` across `/ready`, `/llm/health`, and `/status/summary`.
- False negative `rag.ok=false` in `/status/summary` when edge pathing or fallback-only mode previously blocked internal HTTP probe.
- Startup hangs waiting indefinitely for large model pulls (now bounded by `MODEL_WAIT_MAX_SECONDS`).

## [0.2.0] - 2025-09-27
### Added
- Full-stack Docker Compose (`docker-compose.full.yml`) including frontend + edge proxy.
- Static-first `deploy/Dockerfile.frontend` with future Node build upgrade path.
- Edge nginx proxy config (SSE buffering off, CORS map, static caching).
- Documentation policy integration (`.github/copilot-instructions.*`).
- Architecture, Deploy, Development, Security, API, Changelog scaffolds in `docs/`.
- Docs Policy section appended to root `README.md`.

### Changed
- Backend Dockerfile slimmed (removed static asset copy).
- Build context size reduced via `.dockerignore` (2.28GB → ~6.8MB for frontend).

### Fixed
- Edge container restart loop due to malformed nginx.conf (removed stray diff markers).
- Frontend build failure (`COPY --from=build /app/dist`) replaced with static collector pattern.

## [0.1.0] - 2025-09-20
### Added
- Initial FastAPI backend with chat, streaming, RAG query, health, metrics, diagnostics, latency probe endpoints.
- Ollama primary + OpenAI fallback provider logic.
- RAG SQLite store & ingestion scripts.
- Initial static portfolio frontend.

