# Copilot Documentation Drafting Instructions

## Goal
When code changes, always **draft or update Markdown files** so context is captured.  
Drafts don’t need to be perfect prose — just structured, factual, and complete enough to hand off for polish.

## Required Draft Files
Copilot should **always create or update these**:

1. **README.md**
  - Project description (one-liner + purpose).
  - Quickstart (local run with `uvicorn` + Docker compose run).
  - Key features (chat dock, RAG, diagnostics).
  - Health endpoints (`/ready`, `/status/summary`).
  - Example commands (PowerShell + Docker).

2. **docs/ARCHITECTURE.md**
  - Diagram or outline of services:
    - Frontend (GitHub Pages / nginx).
    - Backend (FastAPI + Ollama/OpenAI fallback).
    - RAG system (SQLite + embeddings).
    - Edge proxy (nginx, optional).
  - Data flow (frontend → edge → backend → Ollama/OpenAI).
  - Deployment modes (local dev, full-stack compose, GitHub-hosted frontend).

3. **docs/DEPLOY.md**
  - Local dev instructions (uvicorn runner, tasks.ps1, WSL).
  - Docker compose full-stack usage.
  - Edge proxy config (SSE buffering off, /api/, /chat/stream).
  - GitHub Pages frontend hosting steps.
  - How to add a custom domain.

4. **docs/DEVELOPMENT.md**
  - Setting up venv (`python -m venv .venv`).
  - Dependency workflow (`requirements.in` → lock → update scripts).
  - Running tests (`pytest`).
  - Using `tasks.ps1` or `Makefile`.
  - Linting / audit workflows (pip-audit, CI jobs).
  - Notes on PowerShell quirks (uvicorn shutdowns).

5. **docs/SECURITY.md**
  - Running backend as non-root (`appuser` UID 1001).
  - CORS allowlist with origins.
  - Secure headers (optional).
  - TLS guidance (Let’s Encrypt with Cloudflare DNS-01).
  - Docker hardening (readOnlyRootFilesystem, SELinux/AppArmor).

6. **CHANGELOG.md**
  - Semantic version style (v0.1.0, v0.2.0).
  - Each entry: date, summary of changes (features, fixes, infra).
  - Copilot should append draft entries automatically.

7. **docs/API.md**
  - Document all endpoints:
    - `/chat`, `/chat/stream`
    - `/api/rag/query`
    - `/llm/*` (diag, models, latency, etc.)
    - `/status/summary`, `/ready`, `/metrics`
  - Include request/response examples (JSON snippets).
  - Note SSE behavior for `/chat/stream`.

## Drafting Guidelines
- Use **headings** and **lists** over long paragraphs.
- Include **code fences** for commands.
- Be explicit about file paths, ports, and service names.
- For drafts, it’s fine to include TODOs (I’ll refine later).
- Always append new info rather than overwrite important context.
