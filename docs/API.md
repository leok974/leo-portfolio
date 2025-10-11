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

## OpenAPI Drift Guard

We keep a snapshot at `docs/openapi.json`. CI fails if the live schema differs.

Regenerate snapshot:
```bash
python -m assistant_api.export_openapi > docs/openapi.json
```

Why: Ensures API docs and server stay in lockstep for the portfolio demo and examples.

## Chat
### POST /chat
Request:
```json
{ "messages": [ { "role": "user", "content": "Hello" } ] }
```
Response (truncated):
```json
{ "id": "chatcmpl-...", "choices": [{ "message": { "role": "assistant", "content": "Hi!" }}], "content": "Hi!", "_served_by": "primary", "grounded": true, "sources": [{ "repo": "leo-portfolio", "path": "projects/ledgermind.md", "score": 0.91, "id": "..." }], "guardrails": { "flagged": false, "blocked": false, "reason": null, "patterns": [] } }
```

Notes:
- Optional request field `include_sources: true` tells the backend to attach `sources` in the JSON response when RAG grounding is applied.
- `grounded` indicates whether the reply used repository context. When false, the assistant avoids specific claims and offers to share the case study/demo.
 - Convenience field `content` mirrors `choices[0].message.content` to simplify test assertions.
 - Guardrails: JSON replies include `guardrails` with shape `{ flagged, blocked, reason, patterns[] }`. When enforcement is on and an input is flagged, the reply is a safe message with `_served_by: "guardrails"` and `blocked: true`.

Blocked example (enforce mode):
```json
{ "content": "Sorry, I can't follow those instructions. Let's try a different question.", "_served_by": "guardrails", "guardrails": { "flagged": true, "blocked": true, "reason": "prompt_injection", "patterns": ["ignore previous", "system prompt"] } }
```

Behavioral details:
- Even when the UI falls back from SSE to plain JSON, the backend now attempts retrieval on the JSON path. When matches are found, the JSON response includes `grounded: true` and `sources: [...]` so the frontend can still render the grounding badge and sources popover.
- If the assistant previously offered a case study and the next user input is an affirmation (e.g., "yes", "sure"), the backend returns a concise case-study snippet immediately (LedgerMind path implemented) and still ends with a short follow-up question.

Testing knobs (dev/CI):
- `DEV_ALLOW_NO_LLM=1` synthesizes minimal assistant replies so backend tests can run without external LLM/API keys while preserving `grounded`/`sources` behavior.

### POST /chat/stream (SSE)
- Content-Type: application/json
- Server-Sent Events stream
- Events: `data:` chunks containing partial tokens; initial `event: meta` (with `_served_by`, plus `grounded` and optional `sources` when `include_sources: true` is sent) then token deltas; periodic `event: ping` heartbeats until the first token; trailing `event: done`.
- Guardrails in stream: when inputs are flagged, the first `meta` includes a `guardrails` object. In `enforce` mode the server short‑circuits: emits `meta` with `guardrails{ flagged:true, blocked:true }`, a single safe `data:` delta, then `done`.
- Frontend widgets now force this call through the `/api/chat/stream` shim so edge headers and buffering rules always apply (even if backend summaries provide direct URLs).
- Client helpers (`src/lib/sse.ts`) provide a `readSSE()` utility to decode frames and surface `onMeta`/`onData` callbacks.
- Frontend behavior: when `meta` includes `grounded: true`, the UI renders a visible "grounded (n)" badge next to the provider marker immediately and preserves it across JSON fallback. Tests target `[data-testid="assistant-badge"]`.
 - Frontend behavior: when `meta` includes `grounded: true`, the UI renders a visible "grounded (n)" badge next to the provider marker immediately and preserves it across JSON fallback. Clicking the badge opens a popover listing source titles and paths, linking out when a `url` is present; see `[data-testid="assistant-sources-popover"]`.
 - Each `sources[]` item includes: `title`, `id`, `path`, and optionally `url` (use `RAG_REPO_WEB` env to enable clean repo links like `https://github.com/<owner>/<repo>/blob/<ref>/<path>`).
- Route badge: a small pill shows the chosen route (rag | faq | chitchat) under the assistant bubble. It uses streaming `meta.scope.route` when provided; otherwise, it defaults to chitchat during early streaming and updates when the final JSON is received. Non-stream replies also render the badge.
- Playwright helper `installFastUI(page)` blocks image/font/media loads and enforces reduced motion during frontend SSE mocks, so tests exercise `/api/chat/stream` deterministically without waiting on heavy assets.
- Guard rails: if the stream closes without emitting assistant tokens, the UI automatically retries via `/api/chat` JSON (tracked in `tests/e2e/assistant-ui-fallback.spec.ts`), while backend guard spec `tests/e2e/chat-stream-yields.spec.ts` ensures real streams include at least one token.

Example:
```bash
curl -N -X POST http://127.0.0.1:8080/api/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Test streaming"}], "include_sources": true}'
```

Example meta (truncated):
```
event: meta
data: {"_served_by":"primary","grounded":true,"sources":[...],"guardrails":{"flagged":false,"blocked":false}}

```

## Agent Orchestration

### GET /agents/tasks/paged
Paginated list of agent task runs with filtering support.

