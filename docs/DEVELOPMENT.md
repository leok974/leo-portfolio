---
title: DEVELOPMENT
---

# Development Guide

> Draft – Expand as tooling evolves.

## Environment Setup
```bash
python -m venv .venv
# Windows PowerShell
. .venv/Scripts/Activate.ps1
# macOS/Linux
source .venv/bin/activate
pip install -U pip
pip install -r assistant_api/requirements.txt
```

## Run Backend (Dev)
```bash
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001 --reload
```
Or use batch / PowerShell helpers:
- `run_dev.bat`
- `tasks.ps1` → `CmdDev`, `HyperDev`

## Frontend (Static)
Serve root via:
```bash
python -m http.server 5173
# or
npx http-server -p 5173
```

## Combined Stack (Compose)
```bash
cd deploy
docker compose -f docker-compose.full.yml up -d --build
```

### Dev Frontend Override & CSP
For rapid UI iteration without rebuilding the frontend image each change:

```bash
cd deploy
docker compose \
  -f docker-compose.prod.yml \
  -f docker-compose.dev.override.yml \
  up -d --force-recreate nginx
```

What this does:
* Binds your local `./dist` into the Nginx container (immediate asset refresh on rebuild).
* Swaps in `nginx.dev.conf` which relaxes CSP (`'unsafe-inline'` / `'unsafe-eval'`) to avoid blocking inline dev styles or Vite-injected snippets.
* Leaves backend services untouched (only recreates `nginx`).

IMPORTANT: Do not deploy `nginx.dev.conf` to production. The production config (`nginx.conf`) is strict (no inline). Refactor remaining inline `<style>` tags into the Vite pipeline so you can keep the strong CSP everywhere.

Production image now ships with `entrypoint.d/10-csp-render.sh`. The script runs at container start, hashes any inline `<script>` blocks found in `index.html`, and patches the CSP header. If you test alternate HTML shells locally, remember to regenerate hashes (either by running the script manually via `sh entrypoint.d/10-csp-render.sh` or by replicating its logic in your dev workflow).

Manifest MIME: The production config now declares `application/manifest+json` for `webmanifest` ensuring browsers no longer warn about `site.webmanifest` being served as `text/plain` or `text/html`.

Troubleshooting 404s:
1. Ensure you actually built assets: `npm run build` (creates `dist/`).
2. Confirm the files exist locally: `dir dist` (PowerShell) or `ls dist`.
3. If still 404 in container, exec in Nginx: `docker compose exec nginx ls -1 /usr/share/nginx/html/assets`.
4. Cache: Hashed assets are cached aggressively; force refresh with Ctrl+Shift+R.
5. If files exist but nginx still returns 404, verify the container build kept directory execute bits. The prod Dockerfile now sweeps permissions with `find ... chmod` after copying artifacts—mirror that change if you maintain a custom image.

Next Hardening Steps (planned):
* Remove remaining inline styles → drop `'unsafe-inline'` from dev.
* Consider hashing critical inline script (if ever introduced) with CSP `script-src` sha256.
* Add build check that fails if inline `<style>` blocks persist (simple grep in CI).

### Assistant Dock Streaming Debug
- Browser requests are now forced through `/api/chat/stream` even if the backend summary advertises a different URL. This keeps local/GitHub Pages builds aligned with the edge shim during tests.
- DevTools prints `[assistant] chat POST …` for each submission and `[assistant] stream non-200 …` when the response status is not OK. Use these logs to confirm whether the request fired and which host/path it targeted before digging into backend logs.
- When a stream finishes without assistant tokens, the dock logs `stream done -> fallback` and immediately issues a JSON chat request so the transcript stays populated; inspect traces from the fallback Playwright spec if the console output looks suspicious.
- Shared SSE parsing lives in `src/lib/sse.ts` (`readSSE()` wrapper). Import it wherever you need to consume SSE streams; it normalizes `event:`/`data:` frames and surfaces safe callbacks.
- Assistant dock exposes a sr-only `<div data-testid="assistant-output">` that mirrors streamed text for Playwright assertions without changing the visible layout.

#### Guardrails (prompt‑injection) dev notes
- Backend detects prompt‑injection and common secret patterns; mode controlled by `GUARDRAILS_MODE=enforce|log` (default enforce). Set `ALLOW_UNSAFE=1` to disable blocking locally.
- SSE meta includes `guardrails` so the UI can render a Shield badge during streaming. JSON fallback responses also carry `guardrails`.
- Quick spec: `npm run e2e:guardrails:proxy` builds `dist/`, serves it with a proxy to `:8001`, and runs a Playwright spec that:
  - Confirms the Shield badge appears during stream
  - Confirms `/chat` JSON returns `guardrails.flagged=true` and `blocked=true` in enforce mode
- Related UI resiliency: `tests/e2e/ui-assistant-chip.spec.ts` ensures the assistant chip is not covered by the admin dock and remains clickable (z-index + pointer-events hardening).

## Dependency Management
- Source constraints: `assistant_api/requirements.in`
- Locked/pinned: `assistant_api/requirements.txt`
- Update flow:
```bash
pip install pip-tools
pip-compile assistant_api/requirements.in --output-file assistant_api/requirements.txt
pip install -r assistant_api/requirements.txt
```

## Tests
Run all tests:
```bash
pytest -q
```

### Backend Python Tests
```bash
# All backend tests
pytest -q

# Analytics & SEO tests
pytest tests/test_analytics_ingest.py -v
pytest tests/test_seo_llm_fallback.py -v

# Direct Python test (bypasses HTTP auth)
python test_analytics_direct.py
```

### SEO LLM Smoke Test
Manual end-to-end test for LLM-based SEO rewriting:

```powershell
# 1) Ensure Ollama is running with a suitable model
# Example: ollama run qwen2.5:7b-instruct

# 2) Set environment variables
$env:OPENAI_BASE_URL = "http://127.0.0.1:11434/v1"
$env:OPENAI_MODEL = "qwen2.5:7b-instruct"
$env:SEO_LLM_ENABLED = "1"
$env:SEO_LLM_TIMEOUT = "9.0"

# 3) Start backend
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001

# 4) Run smoke test (in another terminal)
.\test-seo-llm.ps1
```

The script will:
1. Ingest sample CTR data for 2 pages
2. Run the `seo.tune` task with LLM rewriting enabled
3. Display artifacts with method used (llm vs heuristic)
4. Show a preview of the generated recommendations

Expected output shows `notes: "llm"` when Ollama is reachable, or `notes: "heuristic"` when falling back.

### Frontend Tests

Frontend unit tests (Vitest + jsdom):
```bash
npm run test     # one-off
npm run test:watch
npm run test:assistant:ui   # backend-free assistant UI Playwright harness (serve dist/ or set BASE_URL)
npm run test:assistant:fallback   # targeted guard for zero-token stream fallback path
- Harness stubs `/api/status/summary` via `tests/e2e/lib/mock-ready.ts` so the assistant dock unlocks without the real backend and works against archived shells.
- Specs accept either the new `data-testid` hooks or legacy `#chatInput`/`#chatSend` markup, keeping assertions stable even if the hosted HTML hasn't been rebuilt yet.
- `installFastUI(page)` from `tests/e2e/lib/fast-ui.ts` blocks heavy assets, disables animations, and standardizes viewport + reduced motion so mocked UI specs stay deterministic.
- `tests/e2e/assistant-ui-fallback.spec.ts` intercepts a stream that only emits meta/done events and asserts the dock retries via `/api/chat` JSON, preventing blank transcripts.
- `tests/e2e/assistant-ui-followup.spec.ts` validates the assistant's conversational tone by checking that responses end with follow-up questions. Uses bundle interception to ensure SSE mocks work correctly.
- The fallback spec serves the freshly built Vite bundle from `dist/assets/`; run `npm run build` first so the hashed `index-*.js` is available.

Fast Playwright loops:
```bash
npm run test:fast      # chromium, @frontend + routing smoke, aborts on first failure
npm run test:changed   # chromium only, reruns specs touching modified files
```

### Eval harness (chat + planner)
Lightweight evals are defined under `evals/` and executed by `scripts/eval_run.py`.

One-offs (local backend at 127.0.0.1:8023 by default):
```powershell
npm run eval:chat   # baseline chat cases
npm run eval:plan   # planning/tooling cases
npm run eval:all    # both files
npm run eval:regress # regression-only set (keep baseline lean)
npm run eval:full    # baseline + planning + regression
```

Pytest smokes:
```powershell
npm run test:eval
```

Admin UI: the floating dock includes an Eval card with a tiny trend chart (pass ratio) backed by `/api/eval/history` and a Run button invoking `/api/eval/run`.

#### Local E2E for Eval run-sets (proxy recommended)
If you see 404s from `/api/*` during the Eval e2e, it usually means the page origin (5178) is calling `/api/...` but your backend is on a different origin/port. Serve the built UI with a proxy so `/api/...` forwards to the backend.

PowerShell (Windows):
```powershell
# 1) Start backend (safe/dev mode)
$env:CORS_ALLOW_ALL='1'
$env:SAFE_LIFESPAN='1'
$env:DISABLE_PRIMARY='1'
$env:DEV_ALLOW_NO_LLM='1'
Remove-Item Env:RAG_URL -ErrorAction SilentlyContinue
python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001 --log-level warning
```

```powershell
# 2) In another terminal: build and serve dist with proxy to :8001
npm run -s build
npm run -s serve:dist:proxy   # http://127.0.0.1:5178 → proxies /api → http://127.0.0.1:8001
```

```powershell
# 3) Run the Eval e2e (points BASE to UI origin; API calls go through the proxy)
$env:PLAYWRIGHT_GLOBAL_SETUP_SKIP='1'
$env:BASE='http://127.0.0.1:5178'
npx playwright test tests/e2e/eval-run-sets.spec.ts --project=chromium --reporter=line --timeout=120000
```

Alternatively, use the helper script:
```powershell
# Serve with proxy and run the spec (expects backend at :8001)
npm run e2e:eval:proxy
```

Radix Select testing notes:
- The Eval card now uses a shadcn/Radix Select for the run-set dropdown. In Playwright, click the trigger (data-testid="admin-eval-select") then choose an option by role:
  - `page.getByTestId('admin-eval-select').click()`
  - `page.getByRole('option', { name: 'Regression' }).click()`
- The options render in a portal; role-based queries remain stable across portals.
- For e2e stability, prefer polling `/api/eval/history` to assert a run completed rather than waiting for the POST response.

### Agent E2E Tests (SEO Analytics)

The SEO analytics agent (`seo.tune` task) has dedicated E2E tests with **mock** and **full** modes:

#### Quick Commands
```bash
npm run test:e2e:seo:mock  # Fast mock tests (~3s) - no LLM/DB dependencies
npm run test:e2e:seo:full  # Full integration tests (~2min) - real agent execution
```

#### Test Modes Comparison

| Mode | Duration | Dependencies | Use Case | Artifacts |
|------|----------|--------------|----------|-----------|
| **Mock** (`seo-analytics.mock.spec.ts`) | ~3s | None (test endpoint `/agent/run/mock`) | CI smoke tests, quick verification | Deterministic fake data with SHA-256 integrity |
| **Full** (`seo-analytics.spec.ts`) | ~2min | Backend + Ollama/OpenAI LLM | Pre-deploy validation, LLM quality checks | Real agent analysis results |

#### Auto-Downgrade Feature
When the **backend** is started with `SEO_LLM_ENABLED=0`, the `seo.tune` task automatically downgrades to mock mode:
- No code changes needed in tests
- Backend logs `seo.tune.auto_mock` event
- Artifacts include `"mock": true` indicator
- Useful for:
  - Local dev without LLM setup
  - CI environments without API keys
  - Fast smoke tests

---

## SEO Intelligence Scripts (Phase 50.9)

Automated nightly reports for SEO health and analytics monitoring.

### Available Scripts

#### 1. `scripts/seo-intel.mjs` - Intelligence Scanner
Probes frontend and backend endpoints to generate comprehensive reports.

**Usage**:
```bash
# Local run with default URLs
node scripts/seo-intel.mjs

# Custom URLs
node scripts/seo-intel.mjs --base http://localhost:5173 --backend http://localhost:8001

# Custom output paths
node scripts/seo-intel.mjs --out reports/custom.json --md reports/custom.md
```

**What it checks**:
- Frontend: Title, meta description, Open Graph tags, canonical URLs, JSON-LD
- Backend: Health endpoints (/ready, /api/metrics/behavior)
- Assets: WebP optimization ratios
- Privacy: privacy.html compliance, retention policy, opt-out instructions

**Output**:
- `reports/summary.json` - Machine-readable results
- `reports/summary.md` - Human-readable markdown report

#### 2. `scripts/seo-pr-body.mjs` - PR Body Generator
Generates formatted PR descriptions from intelligence reports.

**Usage**:
```bash
# Generate PR body from summary
node scripts/seo-pr-body.mjs --summary reports/summary.json > reports/PR_BODY.md

# Or use default path
node scripts/seo-pr-body.mjs > pr-body.md
```

