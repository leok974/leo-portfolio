# Copilot Documentation Instructions

## General Rule
Always add, update, or extend Markdown docs whenever code changes could affect setup, usage, or architecture.  
Docs are a **first-class deliverable** alongside code.

## Files to Maintain
- **README.md** – top-level project overview, setup, run instructions, key features.
- **docs/** – place detailed guides here:
  - `ARCHITECTURE.md` – describe backend, frontend, services, how they connect.
  - `DEPLOY.md` – how to deploy (local Docker, full-stack compose, GitHub Pages, etc.).
  - `DEVELOPMENT.md` – how to run in dev (uvicorn, Docker, WSL, etc.).
  - `SECURITY.md` – hardening notes (non-root user, headers, etc.).
  - `CHANGELOG.md` – summarize meaningful updates (semantic version style).
- **CONTRIBUTING.md** – how to submit changes, run tests, style guidelines.

## Writing Style
- Clear, concise, beginner-friendly where possible.
- Use **code blocks** for commands.
- Use **checklists** for setup steps.
- Always include **service URLs** for health checks (e.g., `/ready`, `/status/summary`).

## Context to Capture
- Environment setup (Python, venv, Docker).
- Any required secrets (API keys) and how they are loaded (never commit secrets).
- Backend endpoints (`/chat`, `/chat/stream`, `/llm/*`, `/api/rag/query`).
- Frontend integration (assistant dock, status pill).
- Deployment flows (GitHub Pages for frontend, Docker Compose for backend).

## Special Instructions
- When adding new endpoints → update `README.md` **and** `docs/API.md`.
- When adding new services in Docker → update `docker-compose.*.yml` section in `DEPLOY.md`.
- When security hardening (non-root, CORS, etc.) → update `SECURITY.md`.
- When tests added → mention in `DEVELOPMENT.md`.
- Always update `CHANGELOG.md` with short summaries.