**Query Parameters:**
- `limit` (integer, default: 50) - Max items per page
- `cursor` (string, optional) - Pagination cursor from `next_cursor`
- `since` (datetime, optional) - Filter by `started_at >= since` (ISO 8601 UTC)
- `status` (array, optional) - Filter by status (e.g., `?status=queued&status=running`)
  - Values: `queued`, `running`, `awaiting_approval`, `succeeded`, `failed`, `skipped`
- `task` (array, optional) - Filter by task name (e.g., `?task=validate&task=review`)

**Response:**
```json
{
  "items": [
    {
      "id": 11,
      "task": "validate",
      "run_id": "834b0717-d2ee-4f",
      "status": "awaiting_approval",
      "started_at": "2025-10-10T13:22:23",
      "finished_at": "2025-10-10T13:22:23",
      "duration_ms": 450,
      "outputs_uri": "https://...",
      "log_excerpt": "Validation complete...",
      "approval_state": "pending",
      "approver": null,
      "webhook_notified_at": null
    }
  ],
  "next_cursor": "eyJzdGFydGVkX2F0IjogIjIwMjUtMTAtMTBUMTM6MjI6MjMiLCAiaWQiOiAxMX0="
}
```

**Example:**
```bash
# Last 7 days, awaiting approval or failed
curl "http://localhost:8001/agents/tasks/paged?since=2025-10-03T00:00:00Z&status=awaiting_approval&status=failed&limit=20"
```

### GET /agents/tasks/paged.csv
Export agent task runs as CSV (max 10,000 rows).

**Query Parameters:** Same as `/paged` endpoint

**Response:** CSV file with headers:
```csv
id,task,run_id,status,started_at,finished_at,duration_ms,outputs_uri,log_excerpt
11,validate,834b0717-d2ee-4f,awaiting_approval,2025-10-10T13:22:23,2025-10-10T13:22:23,450,https://...,Validation complete...
```

**Example:**
```bash
# Export last 30 days of succeeded tasks
curl "http://localhost:8001/agents/tasks/paged.csv?since=2025-09-10T00:00:00Z&status=succeeded&limit=1000" > tasks.csv
```

### DELETE /agents/tasks/before (Admin Only)
Prune historical agent task records before a specified date.

**Security:** Requires `X-Admin-Key` header matching server's `ADMIN_API_KEY` environment variable.

**Query Parameters:**
- `date` (datetime, required) - Delete rows with `started_at < date` (ISO 8601 UTC)

**Request:**
```bash
# Delete tasks older than 90 days
CUTOFF=$(date -u -d '90 days ago' +%FT%TZ)
curl -X DELETE "http://localhost:8001/agents/tasks/before?date=$CUTOFF" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -H "Accept: application/json"
```

**Response:**
```json
{
  "deleted": 42,
  "cutoff": "2025-07-12T00:00:00Z"
}
```

**Error Response (403 Forbidden):**
```json
{
  "detail": "Forbidden"
}
```

**Setup:**
1. Set `ADMIN_API_KEY` environment variable on server (strong random key)
2. Configure same key in GitHub Actions secrets for automated pruning
3. Optional: Run Alembic migration `002_agents_tasks_prune_fn` for PostgreSQL function

**Automated Pruning:**
- Weekly cron via `.github/workflows/agents-prune.yml` (Mondays 03:15 UTC)
- Requires repository Variable: `API_BASE` (e.g., `https://api.yourdomain.com`)
- Requires repository Secret: `ADMIN_API_KEY` (must match server env var)

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
- Ingestion path opens SQLite in WAL mode with a 10s busy timeout and retries connect/commit up to 5×, so concurrent warmup jobs no longer surface `sqlite3.OperationalError: database is locked`.
- Secret redaction: snippets in RAG responses are sanitized server-side to redact common secret patterns (JWTs, API keys, PEM blocks) to reduce accidental exposure in UIs and logs.

### GET /api/rag/projects
List distinct project IDs present in the `chunks` table, with row counts.

Query params:
- `include_unknown` (bool, default false) – when true, empty/null `project_id` values are folded into an `"unknown"` bucket.

Response:
```json
{ "ok": true, "projects": [ { "id": "ledgermind", "chunks": 128 }, { "id": "unknown", "chunks": 517 } ] }
```

