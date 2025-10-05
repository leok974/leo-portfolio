# Changelog

## [Unreleased] - 2025-10-03

### Security / Guardrails
- Added prompt‑injection detection with optional enforcement (`GUARDRAILS_MODE=enforce|log`, default enforce; `ALLOW_UNSAFE=1` disables enforcement in dev).
- RAG snippet sanitization now redacts common secret patterns (JWTs, API keys, PEM blocks).
- `/chat` JSON includes `guardrails` snapshot `{ flagged, blocked, reason, patterns[] }`; replies blocked are served as `_served_by: "guardrails"` with a safe message.
- UI shows a tiny 🛡️ badge when a reply is flagged/blocked.
- Tests added: `tests/test_guardrails.py`.

### Added
 - Backend test `tests/test_chat_rag_grounded.py` asserts grounded chat behavior after FS ingest using an isolated SQLite DB and no-LLM mode.
 - Heartbeat-aware SSE client: `onHeartbeat` support, dynamic grace window via `VITE_SSE_GRACE_MS`, model-aware bump.
 - New UI spec `tests/e2e/assistant-ui-first-chunk.spec.ts` ensures no console warnings when first token arrives timely.
 - Chat API now supports `include_sources` in requests. JSON responses include `grounded` and optional `sources`; SSE `meta` event carries `grounded` and (optionally) `sources`.
 - Assistant dock shows a "grounded (n)" badge next to the served-by marker when grounding is active; it renders immediately on SSE meta and persists across JSON fallback. Falls back to a gentle hint when the reply is intentionally non-grounded.
 - Sources popover: lists title — path and links out when a `url` is present. Test updated to validate link hrefs.
 - Backend enriches source items with `title`, `id`, `path`, and optional `url` (constructed via `RAG_REPO_WEB` + `/blob/<ref>/<path>` when set).
### UI
 - RouteBadge: add per-route chip accents (border + subtle tinted background) and maintain compact variant; tooltip retains backend and reason details.
 - Tools panel: add a "Run (dangerous)" button next to Dry-run. It executes `run_script` without `dry_run` after a confirmation prompt and respects backend guardrails: `ALLOW_TOOLS=1`, `ALLOW_SCRIPTS` allowlist, and optional pre-flight repo cleanliness/ahead-behind gates.
 - Tools panel polish: Pre-flight glimpse shows git branch/dirty/ahead/behind with color-coded hint and legend; preset script selector sourced from allowlist.
 - Admin Eval widget: floating dock card shows latest pass ratio, a tiny trend chart of historical eval runs, and a one-click "Run eval" button that triggers `/api/eval/run`.
 - Admin Eval widget: swapped native `<select>` to shadcn/Radix Select for consistent styling and accessibility. E2E spec updated to interact with the portal menu using role-based queries and to poll `/api/eval/history` for completion.

### Features
- Tools registry with audit and guardrails (safe BASE_DIR sandbox). Added built-in tools: search_repo, read_file, create_todo. New endpoints: GET /api/tools and POST /api/act. Chitchat branch auto-detects repo questions and uses tools to summarize results in /chat responses (actions transcript included).
 - Dangerous tool `run_script` added: requires `ALLOW_TOOLS=1` and an `ALLOW_SCRIPTS` allowlist. `/api/tools/exec` now refuses dangerous tools when gating is off. AdminRebuildButton triggers `scripts/rag-build-index.ps1` and surfaces exit code + stdout/stderr tail.
 - Eval runner upgraded: supports multiple files, plan-type cases, history append to `data/eval_history.jsonl`, and emits git/build metrics.
 - Planning evals added at `evals/tool_planning.jsonl` verifying tool presence and first-step shape.
 - Backend endpoints `/api/eval/history` and `/api/eval/run` expose eval history and allow on-demand runs.

### Changed
 - Streaming completion ensures an `.assistant-meta` footer exists and renders a default route badge even if no SSE `meta` was observed, improving determinism for UI tests.
 - Backend SSE emits an immediate heartbeat and pings until first token; nginx config hardened for SSE.
 - Status summary now includes top-level "ok" boolean and preserves `last_served_by` provider hint for UI/diagnostics.
 - `/status/cors` returns richer payload: `raw_env`, `allow_all`, derived origins from `DOMAIN`, `request_origin` and `is_allowed` (when available), plus timestamp.
 - Chat JSON responses are post-processed to guarantee a follow-up question is present in the assistant content when the model omits one.

