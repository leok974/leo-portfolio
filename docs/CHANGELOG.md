# Changelog

All notable changes to this project will be documented here.
Format: Keep / Semantic Versioning (MAJOR.MINOR.PATCH). Dates in ISO (YYYY-MM-DD).

## [0.2.0] - 2025-09-27
### Added
- Full-stack Docker Compose (`docker-compose.full.yml`) including frontend + edge proxy.
- Static-first `deploy/Dockerfile.frontend` with future Node build upgrade path.
- Edge nginx proxy config (SSE buffering off, CORS map, static caching).
- Documentation policy integration (`.github/copilot-instructions.*`).
- Architecture, Deploy, Development, Security, API, Changelog scaffolds in `docs/`.
- Docs Policy section appended to root `README.md`.

### Changed
- Backend Dockerfile slimmed (removed static asset copy).
- Build context size reduced via `.dockerignore` (2.28GB → ~6.8MB for frontend).

### Fixed
- Edge container restart loop due to malformed nginx.conf (removed stray diff markers).
- Frontend build failure (`COPY --from=build /app/dist`) replaced with static collector pattern.

## [0.1.0] - 2025-09-20
### Added
- Initial FastAPI backend with chat, streaming, RAG query, health, metrics, diagnostics, latency probe endpoints.
- Ollama primary + OpenAI fallback provider logic.
- RAG SQLite store & ingestion scripts.
- Initial static portfolio frontend.

