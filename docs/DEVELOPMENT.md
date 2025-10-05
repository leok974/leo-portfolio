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
## Adding a New Endpoint
1. Implement route in `assistant_api/...`
2. Add tests in `tests/`
3. Update `docs/API.md` & `README.md`
4. Append entry to `docs/CHANGELOG.md`

## TODO
