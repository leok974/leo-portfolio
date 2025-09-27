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
Minimal health smoke (PowerShell):
```powershell
pwsh -File scripts/smoke.ps1 -BaseUrl "http://127.0.0.1:8001"
```

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
