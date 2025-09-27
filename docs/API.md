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
Summarized system state (model presence, fallback mode, counts) – if implemented.
### GET /metrics
JSON metrics: request totals, 5xx, token in/out, latency buckets, provider distribution.

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