Notes:
- The backend ensures an index on `chunks(project_id)` exists (`idx_chunks_project`) the first time this endpoint is invoked.
- Use this endpoint to populate a quick filter in the UI before issuing scoped RAG queries.

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
  }
}
```
### GET /status/cors
### GET /api/metrics

## Behavior Metrics (Phase 50.8)

### POST /api/metrics/event
Ingest a single anonymized behavior event.

Request:
```json
{
  "visitor_id": "abc123",
  "event": "page_view",
  "timestamp": "2025-10-09T12:34:56Z",
  "metadata": { "path": "/" }
}
```

Response (202 Accepted):
```json
{
  "ok": true,
  "stored": 1,
  "file": "./data/metrics.jsonl"
}
```

Notes:
- `visitor_id`: Anonymous sticky ID (hash), 6-64 characters
- `event`: Event name (e.g., "page_view", "link_click"), 1-64 characters
- `timestamp`: ISO 8601 datetime (defaults to server time if omitted)
- `metadata`: Optional key-value pairs for event context
- `user_agent`: Automatically captured from request header if not provided
- Events are appended to JSONL sink (configurable via `METRICS_JSONL` env var)
- Also stored in in-memory ring buffer (capacity: `METRICS_RING_CAPACITY`, default 500)

### GET /api/metrics/behavior
Returns a snapshot of recent events from the ring buffer with aggregated counts.

Query parameters:
- `limit`: Number of recent events to include (default: 50, max: ring capacity)

Response:
```json
{
  "total": 123,
  "by_event": [
    { "event": "page_view", "count": 80 },
    { "event": "link_click", "count": 43 }
  ],
  "last_events": [
    {
      "visitor_id": "abc123",
      "event": "page_view",
      "timestamp": "2025-10-09T12:34:56Z",
      "metadata": { "path": "/" },
      "user_agent": "Mozilla/5.0..."
    }
  ],
  "file_size_bytes": 4096
}
```

Notes:
- `total`: Total number of events in ring buffer
- `by_event`: Aggregated counts by event type
- `last_events`: Most recent events (newest first)
- `file_size_bytes`: Size of JSONL sink file (null if file doesn't exist)

### GET /api/metrics/behavior/health
Lightweight health check for the metrics subsystem.

Response:
```json
{
  "ok": true,
  "ring_capacity": 500,
  "sink_exists": true
}
```

## Tools API

### GET /api/tools
List registered tools in the sandboxed registry.

Response:
```json
{ "ok": true, "tools": [ { "name": "search_repo", "dangerous": false }, { "name": "run_script", "dangerous": true } ], "allow": false }
```

Notes:
- `allow` reflects `ALLOW_TOOLS=1` (dangerous gating). When false, dangerous tools cannot run.

### POST /api/act
Plans then executes a small sequence of tool calls for repo Q&A, returning the plan and execution transcript.

### POST /api/plan
Preview a plan (no execution).

Body:
```json
{ "question": "rebuild the rag index for DB at D:/leo-portfolio/data/rag_8023.sqlite" }
```
Response:
```json
{ "ok": true, "plan": { "plan": [ { "tool": "run_script", "args": { "script": "scripts/rag-build-index.ps1", "args": ["-DbPath", "D:/leo-portfolio/data/rag_8023.sqlite"] } } ] } }
```

Body:
```json
{ "question": "Where is the deploy compose file?" }
```
Response:
```json
{ "ok": true, "plan": { "steps": [ {"tool": "search_repo", "args": {"q": "docker-compose.prod.yml"}} ] }, "result": { "steps": [ {"ok": true, "tool": "search_repo", "rows": 3 } ] } }
```

### POST /api/tools/exec
Execute a specific registered tool. Dangerous tools are blocked unless `ALLOW_TOOLS=1`.

Body:
```json
{ "name": "run_script", "args": { "script": "scripts/rag-build-index.ps1", "args": ["-DbPath", "./data/rag.sqlite"], "timeout_s": 900 } }
```
Response (run_script):
```json
{ "ok": true, "exit_code": 0, "duration_ms": 1234, "stdout_tail": "...", "stderr_tail": "..." }
```

Optional dry run (no execution):
```json
{ "name": "run_script", "args": { "script": "scripts/rag-build-index.ps1", "dry_run": true } }
```
Response:
```json
{ "ok": true, "dry_run": true, "cmd": ["pwsh","-NoLogo","-NoProfile","-ExecutionPolicy","Bypass","-File","scripts/rag-build-index.ps1"] }
```

Security:
- `run_script` requires both `ALLOW_TOOLS=1` and an allowlist via `ALLOW_SCRIPTS` (comma/semicolon separated relative paths). Non-allowed scripts return `{ ok: false, error: "script not in allowlist" }`.
- All tools run within a BASE_DIR sandbox (`REPO_ROOT`, default repo root); file access uses a safe-join to prevent path escape.

## Eval API

### GET /api/eval/history
Returns recent eval summaries appended by the runner when `--history` is enabled (stored at `data/eval_history.jsonl`).

Query:
- `limit` (default 24) – number of recent items.

Response:
```json
{ "ok": true, "items": [ { "ts": "2025-10-04T12:34:56Z", "ratio": 0.83, "pass": 5, "total": 6 } ], "count": 1 }
```

### POST /api/eval/run
Runs the Python eval runner (`scripts/eval_run.py`) as a subprocess and returns its JSON summary. Also appends to history by default.

Body:
```json
{ "files": ["evals/baseline.jsonl","evals/tool_planning.jsonl"], "fail_under": 0.67 }
```

Response:
```json
{ "ok": true, "summary": { "ok": true, "ratio": 0.75, "pass": 6, "total": 8, "files": ["evals/baseline.jsonl","evals/tool_planning.jsonl"] } }
```

## Feedback API

### POST /api/feedback
Record user feedback for an assistant reply.

Body:
```json
{ "question": "What is LedgerMind?", "answer": "...", "score": 1, "note": "helpful", "served_by": "primary", "grounded": true, "sources_count": 3 }
```

Response:
```json
{ "ok": true, "ts": "2025-10-05T12:34:56.000Z" }
```

### GET /api/feedback/recent
Returns recent feedback items and a small summary.

Response:
```json
{ "ok": true, "summary": { "count": 8, "up": 6, "down": 2 }, "items": [ { "ts": "...", "score": -1, "question": "..." } ] }
```

### GET /api/feedback/export.csv
CSV export suitable for spreadsheets.


### POST /chat (augmented)
Adds a lightweight router and short-term memory:
- Router picks: `faq` (curated answers), `rag` (BM25 + rerank path), or `chitchat` (LLM brief answer).
- Response includes a `scope` object and `memory_preview` of the last turns.

Env knobs:
- `ROUTER_RAG_MIN` (default 7.0)
- `ROUTER_FAQ_MIN` (default 0.72)
- `FAQ_PATH` (default `data/faq.json`)
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

## Analytics & SEO

### POST /agent/analytics/ingest
Ingest CTR (Click-Through Rate) analytics data for SEO optimization.

**Accepts multiple formats:**

1. **Internal JSON** (recommended):
```json
{
  "source": "search_console",
  "rows": [
    { "url": "/projects/datapipe-ai", "impressions": 1000, "clicks": 5 },
    { "url": "/projects/derma-ai", "impressions": 1200, "clicks": 12 }
  ]
}
```

2. **Google Search Console API JSON** (from `searchanalytics.query`):
```json
{
  "rows": [
    { "keys": ["/projects/datapipe-ai"], "clicks": 6, "impressions": 1400 },
    { "keys": ["https://example.com/about"], "clicks": 10, "impressions": 1200 }
  ]
}
```

3. **CSV** (from GSC UI export with `Content-Type: text/csv`):
```csv
Page,Clicks,Impressions,CTR,Position
/,12,2200,0.54%,1.2
/projects/siteagent,11,1850,0.59%,1.5
```

4. **GA4 JSON** (loose mapping with dimensionValues/metricValues):
```json
{
  "rows": [
    {
      "dimensionValues": [{"value": "/projects/clarity"}],
      "metricValues": [{"value": "892"}, {"value": "8"}]
    }
  ]
}
```

**Response:**
```json
{
  "inserted_or_updated": 2,
  "rows": 2,
  "source": "search_console"
}
```

**Sources:** `search_console`, `ga4`, `manual`

**URL Normalization:** All URLs are normalized to relative paths (e.g., `https://example.com/about` → `/about`)