#### 3. `scripts/seo-autofix.mjs` - Safe Autofixes
Applies conservative, safe fixes for common SEO issues.

**Usage**:
```bash
# Dry run (default) - shows what would be fixed
node scripts/seo-autofix.mjs

# Apply fixes
node scripts/seo-autofix.mjs --apply

# Custom base URL
node scripts/seo-autofix.mjs --base http://localhost:5173 --apply
```

**Safe fixes applied**:
- Missing `<meta name="description">` tags
- Missing viewport meta tag
- Missing canonical URL
- Missing `robots.txt`
- Missing `.gitignore` patterns for reports/

**⚠️ Important**: Only run with `--apply` when you've reviewed the dry-run output.

### Integration with Nightly Workflow

These scripts are automatically run by `.github/workflows/seo-intel-nightly.yml`:
- Runs daily at 02:30 ET (06:30 UTC)
- Creates auto-PR with findings
- Uploads artifacts for review
- Optionally applies safe fixes when `AUTO_FIX=true`

**Local simulation**:
```bash
# Run the full nightly sequence locally
mkdir -p reports
node scripts/seo-intel.mjs --base http://localhost:5173 --out reports/summary.json --md reports/summary.md
node scripts/seo-pr-body.mjs --summary reports/summary.json > reports/PR_BODY.md
cat reports/PR_BODY.md
```

**Important**: The environment variable must be set when **starting the backend**, not just in the test runner.

```bash
# Example: Start backend with auto-downgrade enabled
$env:SEO_LLM_ENABLED="0"
.venv/Scripts/python.exe -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001

# Then run tests (they'll use mock under the hood)
npm run test:e2e:seo:full
```

**CI Integration**: The e2e-mock workflow automatically sets `SEO_LLM_ENABLED=0` when starting the backend, enabling auto-downgrade for fast CI tests.

#### Helper Functions
**`waitForArtifact(filePath, options)`** (`tests/e2e/helpers/waitForArtifact.ts`):
- Polls filesystem for artifact with retry logic
- Configurable timeout (default: 30s) and interval (default: 500ms)
- Returns parsed JSON content or throws timeout error
- Used in both mock and full test suites

```typescript
import { waitForArtifact } from './helpers/waitForArtifact';
const artifact = await waitForArtifact('./agent_artifacts/seo-tune.json', { timeout: 60000 });
expect(artifact.changes).toBeInstanceOf(Array);
```

#### Prerequisites
1. **Backend running** on port 8001:
   ```bash
   .venv/Scripts/python.exe -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001
   ```
2. **Test routes enabled**: `ALLOW_TEST_ROUTES=1` (default in dev)
3. **For full tests**: Ollama/OpenAI configured with `SEO_LLM_ENABLED=1`

#### Troubleshooting
- **Artifact not found**: Check backend logs for task execution errors
- **Timeout in mock tests**: Ensure `ALLOW_TEST_ROUTES=1` and backend is healthy
- **LLM errors in full tests**: Verify `SEO_LLM_ENABLED=1` and model availability
- **SHA-256 mismatch**: Mock artifacts use compact JSON format for consistent hashing

