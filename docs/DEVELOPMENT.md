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

Manifest MIME: The production config now declares `application/manifest+json` for `webmanifest` ensuring browsers no longer warn about `site.webmanifest` being served as `text/plain` or `text/html`.

Troubleshooting 404s:
1. Ensure you actually built assets: `npm run build` (creates `dist/`).
2. Confirm the files exist locally: `dir dist` (PowerShell) or `ls dist`.
3. If still 404 in container, exec in Nginx: `docker compose exec nginx ls -1 /usr/share/nginx/html/assets`.
4. Cache: Hashed assets are cached aggressively; force refresh with Ctrl+Shift+R.

Next Hardening Steps (planned):
* Remove remaining inline styles → drop `'unsafe-inline'` from dev.
* Consider hashing critical inline script (if ever introduced) with CSP `script-src` sha256.
* Add build check that fails if inline `<style>` blocks persist (simple grep in CI).

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