**Auth:** Requires agent authentication (dev overlay or Cloudflare Access)

### POST /agent/run?task=seo.tune
Generate SEO metadata improvement recommendations based on CTR data.

Request (optional):
```json
{ "threshold": 0.02 }
```

Response:
```json
{
  "ok": true,
  "json": "./agent_artifacts/seo-tune.json",
  "md": "./agent_artifacts/seo-tune.md",
  "count": 3
}
```

Creates two artifacts:
- `seo-tune.json` - Structured recommendations with old/new title and description
- `seo-tune.md` - Human-readable report

**LLM Rewriting**: The task now attempts LLM-based metadata rewriting using the primary endpoint (configured via `OPENAI_BASE_URL`/`OPENAI_MODEL`) with automatic fallback to a secondary endpoint (`FALLBACK_BASE_URL`/`FALLBACK_MODEL`). If both LLM endpoints fail or are unreachable, the system gracefully falls back to heuristic rewrites (action verbs, value props, AI/automation keywords). The `notes` field in the JSON artifact indicates which method was used: `"llm"` or `"heuristic"`.

**Configuration**:
- `SEO_LLM_ENABLED=1` - Enable LLM rewriting (default: enabled)
- `SEO_LLM_TIMEOUT=9.0` - Timeout for LLM requests in seconds
- Reuses existing `OPENAI_BASE_URL`, `OPENAI_MODEL`, `OPENAI_API_KEY`
- Reuses existing `FALLBACK_BASE_URL`, `FALLBACK_MODEL`, `FALLBACK_API_KEY`

Example artifact entry:
```json
{
  "url": "/projects/datapipe-ai",
  "ctr": 0.008,
  "old_title": "DataPipe AI",
  "old_description": "Data pipeline automation",
  "new_title": "DataPipe AI — Automate Your Data Pipelines with AI",
  "new_description": "Transform raw data into insights automatically with AI-powered pipeline orchestration and real-time processing.",
  "notes": "llm"
}
```

### POST /agent/run/mock (Test-only)
**Purpose**: Instantly writes fake `seo-tune.json` and `seo-tune.md` artifacts for E2E smoke tests.

**Guarded by**: `ALLOW_TEST_ROUTES=1` (disable in production)

**Request**:
```json
{ "threshold": 0.02 }
```

**Response**:
```json
{
  "ok": true,
  "mock": true,
  "json": "./agent_artifacts/seo-tune.json",
  "md": "./agent_artifacts/seo-tune.md",
  "count": 2
}
```

**Use Case**: Fast E2E tests that need artifacts without waiting for real agent execution. Always writes 2 mock pages (`/` and `/projects/siteagent`) with deterministic content.

### POST /agent/seo/keywords
**Purpose**: Generate keyword intelligence artifacts with LLM or heuristic extraction, Google Trends-like enrichment, and CTR underperformer bias.

**Authentication**: Requires Cloudflare Access or dev bearer token.

**Page Discovery**: Auto-discovers pages via enhanced sitemap loader:
1. **Reads sitemap.xml** from `public/`, `dist/`, or repo root
2. **Scans filesystem** for `*.html` files (supports 3-level nesting: `/blog/post/index.html`)
3. **Extracts metadata** from HTML `<title>` and `<meta name="description">`
4. **Applies filters** via env vars:
   - `SEO_SITEMAP_INCLUDE="/*.html,/blog/*"` — Only include matching paths
   - `SEO_SITEMAP_EXCLUDE="/drafts/*,/tmp-e2e/*"` — Exclude matching paths
