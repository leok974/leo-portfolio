# Assistant API – Dev switches and quick run

## Dev switches

- DISABLE_PRIMARY=1
  Forces /chat and /chat/stream to use OpenAI fallback, skipping Ollama.
  Useful when you don’t have an OpenAI-compatible local endpoint up.

- RAG_URL
  Backend URL the auto-RAG helper queries.
  - Dev default: http://127.0.0.1:8001/api/rag/query
  - Prod example (Compose): http://backend:8000/api/rag/query

## Examples

PowerShell

```
$env:DISABLE_PRIMARY="1"
$env:OPENAI_API_KEY = (Get-Content .\secrets\openai_api_key).Trim()
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001
```

bash

```
export DISABLE_PRIMARY=1
export OPENAI_API_KEY="$(cat secrets/openai_api_key)"
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001
```

## VS Code task (fallback)

Add to .vscode/tasks.json:

```
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Run FastAPI (assistant_api, fallback)",
      "type": "shell",
      "options": {
        "cwd": "${workspaceFolder}/assistant_api",
        "env": {
          "DISABLE_PRIMARY": "1",
          "OPENAI_API_KEY": "${input:OPENAI_API_KEY}"
        }
      },
      "command": "uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001",
      "problemMatcher": []
    }
  ],
  "inputs": [
    {
      "id": "OPENAI_API_KEY",
      "type": "command",
      "command": "workbench.action.inputBox",
      "args": {
        "prompt": "Enter your OpenAI API key (dev only; use Docker secrets in prod)",
        "password": true
      }
    }
  ]
}
```

## Quick re-run checklist

Force fallback and run

```
$env:DISABLE_PRIMARY="1"
pwsh -File scripts/smoke.ps1 -BaseUrl "http://127.0.0.1:8001"
```

Expect:

- /ready PASS
- /llm/health PASS (openai:"configured")
- /api/rag/query PASS (200 with matches)
- /chat PASS (_served_by:"fallback")
- /metrics shows providers: { "fallback": N } with tokens

Re-enable primary (optional)

Unset DISABLE_PRIMARY, start Ollama (with gpt-oss:20b), re-run smoke; /chat should show _served_by:"primary".

Prod flip

Set RAG_URL=http://backend:8000/api/rag/query in env/compose.

Ensure secrets/openai_api_key exists and mounted.

Run scripts/smoke.sh http://127.0.0.1:8000 on the host or from a toolbox container.

## Restart helpers (PowerShell)

**Dev (uvicorn)**

```powershell
Get-Process -Name "uvicorn" -ErrorAction SilentlyContinue | Stop-Process -Force
python -m uvicorn assistant_api.main:app --host 0.0.0.0 --port 8000
```

**Docker Compose (backend container)**

```powershell
$FILES = @('-f','docker-compose.prod.yml','-f','docker-compose.prod.override.yml')
docker compose $FILES restart backend
docker compose $FILES logs -f backend --tail=100
```
