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
- Introduce pre-commit hooks (ruff, trailing whitespace)
- Add load test harness (Locust/k6 snippets)
- Add typed return models for diagnostics endpoints
- Replace inline `<style>` blocks to drop `'unsafe-inline'` from CSP `style-src`
- Consider nonces or hashes if future inline scripts required (currently avoided)