5. **Falls back** to defaults (`/index.html`, `/agent.html`) if no pages found
6. **Optional caching** to `agent/artifacts/status.json` via `SEO_SITEMAP_CACHE=1`
7. Returns deduplicated list with path, title, desc metadata

**Request**: None (uses auto-discovered pages from sitemap/filesystem)

**Response**:
```json
{
  "generated_at": "2025-10-08T18:30:00.123456+00:00",
  "mode": "heuristic",
  "inputs": {
    "analytics": "underperformers",
    "source": "sitemap|defaults"
  },
  "items": [
    {
      "page": "/",
      "title": "SiteAgent — Autonomous Portfolio Agent",
      "desc": "Self-maintaining portfolio builder...",
      "keywords": [
        {
          "term": "AI portfolio automation",
          "score": 0.96,
          "trend": 85
        },
        {
          "term": "autonomous website builder",
          "score": 0.94,
          "trend": 92
        }
      ]
    }
  ],
  "integrity": {
    "algo": "sha256",
    "value": "7f8d9e1c...",
    "size": "1456"
  }
}
```

**Artifacts Written**:
- `agent_artifacts/seo-keywords.json` — Full report with integrity
- `agent_artifacts/seo-keywords.md` — Human-readable report

**Mode Selection**:
- `SEO_LLM_ENABLED=1` — LLM-powered keyword extraction (high quality)
- `SEO_LLM_ENABLED=0` — Heuristic extraction (fast, rule-based)

**CTR Bias**: Pages with CTR < 2% receive +15% confidence boost for broader keyword exploration.

**Ranking**: Combines confidence (0-1) × trend interest (0-100) for effectiveness scoring.

### GET /agent/seo/keywords
**Purpose**: Fetch the most recently generated keyword intelligence report.

**Authentication**: Public (no auth required).

**Response**: Same as POST response above.

**Error**: Returns 404 if no report exists. Run POST first to generate.

### POST /agent/seo/keywords/mock (Test-only)
**Purpose**: Instantly writes deterministic mock seo-keywords artifacts for fast CI verification.

**Guarded by**: `ALLOW_TEST_ROUTES=1` (disable in production)

**Authentication**: Requires Cloudflare Access or dev bearer token.

**Request**: None

**Response**:
```json
{
  "ok": true,
  "artifacts": [
    {
      "file": "./agent_artifacts/seo-keywords.json",
      "type": "json",
      "integrity": {
        "algo": "sha256",
        "value": "56050ce087...",
        "size": "951"
      }
    },
    {
      "file": "./agent_artifacts/seo-keywords.md",
      "type": "markdown"
    }
  ],
  "payload": {
    "generated_at": "2025-10-08T18:13:13+00:00",
    "mode": "mock",
    "items": [
      {
        "page": "/index.html",
        "title": "SiteAgent — Leo Klemet",
        "keywords": [...]
      }
    ],
    "integrity": {...}
  }
}
```

**Artifacts**: Always writes 2 pages (`/index.html`, `/agent.html`) with 5 deterministic keywords each.

**Use Case**: Fast E2E tests that need keyword artifacts without waiting for real extraction or LLM calls. Runtime ~500ms vs ~3s for full heuristic.

### GET /agent/seo/keywords/mock (Test-only)
**Purpose**: Fetch the most recently generated mock keyword report.

**Response**: Same structure as POST `/agent/seo/keywords` (KeywordsReport with mode="mock").

**Error**: Returns 404 if no mock artifacts exist.

---

## SEO JSON-LD

### POST /agent/seo/ld/generate
**Purpose**: Generate JSON-LD structured data for a URL with validation.

**Request**:
```json
{
  "url": "https://example.com/projects/ledgermind",
  "types": ["WebPage", "WebSite", "BreadcrumbList", "Person", "Organization", "CreativeWork"],
  "dry_run": true
}
```

**Response**:
```json
{
  "jsonld": [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Leo Klemet — SiteAgent",
      "url": "https://example.com",
      "logo": "https://example.com/assets/logo.png"
    },
    {
      "@context": "https://schema.org",
      "@type": "Person",
      "name": "Leo Klemet",
      "url": "https://example.com",
      "sameAs": ["https://www.linkedin.com/in/leo-klemet/"]
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "url": "https://example.com",
      "name": "Leo Klemet — SiteAgent",
      "inLanguage": "en",
      "publisher": {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": "Leo Klemet"
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://example.com"},
        {"@type": "ListItem", "position": 2, "name": "Projects", "item": "https://example.com/projects"},
        {"@type": "ListItem", "position": 3, "name": "Ledgermind", "item": "https://example.com/projects/ledgermind"}
      ]
    },
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "url": "https://example.com/projects/ledgermind",
      "name": "ledgermind — Leo Klemet — SiteAgent",
      "description": "Self-updating portfolio powered by SiteAgent.",
      "isPartOf": {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "url": "https://example.com",
        "name": "Leo Klemet — SiteAgent"
      },
      "primaryImageOfPage": {
        "@type": "ImageObject",
        "url": "https://example.com/assets/logo.png"
      },
      "breadcrumb": {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [...]
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      "name": "ledgermind — Leo Klemet — SiteAgent",
      "url": "https://example.com/projects/ledgermind",
      "description": "Self-updating portfolio powered by SiteAgent.",
      "image": ["https://example.com/assets/logo.png"],
      "author": {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": "Leo Klemet"
      },
      "datePublished": "2025-10-08T18:30:00Z"
    }
  ],
  "report": {
    "count": 6,
    "errors": [],
    "warnings": []
  },
  "artifacts": {
    "json": "agent/artifacts/seo-ld/<slug>/2025-10-08T123456Z.jsonld",
    "report": "agent/artifacts/seo-ld/<slug>/2025-10-08T123456Z.report.json"
  }
}
```

