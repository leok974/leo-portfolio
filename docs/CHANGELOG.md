# Changelog

All notable changes to this project will be documented here.
Format: Keep / Semantic Versioning (MAJOR.MINOR.PATCH). Dates in ISO (YYYY-MM-DD).

## [v0.7.1] - 2025-10-01
### Added
- Markdown & YAML linting via @eslint/markdown, yaml-eslint-parser, eslint-plugin-yml.
- Dispatcher `--help` and CI smoke step.
- Coverage threshold gate (Node 20 job).
- README badges: Release + per-metric shields.

### Fixed
- Docs normalized for MD/YAML lint (indentation, tabs, illustrative snippet suppressions).

### Notes
- Thresholds: Lines≥80, Statements≥80, Functions≥70, Branches≥60 (tune in `scripts/coverage-gate.mjs`).

## [v0.7.0] - 2025-10-01
### Added
- CI matrix (Node 18/20), unit tests, probe/status/CORS health checks, SRI dist verification.
- Scripts dispatcher (`scripts/bin.mjs`), coverage shield generator, integrity/status probe scripts.
- FastAPI settings module with enhanced status endpoints.
- TypeScript sources, global type declarations, and new tests.
- Husky pre-commit hook.

### Changed
- ESM-first repo (`"type":"module"`). Converted scripts to ESM and added `isEntrypoint()` helper.
- Relaxed `lint-staged` to skip eslint on JSON/MD/YAML (until dedicated parsers are configured).
- Docs refreshed: DEPLOY, DEVELOPMENT, ARCHITECTURE, SECURITY, OPERATIONS.

### Notes
- Coverage badges published from Node 20 job only.
- Optional: re-enable linting for MD/YAML once parsers are in place.

## [Unreleased]

### Added
- Operational helper scripts:
	- `scripts/all-green.ps1` (readiness + summary + latency + chat checks)
	- `scripts/chat-probe.mjs` (Node SSE streaming probe with truncation)
	- `scripts/chat-stream.ps1` (PowerShell HttpClient raw SSE reader)
	- `tests/chat.stream.served_by.spec.mjs` (soft-skip SSE marker validation test for `_served_by`)
		- `tests/chat.stream.fallback.spec.mjs` (conditional fallback-mode SSE marker test)
- Coverage Shields generation script `scripts/coverage-shield.mjs` producing `.github/badges/*.json` (combined + per-metric) for Shields.io endpoints.
- CI integration (unit-ci) step to publish coverage badges & summary to `status-badge` branch.
- Nightly strict streaming workflow (`nightly-streaming-strict.yml`) enforcing `_served_by` marker and publishing `streaming.json` badge.
- README streaming badge for nightly strict run (green=pass, red=fail).
- Nightly fallback streaming workflow (`nightly-streaming-fallback.yml`) validating `_served_by` under fallback host and publishing `streaming-fallback.json` badge (skips if secret unset).
- Streaming test enhancement: `EXPECT_SERVED_BY` env allows regex assertion of provider identity when `STRICT_STREAM_MARKER=1`.
- Aggregate streaming workflow (`nightly-streaming-aggregate.yml`) producing combined badge `streaming-combined.json` summarizing strict + fallback states.
- Dev frontend override (`docker-compose.dev.override.yml`) enabling local `dist` bind-mount + relaxed CSP (`nginx.dev.conf`).
- Manifest MIME mapping + explicit `location = /site.webmanifest` in production nginx config eliminating browser console warning.

### Changed
- Cloudflare Tunnel now delivered via optional overlay `docker-compose.cloudflared.yml` (removed embedded `cloudflared-portfolio` service from `deploy/docker-compose.prod.yml`).
	- Simplifies base production stack (no tunnel dependency by default).
	- Documentation, helper scripts, and operations updated to reference overlay pattern and generic `cloudflared` service name.
- Lint cleanup: removed stray unused expressions; standardized unused parameter/catch naming via underscore prefix.
- Unified frontend + edge nginx container via multi-target `deploy/Dockerfile.frontend` (targets: `frontend-static-final`, `frontend-vite-final`).
- Production convenience shortcuts: Makefile targets (`prod-up`, `prod-down`, `prod-logs`, `prod-rebuild`) and PowerShell tasks (`prod`, `prod-logs`, `prod-down`, `prod-rebuild`).
- Vite scaffolding (`package.json` scripts, `vite.config.ts`) and switched prod compose target to `frontend-vite-final`.

### Changed
- `docker-compose.prod.yml`: `nginx` service now builds integrated image (serves SPA + proxies API) replacing separate static frontend path.
- Simplified `deploy/nginx.conf` to serve SPA (history fallback) and proxy `/api/`, `/chat/stream`, diagnostics endpoints.
- Frontend status pill polling now imported from TypeScript module (`src/status/status-ui.ts`) via Vite entry (`main.js`), replacing legacy `js/status-ui.js` inline script tag (improves type safety & bundling consistency).
 - Frontend status pill polling now imported from TypeScript module (`src/status/status-ui.ts`) via Vite entry (migrated to `src/main.ts`), replacing legacy `js/status-ui.js` inline script tag (improves type safety & bundling consistency).
 - Migrated root `main.js` to TypeScript entry `src/main.ts` (added strong typings for project data, gallery, lazy loading, filtering, and build info injection; removed `@ts-nocheck`).
 - Migrated remaining legacy scripts to TypeScript: `js/api.js` → `src/api.ts`, `js/agent-status.js` → `src/agent-status.ts`, `js/assistant-dock.js` → `src/assistant-dock.ts`; consolidated loading via a single Vite module graph (no direct `<script>` tags).
 - Removed deleted legacy JS files from repository; index.html now only references the single module entry (`/src/main.ts`).
 - Frontend unit test harness (Vitest + jsdom) added with initial tests for filtering (`filters.ts`) and gallery navigation (`gallery-nav.ts`).
 - CSP tightened in `deploy/nginx.conf`: `script-src` no longer allows `'unsafe-inline'`; TODO left to remove `'unsafe-inline'` from `style-src` after refactoring inline styles.
 - Inline style refactor complete: extracted all inline `<style>` blocks & `style=""` attributes to `assets/site.css`; CSP `style-src 'self'` now enforced (dropped `'unsafe-inline'`).

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