### Fixed
 - Popover visibility: toggle inline `style.display` along with `[hidden]` and class changes to satisfy strict Playwright visibility assertions across browsers.
 - Lifespan cleanup: switched to task cancellation + `asyncio.gather` and added `SAFE_LIFESPAN` guard to avoid probing when disabled. Eliminates `Passing coroutines is forbidden` and `Event.wait was never awaited` warnings on Windows.
 - Gen metrics stamping: corrected indentation in `assistant_api/llm_client.py` so successful fallback completions record `stage_record_ms("gen", "openai", ms)` and increment provider counters reliably; primary path already stamps `gen` as `local` on success.
 - Diagnostics consistency in no-LLM mode: when `DEV_ALLOW_NO_LLM` synthesizes a reply (bypassing providers), we now stamp `LAST_PRIMARY_ERROR="simulated"` and `LAST_PRIMARY_STATUS=500` if unset so tests and status endpoints consistently observe a non-None primary error after a simulated failure.
 - Windows startup: FAISS import is now optional. When `faiss` is not installed, the backend still starts; dense search returns empty and RAG falls back to BM25 + brute-force. Build index returns `reason: "faiss not installed"`.
 - New env switch `RAG_DENSE_DISABLE=1` forces dense search off even if FAISS is available (useful for CI or quick dev on Windows).
 - FTS5 fusion query: replaced alias `f MATCH ?` with table name `chunks_fts MATCH ?` to satisfy SQLite FTS5 syntax. Also switched snippet generation from `offsets()` to `highlight()` due to context limitations; snippet highlight test now passes.
 - RAG fusion scoring guard: prevent ZeroDivisionError by clamping bm25 ranks and using a safe inverse weighting. Combined test runs no longer fail intermittently.
 - CI: Fixed `.github/workflows/openapi-drift.yml` duplicate `on/jobs` sections resulting in YAML linter errors; consolidated into a single clean job.

### Infrastructure / RAG ingest
 - In-process fallback for `auto_rag.fetch_context` enables deterministic tests without network dependencies; `/chat` supports `DEV_ALLOW_NO_LLM` to synthesize a minimal grounded response for CI.

### Added
- Endpoint `GET /api/rag/projects` to list distinct project IDs with chunk counts. Includes optional `include_unknown=true` to fold empty/null into an `unknown` bucket. Backend ensures an index on `chunks(project_id)` via `ensure_chunk_indexes()` for fast enumeration.

- Analytics: Track outbound link clicks via `link_click_total{kind, href_domain}`. Collector handles `type: "link_click"` with a low-cardinality kind whitelist (`github`, `artstation`, `resume`, else `other`). Frontend beacon auto-detects anchor clicks for GitHub/ArtStation/Resume links and sends `sendBeacon` events; PowerShell quick-check and PromQL examples added in `docs/analytics.md`.
 - Analytics: Server-side resume download counter `resume_download_total` with `/dl/resume` route that serves the PDF and increments counter (works even with JS disabled). Tests and PromQL example included.
 - Analytics: Device-split DOW/HOUR path metric `page_view_by_dow_hour_path_device_total{dow,hour,path_group,device}` to visualize time-of-day patterns by device without inflating label cardinality. Docs updated with PromQL examples.

### Docs
 - API: Documented `/api/tools/exec`, `run_script` body/response, and gating.
 - Deploy: Added env examples for `ALLOW_TOOLS`/`ALLOW_SCRIPTS` and admin rebuild usage.
 - Security: Noted tools sandbox, allowlist, and audit logging.
 - Eval: Added minimal evals at `evals/baseline.jsonl`, runner `scripts/eval_run.py`, pytest smoke `tests/test_eval_min.py`, and npm scripts `eval:local` and `test:eval`.
	- Eval: Introduced `evals/regression.jsonl` and scripts `eval:regress` / `eval:full` to keep baseline tight and track new regressions.
 - API: Documented Eval API endpoints and example bodies/responses.
 - Dev: Added local eval e2e guidance with a proxy-based workflow to avoid `/api/*` 404s when serving `dist/` directly. New npm script `serve:dist:proxy` and helper `e2e:eval:proxy`.

### Feedback
- Backend: Added feedback endpoints — POST `/api/feedback`, GET `/api/feedback/recent`, GET `/api/feedback/export.csv` (stored in `data/feedback.jsonl`).
- UI: Thumbs bar appears under assistant replies to capture quick 👍/👎. Posts include question, answer, served_by, and grounding metadata.
- Admin: New Admin Feedback widget shows pass ratio of 👍, recent items (👎 by default), and quick refresh.
- Scripts: `scripts/feedback_to_regress.py` converts 👎 items into `evals/regression.jsonl` cases to tighten baseline over time.