**Parameters**:
- `url` (required): Page URL to generate JSON-LD for
- `types` (optional): Array of schema.org types to generate. Available types:
  - `WebSite` - Main website entity
  - `WebPage` - Individual page
  - `BreadcrumbList` - Navigation breadcrumbs
  - `Person` - Person entity (author, publisher)
  - `Organization` - Organization/brand entity
  - `CreativeWork` - Creative work (for project pages)
  - `Article` - Article content (for blog/content pages)
  - `ImageObject` - Images with metadata
  - `VideoObject` - Videos with metadata
  - Defaults to `["WebPage", "WebSite"]`
- `dry_run` (optional): If `true`, validates but doesn't write artifacts (default: `true`)

**Behavior**:
- Intelligently generates JSON-LD based on URL patterns (projects vs articles)
- Validates generated JSON-LD against schema.org requirements
- Returns validation report with errors and warnings
- When `dry_run: false`, writes artifacts to `agent/artifacts/seo-ld/`
- Currently produces minimal stub data; replace with actual metadata extraction

**Feature flags**:
- `SEO_LD_ENABLED=1` (required)
- `SEO_LD_TYPES` (allowlist of valid @type values)

### POST /agent/seo/ld/validate
**Purpose**: Validate JSON-LD structure and schema compliance.

**Request**:
```json
{
  "jsonld": {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "url": "https://example.com",
    "name": "Test Page"
  }
}
```

Or validate multiple objects:
```json
{
  "jsonld": [
    { "@context": "https://schema.org", "@type": "WebSite", "url": "...", "name": "..." },
    { "@context": "https://schema.org", "@type": "WebPage", "url": "...", "name": "..." }
  ]
}
```

**Response**:
```json
{
  "count": 1,
  "errors": [],
  "warnings": []
}
```

**Validation checks**:
- `@context` must be `https://schema.org`
- `@type` must be present and in allowlist (if configured)
- No duplicate `@id` values
- Schema-specific field validation for known types
- Date fields must be ISO-8601 format

**Errors vs Warnings**:
- **Errors**: Structural issues (missing required fields, invalid format)
- **Warnings**: Best practice violations (type not in allowlist, date format suggestions)

**Strict mode**: When `SEO_LD_VALIDATE_STRICT=1`, returns HTTP 422 if errors are present.

### GET /agent/seo/ld/report?url=<url>
**Purpose**: Retrieve the latest JSON-LD and validation report for a URL.

**Request**: Query parameter `url` (exact URL used when generating artifacts)

**Response**:
```json
{
  "url": "https://example.com/page",
  "jsonld": [...],
  "report": {
    "url": "https://example.com/page",
    "count": 2,
    "errors": [],
    "warnings": []
  }
}
```

**Error**: Returns 404 if no artifacts exist for the URL.

### POST /agent/seo/ld/mock (Test-only)
**Purpose**: Fast artifact generator for E2E/CI (no external fetch).

**Guarded by**: `ALLOW_DEV_ROUTES=1` (disable in production)

**Request**:
```json
{
  "url": "https://example.com/"
}
```

**Response**: Same as `/generate` with `dry_run: false`, but instant execution.

**Use case**: Fast E2E tests that need JSON-LD artifacts without metadata extraction overhead.

---

### GET /agent/status/pages
**Purpose**: Return discovered pages from sitemap/filesystem with metadata (title, desc).

**Authentication**: None required (public endpoint).

**Response**:
```json
{
  "ok": true,
  "generated_at": "2025-10-08T18:54:06.141876+00:00",
  "count": 29,
  "integrity": {
    "algo": "sha256",
    "value": "3af0229d1b84e8a9...",
    "size": 3685
  },
  "pages": [
    {
      "path": "/index.html",
      "title": "Portfolio Home",
      "desc": "Welcome to my portfolio"
    },
    {
      "path": "/blog/post/index.html",
      "title": "Blog Post Title",
      "desc": "Post description"
    }
  ]
}
```

**Behavior**:
- Returns cached discovery from `agent/artifacts/status.json` if present
- Falls back to on-demand discovery via `discover_pages()`
- Writes cache for future requests
- Integrity checksum computed on compact JSON for validation

**Discovery Sources** (in order):
1. `sitemap.xml` from `public/`, `dist/`, or repo root
2. Filesystem scan for `*.html` files (3 levels deep)
3. Fallback to defaults (`/index.html`, `/agent.html`)

**Environment Variables** (affect discovery):
- `SEO_PUBLIC_DIRS`: Comma-separated paths to scan
- `SEO_SITEMAP_INCLUDE`: Include only matching globs
- `SEO_SITEMAP_EXCLUDE`: Exclude matching globs
- `SEO_SITEMAP_CACHE=1`: Auto-write cache on discovery

**Use Cases**:
- Dev overlay panel showing all pages
- Pre-flight validation of page coverage
- Debugging sitemap/filesystem discovery
- Cache warmup for other services

---