### Added
- Security headers in `deploy/nginx.conf` (CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`) applied to all responses (including errors) via `always`.
- Build provenance: Docker/Vite build arg `VITE_BUILD_SHA` injected (compose passes `${GIT_SHA:-local}`) and surfaced in footer (`main.js` uses `import.meta.env.VITE_BUILD_SHA`).
- Footer build info element (`<small data-build-info>` in `index.html`) displaying short SHA + timestamp for traceability.
- Smoke test enhancement (`scripts/smoke.ps1`): fetches first hashed asset (`/assets/*.js`), asserts `Cache-Control` includes `immutable`, verifying long-lived caching policy.

### Changed
- `deploy/nginx.conf`: Added CSP (`default-src 'self'`) and long-cache directives now paired with explicit security headers; will tighten `style-src` (remove `'unsafe-inline'`) in a future pass once inline styles are refactored.
- `docker-compose.prod.yml`: Passes `VITE_BUILD_SHA` build arg enabling reproducible build metadata across environments.
 - `assistant_api/Dockerfile`: Optimized wheel build & install (persistent pip cache, wheels cache, removed `--no-cache-dir`, binary-only fast fail via `PIP_ONLY_BINARY=:all:`) dramatically reducing repeat build times.
 - `.dockerignore`: Pruned additional paths (`node_modules`, temp asset dirs, coverage, IDE metadata) to shrink build context and stabilize layer caching.
 - Frontend service worker: Disabled on GitHub Pages (auto-unregister) to prevent stale `index.html`; new network-first + hashed asset cache-first strategy (`sw.js`).
 - Dynamic API base selection in `main.js` (`window.__API_BASE__`) chooses external assistant domain on GitHub Pages and `/api` when self-hosted.
 - Backend CORS allowlist expanded (`ALLOWED_ORIGINS`) to include `https://leok974.github.io` enabling chat/diagnostic requests from Pages.
 - Centralized frontend API helpers (`js/api.js`) unify status, chat, and streaming calls and expose `window.API`.
 - Backend CORS handling: enhanced parsing for `ALLOWED_ORIGINS` (comma/space/newline separated) plus `CORS_ALLOW_ALL=1` emergency wildcard (credentials disabled when wildcard in effect).
 - Automatic CORS origin derivation from `DOMAIN` (adds https/http + www variants unless explicitly provided) stored with metadata.
 - Preflight logging middleware gated by `CORS_LOG_PREFLIGHT=1` prints Origin + Access-Control-Request-* headers for auditing.
 - `/status/cors` endpoint exposes current CORS configuration (raw env, derived origins, wildcard mode) for rapid diagnostics.

### Added (Unreleased – Monitoring & E2E)
- Scheduled production probe workflow (`prod-assistant-probe.yml`) publishing `status.json` (Shields endpoint) + `probe.json` to `status-badge` branch.
- Dynamic badge payload with latency-derived color + message (`ok|degraded|error|partial`) and captured `X-Build-ID`.
- SLO gating step (soft >5s, hard >10s, partial disallowed) failing workflow when thresholds breached.
- Playwright production E2E workflow (`e2e-prod.yml`) validating status pill and redirect.
- Redirect verification test (`redirect.spec.ts`) ensuring GitHub Pages → unified host transition.
- README status badge legend (color semantics) and OPERATIONS / DEVELOPMENT guidance additions.

### Fixed (Unreleased – CI Triage)
- Lint failure in `scripts/chat-probe.mjs` resolved by explicitly importing `URL` from `node:url` (ESLint no-undef under ESM).
- Schema validation script migrated from CommonJS `__dirname` to ESM-compatible `fileURLToPath(import.meta.url)` resolution avoiding runtime `ReferenceError`.
 - Coverage job failure resolved by adding missing `@vitest/coverage-v8` devDependency and explicit v8 coverage config in `vitest.config.ts`.
 - Publish backend workflow import failures (`ModuleNotFoundError: assistant_api`) fixed by exporting `PYTHONPATH` and invoking tests via `python -m pytest`.

### Improved (Unreleased – Resilience)
### Added (Unreleased – Test Performance)
- Slim test dependency set (`requirements.test.txt`) excluding heavy ML frameworks.
- Pytest config (`pytest.ini`) defaulting to skip `@pytest.mark.heavy` tests.
- Auto-mocking of heavy ML modules via `conftest.py` when `LIGHTWEIGHT_TEST_DEPS=1`.
- Fast slim CI workflow (`ci-fast.yml`) for quick feedback on PRs/pushes.
- Heavy model CI workflow (`ci-heavy.yml`) scheduled + manual for full coverage with CPU-only Torch wheel.

- `cors-verify` workflow hardened against intermittent Cloudflare bot challenges: added custom User-Agent, up to 5 retries with backoff, challenge HTML detection, and soft-skip behavior when persistent 403 challenge encountered (prevents noisy false negatives while preserving visibility).
 - Extended soft-skip / retry logic to OPTIONS preflight in `cors-verify` (mirrors GET logic; avoids failing build on persistent Cloudflare challenge pages).

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

