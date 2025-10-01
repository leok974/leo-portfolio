# API Reference

> Draft – Expand with full schemas as models stabilize.

Base URL (edge): `http://<host>:8080`
Backend direct (compose network): `http://backend:8000`

## OpenAPI Schema
- Live JSON: `http://<host>:8080/openapi.json` (edge) or backend direct `http://127.0.0.1:8001/openapi.json`
- Documentation UI (FastAPI Swagger): `http://<host>:8080/docs`
- ReDoc UI (if enabled): `http://<host>:8080/redoc`
- Exported snapshot: `docs/openapi.json` (regenerated via `python -m assistant_api.export_openapi`)

Regeneration command (from repo root):
```bash
python -m assistant_api.export_openapi
```

## Chat
### POST /chat
Request:
```json
{ "messages": [ { "role": "user", "content": "Hello" } ] }
```
Response (truncated):
```json
{ "id": "chatcmpl-...", "choices": [{ "message": { "role": "assistant", "content": "Hi!" }}], "_served_by": "primary" }
```

### POST /chat/stream (SSE)
- Content-Type: application/json
- Server-Sent Events stream
- Events: `data:` chunks containing partial tokens; initial `event: meta` then token deltas; trailing `event: done`.

Example:
```bash
curl -N -X POST http://127.0.0.1:8080/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Test streaming"}]}'
```

## RAG
### POST /api/rag/query
```json
{ "question": "What models are supported?", "k": 4 }
```
Response snippet:
```json
{ "matches": [ { "score": 0.82, "source": "README.md", "text": "..." } ], "count": 4 }
```

## LLM Diagnostics
### GET /llm/health
Provider wiring & key presence.
### GET /llm/primary/latency
Rolling probe stats for primary model endpoint.
### GET /llm/primary/chat-latency (deprecated)
Latency including minimal message round trip; returns `{ deprecated: true, replacement: "/llm/primary/latency" }`.
### GET /llm/diag
Extended diagnostic info (models list, fallback readiness) – if implemented.

## Readiness & Status
### GET /ready
Basic readiness (DB + provider reachability) for container orchestration.
### GET /status/summary
Summarized system state (model presence, fallback mode, counts). Always present; returns HTTP 200 with JSON when healthy, 503 if underlying readiness signals fail (never 404).
### GET /status/cors
Current CORS configuration snapshot – useful for debugging cross‑origin failures without redeploying.

Response example:
```json
{
  "raw_env": "https://site.example, https://admin.example",
  "allow_all": false,
  "allowed_origins": [
    "https://site.example",
    "https://admin.example",
    "https://example.com",
    "http://example.com",
    "https://www.example.com",
    "http://www.example.com"
  ],
  "derived_from_domain": [
    "https://example.com",
    "http://example.com",
    "https://www.example.com",
    "http://www.example.com"
  ],
  "domain_env": "example.com",
  "timestamp": 1730000000.123
}
```

Derivation rules:
- `ALLOWED_ORIGINS` accepts comma, space, or newline separated values.
- If `DOMAIN` is set (e.g. `portfolio.example`), the service auto-adds both HTTP + HTTPS plus `www.` variants unless already present.
- Set `CORS_ALLOW_ALL=1` for temporary wildcard troubleshooting (credentials disabled automatically in that mode – avoid for production).
- Enable verbose preflight logging with `CORS_LOG_PREFLIGHT=1` to print method, Origin, and Access-Control-Request-* headers.
### GET /metrics
JSON metrics: request totals, 5xx, token in/out, latency buckets, provider distribution.

Status response (fields excerpt):
```json
{
  "llm": { "path": "fallback", "primary_model_present": false, "ready_probe": false },
  "rag": { "ok": true, "db": "./data/rag.sqlite", "mode": "local-model" },
  "ready": false,
  "_source": "/status/summary"
}
```

RAG health is now determined in‑process (SQLite open + vector index dimension heuristic) instead of issuing an internal HTTP POST to `/api/rag/query`. This removes failure coupling with edge routing and avoids false negatives during partial outages. Legacy HTTP probing can be forced (for debugging) by setting `STATUS_RAG_VIA_HTTP=1` (timeout seconds via `RAG_PROBE_TIMEOUT`, default 2–3s).

### GET /status/uptime
Minimal payload for lightweight external probes (avoids larger status summary cost). Alias also available at `/api/status/uptime` for clients already namespacing under `/api`.

Request:
```
GET /status/uptime
```
Response:
```json
{
  "uptime_seconds": 1234.567,
  "start_time": 1759254897.8170595,
  "build": { "sha": "40924bf", "time": "2025-09-30T17:50:51+00:00" }
}
```
Field notes:
- `uptime_seconds`: Seconds since process startup (monotonic wall‑clock difference).
- `start_time`: Epoch seconds (float) when service process initialized (UTC based on system time).
- `build`: Present if build metadata env vars (`BUILD_SHA`/`GIT_SHA`, `BUILD_TIME`) were injected at image build or runtime.

Cache policy: edge layer (nginx) injects `Cache-Control: no-store` for `/api/status/*` and `/status/*`; uptime endpoint intentionally mirrors this behavior to avoid stale monitoring data.

Use cases:
- External uptime probes / SLIs.
- Rapid readiness gating in orchestrators where full summary is unnecessary.
- Cross-region latency sampling with minimal transfer.

If `build` is null, ensure build pipeline populates `GIT_SHA` and `BUILD_TIME` when building the backend image.

Warmup / startup environment flags:
- `MODEL_WAIT_MAX_SECONDS` (default 180) – Maximum seconds to wait for Ollama API + model tag before continuing (server starts even if model not yet pulled).
- `DISABLE_PRIMARY=1` – Skip waiting entirely; service starts in fallback mode (`llm.path=fallback`). Useful for CI and fast local dev.

## Errors
Standard JSON error form:
```json
{ "detail": "Descriptive message", "code": "fallback_unavailable" }
```

## Versioning
Breaking changes recorded in `docs/CHANGELOG.md`. Deprecated endpoints include a `deprecated: true` flag and a `replacement` field.

## TODO
- Enumerate specific metric fields
- Include embedding model field in RAG response example