### GET /agent/status/open
**Purpose**: Dev-only route to view underlying HTML files for discovered pages. Guards against directory traversal.

**Authentication**: Requires `ALLOW_DEV_ROUTES=1` environment variable.

**Parameters**:
- `path` (required): Site-relative path (e.g., `/index.html`)
- `raw` (optional): If `1`, streams raw HTML; otherwise returns metadata JSON

**Response (Metadata mode, raw=0)**:
```json
{
  "ok": true,
  "abs_path": "D:\\leo-portfolio\\dist\\index.html",
  "size": 12345,
  "mtime": 1696789012.345,
  "hint_raw_url": "/agent/status/open?path=/index.html&raw=1"
}
```

**Response (Raw mode, raw=1)**:
- Content-Type: `text/html; charset=utf-8` (or `text/plain` for non-HTML files)
- Body: Raw file contents (size-capped at 2MB)
- Header: `X-Resolved-Path: <absolute_path>`

**Error Responses**:
- `403`: Dev routes are disabled (`ALLOW_DEV_ROUTES` not set)
- `400`: Path must be site-relative (start with `/`)
- `404`: File not found in public directories
- `413`: File too large for raw view (>2MB)

**Security**:
- Directory traversal protection: Validates resolved path is within configured public dirs
- Size limits: 2MB cap on raw file streaming
- Environment guard: Only accessible when `ALLOW_DEV_ROUTES=1`

**Use Cases**:
- Dev overlay "Open" action to view page HTML in new tab
- Copy absolute file path for local editing
- Debug page metadata extraction
- Verify which file serves a given URL path

**Example Requests**:
```bash
# Metadata (returns abs_path, size, mtime)
curl "http://127.0.0.1:8001/agent/status/open?path=/index.html"

# Raw HTML (opens in browser)
curl "http://127.0.0.1:8001/agent/status/open?path=/index.html&raw=1"

# Copy absolute path
curl -s "http://127.0.0.1:8001/agent/status/open?path=/blog/post/index.html" | jq -r '.abs_path'
```

---

## SEO SERP / Indexing

### POST /agent/seo/serp/fetch
**Purpose**: Fetch Search Console data (or mock) for a date range and write artifacts.

**Request**:
```json
{
  "start_date": "2025-10-07",
  "end_date": "2025-10-08",
  "property_url": "https://leok974.github.io/leo-portfolio/",
  "limit": 200,
  "dry_run": true
}
```

**Parameters**:
- `start_date` (optional): YYYY-MM-DD format (defaults to yesterday)
- `end_date` (optional): YYYY-MM-DD format (defaults to today)
- `property_url` (optional): GSC property URL (defaults to `GSC_PROPERTY` env var)
- `limit` (optional): Max rows to return (default: 200)
- `dry_run` (optional): If `false`, writes artifacts to `agent/artifacts/seo-serp/` (default: `true`)

**Response**:
```json
{
  "rows": [
    {
      "date": "2025-10-08",
      "page": "https://leok974.github.io/leo-portfolio/",
      "clicks": 45,
      "impressions": 1200,
      "ctr": 0.0375,
      "position": 8.5
    }
  ],
  "report": {
    "source": "gsc",
    "property": "https://leok974.github.io/leo-portfolio/"
  },
  "artifacts": {
    "jsonl": "agent/artifacts/seo-serp/2025-10-08/gsc.jsonl",
    "summary": "agent/artifacts/seo-serp/2025-10-08/summary.json"
  }
}
```

**Behavior**:
- When `GSC_PROPERTY` and service account credentials are configured, fetches real Google Search Console data
- Falls back to mock data if credentials missing or not configured
- Mock data includes stable test data with one low-CTR anomaly for testing
- When `dry_run: false`, writes JSONL artifacts for downstream analysis

**Required Environment Variables** (for real GSC):
- `GSC_PROPERTY`: Full property URL (e.g., `https://leok974.github.io/leo-portfolio/`)
- `GSC_SA_JSON`: Service account JSON as string OR
- `GSC_SA_FILE`: Path to service account JSON file

### POST /agent/seo/serp/analyze
**Purpose**: Analyze SERP data for CTR anomalies and performance issues.

**Request**:
```json
{
  "rows": [
    {
      "date": "2025-10-08",
      "page": "https://example.com/page",
      "clicks": 2,
      "impressions": 500,
      "ctr": 0.004,
      "position": 35.0
    }
  ],
  "min_impressions": 50,
  "low_ctr_factor": 0.5
}
```

**Parameters**:
- `rows` (required): Array of SERP data (from `/fetch` or manual input)
- `min_impressions` (optional): Minimum impressions to consider for analysis (default: 50)
- `low_ctr_factor` (optional): Flag pages with CTR < (factor × median CTR) (default: 0.5)

**Response**:
```json
{
  "median_ctr": 0.045,
  "total_pages": 5,
  "anomalies": [
    {
      "page": "https://example.com/page",
      "impressions": 500,
      "ctr": 0.004,
      "position": 35.0,
      "prev_ctr": 0.025,
      "delta_ctr": -0.021,
      "reasons": [
        "ctr<0.5×median (0.004 < 0.023)",
        "ctr drop vs prev (0.004 < 0.5×0.025)"
      ],
      "suggestions": [
        "Run seo.rewrite on H1/description.",
        "Validate JSON-LD types for this route.",
        "Check internal links/anchor text.",
        "Consider new thumbnail/OG image test."
      ]
    }
  ]
}
```

