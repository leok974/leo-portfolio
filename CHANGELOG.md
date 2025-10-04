# Changelog

## [Unreleased] - 2025-10-03

### Added
- Hybrid retrieval: BM25 (SQLite FTS5) + dense (FAISS) with CrossEncoder rerank; falls back gracefully if indexes are missing.
- Per-batch embedding fallback during FAISS build: local SentenceTransformers first, then OpenAI batch if a local batch fails; controlled by `PREFER_LOCAL` and `EMBED_BATCH`.
- Stage metrics (embeddings, rerank, gen) with counts and last latency/backend; surfaced in `/api/ready`, `/api/metrics`, and `/api/metrics.csv`.
- `/api/metrics` (JSON) and `/api/metrics.csv` (CSV) endpoints for lightweight diagnostics and CI assertions.
- SAFE_LIFESPAN env toggle: skip model probe entirely during startup for fully resilient dev/CI boots.
- Lightweight `/api/ready` endpoint: fast RAG DB chunk check for scripts and CI smoke probes.
- Micro test `tests/test_grounded_fallback.py` to assert grounded JSON fallback behavior without contacting an LLM.
- `installFastUI` Playwright helper to block heavy assets, disable animations, and set deterministic viewport for frontend mocks.
- `fast-chromium` Playwright project plus `npm run test:fast` and `npm run test:changed` scripts for rapid local iterations.
- Assistant zero-token guardrails: frontend spec `tests/e2e/assistant-ui-fallback.spec.ts`, backend spec `tests/e2e/chat-stream-yields.spec.ts`, and npm script `test:assistant:fallback`.
- Assistant follow-up question validation: frontend spec `tests/e2e/assistant-ui-followup.spec.ts` checks that responses end with question marks to ensure conversational tone.
 - Backend test `tests/test_chat_rag_grounded.py` asserts grounded chat behavior after FS ingest using an isolated SQLite DB and no-LLM mode.
- CI workflow `frontend-fast.yml` runs `npm run test:fast` suite (6 tests in ~4s) with badge in README.
 - Heartbeat-aware SSE client: `onHeartbeat` support, dynamic grace window via `VITE_SSE_GRACE_MS`, model-aware bump.
 - New UI spec `tests/e2e/assistant-ui-first-chunk.spec.ts` ensures no console warnings when first token arrives timely.
 - Chat API now supports `include_sources` in requests. JSON responses include `grounded` and optional `sources`; SSE `meta` event carries `grounded` and (optionally) `sources`.
 - Assistant dock shows a "grounded (n)" badge next to the served-by marker when grounding is active; it renders immediately on SSE meta and persists across JSON fallback. Falls back to a gentle hint when the reply is intentionally non-grounded.
 - Sources popover: lists title — path and links out when a `url` is present. Test updated to validate link hrefs.
 - Backend enriches source items with `title`, `id`, `path`, and optional `url` (constructed via `RAG_REPO_WEB` + `/blob/<ref>/<path>` when set).

### Changed
- Assistant UI specs call `installFastUI(page)` alongside `mockReady` so mocked SSE flows stay backend-free by default.
- Documentation updates covering fast UI loops and new commands.
- Assistant dock now retries via `/api/chat` JSON when a stream finishes without emitting assistant tokens.
 - Backend SSE emits an immediate heartbeat and pings until first token; nginx config hardened for SSE.
 - Status summary now includes top-level "ok" boolean and preserves `last_served_by` provider hint for UI/diagnostics.
 - `/status/cors` returns richer payload: `raw_env`, `allow_all`, derived origins from `DOMAIN`, `request_origin` and `is_allowed` (when available), plus timestamp.
 - Chat JSON responses are post-processed to guarantee a follow-up question is present in the assistant content when the model omits one.

### Fixed
- Sources popover robustness: enforce singleton, hard-close on ESC with immediate hidden state, and remove from DOM to satisfy strict visibility checks.
- Prevent dock ESC handler from firing when popover consumes the event; avoid accidental dock close during popover interactions.
- Stabilized focus return to the grounding badge after popover close (ESC and outside-click) with multi-shot focus retries and pointer sequence handling.
 - Lifespan cleanup: switched to task cancellation + `asyncio.gather` and added `SAFE_LIFESPAN` guard to avoid probing when disabled. Eliminates `Passing coroutines is forbidden` and `Event.wait was never awaited` warnings on Windows.
 - Gen metrics stamping: corrected indentation in `assistant_api/llm_client.py` so successful fallback completions record `stage_record_ms("gen", "openai", ms)` and increment provider counters reliably; primary path already stamps `gen` as `local` on success.

### Infrastructure / RAG ingest
- Backend: Flexible /api/rag/ingest supports fs and git sources, plus dry_run preview and reset flag.
- Backend: Installed git in runtime image to enable git-based ingestion.
- Backend: SQLite connection uses WAL and busy_timeout to mitigate lock contention.
- Edge: Added explicit nginx mapping for /api/rag/ingest and preserved API proxy timeouts.
- Docs: API.md updated with ingest body schema and response examples.
 - In-process fallback for `auto_rag.fetch_context` enables deterministic tests without network dependencies; `/chat` supports `DEV_ALLOW_NO_LLM` to synthesize a minimal grounded response for CI.
- Index build script `scripts/rag-build-index.ps1` now ensures FTS schema, backfills docs→chunks, rebuilds FTS, and builds FAISS with per-batch fallback.
