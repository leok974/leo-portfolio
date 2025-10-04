# API Reference

> Draft – Expand with full schemas as models stabilize.

Base URL (edge): `http://<host>:8080`
Backend direct (compose network): `http://backend:8000`

> Operational note: The nginx image now re-normalizes `/usr/share/nginx/html` permissions during build, so HEAD/GET probes against hashed bundles (e.g. `/assets/index-*.js`) succeed reliably. Combine one of those probes with `/ready` when scripting edge health checks.
> Inline bootstrap changes are covered by `entrypoint.d/10-csp-render.sh`, which refreshes the CSP `script-src` hash list before nginx starts. If you add new inline diagnostics endpoints, make sure they keep using the same placeholder or rely on the script to append hashes automatically.

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
{ "id": "chatcmpl-...", "choices": [{ "message": { "role": "assistant", "content": "Hi!" }}], "content": "Hi!", "_served_by": "primary", "grounded": true, "sources": [{ "repo": "leo-portfolio", "path": "projects/ledgermind.md", "score": 0.91, "id": "..." }] }
```

Notes:
- Optional request field `include_sources: true` tells the backend to attach `sources` in the JSON response when RAG grounding is applied.
- `grounded` indicates whether the reply used repository context. When false, the assistant avoids specific claims and offers to share the case study/demo.
 - Convenience field `content` mirrors `choices[0].message.content` to simplify test assertions.

Behavioral details:
- Even when the UI falls back from SSE to plain JSON, the backend now attempts retrieval on the JSON path. When matches are found, the JSON response includes `grounded: true` and `sources: [...]` so the frontend can still render the grounding badge and sources popover.
- If the assistant previously offered a case study and the next user input is an affirmation (e.g., "yes", "sure"), the backend returns a concise case-study snippet immediately (LedgerMind path implemented) and still ends with a short follow-up question.

Testing knobs (dev/CI):
- `DEV_ALLOW_NO_LLM=1` synthesizes minimal assistant replies so backend tests can run without external LLM/API keys while preserving `grounded`/`sources` behavior.

### POST /chat/stream (SSE)
- Content-Type: application/json
- Server-Sent Events stream
- Events: `data:` chunks containing partial tokens; initial `event: meta` (with `_served_by`, plus `grounded` and optional `sources` when `include_sources: true` is sent) then token deltas; periodic `event: ping` heartbeats until the first token; trailing `event: done`.
- Frontend widgets now force this call through the `/api/chat/stream` shim so edge headers and buffering rules always apply (even if backend summaries provide direct URLs).
- Client helpers (`src/lib/sse.ts`) provide a `readSSE()` utility to decode frames and surface `onMeta`/`onData` callbacks.
- Frontend behavior: when `meta` includes `grounded: true`, the UI renders a visible "grounded (n)" badge next to the provider marker immediately and preserves it across JSON fallback. Tests target `[data-testid="assistant-badge"]`.
 - Frontend behavior: when `meta` includes `grounded: true`, the UI renders a visible "grounded (n)" badge next to the provider marker immediately and preserves it across JSON fallback. Clicking the badge opens a popover listing source titles and paths, linking out when a `url` is present; see `[data-testid="assistant-sources-popover"]`.
 - Each `sources[]` item includes: `title`, `id`, `path`, and optionally `url` (use `RAG_REPO_WEB` env to enable clean repo links like `https://github.com/<owner>/<repo>/blob/<ref>/<path>`).
- Playwright helper `installFastUI(page)` blocks image/font/media loads and enforces reduced motion during frontend SSE mocks, so tests exercise `/api/chat/stream` deterministically without waiting on heavy assets.
- Guard rails: if the stream closes without emitting assistant tokens, the UI automatically retries via `/api/chat` JSON (tracked in `tests/e2e/assistant-ui-fallback.spec.ts`), while backend guard spec `tests/e2e/chat-stream-yields.spec.ts` ensures real streams include at least one token.

Example:
```bash
curl -N -X POST http://127.0.0.1:8080/api/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Test streaming"}], "include_sources": true}'
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

### POST /api/rag/ingest

Purpose:
- Index content into the SQLite RAG store.

Body schema:
- reset: bool — remove the DB file before ingest (use once after schema changes)
- dry_run: bool — preview files without writing to the DB
- repos: array — sources to ingest
  - type: "fs" | "git"
  - fs example: { "type": "fs", "path": "/app", "include": ["README.md","docs/**/*.md"] }
  - git example: { "type": "git", "url": "https://github.com/owner/repo", "ref": "main", "include": ["**/*.md"] }

Responses:
- Dry run: { "ok": true, "dry_run": true, "preview": [ { type, path|url, files? }... ] }
- Real ingest: { "ok": true, "chunks": number, "sources": [ { type, path|url, count }... ] }
- Error: { "ok": false, "error": string, "hint": string }

Notes:
- Behind the edge, call /api/rag/ingest. Backend also accepts /rag/ingest.
- Backend image includes git for optional git ingestion.

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
### GET /api/ready
Lightweight readiness that only checks that the RAG SQLite DB exists and has at least one chunk. Useful for quick scripts/CI when provider checks are noisy.
Response also includes a minimal stage metrics snapshot for quick diagnostics:
```json
{
  "ok": true,
  "rag": { "db": "./data/rag.sqlite", "chunks": 123, "ok": true },
  "metrics": {
    "embeddings": { "count": 2, "last_ms": 85.2, "last_backend": "local" },
    "rerank": { "count": 1, "last_ms": 42.5, "last_backend": "local" },
    "gen": { "count": 1, "last_ms": 210.4, "last_backend": "openai" }
  }
}
```
### GET /status/summary
Summarized system state (model presence, fallback mode, counts). Includes top-level `ok` boolean. Always present; returns HTTP 200 with JSON when healthy, 503 if underlying readiness signals fail (never 404).
### GET /status/cors
### GET /api/metrics
JSON metrics for embeddings/rerank/gen stages (counts, last latency, last backend). Handy for quick probes or assertions.

Example:
```json
{ "ok": true, "metrics": { "embeddings": {"count": 3, "last_ms": 71.1, "last_backend": "local"}, "rerank": {"count": 2, "last_ms": 62.3, "last_backend": "openai"}, "gen": {"count": 1, "last_ms": 210.4, "last_backend": "openai"} } }
```

### GET /api/metrics.csv
CSV view of the same metrics for shell tooling and dashboards.

Header: `stage,count,last_ms,last_backend`

Sample:
```
stage,count,last_ms,last_backend
embeddings,3,71.1,local
rerank,2,62.3,openai
gen,1,210.4,openai
```
Current CORS configuration snapshot – useful for debugging cross‑origin failures without redeploying.

Response example:
```json
{
  "raw_env": "https://site.example, https://admin.example",
  "allow_all": false,
  "request_origin": "http://127.0.0.1:5173",
  "is_allowed": true,
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
- `SAFE_LIFESPAN=1` – Skip model probing entirely inside the FastAPI lifespan (no `/models` calls on boot). Complements `DISABLE_PRIMARY` and is the safer default for Windows/CI.

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