**Analysis Logic**:
- Calculates median CTR across all pages with sufficient impressions
- Flags pages with CTR significantly below median
- Compares with previous day's data (if available) to detect CTR drops
- Provides actionable suggestions for each anomaly

### GET /agent/seo/serp/report?day=YYYY-MM-DD
**Purpose**: Retrieve latest or specific day's SERP analysis with anomalies.

**Request**: Query parameter `day` (optional, defaults to latest available)

**Response**:
```json
{
  "day": "2025-10-08",
  "count": 5,
  "summary": {
    "window": {"start": "2025-10-07", "end": "2025-10-08"},
    "fetched": 5,
    "source": "gsc"
  },
  "analysis": {
    "median_ctr": 0.045,
    "total_pages": 5,
    "anomalies": [...]
  }
}
```

**Error**: Returns 404 if no artifacts exist for requested day.

### POST /agent/seo/serp/ping-sitemaps
**Purpose**: Ping Google and Bing to notify of sitemap updates.

**Request**:
```json
{
  "sitemap_urls": [
    "https://leok974.github.io/leo-portfolio/sitemap.xml"
  ],
  "dry_run": true
}
```

**Parameters**:
- `sitemap_urls` (required): Array of full sitemap URLs to ping
- `dry_run` (optional): If `false`, actually performs HTTP requests (default: `true`)

**Response**:
```json
{
  "targets": [
    "https://www.google.com/ping?sitemap=https://leok974.github.io/leo-portfolio/sitemap.xml",
    "https://www.bing.com/ping?sitemap=https://leok974.github.io/leo-portfolio/sitemap.xml"
  ],
  "performed": false
}
```

**Behavior**:
- Safe by default: `dry_run: true` only returns ping URLs without making requests
- When `dry_run: false`, fires-and-forgets HTTP requests to search engines
- Use after sitemap regeneration or significant content updates

### POST /agent/seo/serp/mock/populate (Test-only)
**Purpose**: Generate mock SERP artifacts for testing and CI.

**Guarded by**: `ALLOW_DEV_ROUTES=1` (disable in production)

**Request**:
```json
{
  "days": 2
}
```

**Response**:
```json
{
  "ok": true,
  "days": 3
}
```

**Behavior**:
- Creates `days + 1` worth of mock artifacts (specified days back + today)
- Generates stable mock data with one intentional low-CTR anomaly
- Writes to `agent/artifacts/seo-serp/<date>/` for testing report endpoints
- Used by E2E tests to verify anomaly detection without real GSC data

---

## Agent Telemetry & Behavior

### POST /agent/metrics/ingest
**Purpose**: Accept anonymous section-level analytics events from frontend.

**Request**:
```json
{
  "events": [
    {
      "session_id": "abc12345",
      "visitor_id": "v1234567",
      "section": "projects",
      "event_type": "view",
      "ts": "2025-10-08T12:00:00Z",
      "viewport_pct": 0.8
    },
    {
      "session_id": "abc12345",
      "visitor_id": "v1234567",
      "section": "projects",
      "event_type": "click",
      "ts": "2025-10-08T12:00:01Z"
    },
    {
      "session_id": "abc12345",
      "visitor_id": "v1234567",
      "section": "about",
      "event_type": "dwell",
      "ts": "2025-10-08T12:00:05Z",
      "dwell_ms": 4500
    }
  ]
}
```

**Event Types**:
- `view`: Section entered viewport
- `click`: User clicked within section
- `dwell`: Section left viewport (includes time spent)

**Response**:
```json
{ "ok": true, "count": 3 }
```

**Notes**:
- `visitor_id` is client-generated (no PII)
- Origin allowlist enforced via `ANALYTICS_ORIGIN_ALLOWLIST` setting
- Events stored as JSONL in `./data/analytics/events-YYYYMMDD.jsonl`

### POST /agent/analyze/behavior
**Purpose**: Analyze recent events (last 14 days), compute per-section weights, and return optimal ordering.

**Response**:
```json
{
  "updated": "2025-10-08T12:30:00Z",
  "weights": {
    "projects": { "weight": 0.85 },
    "about": { "weight": 0.72 },
    "skills": { "weight": 0.68 },
    "contact": { "weight": 0.45 }
  },
  "order": ["projects", "about", "skills", "hero", "contact"]
}
```

**Algorithm**:
- Computes CTR (clicks/views) and average dwell time per section
- Normalizes metrics, combines with 60/40 weight (CTR/dwell)
- Applies EMA smoothing with configurable alpha
- Applies time decay to gradually regress to baseline
- Adds epsilon-greedy exploration (randomly swaps 2 sections)

**Configuration**:
- `LEARNING_EPSILON`: Exploration probability (default: 0.10)
- `LEARNING_DECAY`: Daily decay factor (default: 0.98)
- `LEARNING_EMA_ALPHA`: EMA smoothing (default: 0.30)

### GET /agent/layout
**Purpose**: Return current learned section ordering (no exploration, deterministic).

**Response**:
```json
{
  "order": ["projects", "about", "skills", "hero", "contact"],
  "weights": {
    "projects": { "weight": 0.85 },
    "about": { "weight": 0.72 }
  }
}
```

**Usage**:
- Call on page load to apply learned layout
- Frontend script `apply-learned-layout.js` reorders sections automatically

---

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
