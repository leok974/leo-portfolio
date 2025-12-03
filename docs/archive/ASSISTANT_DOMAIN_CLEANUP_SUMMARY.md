# assistant.ledger-mind.org References Cleanup

## Context
The domain `assistant.ledger-mind.org` **never existed**. It was incorrectly configured in nginx and documentation, causing 502 Bad Gateway errors.

## Current Architecture (Correct)
- **Frontend**: `www.leoklemet.com` (via Cloudflare Tunnel → nginx)
- **Backend (public)**: `api.leoklemet.com` (via Cloudflare Tunnel → `portfolio-api.int:8000`)
- **Backend (internal)**: `portfolio-api.int:8000` (Docker network alias)
- **Same-origin proxy**: `www.leoklemet.com/api/` → `portfolio-api.int:8000/api/`

## Grep Results Summary
Found **~600 matches** for `assistant.ledger-mind.org` across the codebase:

### Critical Files (Fixed in this PR)
- ✅ `deploy/nginx.portfolio-dev.conf` - Changed to `portfolio-api.int:8000`
- ✅ `apps/portfolio-ui/.env.production` - `VITE_SITE_ORIGIN` now set correctly
- ✅ `cloudflared/config.yml` - Routes `api.leoklemet.com`, not assistant domain
- ✅ `deploy/docker-compose.full.yml` - Uses internal alias
- ✅ `deploy/docker-compose.portfolio-prod.yml` - Uses internal alias

### Documentation Files (Historical - Low Priority)
Most references are in documentation markdown files describing past deployment attempts:
- `docs/DEPLOY.md`, `docs/PRODUCTION_DEPLOYMENT.md`, `docs/BACKEND_DEPLOYMENT.md`
- `DEPLOY_TO_CLOUDFLARE.md`, `DEPLOY_TO_SERVER.md`, `DEPLOY_IMAGE.md`
- `PRODUCTION_DEPLOYMENT_CHECKLIST.md`, `NEXT_STEPS.md`
- `CLOUDFLARE_ACCESS_COMMANDS.md`, `CF_ACCESS_DEPLOYMENT_SUMMARY.md`
- Many `*_COMPLETE.md` files documenting historical implementations

### Active Nginx Configs (Needs Review)
- `deploy/nginx.portfolio.conf` - **Contains** `assistant.ledger-mind.org` as server_name and proxy targets
  - **Action**: This is an old production config, probably not in use
  - **Verify**: Check which nginx config is actually deployed
- `deploy/nginx.assistant.conf` - Dedicated config for assistant domain
  - **Action**: Can be deleted (domain doesn't exist)

### Active Workflow Files
- `.github/workflows/portfolio.yml` (lines 113-114)
- `.github/workflows/public-smoke.yml`
- `.github/workflows/e2e.yml`
- `.github/workflows/orchestrator-nightly.yml`
  - **Action**: Update environment variables to use `www.leoklemet.com` or `api.leoklemet.com`

### README.md
Multiple examples showing `assistant.ledger-mind.org`:
- Cloudflare Access examples
- Admin endpoint examples
- Agent endpoint examples
  - **Action**: Update to `www.leoklemet.com` or `api.leoklemet.com`

## Recommendation for This PR
**Keep PR focused** - Only include critical deployment files already fixed:
1. ✅ Docker compose files (network alias)
2. ✅ Cloudflared config (ingress routing)
3. ✅ Nginx portfolio-dev config (internal proxy)
4. ✅ .env.production (frontend config)
5. ✅ E2E test (api-ready.spec.ts)

**Defer to follow-up PR** - Documentation and example cleanup:
- Update all Markdown docs to reference new domains
- Update GitHub Actions workflows
- Update README examples
- Remove obsolete nginx configs (`nginx.assistant.conf`, `nginx.portfolio.conf`)

## Verification Commands (Post-Deployment)
```powershell
# Should work (new architecture)
curl -I https://www.leoklemet.com/api/ready       # same-origin proxy
curl -I https://api.leoklemet.com/api/ready       # direct backend

# Should NOT work (domains don't exist or aren't routed)
curl -I https://assistant.ledger-mind.org         # 503/530 (domain doesn't exist)
```

## Rollback Safety
If this breaks, revert to:
```env
VITE_BACKEND_ENABLED=0
```
And comment out nginx proxy blocks again.
