# SiteAgent Production Deployment Summary

**Date**: 2025-10-11 19:35 ET
**Git Branch**: main
**Git SHA**: 3534b64
**Tunnel**: applylens (Cloudflare Named Tunnel, remotely managed)

## Pre-Deployment State

### Git Status
- Branch: `main`
- Last 3 commits:
  - `3534b64` - fix(ci): add PyJWT and cryptography to requirements-ci.txt for auth routes
  - `69c866e` - fix(ci): add prometheus_client to requirements-ci.txt
  - `0388d46` - fix(ci): add numpy to requirements-ci.txt for rag_query imports

### Docker Environment
- Docker version: 28.3.0, build 38b7060
- Docker Compose version: v2.38.1-desktop.1

### Compose Configuration
- File: `deploy/docker-compose.yml`
- Name: `portfolio`
- Services: `backend`, `nginx`
- Network: `infra_net` (external)
- Backend alias: `portfolio.int` (for SiteAgent: `siteagent-api.int`)
- Nginx alias: `portfolio.int` (for SiteAgent UI: `siteagent-ui.int`)

### Environment Variables (from assistant_api/.env.prod)
Present keys:
- RAG_DB
- RAG_REPOS
- EMBED_MODEL_QUERY
- OPENAI_API_KEY
- OPENAI_BASE_URL
- OPENAI_MODEL
- PRIMARY_MODEL
- FALLBACK_BASE_URL
- FALLBACK_MODEL
- FALLBACK_API_KEY
- ALLOWED_ORIGINS
- ALLOW_DEV_ROUTES
- SEO_LD_ENABLED
- CF_ACCESS_TEAM_DOMAIN
- CF_ACCESS_AUD
- ACCESS_ALLOWED_EMAILS
- SITEAGENT_HMAC_SECRET

### Cloudflare Tunnel
- Container: `infra-cloudflared`
- Status: Up 4 hours
- Tunnel Name: `applylens`
- Expected Mappings:
  - `siteagents.app` → `http://siteagent-ui.int:80` (or `portfolio.int:80`)
  - `www.siteagents.app` → `http://siteagent-ui.int:80`
  - `api.siteagents.app` → `http://siteagent-api.int:8000`
  - `agent.siteagents.app` → `http://siteagent-api.int:8000`

---

## Deployment Steps

### Step 1: Pull & Build
