# Architecture

> Draft – initial scaffold. Expand with diagrams (Mermaid) and sequence flows.

## Overview
A hybrid AI assistant platform consisting of:
- Frontend: static site (GitHub Pages or nginx container) + assistant dock JS components.
- Edge Proxy (optional): nginx consolidating static + API + SSE streaming.
- Backend: FastAPI service exposing chat, RAG query, health/metrics, and LLM diagnostics.
- Model Host: Ollama container (primary) with automatic fallback to OpenAI-compatible API.
- RAG Store: SQLite (`data/rag.sqlite`) + embeddings (OpenAI or local model) accessed via lightweight query endpoint.

## Data Flow
```
User Browser -> (Edge nginx) -> Backend FastAPI -> (Primary: Ollama / Fallback: OpenAI)
                                 |                
                                 +--> RAG (SQLite embeddings)
```

### Chat (Streaming)
1. Browser POST /chat/stream (SSE)
2. Edge proxies to backend `/chat/stream` (proxy_buffering off)
3. Backend chooses provider: primary (Ollama) unless disabled/unhealthy, else fallback
4. Tokens streamed as `data:` events; a final `meta` event includes provider stats

### RAG Query
1. Browser (or backend internal) POST `/api/rag/query` with `{question,k}`
2. Backend runs embedding → vector similarity in SQLite
3. Returns matched chunks + source metadata
4. Chat pipeline can prepend context (future augmentation)

### Health & Metrics
- `/ready` – readiness / dependency check (DB + provider reachability)
- `/status/summary` – aggregate model presence & fallback state
- `/metrics` – rolling counts (requests, 5xx, token in/out, p95 latency, provider distribution)

## Deployment Modes
| Mode | Components | Notes |
|------|------------|-------|
| Local Dev | Backend + Ollama + static served by `run_web.bat` or Live Server | Fast iteration; no edge |
| Full Compose | `ollama`, `backend`, `frontend`, `edge` | Simulates production routing |
| GitHub Pages + Backend | Frontend on Pages, backend + edge on a VPS | CORS allowlist must include Pages domain |

## Key Resilience Mechanisms
- Automatic fallback if primary model errors / unreachable
- Rolling latency probe endpoint `/llm/primary/latency`
- Explicit deprecation notice on legacy `chat-latency` endpoint
- Health classification used for readiness gating

## Security & Isolation
- Backend runs as non-root `appuser` UID 1001
- Secrets injected via Docker secrets (`openai_api_key`) or env
- CORS restricted to configured allowlist
- SSE route disables buffering to avoid head-of-line blocking

## Future Enhancements (TODO)
- Add rate limiting at edge layer (limit_req)
- Expand RAG ingestion pipeline & incremental update path
- Structured logging with request IDs propagated via headers
- Multi-model routing (policy based on cost/perf)