**CI Integration**: `.github/workflows/e2e-mock.yml` runs mock tests on every push/PR to main and LINKEDIN-OPTIMIZED branches. Badge: [![e2e-mock](https://github.com/leok974/leo-portfolio/actions/workflows/e2e-mock.yml/badge.svg)](https://github.com/leok974/leo-portfolio/actions/workflows/e2e-mock.yml)

### Fast Mock E2E — Keywords (Phase 50.6.3)

Quick verification of `/agent/seo/keywords` endpoint using deterministic mock route.

**Mock Endpoint**: `POST /agent/seo/keywords/mock`
- Instantly writes `agent_artifacts/seo-keywords.{json,md}`
- Deterministic output (2 pages: `/index.html`, `/agent.html`)
- No LLM dependencies
- Includes SHA-256 integrity checksums
- Runtime ~500ms vs ~3s for full extraction

**Test Suite**: `tests/e2e/seo-keywords.mock.spec.ts`
- 3 tests validating artifact structure, integrity, and content
- Verifies keyword format (term, score 0-1, trend 0-100)
- Checks for expected portfolio/automation keywords

**Environment**:
- `ALLOW_TEST_ROUTES=1` — Enables mock endpoints
- `SEO_LLM_ENABLED=0` — Fast heuristic mode (not needed for mock)

**Auto-Downgrade Feature**:
- When `SEO_LLM_ENABLED=0`, hitting `/agent/seo/keywords` (full route) automatically downgrades to the mock path
- Provides seamless fallback without code changes in clients or tests
- Verified by `tests/e2e/seo-keywords.fallback.spec.ts`

**Sitemap Auto-Discovery**:
- `/agent/seo/keywords` auto-discovers pages via `assistant_api/utils/sitemap.py`
- **Sources** (in order): `sitemap.xml` → filesystem scan (3 levels deep) → fallback defaults
- **Nested paths**: Supports `/blog/post/index.html`, `/projects/ai/agent.html`, etc.
- **Filtering**: Include/exclude via env vars
  - `SEO_SITEMAP_INCLUDE="/*.html,/blog/*"` — Only include matching paths
  - `SEO_SITEMAP_EXCLUDE="/drafts/*,/tmp-e2e/*"` — Exclude matching paths
- **Custom public dirs**: `SEO_PUBLIC_DIRS="public,dist,/var/www/html"`
- **Caching**: `SEO_SITEMAP_CACHE=1` writes to `agent/artifacts/status.json`
- **Title/description extraction**: Regex-based from HTML (no dependencies)
- **Test locally**:
  ```bash
  # Discover pages
  python -c "from assistant_api.utils.sitemap import discover_pages; [print(f'{p.path}: {p.title}') for p in discover_pages()]"

  # Test with filtering
  SEO_SITEMAP_INCLUDE="/*.html,/blog/*" SEO_SITEMAP_EXCLUDE="/tmp-e2e/*" \
    python -c "from assistant_api.utils.sitemap import discover_pages; print(f'Found {len(discover_pages())} pages')"
  ```

**Local Usage**:
```bash
# Generate mock artifacts
curl -X POST http://127.0.0.1:8001/agent/seo/keywords/mock \
  -H "Authorization: Bearer dev" | jq

# Verify artifacts
cat agent_artifacts/seo-keywords.json | jq '.integrity'
cat agent_artifacts/seo-keywords.md | head -20

# Run E2E tests
npx playwright test tests/e2e/seo-keywords.mock.spec.ts --project=chromium
```

**CI Workflow**: `.github/workflows/e2e-keywords-mock.yml` runs on push/PR. Badge: [![e2e-keywords-mock](https://github.com/leok974/leo-portfolio/actions/workflows/e2e-keywords-mock.yml/badge.svg)](https://github.com/leok974/leo-portfolio/actions/workflows/e2e-keywords-mock.yml)

---

**CI Workflow:** `.github/workflows/frontend-fast.yml` runs `test:fast` on push/PR. Badge: [![Frontend Fast Tests](https://github.com/leok974/leo-portfolio/actions/workflows/frontend-fast.yml/badge.svg)](https://github.com/leok974/leo-portfolio/actions/workflows/frontend-fast.yml)

Streaming behavior notes:
- Grace window is tunable via `VITE_SSE_GRACE_MS` (ms). Default: 1800. The client extends grace dynamically on SSE heartbeats (comment `:` or `event: ping`).
- The grace is model-aware: it scales slightly with prompt length and bumps for heavy local models (e.g., `gpt-oss:20b`).
- Normal fallback to JSON logs at `console.info`; `console.warn` appears only if both stream and JSON fallback fail.
 - Backend streams send an immediate heartbeat frame (`:\n\n`) and periodic `event: ping` every ~0.9s until the first token arrives, so the UI can keep extending its grace window without spurious warnings. Empty deltas are filtered to avoid flicker.
 - Client env knobs:
   - `VITE_SSE_GRACE_MS` — base grace in ms (default 1800)
   - `VITE_PRIMARY_MODEL` — optional hint like `gpt-oss:20b` to slightly bump grace for heavy local models
 - Backend env knobs (optional):
   - `DISABLE_PRIMARY=1` — force fallback path for fast local dev/CI
  - `DEV_ALLOW_NO_LLM=1` — synthesize minimal assistant replies for deterministic backend tests (no external LLMs)
   - `CORS_LOG_PREFLIGHT=1` — verbose OPTIONS logging during CORS debugging

  Additional backend toggles:
  - `SSE_PING_MS` — override backend SSE heartbeat interval (ms)
  - `RAG_DB` — path to SQLite store (default `./data/rag.sqlite`)
  - `RAG_URL` — internal HTTP RAG query endpoint for auto-RAG; usually unset when using in-process fallback

  Quick overrides (Windows PowerShell):
  ```powershell
  $env:RAG_DB = 'D:/leo-portfolio/data/rag_test.sqlite'
  $env:DEV_ALLOW_NO_LLM = '1'
  $env:VITE_SSE_GRACE_MS = '2200'
  ```

```
Tested helpers:
- `filters.ts` (category visibility & announcement text)
- `gallery-nav.ts` (arrow/home/end navigation wrapping logic)

## Lint & Unit Tests

JavaScript (JSDoc strict) + TypeScript unit helpers:

```bash
npm run lint      # ESLint (flat config) over .js/.ts
npm run test      # Vitest unit tests (jsdom)
npm run coverage  # Generates coverage/ (lcov + HTML)
```

Notes:
* Playwright E2E specs are excluded from unit runs via `vitest.config.ts` (`exclude: ['tests/e2e/**']`).
* Coverage artifact uploaded in CI workflow `.github/workflows/unit-ci.yml`.
* Non-blocking security audit step logs high severity issues (adjust threshold later if you want gating).
* Add new frontend tests under `tests/*.spec.ts` or `.test.ts` (avoid `tests/e2e/` for unit scope).

### Coverage Badges (Shields JSON)
Pipeline (current):
1. `npm run coverage` generates `coverage/coverage-summary.json` (Vitest).
2. `npm run cov:badges` (script `scripts/coverage-shield.mjs`) produces multiple Shields endpoints under `.github/badges/`:
  - `coverage.json` (combined: `L <lines>| B <branches>| F <functions>`)
  - `lines.json`, `branches.json`, `functions.json` (individual metrics)
3. CI workflow (`unit-ci.yml`) commits these JSON files to the `status-badge` branch alongside the raw summary.
4. README references them via Shields endpoint URLs.

Local regeneration after modifying tests:
```bash
npm run coverage
npm run cov:badges
git checkout -B status-badge
git add .github/badges/*.json coverage/coverage-summary.json
git commit -m "chore(badges): update coverage shields"
git push -u origin status-badge --force
```

Color bands (default in script):
| Threshold | Color       |
|-----------|-------------|
| >=95%     | brightgreen |
| >=90%     | green       |
| >=80%     | yellowgreen |
| >=70%     | yellow      |
| >=60%     | orange      |
| <60%      | red         |

Adjust bands in `scripts/coverage-shield.mjs` (`band()` helper).

### Node Module Type
This repository is ESM-first (`"type": "module"` in `package.json`).
* Author new Node scripts with `import` / `export` (use `.mjs` only if you need to force ESM outside the main tree).
* Any legacy CommonJS scripts that still rely on `require()` should be renamed to `.cjs` (none currently present under `scripts/`).
* Mixed mode tip: if you introduce tooling that only supports CommonJS, isolate it as `<name>.cjs` instead of reverting the global module type.
* CI and local commands already target `.mjs` or ESM-aware entry points—no further changes required.

### Pre-commit Hooks (Husky + lint-staged)
Install dependencies (already in `devDependencies` after setup):
```bash
npm run prepare   # installs .husky/ hooks
```
Hook behavior:
* Staged JS/TS: ESLint (`--max-warnings=0`) then `vitest related --run` (fast selective tests).
* Staged JSON/MD/YAML: ESLint invoked with explicit extensions.

Adjust patterns or commands via `lint-staged` block in `package.json`.

Add new frontend test files under `tests/*.test.ts`.
Minimal health smoke (PowerShell):
```powershell
pwsh -File scripts/smoke.ps1 -BaseUrl "http://127.0.0.1:8001"
```

## Playwright (Prod E2E)

These tests exercise the deployed production host (status pill + readiness) and are intentionally lightweight.

Install browsers (first time):
```bash
npm run e2e:install
```

Run against prod (default base URL embedded):
```bash
npm run e2e
```

Override base:
```bash
PROD_BASE=https://assistant.ledger-mind.org npm run e2e
```

Skip in CI (environment gate):
```bash
SKIP_E2E=1 npm run e2e
```

Artifacts (on failure): traces + screenshots (HTML report not auto-opened). Config: `playwright.config.ts`.

Workflow reference: `.github/workflows/e2e-prod.yml` (scheduled + manual dispatch).

## Fast Type Check & UI Smoke (New)

Two lightweight guards were added to catch regressions early:

### 1. TypeScript Check Workflow
File: `.github/workflows/ts-check.yml`

Runs `npm ci` then `tsc --noEmit` (leveraging `checkJs` + `.d.ts` ambient types) on every push / PR to `main` and `test`. Fails fast if any JS/TS typing drift (e.g., window global removal, module rename) occurs.

Local equivalent:
```bash
npm run typecheck
```

### 2. UI Smoke (Playwright)
File: `.github/workflows/ui-smoke.yml`

Purpose: Prove end‑to‑end that:
1. Homepage renders (no blocking CSP errors)
2. First stylesheet is served as real CSS (not HTML fallback)
3. Streaming endpoint `/chat/stream` yields bytes (and optionally `_served_by` metadata)

Environment:
* If secret `UI_SMOKE_BASE` is set → tests hit that public base (no containers).
* Else spins up `backend` + `nginx` locally via `docker-compose.prod.yml` and waits for `/ready` + `/status/summary`.

Adjust strictness:
```bash
PLAYWRIGHT_STRICT_STREAM=1 EXPECT_SERVED_BY="primary|ollama" npx playwright test
```

Test file: `tests/e2e/assistant.smoke.spec.ts` (single spec, ~<5s on warm host).

### 3. One-File Node Smoke (Optional Local Shortcut)
Script: `scripts/ui-smoke.mjs`

Runs without browsers (pure fetch API) to validate:
* CSS asset: 200 + `text/css` + `immutable`
* Stream produces some bytes (stops early if `_served_by` marker found)

Run locally:
```bash
BASE=http://127.0.0.1:8080 node scripts/ui-smoke.mjs
```

Failures exit non‑zero with a concise message—suitable for embedding in future pre-deploy or canary steps.

## Status Badge Reference
The production probe publishes `status.json` to branch `status-badge`. README consumes via Shields endpoint.

Color thresholds:
| Color | Condition |
|-------|-----------|
| green | All latencies ≤ 5s |
| orange | Any latency > 5s & ≤ 10s |
| red | Any latency > 10s |
| lightgrey | One or more null latencies |

Message mapping: `ok`, `degraded`, `error`, `partial`.

Build correlation: `extra.build` (from `X-Build-ID` header) enables linking badge state to a deployed commit.

### Probe SLO & Baseline Collection
The probe workflow enforces SLO thresholds (`SLO_MAX_MS=5`, `HARD_MAX_MS=10`, `ALLOW_PARTIAL=false`). After initial stabilization (24h+), collect samples from `status-badge` branch to consider tuning:
```bash
git fetch origin status-badge:status-badge
git checkout status-badge
git log --format='%H' -- status.json | head -n 50 | while read sha; do \
  git show ${sha}:status.json | jq -r '.extra.probe.latencies | [ .root, .ready, .status, .chat ] | @csv'; \
done > latency-samples.csv
```
Analyze medians / p95; adjust `SLO_MAX_MS` if consistently below or above target.

## Lint / Format / Audit (suggested tooling)
```bash
pip install ruff pip-audit
ruff check assistant_api
pip-audit -r assistant_api/requirements.txt
```

## Troubleshooting Windows Instant Exit
See README section 'Windows: Server starts then immediately shuts down'. Use `run_cmddev.py` runner.

### Lifespan probe noise and safe flag
If you see logs like `list_models error: 'NoneType' object is not iterable` during startup or shutdown warnings like `Passing coroutines is forbidden` / `Event.wait was never awaited`, enable the safe lifespan mode which skips primary model probing and uses robust cleanup:

PowerShell (Windows):
```powershell
$env:SAFE_LIFESPAN = '1'   # skip probe entirely in dev/CI
$env:DISABLE_PRIMARY = '1'
$env:DEV_ALLOW_NO_LLM = '1'
Remove-Item Env:RAG_URL -ErrorAction SilentlyContinue  # use in-process RAG
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8023 --log-level warning
```

To hard-disable lifespan management for a quick unblock, you can also run:
```powershell
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8023 --log-level warning --lifespan off
```

You should see:
```
[lifespan] startup: begin
[lifespan] SAFE_LIFESPAN enabled: skipping primary probe
[lifespan] startup: ready (loop held)
...
[lifespan] shutdown: done
```

### SQLite ingest hardening
- Windows note: FAISS is optional at runtime. If `faiss` is not installed, the backend will still start; dense vector search returns an empty list and RAG falls back to BM25 + brute-force. To build/use the FAISS index on Windows, install a compatible FAISS wheel or use WSL.
- Env gate: set `RAG_DENSE_DISABLE=1` to force-disable dense/FAISS even if the module is present. This is handy for CI and local dev when you only need BM25/FTS behavior.

- `rag.sqlite` now runs in WAL mode with a 10s busy timeout.
- `connect()` and `commit()` are wrapped in a 5× exponential backoff so overlapping warmup jobs and `/api/rag/ingest` no longer surface `sqlite3.OperationalError: database is locked`.
- Helper scripts (`scripts/rag-build-index.ps1`, `/api/rag/ingest`) can be retried immediately—no manual DB resets required.

## Hot Reload Notes
`--reload` watches files; large asset churn can slow reloads. Consider excluding heavy dirs via `--reload-dir` pointing only to `assistant_api`.

## SSE Testing
```bash
curl -N -X POST http://127.0.0.1:8001/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Test streaming"}]}'
```

## RAG Query Quick Test
```bash
curl -s -X POST http://127.0.0.1:8001/api/rag/query \
  -H 'Content-Type: application/json' \
  -d '{"question":"What models are supported?","k":3}' | jq '.'
```

## Pre-pull local models (Windows) — warm the cache

Use the helper to pre-download local models so the first real run is instant:

```
pwsh -File scripts/prepull-models.ps1
```

Defaults:
- Embedder: `BAAI/bge-m3`
- Reranker: `BAAI/bge-reranker-base`
- Generator (Ollama): `llama3.1:8b-instruct`

Options:
```
pwsh -File scripts/prepull-models.ps1 -EmbedModel "intfloat/e5-large-v2" -RerankModel "cross-encoder/ms-marco-MiniLM-L-6-v2" -SkipOllama
```

Tip: Move the HF cache onto a faster disk by setting `HF_HOME`, e.g. `D:/hf-cache` (see script header).

Verify (after pre-pull):
```
pwsh -File scripts/rag-build-index.ps1 -DbPath "D:/leo-portfolio/data/rag_8010.sqlite"
pwsh -File scripts/start-stable.ps1 -BindAddress 127.0.0.1 -Port 8010 -DbPath "D:/leo-portfolio/data/rag_8010.sqlite" -WaitMs 60000

# Exercise embeddings/rerank/gen
Invoke-RestMethod -Method POST -Uri 'http://127.0.0.1:8010/api/rag/query' -ContentType 'application/json' -Body (@{ question='What is LedgerMind?'; k=5 } | ConvertTo-Json) | ConvertTo-Json -Depth 4

$body = @{ messages = @(@{ role='user'; content='Give me a brief about LedgerMind with sources' }); include_sources = $true } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri 'http://127.0.0.1:8010/chat' -ContentType 'application/json' -Body $body | ConvertTo-Json -Depth 5

# Confirm local backends were used
Invoke-RestMethod 'http://127.0.0.1:8010/api/metrics' | ConvertTo-Json -Depth 5
```
Expected: `embeddings.last_backend: "local"`, `rerank.last_backend: "local"`, and `gen.last_backend: "local"` when Ollama base is configured and the model was pulled.

### Routing Smoke vs. Streaming Functional Test (New)

Two complementary backend routing / streaming guards now exist:

- `tests/e2e/routing-smoke.spec.ts` (OPTIONS-based): sends `OPTIONS /api/chat` and `OPTIONS /api/chat/stream`.
  * Purpose: prove nginx maps edge paths → backend (non-404) rapidly.
  * Any status except 404 == mapped (200 / 204 / 405 / 500 / 502 / 503 all acceptable).
  * Rationale: avoids waiting on heavy model cold start (POST may exceed 8s) and avoids hanging on infinite SSE body.

- `tests/e2e/chat-stream-first-chunk.spec.ts`: opens real SSE `POST /api/chat/stream`, reads until the first `_served_by` meta event OR first assistant message `data:` line, then aborts.
  * Captures first-token latency when `STREAM_LATENCY_LOG=1` (annotation `stream-first-token-ms`).
  * Time windows tunable via env: `WAIT_SSE_MS` (overall) and `WAIT_SSE_ATTEMPT_MS` (per attempt segment).
  * Uses readiness helper (`waitForPrimary`) to reduce cold-start flakiness; set `ALLOW_FALLBACK=1` to accept fallback in rescue.

Run examples (PowerShell):
```powershell
# Fast mapping check
pnpm test:routing:smoke

# Streaming first token latency (annotated)
$env:STREAM_LATENCY_LOG='1'
pnpm test:backend:req -- -g "@backend chat stream first-chunk"
```

Adjust latency / attempt budgets for larger models:
```powershell
$env:WAIT_SSE_MS='120000'
$env:WAIT_SSE_ATTEMPT_MS='45000'
$env:STREAM_LATENCY_LOG='1'
pnpm test:backend:req -- -g "@backend chat stream first-chunk"
```

Debugging tips:
| Symptom | Likely Cause | Action |
|---------|--------------|--------|
| OPTIONS returns 404 | Nginx shim missing | Rebuild nginx image & verify `location = /api/chat` blocks. |
| Streaming test times out with no `_served_by` | Model still loading | Increase `WAIT_SSE_MS` & verify `ollama-init` logs. |
| First token latency high (>> expected) | Cold model or container CPU contention | Add pre-warm POST or raise resource limits. |
| `_served_by` shows fallback unexpectedly | Primary model absent | Confirm `ollama-init` pulled model (`docker compose logs ollama-init`). |

Related environment knobs (see readiness section for full list): `WAIT_PRIMARY_MS`, `WAIT_PRIMARY_META_TIMEOUT_MS`, `WAIT_CHAT_MS`, `ALLOW_FALLBACK`, `STREAM_LATENCY_LOG`.

Purpose separation ensures: routing failures surface instantly (fast OPTIONS) while functional streaming health + latency is measured independently without conflating concerns.

### Latency rollup & gating helpers

After running any Playwright specs with `STREAM_LATENCY_LOG=1`, use the helper scripts to summarize and enforce performance budgets:

```powershell
# Single run (Playwright config writes JSON to playwright-report/results.json)
npm run report:latency

# Aggregate every JSON file in playwright-report/ (retries, shards, manual runs)
npm run report:latency:all

# Enforce a latency budget (fails when p95 > LATENCY_P95_MS, default 1500ms)
$env:LATENCY_P95_MS='1200'
npm run report:latency:gate
```

Notes:
- `report:latency:all` accepts directories or glob patterns; on PowerShell, pass the folder name (`playwright-report`) if `*.json` does not expand automatically.
- The rollup prints an overall table *and* per-provider breakdown, also appending both tables to `$GITHUB_STEP_SUMMARY` in CI.
- The gate script skips gracefully when no annotations are present, so it is safe to run inside `if: always()` blocks.
- The `@backend chat stream first-chunk` spec records both `stream-first-token-ms` and `stream-provider` annotations, so fallback vs. primary paths show up automatically in the rollup tables.

SSE quick probes (PowerShell):
```powershell
curl.exe -s -N -X POST http://127.0.0.1:8080/api/chat/stream -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"Ping"}]}' | Select-String -Pattern "^event:|^data:" -AllMatches | ForEach-Object { $_.Line }
```

Example multi-run aggregation (PowerShell):

```powershell
Remove-Item playwright-report\\*.json -ErrorAction Ignore
for ($i = 1; $i -le 5; $i++) {
  npx playwright test -g "@backend chat stream first-chunk" --reporter=json --quiet > "playwright-report/run-$i.json"
  Start-Sleep -Seconds 1
}
npm run report:latency:all
```

CI wiring example:

```yaml
- name: Stream latency rollup (all JSON)
  if: always()
  run: node scripts/stream-latency-report.mjs playwright-report || true

- name: Enforce latency budget (p95)
  if: always()
  env:
    LATENCY_P95_MS: "1500"
  run: npm run report:latency:gate
```

Optional extension: add annotations like `{ type: 'stream-coldstart', description: '1' }` in the spec when `waitForPrimary` detects a cold pull, then modify the rollup to segment stats by cold vs. warm runs.

## Dependency Management
- Source constraints: `assistant_api/requirements.in`
- Locked/pinned: `assistant_api/requirements.txt`
- Update flow:
```bash
pip install pip-tools
pip-compile assistant_api/requirements.in --output-file assistant_api/requirements.txt
pip install -r assistant_api/requirements.txt
```

## Tests
Run all tests:
```bash
pytest -q
```
Frontend unit tests (Vitest + jsdom):
```bash
npm run test     # one-off
npm run test:watch
```
Tested helpers:
- `filters.ts` (category visibility & announcement text)
- `gallery-nav.ts` (arrow/home/end navigation wrapping logic)

## Lint & Unit Tests

JavaScript (JSDoc strict) + TypeScript unit helpers:

```bash
npm run lint      # ESLint (flat config) over .js/.ts
npm run test      # Vitest unit tests (jsdom)
npm run coverage  # Generates coverage/ (lcov + HTML)
```

Notes:
* Playwright E2E specs are excluded from unit runs via `vitest.config.ts` (`exclude: ['tests/e2e/**']`).
* Coverage artifact uploaded in CI workflow `.github/workflows/unit-ci.yml`.
* Non-blocking security audit step logs high severity issues (adjust threshold later if you want gating).
* Add new frontend tests under `tests/*.spec.ts` or `.test.ts` (avoid `tests/e2e/` for unit scope).

### Coverage Badges (Shields JSON)
Pipeline (current):
1. `npm run coverage` generates `coverage/coverage-summary.json` (Vitest).
2. `npm run cov:badges` (script `scripts/coverage-shield.mjs`) produces multiple Shields endpoints under `.github/badges/`:
  - `coverage.json` (combined: `L <lines>| B <branches>| F <functions>`)
  - `lines.json`, `branches.json`, `functions.json` (individual metrics)
3. CI workflow (`unit-ci.yml`) commits these JSON files to the `status-badge` branch alongside the raw summary.
4. README references them via Shields endpoint URLs.

Local regeneration after modifying tests:
```bash
npm run coverage
npm run cov:badges
git checkout -B status-badge
git add .github/badges/*.json coverage/coverage-summary.json
git commit -m "chore(badges): update coverage shields"
git push -u origin status-badge --force
```

Color bands (default in script):
| Threshold | Color       |
|-----------|-------------|
| >=95%     | brightgreen |
| >=90%     | green       |
| >=80%     | yellowgreen |
| >=70%     | yellow      |
| >=60%     | orange      |
| <60%      | red         |

Adjust bands in `scripts/coverage-shield.mjs` (`band()` helper).

### Node Module Type
This repository is ESM-first (`"type": "module"` in `package.json`).
* Author new Node scripts with `import` / `export` (use `.mjs` only if you need to force ESM outside the main tree).
* Any legacy CommonJS scripts that still rely on `require()` should be renamed to `.cjs` (none currently present under `scripts/`).
* Mixed mode tip: if you introduce tooling that only supports CommonJS, isolate it as `<name>.cjs` instead of reverting the global module type.
* CI and local commands already target `.mjs` or ESM-aware entry points—no further changes required.

### Pre-commit Hooks (Husky + lint-staged)
Install dependencies (already in `devDependencies` after setup):
```bash
npm run prepare   # installs .husky/ hooks
```
Hook behavior:
* Staged JS/TS: ESLint (`--max-warnings=0`) then `vitest related --run` (fast selective tests).
* Staged JSON/MD/YAML: ESLint invoked with explicit extensions.

Adjust patterns or commands via `lint-staged` block in `package.json`.

Add new frontend test files under `tests/*.test.ts`.
Minimal health smoke (PowerShell):
```powershell
pwsh -File scripts/smoke.ps1 -BaseUrl "http://127.0.0.1:8001"
```

## Playwright (Prod E2E)

These tests exercise the deployed production host (status pill + readiness) and are intentionally lightweight.

Install browsers (first time):
```bash
npm run e2e:install
```

Run against prod (default base URL embedded):
```bash
npm run e2e
```

Override base:
```bash
PROD_BASE=https://assistant.ledger-mind.org npm run e2e
```

Skip in CI (environment gate):
```bash
SKIP_E2E=1 npm run e2e
```

Artifacts (on failure): traces + screenshots (HTML report not auto-opened). Config: `playwright.config.ts`.

Workflow reference: `.github/workflows/e2e-prod.yml` (scheduled + manual dispatch).

## Fast Type Check & UI Smoke (New)

Two lightweight guards were added to catch regressions early:

### 1. TypeScript Check Workflow
File: `.github/workflows/ts-check.yml`

Runs `npm ci` then `tsc --noEmit` (leveraging `checkJs` + `.d.ts` ambient types) on every push / PR to `main` and `test`. Fails fast if any JS/TS typing drift (e.g., window global removal, module rename) occurs.

Local equivalent:
```bash
npm run typecheck
```

### 2. UI Smoke (Playwright)
File: `.github/workflows/ui-smoke.yml`

Purpose: Prove end‑to‑end that:
1. Homepage renders (no blocking CSP errors)
2. First stylesheet is served as real CSS (not HTML fallback)
3. Streaming endpoint `/chat/stream` yields bytes (and optionally `_served_by` metadata)

Environment:
* If secret `UI_SMOKE_BASE` is set → tests hit that public base (no containers).
* Else spins up `backend` + `nginx` locally via `docker-compose.prod.yml` and waits for `/ready` + `/status/summary`.

Adjust strictness:
```bash
PLAYWRIGHT_STRICT_STREAM=1 EXPECT_SERVED_BY="primary|ollama" npx playwright test
```

Test file: `tests/e2e/assistant.smoke.spec.ts` (single spec, ~<5s on warm host).

### 3. One-File Node Smoke (Optional Local Shortcut)
Script: `scripts/ui-smoke.mjs`

Runs without browsers (pure fetch API) to validate:
* CSS asset: 200 + `text/css` + `immutable`
* Stream produces some bytes (stops early if `_served_by` marker found)

Run locally:
```bash
BASE=http://127.0.0.1:8080 node scripts/ui-smoke.mjs
```

Failures exit non‑zero with a concise message—suitable for embedding in future pre-deploy or canary steps.

## Status Badge Reference
The production probe publishes `status.json` to branch `status-badge`. README consumes via Shields endpoint.

Color thresholds:
| Color | Condition |
|-------|-----------|
| green | All latencies ≤ 5s |
| orange | Any latency > 5s & ≤ 10s |
| red | Any latency > 10s |
| lightgrey | One or more null latencies |

Message mapping: `ok`, `degraded`, `error`, `partial`.

Build correlation: `extra.build` (from `X-Build-ID` header) enables linking badge state to a deployed commit.

### Probe SLO & Baseline Collection
The probe workflow enforces SLO thresholds (`SLO_MAX_MS=5`, `HARD_MAX_MS=10`, `ALLOW_PARTIAL=false`). After initial stabilization (24h+), collect samples from `status-badge` branch to consider tuning:
```bash
git fetch origin status-badge:status-badge
git checkout status-badge
git log --format='%H' -- status.json | head -n 50 | while read sha; do \
  git show ${sha}:status.json | jq -r '.extra.probe.latencies | [ .root, .ready, .status, .chat ] | @csv'; \
done > latency-samples.csv
```
Analyze medians / p95; adjust `SLO_MAX_MS` if consistently below or above target.

## Lint / Format / Audit (suggested tooling)
```bash
pip install ruff pip-audit
ruff check assistant_api
pip-audit -r assistant_api/requirements.txt
```

## Troubleshooting Windows Instant Exit
See README section 'Windows: Server starts then immediately shuts down'. Use `run_cmddev.py` runner.

## Hot Reload Notes
`--reload` watches files; large asset churn can slow reloads. Consider excluding heavy dirs via `--reload-dir` pointing only to `assistant_api`.

## SSE Testing
```bash
curl -N -X POST http://127.0.0.1:8001/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Test streaming"}]}'
```

## RAG Query Quick Test
```bash
curl -s -X POST http://127.0.0.1:8001/api/rag/query \
  -H 'Content-Type: application/json' \
  -d '{"question":"What models are supported?","k":3}' | jq '.'
```

### Routing Smoke vs. Streaming Functional Test (New)

Two complementary backend routing / streaming guards now exist:

- `tests/e2e/routing-smoke.spec.ts` (OPTIONS-based): sends `OPTIONS /api/chat` and `OPTIONS /api/chat/stream`.
  * Purpose: prove nginx maps edge paths → backend (non-404) rapidly.
  * Any status except 404 == mapped (200 / 204 / 405 / 500 / 502 / 503 all acceptable).
  * Rationale: avoids waiting on heavy model cold start (POST may exceed 8s) and avoids hanging on infinite SSE body.

- `tests/e2e/chat-stream-first-chunk.spec.ts`: opens real SSE `POST /api/chat/stream`, reads until the first `_served_by` meta event OR first assistant message `data:` line, then aborts.
  * Captures first-token latency when `STREAM_LATENCY_LOG=1` (annotation `stream-first-token-ms`).
  * Time windows tunable via env: `WAIT_SSE_MS` (overall) and `WAIT_SSE_ATTEMPT_MS` (per attempt segment).
  * Uses readiness helper (`waitForPrimary`) to reduce cold-start flakiness; set `ALLOW_FALLBACK=1` to accept fallback in rescue.

Run examples (PowerShell):
```powershell
# Fast mapping check
pnpm test:routing:smoke

# Streaming first token latency (annotated)
$env:STREAM_LATENCY_LOG='1'
pnpm test:backend:req -- -g "@backend chat stream first-chunk"
```

Adjust latency / attempt budgets for larger models:
```powershell
$env:WAIT_SSE_MS='120000'
$env:WAIT_SSE_ATTEMPT_MS='45000'
$env:STREAM_LATENCY_LOG='1'
pnpm test:backend:req -- -g "@backend chat stream first-chunk"
```

Debugging tips:
| Symptom | Likely Cause | Action |
|---------|--------------|--------|
| OPTIONS returns 404 | Nginx shim missing | Rebuild nginx image & verify `location = /api/chat` blocks. |
| Streaming test times out with no `_served_by` | Model still loading | Increase `WAIT_SSE_MS` & verify `ollama-init` logs. |
| First token latency high (>> expected) | Cold model or container CPU contention | Add pre-warm POST or raise resource limits. |
| `_served_by` shows fallback unexpectedly | Primary model absent | Confirm `ollama-init` pulled model (`docker compose logs ollama-init`). |

Related environment knobs (see readiness section for full list): `WAIT_PRIMARY_MS`, `WAIT_PRIMARY_META_TIMEOUT_MS`, `WAIT_CHAT_MS`, `ALLOW_FALLBACK`, `STREAM_LATENCY_LOG`.

Purpose separation ensures: routing failures surface instantly (fast OPTIONS) while functional streaming health + latency is measured independently without conflating concerns.

### Latency rollup & gating helpers

After running any Playwright specs with `STREAM_LATENCY_LOG=1`, use the helper scripts to summarize and enforce performance budgets:

```powershell
# Single run (Playwright config writes JSON to playwright-report/results.json)
npm run report:latency

# Aggregate every JSON file in playwright-report/ (retries, shards, manual runs)
npm run report:latency:all

# Enforce a latency budget (fails when p95 > LATENCY_P95_MS, default 1500ms)
$env:LATENCY_P95_MS='1200'
npm run report:latency:gate
```

Notes:
- `report:latency:all` accepts directories or glob patterns; on PowerShell, pass the folder name (`playwright-report`) if `*.json` does not expand automatically.
- The rollup prints an overall table *and* per-provider breakdown, also appending both tables to `$GITHUB_STEP_SUMMARY` in CI.
- The gate script skips gracefully when no annotations are present, so it is safe to run inside `if: always()` blocks.

Example multi-run aggregation (PowerShell):

```powershell
Remove-Item playwright-report\\*.json -ErrorAction Ignore
for ($i = 1; $i -le 5; $i++) {
  npx playwright test -g "@backend chat stream first-chunk" --reporter=json --quiet > "playwright-report/run-$i.json"
  Start-Sleep -Seconds 1
}
npm run report:latency:all
```

## Adding a New Endpoint
1. Implement route in `assistant_api/...`
2. Add tests in `tests/`
3. Update `docs/API.md` & `README.md`
4. Append entry to `docs/CHANGELOG.md`

## TODO

## Strict Test Modes (Static vs Full-Stack)

There are now TWO flavors of "strict" E2E to balance speed and parity:

### 1. Static Strict (Fast)
Stack: Nginx + built `dist/` only (no backend container).

Used by:
* CI job: `E2E (matrix: strict)` (via `docker-compose.test.yml`)
* Local helper: `pwsh -File tasks.ps1 strict-nginx`

Behavior:
* BACKEND_REQUIRED=0 so backend-dependent specs auto-skip (status summary JSON, ping API path hits the static shim and is skipped if HTML is returned).
* Focuses on CSP, cache-control immutability, stylesheet integrity, and basic page boot.

### 2. Full-Stack Strict (Parity)
Stack: Nginx + Mock FastAPI backend (`tests/backend-mock`) behind proxy (via `docker-compose.test.full.yml`).

Used by:
* CI job: `strict-full` (non-PR runs only) in `.github/workflows/e2e.yml`.
* Local helper: `pwsh -File tasks.ps1 strict-nginx-fullstack` (smoke) or `strict-nginx-fullstack-full` (entire suite).

Behavior:
* BACKEND_REQUIRED=1 so backend specs MUST pass (no skips for summary / streaming tests).
* Mock backend implements: `/api/ping`, `/api/ready`, `/api/status/summary`, `/chat` (JSON), `/chat/stream` (SSE one-chunk) with `_served_by` + `_strict_stream` markers.
* Validates proxy wiring, SSE buffering disablement, and CSP still intact under proxied requests.

### Choosing a Mode
| Goal | Mode |
|------|------|
| Fast feedback on HTML/CSS/CSP & cache | Static Strict |
| Validate chat streaming & API summary routing | Full-Stack Strict |
| PR gating (speed) | Static Strict |
| Nightly / main branch deeper guard | Full-Stack Strict |

### Commands Summary
```powershell
# Static-only (skips backend-dependent specs)
pwsh -File tasks.ps1 strict-nginx

# Static full test suite (if you want everything besides backend specs)
pwsh -File tasks.ps1 strict-nginx-full

# Full-stack (with mock backend) smoke subset
pwsh -File tasks.ps1 strict-nginx-fullstack

# Full-stack entire Playwright suite
pwsh -File tasks.ps1 strict-nginx-fullstack-full
```

### Adding New Backend-Sensitive Specs
1. Write spec under `tests/e2e/`.
2. Guard with:
  ```ts
  test.skip(process.env.BACKEND_REQUIRED !== '1', 'Backend required for this spec');
  ```
3. Ensure it passes with `strict-nginx-fullstack-full` locally.
4. Confirm it skips (not fails) under `strict-nginx`.

### Mock Backend Notes
File: `tests/backend-mock/main.py`
* Minimal; do NOT mirror production logic beyond shape & essential markers.
* If you add a new proxied route, extend the mock with the shallowest viable response.
* Keep dependency list tiny (`fastapi`, `uvicorn`).

### CSP Hash Sync
Both modes rely on the same extraction step:
```bash
pnpm csp:hash && pnpm csp:sync:test
```
Static mode updates `nginx.test.conf`; full-stack mode references `nginx.test.full.conf` (same placeholder replacement process).

### Troubleshooting
| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Backend specs fail in static mode | BACKEND_REQUIRED not 0 | Ensure env var unset or explicitly 0 |
| SSE test hangs | Proxy buffering accidentally enabled | Verify `proxy_buffering off` in full config |
| CSP violation errors | Hash drift | Re-run extraction after build |
| 404 on assets in full-stack | Dist not built before compose | Run build first (tasks handle this automatically) |

### Future Enhancements (Optional)
* Add real latency shaping (sleep) in mock to exercise client spinners.
* Parameterize mock responses (error injection) via env flags for resilience tests.
* Promote some full-stack specs to required on PR once stable & fast.

## Edge Header Gating & Favicon Generation

### EXPECT_EDGE / NGINX_STRICT
Some Playwright specs assert strict security + caching headers (CSP baseline, immutable asset cache, favicon long‑cache, projects.json short cache). These are skipped automatically unless one of the following is set:

```
EXPECT_EDGE=1   # Explicitly signal we are hitting the hardened edge/nginx
NGINX_STRICT=1  # (Set by scripts/run-prod-stack.ps1 and certain CI tasks)
```

Rationale: When serving via a simple static server (`python -m http.server`, `http-server`), security headers & differentiated Cache-Control directives are absent. Skipping avoids noisy false negatives during quick local iteration.

In CI, the strict workflows export one of these flags so header regressions fail fast.

### Adding New Header-Dependent Specs
Guard them exactly like existing ones:
```ts
const EXPECT_EDGE = process.env.EXPECT_EDGE === '1' || process.env.NGINX_STRICT === '1';
test.skip(!EXPECT_EDGE, 'Edge headers not expected in static mode');
```

### Automated Favicon Generation
Root favicon / PWA icons (`leo-avatar-sm.png` 192x192 and `leo-avatar-md.png` 512x512) are generated from `assets/leo-avatar.svg` at build time.

Script: `scripts/generate-favicons.mjs`

Hook: Runs automatically via `prebuild:prod` (triggered by `npm run build:prod` which the Dockerfile uses). This guarantees non-zero PNGs (Content-Length > 0) preventing failing cache/MIME tests or broken PWA install metadata.

Regressions previously occurred when placeholder zero-byte files lived in `public/`. The generation step ensures consistent sizes across local + container builds.

### Regeneration Manually
```bash
node scripts/generate-favicons.mjs
ls -l public/leo-avatar-*.png
```

### Test Coverage
`tests/e2e/icons-favicon.spec.ts` now asserts:
* 200 status
* `image/png` MIME
* `Cache-Control: public, max-age=31536000, immutable`
* `Content-Length > 0` for both icons

If you alter icon dimensions or add new sizes, extend the `ICONS` array and (optionally) add size metadata to the manifest.


## Test Tags & Backend Filtering

Backend-sensitive specs are grouped with a `@backend` prefix in the `describe` block. Run only these:
```bash
pnpm test:backend
```
Smoke subset (only core health):
```bash
pnpm test:smoke:backend
```
CI static strict path does NOT fail if these skip (`BACKEND_REQUIRED=0`). Full-stack strict sets `BACKEND_REQUIRED=1` forcing pass/fail.

### Adding a New Backend Test
1. Wrap in `test.describe('@backend <short label>', () => { ... })`.
2. Guard skip logic the same way existing specs do (conditional `test.skip`).
3. Ensure it runs green in full-stack mode before merging.

### Streaming Smoke: Backend-Aware Early Probe

The `assistant.smoke` spec now performs an EARLY probe of backend endpoints before attempting the streaming request:

Probe order:
1. `/api/status/summary`
2. `/api/ready`
3. `/ready`

Behavior matrix:
| Backend Reachable | `BACKEND_REQUIRED` | Outcome |
|-------------------|--------------------|---------|
| No                | `0` or unset       | Spec SKIPS (annotations include `skip-reason: Backend absent; BACKEND_REQUIRED=0 (frontend-only mode)`) |
| No                | `1`                | Spec FAILS (`Backend required but not reachable via status/ready probes`) |
| Yes               | any                | Streams; annotates `backend-probe: reachable: <endpoint>` |

On success, the streaming segment asserts:
* At least 1 byte of streamed response.
* In STRICT mode (`PLAYWRIGHT_STRICT_STREAM=1`), presence of `_served_by` marker and optional match against `EXPECT_SERVED_BY` regex.

Run a frontend-only smoke (CSS + HTML + CSP + wiring) without waiting on backend:
```bash
pnpm test:frontend-smoke
```

This sets `BACKEND_REQUIRED=0` so backend-tagged specs (`@backend`) and the streaming portion skip cleanly.

To enforce backend presence in strict/full runs, ensure `BACKEND_REQUIRED=1` (handled by strict full-stack scripts / tasks).

Annotations of interest in reports:
* `backend-probe` – each probe result; one with `reachable:` when success.
* `skip-reason` – why streaming was skipped.
* `stream-bytes` – number of bytes read (non-strict mode only).

Troubleshooting:
| Symptom | Note |
|---------|------|
| Spec skipped unexpectedly | Check env: is `BACKEND_REQUIRED` unset? Did probes 404? |
| Fails saying backend required | Ensure backend container/service is running & proxy routes correct |
| Streams but no `_served_by` | STRICT mode off? Or backend not injecting marker; inspect captured `sample` via trace |

Fast local iteration tip: pair `pnpm build:prod` (or `build`) with `pnpm test:frontend-smoke` after asset or CSP changes for <5s feedback loop.

## Mock Backend Error Injection

The mock service (`tests/backend-mock/main.py`) supports env flags to exercise failure handling:

| Flag | Effect |
|------|--------|
| `FAIL_PING=1` | `/api/ping` returns 503 |
| `FAIL_READY=1` | `/api/ready` returns `{ready:false}` |
| `FAIL_SUMMARY=1` | Summary returns `rag.ok=false` |
| `FAIL_CHAT=1` | `/chat` returns 500 |
| `FAIL_SSE=1` | `/chat/stream` closes immediately (no data) |
| `LATENCY_MS=250` | Adds 250ms artificial delay per request |

Example (local full-stack strict with injected rag failure + latency):
```powershell
FAIL_SUMMARY=1 LATENCY_MS=250 pwsh -File .\tasks.ps1 strict-nginx-fullstack-full
```
Use these to harden client-side resilience logic (retry/backoff/UI state) without modifying production code paths.

## Static Asset Digest Baseline

The build produces a keyed SHA-256 digest manifest for every long‑lived, hashed static asset (JS, CSS, fonts, images) to guarantee:
* Immutable caching is actually served (Cache-Control + content stability)
* Drift between local build and deployed edge is detected early
* Accidental host double-builds (which previously caused hash divergence) are eliminated under the single-source Docker build approach

### Artifacts
| File | Purpose |
|------|---------|
| `assets-digests.json` | Fresh manifest (array or map form) produced by `verify:static` each run. |
| `scripts/assets-digests-baseline.json` | Committed baseline used by Playwright to assert no unexpected digest drift. |

Each entry includes: `path`, `sha256`, `bytes`, `contentType`, `cacheControl`.

### Generation Flow
1. `pnpm verify:static` → runs `scripts/verify-static-cache.mjs`
  * Extracts asset paths from built HTML (plus fallback patterns)
  * Fetches bytes (binary) and computes SHA-256 digests
  * Asserts `immutable` caching for hashed filenames
  * Writes `asset-digests.json` + `assets-digests.json`
2. (Optional) `pnpm assets:baseline` → updates committed baseline IF digests changed (ignores `generatedAt` timestamp)
3. Playwright spec `assets-immutable` (tagged in security suite) compares live fetch → baseline map

### Commands
Normal update (skips timestamp-only churn):
```bash
pnpm assets:baseline
```
Force rewrite even if only `generatedAt` changed:
```bash
pnpm assets:baseline:force
```
Auto-commit (PowerShell):
```powershell
$env:AUTO_COMMIT=1; pnpm assets:baseline
```
Auto-commit (bash):
```bash
AUTO_COMMIT=1 pnpm assets:baseline
```

### Environment Variables
| Variable | Effect |
|----------|--------|
| `DIGEST_SOURCE` | Override source manifest path (default `assets-digests.json`). |
| `AUTO_COMMIT=1` | After update, automatically `git add` + commit the baseline. |
| `FORCE=1` | Write baseline even when only `generatedAt` differs. |
| `STRICT_ASSET_BASELINE=1` | (Consumed by Playwright) Fails test on any drift instead of warning. |

### CI Usage Pattern
1. Build image / assets (single-source build ensures determinism).
2. Run `pnpm verify:static` to fail fast on cache header regressions.
3. Run Playwright security suite (`pnpm test:security`) with `STRICT_ASSET_BASELINE=1`.
4. If failure indicates legitimate asset changes (intentional upgrade), dev runs:
  ```bash
  pnpm assets:baseline
  git commit -m "chore(assets): refresh digests baseline"
  ```
  and re-push.

### Rationale for Timestamp Suppression
Without suppression every invocation produced a diff (only `generatedAt`), generating noisy commits. The updater strips `generatedAt` when comparing JSON, only rewriting if digest content changes, or when `FORCE=1`.

### Guard Rails
* Digest mismatch = potential accidental rebuild or mid-pipeline asset mutation (e.g., image optimizer run after baseline capture).
* Always inspect the diff of `scripts/assets-digests-baseline.json`: large churn or type/MIME changes may signal a packaging regression.
* Do NOT blindly force-update on CI failures—verify that the new asset hashes correspond to intentional source changes.

### Extending Coverage
Add new asset categories (e.g., WebAssembly) by editing `scripts/verify-static-cache.mjs` extraction + MIME assertions; Playwright comparison automatically includes them once present in the manifest.

### Future Ideas (Optional)
* Add a GitHub Action comment bot that posts a summary of drift (added / removed / changed bytes total).
* Aggregate size deltas over time (detect gradual bloat) → fail if > X% increase release-to-release.
* Integrate Brotli / Gzip size metrics into the manifest for performance budgeting.

## Backend Readiness Waiter (Phased Warmup)

Playwright backend / streaming specs use a three‑phase readiness gate implemented in `tests/e2e/lib/wait-primary.ts` to eliminate flaky cold starts and surface precise failure reasons.

### Phases
1. **Server Preflight (Phase 0)** – Probe `/_up`, `/api/ready`, `/api/status/summary`; any 2xx ⇒ server/proxy listening.
2. **Meta Probe (Phase 1)** – Poll `/llm/primary/ping` and `/api/status/summary` until either confirms model/provider readiness (`served_by=primary`, `primary_model_present`, or `provider_ready`).
3. **Tiny Chat Probe (Phase 2)** – POST `/api/chat` with a single short user message to confirm end‑to‑end path (routing + model) is hot and non‑fallback.

### Half‑Time Rescue
If Phase 1 has zero successes by 50% of `WAIT_PRIMARY_MS`, perform a one‑off rescue tiny chat. Counts as success when:
* 200 OK and NOT a fallback response, OR
* Fallback response and `ALLOW_FALLBACK=1` (explicit opt‑in).

### Diagnostics Captured
* Distinct recent status codes for ping & summary: `ping=[404,503,"ERR:Timeout"] summary=[503,200]`
* First 300 chars of summary body (earliest failure or first success)
* Periodic progress lines when `WAIT_PRIMARY_LOG=1`
* Soft mode warnings instead of failures when `WAIT_PRIMARY_SOFT=1`

### Environment Variables
| Var | Default | Phase | Description |
|-----|---------|-------|-------------|
| `WAIT_SERVER_MS` | 120000 | 0 | Max time for server endpoint (/_up|/api/ready|/api/status/summary). |
| `WAIT_SERVER_INTERVAL_MS` | 1000 | 0 | Server preflight poll interval. |
| `WAIT_PRIMARY_MS` | 90000 / 120000 (scripts) | 1–2 | Total meta + chat readiness window. |
| `WAIT_PRIMARY_MS_GLOBAL` | (unset) | Global | Optional override for global setup only. |
| `WAIT_PRIMARY_INTERVAL_MS` | 2000 | 1 | Ping/summary poll cadence. |
| `WAIT_PRIMARY_META_TIMEOUT_MS` | 5000 | 1 | Per-request timeout for ping & summary. |
| `WAIT_PRIMARY_CHAT_PROBE` | 1 | 2 | Enable tiny chat probe. |
| `WAIT_CHAT_MS` | 15000 / 20000 | 2 | Tiny chat per-request timeout. |
| `WAIT_PRIMARY_SOFT` | 0 | All | Log instead of fail when readiness window exceeded. |
| `WAIT_PRIMARY_LOG` | 0 | All | Emit periodic status arrays. |
| `ALLOW_FALLBACK` | 0 | Rescue | Accept fallback only for rescue success. |
| `BACKEND_REQUIRED` | 0/1 | Gating | When 1, backend-tagged specs must pass. |
| `WAIT_SSE_MS` | 90000 | Streaming | First-token overall SSE wait. |
| `WAIT_SSE_ATTEMPT_MS` | 30000 | Streaming | Per attempt SSE budget. |
| `ALLOW_STREAM_FLAKY` | 0 | Streaming | Soften streaming failures to skip/log. |
| `STREAM_LATENCY_LOG` | 0 | Streaming | When 1, logs `[stream-latency] first_token=<ms>` and annotates spec. |

### Interpreting Status Arrays
| Pattern | Meaning | Action |
|---------|---------|--------|
| `ping=[404]` + `summary=[200]` | Ping route absent / disabled | Ignore ping; summary authoritative. |
| Persistent `summary=[503,...]` | Provider/model warming | Increase `WAIT_PRIMARY_MS` & `WAIT_PRIMARY_META_TIMEOUT_MS`. |
| Many `ERR:Timeout` entries | Slow network / container contention | Raise meta timeout modestly (e.g. 8000). |
| Rescue-only success | Summary/ping unreliable | Investigate endpoints; rely on rescue temporarily. |

### Quick Tuning (Heavy Model)
```powershell
$env:WAIT_PRIMARY_MS='180000'
$env:WAIT_PRIMARY_META_TIMEOUT_MS='8000'
$env:WAIT_CHAT_MS='30000'
$env:WAIT_SSE_MS='120000'
$env:WAIT_SSE_ATTEMPT_MS='45000'
npm run test:backend:req
```

Soft diagnostics (never fails):
```powershell
npm run test:backend:req:soft
```

Lenient streaming while stabilizing readiness:
```powershell
npm run test:backend:req:flaky
```

### Future Enhancements
* First-token latency histogram (optimize SSE attempt duration)
* Structured JSON readiness log for CI artifact ingestion
* Provider-specific auxiliary endpoints folded into Phase 1

### Diagnostics: Targeted Streaming Run
For focused investigation of streaming readiness and first-token latency without waiting for the full readiness gate, use:

```bash
npm run test:backend:req:stream
```

This script:
* Skips global setup readiness (`PLAYWRIGHT_GLOBAL_SETUP_SKIP=1`).
* Logs first-token latency (`STREAM_LATENCY_LOG=1`).
* Allows streaming flakiness (`ALLOW_STREAM_FLAKY=1`) so the run doesn’t fail hard while gathering data.
* Extends SSE budgets (`WAIT_SSE_MS=120000`, `WAIT_SSE_ATTEMPT_MS=45000`).

Annotated output includes `stream-first-token-ms` and console lines like:
```
[stream-latency] first_token=842ms attempt_window=30000 total_budget=120000
```

### Optional Pre-Warm (Chat Path)
You can proactively warm the model/chat path (e.g., in a compose startup or CI pre-step) with a one-token prompt to reduce first user latency:

PowerShell:
```powershell
try {
  iwr -UseBasicParsing -Method POST http://127.0.0.1:8080/api/chat \
    -ContentType 'application/json' \
    -Body (@{messages=@(@{role='user';content='hi'})} | ConvertTo-Json -Compress) | Out-Null
} catch {
  Write-Warning "Pre-warm chat request failed: $($_.Exception.Message)"
}
```

Shell (curl):
```bash
curl -s -X POST http://127.0.0.1:8080/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"hi"}]}' >/dev/null || true
```

Place this after the stack is up but before running Playwright to reduce cold-start variability.

## E2E Testing

### Quick Commands

**Fast Mock Tests** (for smoke checks, ~10-15s):
```powershell
# Set environment
$env:ALLOW_DEV_ROUTES="1"
$env:ALLOW_TEST_ROUTES="1"
$env:SITEAGENT_DEV_COOKIE_KEY="dev-secret-test"
$env:BACKEND_URL="http://127.0.0.1:8001"
$env:UI_URL="http://127.0.0.1:5173"
$env:DEV_BEARER="dev"

# Run mock tests (uses /agent/run/mock endpoint)
npm run test:e2e:seo:mock
```

**Full Integration Tests** (with real agent execution, ~1-2min):
```powershell
# Same environment as above
$env:ALLOW_DEV_ROUTES="1"
$env:SITEAGENT_DEV_COOKIE_KEY="dev-secret-test"
$env:BACKEND_URL="http://127.0.0.1:8001"
$env:UI_URL="http://127.0.0.1:5173"
$env:DEV_BEARER="dev"

# Optional: Skip LLM to speed up (uses heuristic fallback)
$env:SEO_LLM_ENABLED="0"

# Run full tests (real seo.tune task)
npm run test:e2e:seo:full
```

### Test Modes

1. **Mock Mode** (`seo-analytics.mock.spec.ts`)
   - Uses `/agent/run/mock` endpoint
   - Instant artifact generation (no LLM/DB required)
   - Deterministic output (2 pages: `/` and `/projects/siteagent`)
   - Ideal for: CI smoke tests, quick validation
   - Timeout: 30s

2. **Full Mode** (`seo-analytics.spec.ts`)
   - Uses real `/agent/run` with `seo.tune` task
   - Real database queries, LLM calls (with heuristic fallback)
   - Variable output based on actual data
   - Ideal for: Integration testing, pre-deployment validation
   - Timeout: 60s

### Helper Functions

**`waitForArtifact(api, path, headers, timeoutMs)`** (`tests/e2e/helpers/waitForArtifact.ts`)
- Smart polling for artifact availability
- Validates content (not just 200 OK)
- Supports JSON and text artifacts
- Default timeout: 45s

Example:
```typescript
const json = await waitForArtifact(
  api,
  '/agent/artifacts/seo-tune.json',
  { Authorization: 'Bearer dev' },
  10_000
);
```

### Prerequisites

1. **Backend running** (port 8001):
   ```powershell
   uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001 --reload
   ```

2. **Vite dev server** (port 5173, for UI tests):
   ```powershell
   npm run dev
   ```

3. **Environment variables set** (see commands above)

### Troubleshooting

**Tests timeout**: Increase timeout or disable LLM (`SEO_LLM_ENABLED=0`)

**"Test routes disabled"**: Set `ALLOW_TEST_ROUTES=1` (for mock tests)

---

## Telemetry + Behavior Learning (dev)

1. Ensure backend runs on `http://127.0.0.1:8001` and `ANALYTICS_ENABLED=true`.
2. Add `data-section="..."` to each major section and include:
   - `src/lib/behavior-tracker.js`
   - `src/lib/apply-learned-layout.js`
3. Click around locally, then:
   ```bash
   curl -X POST http://127.0.0.1:8001/agent/analyze/behavior
   curl http://127.0.0.1:8001/agent/layout
   ```
4. Run tests:
   ```bash
   pytest -q tests/test_metrics_learning.py
   npx playwright test tests/e2e/behavior-analytics.spec.ts --project=chromium
   ```

**Configuration**:
- `ANALYTICS_ENABLED=true` (default)
- `ANALYTICS_ORIGIN_ALLOWLIST=""` (empty = allow all origins in dev)
- `LEARNING_EPSILON=0.10` (exploration rate)
- `LEARNING_DECAY=0.98` (time decay factor)
- `LEARNING_EMA_ALPHA=0.30` (smoothing factor)

### Nightly Learning Job

- GitHub Actions workflow `behavior-learning-nightly.yml` runs daily at ~02:30 ET.
- It executes `scripts/analyze_behavior.py` which reads JSONL in `./data/analytics/`, updates `weights.json` if needed, and commits changes back to the repo.
- View your current metrics at `/agent/metrics/dashboard` (requires privileged access).

### Weekly Retention & Compression

Rotate and prune analytics logs:

1. **Configure** (optional overrides):
   - `ANALYTICS_RETENTION_DAYS` (default 90)
   - `ANALYTICS_GZIP_AFTER_DAYS` (default 7)

2. **Run locally**:
   ```bash
   python scripts/analytics_retention.py
   ```

3. **CI**:
   - Workflow `analytics-retention-weekly.yml` runs every Sunday and commits gzip/prune changes if files are tracked.

4. **Server cron** (example):
   ```cron
   17 3 * * 0 /usr/bin/env ANALYTICS_RETENTION_DAYS=90 ANALYTICS_GZIP_AFTER_DAYS=7 \
      /path/to/venv/bin/python /srv/app/scripts/analytics_retention.py >> /var/log/analytics_retention.log 2>&1
   ```

### On-Demand Retention (Guarded)

Manually trigger retention operations via API:

**Endpoint**: `POST /agent/metrics/retention/run`

**Authentication**: Requires dev token (same as metrics dashboard)

**Response**:
```json
{
  "ok": true,
  "scanned": 15,
  "compressed": 2,
  "removed": 1,
  "dir": "/path/to/analytics"
}
```

**Usage**:
```bash
# With token in environment
curl -X POST \
  -H "Authorization: Bearer $METRICS_DEV_TOKEN" \
  http://127.0.0.1:8001/agent/metrics/retention/run

# Or with query parameter
curl -X POST \
  "http://127.0.0.1:8001/agent/metrics/retention/run?dev=your-token-here"
```

**Behavior**:
- Uses same logic as scheduled weekly script
- Compresses files older than `ANALYTICS_GZIP_AFTER_DAYS`
- Removes files older than `ANALYTICS_RETENTION_DAYS`
- Returns stats for monitoring/logging

### Debugging Telemetry (Guarded)

**GET `/agent/metrics/debug`** returns effective telemetry config (no secrets) and a quick snapshot of analytics files.

**Authentication**: Requires dev token (same as metrics dashboard)

**Response Example**:
```json
{
  "settings": {
    "ANALYTICS_DIR": "./data/analytics",
    "ANALYTICS_RETENTION_DAYS": 90,
    "ANALYTICS_GZIP_AFTER_DAYS": 7,
    "LOG_IP_ENABLED": true,
    "GEOIP_DB_PATH_set": true,
    "GEOIP_DB_EXISTS": true,
    "METRICS_ALLOW_LOCALHOST": true,
    "LEARNING_EPSILON": 0.1,
    "LEARNING_DECAY": 0.98,
    "LEARNING_EMA_ALPHA": 0.3
  },
  "analytics": {
    "dir_exists": true,
    "file_count": 15,
    "latest_files": ["events-20251006.jsonl.gz", "events-20251007.jsonl.gz", "events-20251008.jsonl"]
  },
  "time": "2025-10-08T23:50:15.123456Z",
  "pid": 12345
}
```

**Usage**:
```bash
curl -H "Authorization: Bearer $METRICS_DEV_TOKEN" \
  http://127.0.0.1:8001/agent/metrics/debug | jq
```

**Startup Logging**: On API boot, a safe startup line logs key telemetry settings:
```
INFO: [telemetry] dir=./data/analytics retention_days=90 gzip_after_days=7
      log_ip_enabled=True geoip_db_set=True geoip_db_exists=True
      epsilon=0.100 decay=0.980 ema_alpha=0.300 allow_localhost=True
```

**UI Integration**: The Privileged Metrics panel includes a Debug Status viewer with:
- **Pretty-printed JSON** from the debug endpoint
- **Refresh button** to reload current telemetry config
- **Copy JSON button** to copy the full debug output to clipboard
- Automatic loading on panel mount

### Privileged Panel Access

The Behavior Metrics dashboard is embedded under the privileged Admin panel.

- The guard is checked via `isPrivilegedUIEnabled()` in `src/lib/devGuard.ts`.
- To enable locally, use your existing unlock flow (e.g., calling `/agent/dev/enable` endpoint) as defined in `devGuard`.
- When unlocked, **AdminToolsPanel** renders the **Behavior Metrics** section with an iframe to `/agent/metrics/dashboard`.

### Locking the Dashboard (server-enforced)

The metrics dashboard is protected by server-side authentication:

**Configuration**:
- Set a token:
  - Local dev: `export METRICS_DEV_TOKEN="dev-$(openssl rand -hex 24)"`
  - Prod: set a strong secret in your runtime env/Secrets
- Localhost bypass: `export METRICS_ALLOW_LOCALHOST=true` (default: true)
  - When enabled, requests from `127.0.0.1` are allowed without token

**Backend serves the dashboard at `/agent/metrics/dashboard`** and requires the token via:
- `Authorization: Bearer <token>` header
- `X-Dev-Token: <token>` header
- `?dev=<token>` query parameter
- Cookie: `dev_token=<token>`

**Frontend integration**:
- The privileged panel automatically appends `?dev=<token>` if `localStorage["dev:token"]` exists
- To set the token for UI access:
  ```javascript
  localStorage.setItem("dev:token", "your-dev-token-here");
  ```
- If access is denied, a friendly unlock page (401/403) is shown with a field to paste the token; it stores to cookie + localStorage and reloads

**Environment Variables**:
- `METRICS_DEV_TOKEN` - Random token for dashboard access (required in production)
- `METRICS_ALLOW_LOCALHOST` - Allow 127.0.0.1 without token (default: true)
- `LAYOUT_SECTIONS_DEFAULT="hero,projects,skills,about,contact"` (baseline ordering)
- `ANALYTICS_DIR="./data/analytics"` (storage path)

**How it Works**:
- Frontend tracker sends anonymous events (view/click/dwell) to `/agent/metrics/ingest`
- Events stored as JSONL files (`events-YYYYMMDD.jsonl`)
- Analyze endpoint computes weights based on CTR and dwell time
- Layout endpoint returns learned ordering (deterministic, no exploration)
- Frontend applier fetches layout and reorders DOM sections

### Advanced Analytics: GeoIP Setup (Optional)

To enable country-level geo enrichment with IP anonymization:

1. **Get MaxMind License Key** (free):
   - Sign up at https://www.maxmind.com/en/geolite2/signup
   - Generate a license key from your account dashboard

2. **Download GeoLite2-Country Database**:
   ```powershell
   # PowerShell (Windows/Linux/Mac)
   ./scripts/download-geoip.ps1 -LicenseKey "YOUR_LICENSE_KEY_HERE"
   ```

   Or manually:
   ```bash
   # Linux/Mac
   wget "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-Country&license_key=YOUR_KEY&suffix=tar.gz" -O GeoLite2-Country.tar.gz
   tar -xzf GeoLite2-Country.tar.gz
   mv GeoLite2-Country_*/GeoLite2-Country.mmdb data/geo/
   ```

3. **Configure Environment Variables**:
   ```bash
   # .env or system environment
   GEOIP_DB_PATH=./data/geo/GeoLite2-Country.mmdb
   LOG_IP_ENABLED=true  # Optional: log anonymized IPs to events
   ```

4. **Restart Backend**:
   ```powershell
   # Backend will now enrich events with country code and anon_ip_prefix
   ./.venv/Scripts/python.exe -m uvicorn assistant_api.main:app --reload
   ```

**What Gets Enriched**:
- **IP Anonymization**: IPv4 → /24 subnet (e.g., `192.168.1.0/24`), IPv6 → /48 prefix
- **Country Detection**: Optional GeoIP lookup adds `country` field to events (e.g., `"US"`, `"GB"`)
- **Privacy-First**: Original IPs are never stored, only anonymized prefixes

**Update Frequency**: MaxMind updates GeoLite2 databases monthly. Re-run the download script to refresh.

---

**Authentication errors**: Verify `ALLOW_DEV_ROUTES=1` and `DEV_BEARER="dev"`

**Artifacts not found**: Check `./agent_artifacts/` directory exists and backend has write permissions

---

## Dev Overlay — Discovered Pages

The Dev Overlay includes a **Discovered Pages** panel that displays all pages discovered by the sitemap loader.

### Backend Endpoint

**GET /agent/status/pages**
- Returns cached discovery from `agent/artifacts/status.json` or triggers on-demand discovery
- Response includes:
  - `ok`: Always true
  - `generated_at`: ISO timestamp
  - `count`: Number of pages
  - `pages`: Array of `{path, title, desc}`
  - `integrity`: SHA-256 checksum for validation

**Example**:
```bash
curl -s http://127.0.0.1:8001/agent/status/pages | jq '.count, .integrity'
```

### Frontend Panel

Located at `src/features/dev/DevPagesPanel.tsx` (integrated into your dev overlay).

**Features**:
- **Real-time filtering** by path, title, or description
- **Refresh** button to reload discovery
- **Copy JSON** exports pages array to clipboard
- **Table view** with path, title, desc columns
- **Integrity display** shows SHA-256 checksum at bottom

### Environment Variables

Control discovery behavior (same as sitemap loader):
- `SEO_PUBLIC_DIRS="public,dist"` — Directories to scan
- `SEO_SITEMAP_INCLUDE="/*.html,/blog/**/*.html"` — Include only matching paths
- `SEO_SITEMAP_EXCLUDE="/drafts/*,/tmp-e2e/*"` — Exclude matching paths
- `SEO_SITEMAP_CACHE=1` — Write cache to `agent/artifacts/status.json`

### Local Usage

```bash
# Backend route
curl -s http://127.0.0.1:8001/agent/status/pages | jq '.count, .integrity'

# Frontend: open your dev overlay and switch to "Discovered Pages" tab
# (or access DevPagesPanel component directly)
```

### E2E Tests

**Backend API tests** (`tests/e2e/status-pages.api.spec.ts`):
- Validates response structure (ok, count, integrity, pages)
- Verifies SHA-256 integrity checksums
- Tests metadata extraction (title, desc)
- Validates cache consistency

**Run tests**:
```bash
npx playwright test tests/e2e/status-pages.api.spec.ts --project=chromium
```

---

### Status Open Endpoint (Dev-Only)

**GET /agent/status/open** — View underlying HTML files for discovered pages.

**Prerequisites**:
- Set `ALLOW_DEV_ROUTES=1` environment variable
- Backend must be running with dev routes enabled

**Modes**:
1. **Metadata mode** (`raw=0` or omitted): Returns file info as JSON
2. **Raw mode** (`raw=1`): Streams raw HTML content

**Examples**:
```bash
# Metadata (returns abs_path, size, mtime)
curl -s "http://127.0.0.1:8001/agent/status/open?path=/index.html" | jq

# Raw HTML (view in browser)
start "" "http://127.0.0.1:8001/agent/status/open?path=/index.html&raw=1"

# Copy absolute path for editing
curl -s "http://127.0.0.1:8001/agent/status/open?path=/blog/post/index.html" | jq -r '.abs_path'
```

**Security**:
- Directory traversal protection (validates path is within public dirs)
- 2MB file size limit for raw streaming
- Only accessible when `ALLOW_DEV_ROUTES=1`

**Dev Panel Actions**:
The `DevPagesPanel` component includes action buttons for each page:
- **Open**: Opens raw HTML in new tab
- **Copy path**: Fetches metadata and copies absolute path to clipboard

**E2E Tests** (`tests/e2e/status-open.api.spec.ts`):
- Metadata response validation
- Raw HTML streaming
- Directory traversal rejection
- Path format validation

**Run tests**:
```bash
# Set ALLOW_DEV_ROUTES=1 for tests to pass
$env:ALLOW_DEV_ROUTES='1'
npx playwright test tests/e2e/status-open.api.spec.ts --project=chromium
```

---

### Dev Overlay — Sitemap & Meta Tools

The Dev Overlay includes additional tools for sitemap inspection and SEO meta generation.

#### Reveal in Sitemap

**Feature**: Checks if a page exists in `sitemap.xml`.

- Calls `/agent/status/sitemap` to get sitemap URLs
- If page found: Opens raw sitemap.xml in new tab
- If page not found: Shows alert message
- If no sitemap: Opens raw endpoint anyway (404 or empty)

**Backend Endpoint**: `GET /agent/status/sitemap`
- Metadata mode (`raw=0`): Returns `{ok, files, count, urls, integrity}`
- Raw mode (`raw=1`): Streams sitemap.xml as `application/xml`

**Example**:
```bash
# Get sitemap metadata
curl -s http://127.0.0.1:8001/agent/status/sitemap | jq '.count, .urls'

# View raw sitemap
start "" "http://127.0.0.1:8001/agent/status/sitemap?raw=1"
```

#### Suggest Meta

**Feature**: Generates SEO-optimized title (≤60 chars) and description (≤155 chars) using discovered keywords.

- Opens modal with title/description suggestions
- Incorporates keywords from `seo-keywords.json` when available
- Provides "Copy" buttons for easy copying
- Writes artifacts to `agent/artifacts/seo-meta/<slug>.json`

**Backend Endpoint**: `GET /agent/seo/meta/suggest?path=<url>`
- Returns `{path, base, keywords, suggestion, integrity}`
- Title: 1-2 top keywords woven into existing title
- Description: 2-3 keywords incorporated into readable sentence

**Example**:
```bash
# Get meta suggestions for index.html
curl -s "http://127.0.0.1:8001/agent/seo/meta/suggest?path=/index.html" | jq '.suggestion'

# Output:
# {
#   "title": "Portfolio Home — Python — FastAPI",
#   "desc": "Welcome to my portfolio showcasing Python and FastAPI projects. Keywords: web development, API design.",
#   "limits": {"title_max": 60, "desc_max": 155}
# }
```

**Artifacts**:
- Location: `agent/artifacts/seo-meta/`
- Naming: `<slugified-path>.json` (e.g., `index-html.json`, `blog-post-index-html.json`)
- Content: Full metadata with integrity checksum

**E2E Tests**:
- `tests/e2e/sitemap-status.api.spec.ts` — Sitemap endpoint validation
- `tests/e2e/seo-meta.suggest.api.spec.ts` — Meta suggestion validation
- `tests/e2e/devpages.suggest.ui.spec.ts` — UI modal tests (optional)

#### Preview & Commit Meta Changes (Phase 50.7 — Dev Only)

**Feature**: Apply SEO meta suggestions directly to HTML files with preview and backup.

**Safety Features**:
- ✅ **Traversal guards**: Only resolves files under `public/`, `dist/`, or root directories
- ✅ **PR-ready diffs**: Generates unified diffs for code review
- ✅ **Timestamped backups**: Creates `.bak.<timestamp>.html` before writing
- ✅ **Integrity checksums**: SHA-256 on all artifacts
- ✅ **Dev-only**: Requires `ALLOW_DEV_ROUTES=1` environment variable
- ✅ **Dry-run mode**: Preview changes without writing files

**Backend Endpoints**:

1. **`POST /agent/seo/meta/preview?path=<url>`** (Always available)
   - Accepts `{title, desc}` payload
   - Returns `{ok, path, changed, artifacts, integrity, empty_diff}`
   - Writes artifacts to `agent/artifacts/seo-meta-apply/<slug>.*`:
     - `<slug>.diff` — Unified diff
     - `<slug>.preview.html` — Modified HTML
     - `<slug>.apply.json` — Metadata with integrity

2. **`POST /agent/seo/meta/commit?path=<url>&confirm=1`** (Requires `ALLOW_DEV_ROUTES=1`)
   - Accepts `{title, desc}` payload
   - Returns `{ok, applied, path, backup, changed, artifacts, integrity}`
   - Creates timestamped backup: `<file>.bak.<timestamp>.html`
   - Writes modified HTML to original file
   - Without `confirm=1`: Returns dry-run response

**Dev Overlay UI**:
- **Editable fields**: Title and description are editable (not readonly)
- **Preview diff** button (sky theme): Calls preview endpoint, shows changed fields
- **Approve & commit** button (emerald theme): Calls commit endpoint with `confirm=1`
- **Diff display**: Shows changed fields and artifact paths

**Example Usage**:

```bash
# Enable dev routes (required for commit)
$env:ALLOW_DEV_ROUTES='1'  # PowerShell

# Preview changes (always available)
curl -s -X POST "http://127.0.0.1:8001/agent/seo/meta/preview?path=/index.html" `
  -H "Content-Type: application/json" `
  -d '{"title":"New Index Title","desc":"New description for index"}' | jq

# Output:
# {
#   "ok": true,
#   "path": "/index.html",
#   "changed": {"title": true, "description": true},
#   "artifacts": {
#     "diff": "agent/artifacts/seo-meta-apply/index-html.diff",
#     "preview_html": "agent/artifacts/seo-meta-apply/index-html.preview.html"
#   },
#   "integrity": {"algo": "sha256", "value": "abc123...", "size": 456},
#   "empty_diff": false
# }

# View diff
cat agent/artifacts/seo-meta-apply/index-html.diff

# Commit changes (writes backup + applies HTML)
curl -s -X POST "http://127.0.0.1:8001/agent/seo/meta/commit?path=/index.html&confirm=1" `
  -H "Content-Type: application/json" `
  -d '{"title":"New Index Title","desc":"New description for index"}' | jq

# Output:
# {
#   "ok": true,
#   "applied": true,
#   "path": "/index.html",
#   "backup": "public/index.bak.20251008-143022.html",
#   "changed": {"title": true, "description": true},
#   "artifacts": {...},
#   "integrity": {...}
# }

# Verify artifacts written
Get-ChildItem agent\artifacts\seo-meta-apply\*
```

**E2E Tests**:
- `tests/e2e/seo-meta.apply.api.spec.ts` — Preview and commit endpoint tests
  - Preview with changes
  - Preview with no changes (empty_diff)
  - Preview with invalid path (404)
  - Commit dry-run mode (confirm=0)
  - Commit with file write (confirm=1) — **SKIPPED by default** (set `WRITE_OK=1` to enable)

**Workflow**:
1. Open Dev Overlay → Discovered Pages
2. Click "Suggest meta" on any page
3. Edit title/description in modal (character limits shown)
4. Click "Preview diff" to see proposed changes
5. Review diff artifacts in `agent/artifacts/seo-meta-apply/`
6. Click "Approve & commit" to apply changes (creates backup)
7. Verify changes in HTML file and backup created

**CI/CD Notes**:
- Set `ALLOW_DEV_ROUTES=1` in dev/staging environments to enable commit endpoint
- Keep `ALLOW_DEV_ROUTES=0` (or unset) in production to disable file modifications
- Tests with `WRITE_OK=1` are skipped by default to prevent CI file modifications

#### Meta PR Helper (GitHub Actions)

**Workflow**: `.github/workflows/siteagent-meta-pr.yml`

Automates the process of creating a pull request with SEO meta artifacts for code review.

**How to Use**:
1. Generate suggestions and preview changes in Dev Overlay (creates artifacts)
2. Click "Open PR helper" button in the Suggest Meta modal
3. Or navigate to: Actions → siteagent-meta-pr → Run workflow
4. Fill in workflow inputs:
   - `page_path`: Page path (e.g., `/index.html`) — leave empty to use newest artifact
   - `compress`: Zip artifacts into `_pr/` directory (default: true)
   - `include_html`: Include modified HTML files in PR (default: false)
   - `draft`: Open PR as draft (default: true)
   - `reviewers`: Comma-separated GitHub usernames to request review from (e.g., alice,bob)
   - `team_reviewers`: Comma-separated team slugs to request review from (e.g., web,platform)
5. Click "Run workflow"

**Workflow Inputs**:

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `page_path` | string | (empty) | Page path like `/index.html`. If empty, uses newest artifact. |
| `compress` | boolean | true | Zip `.diff`, `.apply.json`, `.preview.html` into `_pr/` directory |
| `include_html` | boolean | false | Also include modified HTML files (public/, dist/) in PR |
| `draft` | boolean | true | Open PR as draft |
| `reviewers` | string | (empty) | Comma-separated GitHub usernames to request review from (e.g., alice,bob) |
| `team_reviewers` | string | (empty) | Comma-separated team slugs to request review from (e.g., web,platform) |

**Workflow Outputs**:

The workflow creates a pull request with:
- **Branch**: `meta/<slug>-<timestamp>` (e.g., `meta/index-html-20251008143022`)
- **Title**: `SEO Meta: <page> — PR-ready diff`
- **Body**: Markdown with artifact paths, changed fields, integrity checksum
- **Files**: All artifacts in `agent/artifacts/seo-meta-apply/` (and optional HTML)
- **Reviewers**: Auto-requested from `reviewers` and `team_reviewers` inputs (if provided)

**Artifacts Structure**:

```
agent/artifacts/seo-meta-apply/
├── index-html.diff              # Unified diff
├── index-html.preview.html      # Modified HTML
├── index-html.apply.json        # Metadata + integrity
└── _pr/
    ├── index-html-20251008143022.zip  # Optional: compressed artifacts
    └── index-html-PR.md               # PR body markdown
```

**Script**: `scripts/meta-pr-summary.mjs`

Helper script that:
- Picks slug from `--page` argument or finds newest `*.apply.json`
- Reads artifacts: `.diff`, `.preview.html`, `.apply.json`
- Optionally creates ZIP with all artifacts
- Emits GitHub Actions outputs: `branch`, `title`, `commit`, `body`, `html_glob`

**Example Manual Run**:

```bash
# Generate PR summary for specific page
node scripts/meta-pr-summary.mjs --page /index.html --compress true

# Use newest artifact
node scripts/meta-pr-summary.mjs --compress true --include-html false
```

**Permissions**:

The workflow uses `GITHUB_TOKEN` (no PAT required) with:
- `contents: write` — Create branch and commit
- `pull-requests: write` — Create pull request

**Workflow Steps**:
1. Checkout repository with full history
2. Setup Node.js 20
3. Run `meta-pr-summary.mjs` to build PR metadata
4. Create pull request using `peter-evans/create-pull-request@v6`

**Quick Runbook**:

```bash
# 1. Generate suggestions and preview in Dev Overlay
# (creates artifacts in agent/artifacts/seo-meta-apply/)

# 2. Open PR helper
# Click "Open PR helper" button in modal
# OR navigate to: https://github.com/<owner>/<repo>/actions/workflows/siteagent-meta-pr.yml

# 3. Fill inputs
# - page_path: /index.html (or leave empty for newest)
# - compress: ✅ (recommended)
# - include_html: ❌ (unless you want HTML in PR)
# - draft: ✅ (recommended)

# 4. Run workflow
# Creates draft PR with artifacts for code review

# 5. Review PR
# - Check diff in PR
# - Review artifacts in PR files
# - Approve and merge when ready
```

**PR Labeling & Preview Comments**:

The workflow now includes automatic labeling and preview comment posting:

1. **Auto Labels**: PRs created by `siteagent-meta-pr` are automatically tagged with:
   - `seo-meta` — Indicates SEO metadata changes
   - `automation` — Marks workflow-generated PRs

2. **Repo-wide PR Labeler**: `.github/workflows/labeler.yml` automatically applies labels to ALL PRs based on file paths:
   - `seo-meta`: Matches `agent/artifacts/seo-meta-apply/**` and `agent/artifacts/seo-meta/**`
   - `html`: Matches `public/**/*.html` and `dist/**/*.html`
   - `automation`: Matches `.github/workflows/**` and `scripts/**`

   Configuration: `.github/labeler.yml` (uses `actions/labeler@v5` with `pull_request_target` for fork safety)

3. **Preview Comment**: After PR creation, the workflow posts a comment with:
   - Proposed title and description (≤60 / ≤155 chars)
   - Clickable GitHub links to diff and preview HTML artifacts
   - Apply metadata JSON link

   Example comment structure:
   ```markdown
   **SEO Meta Proposal for `/index.html`**

   **Title (≤60):** New Title Here
   **Description (≤155):** New description here

   **Artifacts:**
   - Diff: [agent/artifacts/.../diff](link)
   - Preview HTML: [agent/artifacts/.../preview.html](link)
   - Apply metadata: [agent/artifacts/.../apply.json](link)
   ```

4. **Artifact Metadata**: All `.apply.json` files now include a `proposal` field with:
   ```json
   {
     "proposal": {
       "title": "Proposed title",
       "desc": "Proposed description"
     }
   }
   ```

   This enables PR comments to show what's being proposed without parsing HTML diffs.

5. **Reviewer Assignment**: Workflow accepts `reviewers` and `team_reviewers` inputs:
   - `reviewers`: Comma-separated GitHub usernames (e.g., `alice,bob`)
   - `team_reviewers`: Comma-separated team slugs (e.g., `web,platform`)
   - Auto-requests reviews when PR is created
   - If empty, no reviewers are requested

6. **Path-based Reviewer Auto-Assignment**:
   - Configure `.github/seo-meta-reviewers.json` with glob-based rules
   - Maps page paths to reviewers and team reviewers
   - Example rules: `/index.html` → `leok974`, `/blog/**` → `alice` + `content` team
   - Supports `**` (any subpath) and `*` (single segment) glob patterns
   - Merges path-based reviewers with manual workflow inputs
   - Removes duplicates and leading `@` symbols
   - Falls back to `defaults` if no rules match
   - Script: `scripts/seo-meta-reviewers.mjs`

**Benefits**:
- Reviewers see proposed changes immediately in PR comment
- Labels enable quick filtering of meta-related PRs
- Autolinks provide instant navigation to artifacts
- Fork PRs are safely labeled using `pull_request_target`
- Auto-request reviews from team members
- Path-based reviewer assignment based on page context

**Path-based Reviewer Configuration**:

Example `.github/seo-meta-reviewers.json`:
```json
{
  "rules": [
    { "glob": "/index.html",            "reviewers": ["leok974"] },
    { "glob": "/blog/**",               "reviewers": ["alice"],     "team_reviewers": ["content"] },
    { "glob": "/agent/**",              "team_reviewers": ["platform"] },
    { "glob": "/projects/**",           "team_reviewers": ["web"] }
  ],
  "defaults": {
    "team_reviewers": ["web"]
  }
}
```

**Glob patterns**:
- `**`: Matches any subpath (e.g., `/blog/**` matches `/blog/post/index.html`)
- `*`: Matches single segment (e.g., `/blog/*/index.html` matches `/blog/post/index.html` but not `/blog/2023/post/index.html`)
- Case-insensitive matching

**Merging behavior**:
1. Script resolves reviewers from matching rules (first match wins, but all matches are accumulated)
2. Falls back to `defaults` if no rules match
3. Merges with manual workflow inputs (`reviewers` and `team_reviewers`)
4. Removes duplicates and leading `@` symbols
5. Emits comma-separated lists to workflow

#### SEO Meta Guardrails (PR Validation)

**Workflow**: `.github/workflows/seo-meta-guardrails.yml`

Automatically validates SEO meta proposals on every PR that changes `*.apply.json` files.

**What it checks**:
- Title length ≤ 60 characters
- Description length ≤ 155 characters

**Validation script**: `scripts/seo-meta-guardrails.mjs`

**How it works**:
1. Triggers on PR open/sync/reopen when `agent/artifacts/seo-meta-apply/**/*.apply.json` changes
2. Computes diff between base and head to find changed files
3. Validates `proposal.title` and `proposal.desc` from each `.apply.json`
4. Writes `guardrails-violations.json` report if violations found
5. Posts a PR review (REQUEST_CHANGES) summarizing all violations
6. Uploads violations report as workflow artifact
7. Uses GitHub log annotations for inline errors (visible in Files Changed view)
8. Fails PR check if any violation found

**Example error annotation**:
```
::error file=agent/artifacts/seo-meta-apply/index-html.apply.json,line=1::Title too long (72 > 60)
```

**PR Review format**:
When violations are found, an automated PR review is posted:
```markdown
### ❌ SEO Meta Guardrails failed

**Rules:** Title ≤ 60, Description ≤ 155

- **title length 72 > 60** in `agent/artifacts/seo-meta-apply/index-html.apply.json`
> Very long title that exceeds the maximum character limit...
- **description length 180 > 155** in `agent/artifacts/seo-meta-apply/index-html.apply.json`
> Very long description that also exceeds the limit...

_Automated review by **seo-meta-guardrails**._
```

**Violations report** (`guardrails-violations.json`):
```json
{
  "files": ["agent/artifacts/seo-meta-apply/index-html.apply.json"],
  "violations": [
    {
      "file": "agent/artifacts/seo-meta-apply/index-html.apply.json",
      "field": "title",
      "length": 72,
      "limit": 60,
      "excerpt": "Very long title..."
    }
  ],
  "title_max": 60,
  "desc_max": 155
}
```

**Permissions**: `contents: read`, `pull-requests: write` (needed for PR reviews)

**Quick test locally**:
```bash
# Validate specific files
node scripts/seo-meta-guardrails.mjs agent/artifacts/seo-meta-apply/index-html.apply.json

# Validate all apply.json files
node scripts/seo-meta-guardrails.mjs agent/artifacts/seo-meta-apply/*.apply.json
```

**Benefits**:
- Prevents merge of invalid SEO meta (title/desc too long)
- Inline annotations point to exact file causing violation
- Automated PR review summarizes all violations with excerpts
- Machine-readable violations report uploaded as artifact
- REQUEST_CHANGES review blocks merge until violations fixed
- Runs automatically on every PR with meta changes
- Fast validation (no build required)
- Acts as status check (blocks merge if enabled)

**Optional: Non-blocking reviews**:
To change from REQUEST_CHANGES to COMMENT (non-blocking), edit the workflow:
```yaml
event: 'COMMENT'  # instead of 'REQUEST_CHANGES'
```

---

## Adding a New Endpoint
1. Implement route in `assistant_api/...`
2. Add tests in `tests/`
3. Update `docs/API.md` & `README.md`
4. Append entry to `docs/CHANGELOG.md`

## TODO
