---
title: PHASE 0.3.0
---

# Phase 0.3.0 — Docs & Release Polish

**Goal:** Ship a polished 0.3.0 that tightens security, diagrams, and CI/release, with measurable test coverage and a clean contributor path.

---

## ✅ Scope
- Architecture/Deploy diagrams (Mermaid + short topology)
- Security headers + rate limiting at edge (nginx)
- CI: tests + smoke + coverage gate + badges
- Pre-commit: ruff + pip-audit
- Release workflow (tag → artifacts; optional GHCR)
- API doc expansion (/metrics, /status/summary schemas)

---

## 📋 Checklist

### Diagrams & Docs
- [ ] Add **Chat Streaming** & **RAG Query** sequence diagrams to `docs/ARCHITECTURE.md`.
- [ ] Add **deployment topology** diagram to `docs/DEPLOY.md`.
- [ ] Expand `docs/API.md` with example responses for `/metrics` and `/status/summary`.

### Security & Hardening
- [ ] Add recommended **security headers** in edge nginx.
- [ ] Add **rate limiting** for `/chat` and `/chat/stream`.

### CI & Quality Gates
- [ ] Add **pytest coverage** gate (≥90% lines).
- [ ] Add **ruff** linting and **pip-audit** to CI.
- [ ] Add **smoke** job that runs `scripts/smoke.ps1` against dev server.
- [ ] Publish **coverage badge** and **CI status** in `README.md`.

### Tooling
- [ ] Introduce **pre-commit** with ruff + pip-audit.
- [ ] Document hooks in `docs/DEVELOPMENT.md`.

### Release
- [ ] `docs/CHANGELOG.md` → bump to **0.3.0** (Added/Changed/Fixed).
- [ ] Create **release workflow** (on tag push). Optional: build & push GHCR image.
- [ ] Tag & push: `git tag v0.3.0 && git push --tags`.

---

## ✅ Acceptance Criteria
- CI passes on PR with coverage ≥90% (fails below).
- Smoke job green on default settings.
- Edge serves security headers; `/chat/stream` rate-limited.
- Diagrams render in GitHub preview.
- API docs show example payloads for `/metrics` and `/status/summary`.

---

## 🔁 Rollback Plan
- Revert nginx changes via `deploy/edge/nginx.conf` prior revision.
- Disable CI gates by setting `COV_FAIL_UNDER=0` (temporary) or reverting CI workflow.
- Remove pre-commit by deleting `.pre-commit-config.yaml` & uninstalling hook.

---

## 📦 PR Template (copy into body)
- [ ] Diagrams updated (ARCHITECTURE, DEPLOY)
- [ ] Security headers + rate limits applied
- [ ] CI (tests/smoke/coverage/lint/audit) green
- [ ] Pre-commit documented/working
- [ ] CHANGELOG bumped → 0.3.0
