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
