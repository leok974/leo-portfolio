# assistant.ledger-mind.org Domain Cleanup Checklist

## Context
Follow-up to PR #14. The domain `assistant.ledger-mind.org` never existed and caused 502 errors. Need to update documentation and examples to use correct domains.

## Correct Domains
- **Frontend**: `www.leoklemet.com` (public site)
- **Backend (public)**: `api.leoklemet.com` (direct API access)
- **Backend (internal)**: `portfolio-api.int:8000` (Docker network alias)

## Files to Update

### High Priority (User-Facing Docs)
- [ ] `README.md` - Update all examples
  - Cloudflare Access examples (lines 448-467)
  - Admin endpoint examples (lines 527-539)
  - Agent endpoint example (line 558)
  - SiteAgent endpoint (line 607)
  - CI examples (line 627)
  - Smoke test URL (line 939)
  - Public smoke reference (line 1270)

- [ ] `docs/DEPLOY.md` - Update deployment instructions
  - Remove unified host section (lines 517-587)
  - Update CORS examples (lines 729-733)
  - Update tunnel examples (lines 959-1029)
  - Update test commands (line 987, 1022)

- [ ] `docs/SECURITY.md` - Update CSP examples
  - connect-src directive (lines 51, 61)

- [ ] `docs/ARCHITECTURE.md` - Update architecture diagrams
  - Replace with internal alias for Docker network diagrams
  - Use api.leoklemet.com for public access flows

- [ ] `docs/API.md` - Update API endpoint examples
  - Base URL examples
  - curl command examples

### Medium Priority (Deployment Configs)
- [ ] `.github/workflows/portfolio.yml` - Update env vars (lines 113-114)
- [ ] `.github/workflows/public-smoke.yml` - Update test URL (line 30, 43)
- [ ] `.github/workflows/e2e.yml` - Update SITE_BASE_URL (line 151)
- [ ] `.github/workflows/orchestrator-nightly.yml` - Update defaults (line 18, 20)

- [ ] `deploy/nginx.portfolio.conf` - REMOVE or UPDATE entire file
  - This config still has assistant.ledger-mind.org as server_name
  - Likely not in use (portfolio-dev.conf is active)
  - **Action**: Delete or update to be a template

- [ ] `deploy/nginx.assistant.conf` - DELETE
  - Config for non-existent domain
  - Not referenced anywhere

- [ ] `deploy/nginx.assistant-server.conf` - DELETE
  - Another config for non-existent domain

- [ ] `apps/portfolio-ui/.env.production` - Already updated ✅
  - VITE_SITE_ORIGIN uses assistant domain but this is a legacy comment

### Low Priority (Historical Docs)
- [ ] `docs/DEVELOPMENT.md` - Update test command examples (line 583, 974)
- [ ] `docs/CHANGELOG.md` - Update historical entries (line 261)
- [ ] `CHANGELOG.md` - Update recent entries (lines 129, 160, 165)

- [ ] All `*_COMPLETE.md` files - Add historical note
  - Add banner: "⚠️ Historical doc: References `assistant.ledger-mind.org` which never existed. Use `www.leoklemet.com` or `api.leoklemet.com`."

- [ ] Deployment guides - Update or archive
  - `DEPLOY_TO_CLOUDFLARE.md`
  - `DEPLOY_TO_SERVER.md`
  - `DEPLOY_IMAGE.md`
  - `DEPLOY_WITHOUT_SSH.md`
  - `PRODUCTION_DEPLOYMENT_GUIDE.md`
  - `PRODUCTION_SETUP_COMPLETE.md`
  - Many others...

## Replacement Rules

### Direct API Access
```bash
# Old (broken)
curl https://assistant.ledger-mind.org/api/ready

# New (correct)
curl https://api.leoklemet.com/api/ready
```

### Same-Origin Proxy
```bash
# Old (broken)
curl https://assistant.ledger-mind.org/api/ready

# New (correct - via nginx proxy)
curl https://www.leoklemet.com/api/ready
```

### Internal Docker Network
```nginx
# Old (broken)
proxy_pass https://assistant.ledger-mind.org/api/;

# New (correct)
proxy_pass http://portfolio-api.int:8000/api/;
```

### CORS Configuration
```bash
# Old
ALLOWED_ORIGINS=https://assistant.ledger-mind.org

# New
ALLOWED_ORIGINS=https://www.leoklemet.com,https://api.leoklemet.com
```

### CSP Headers
```nginx
# Old
connect-src 'self' https://assistant.ledger-mind.org;

# New
connect-src 'self' https://api.leoklemet.com;
```

## Search Commands
```powershell
# Find all references
rg "assistant\.ledger-mind\.org" -g "!.git" -g "!node_modules"

# Count by file type
rg "assistant\.ledger-mind\.org" -g "*.md" --count-matches
rg "assistant\.ledger-mind\.org" -g "*.yml" --count-matches
rg "assistant\.ledger-mind\.org" -g "*.conf" --count-matches
```

## PR Checklist
- [ ] Create branch `chore/assistant-domain-cleanup` from main
- [ ] Update high-priority files (README, DEPLOY, SECURITY, ARCHITECTURE, API)
- [ ] Update medium-priority files (workflows, nginx configs)
- [ ] Delete obsolete nginx configs
- [ ] Add historical notes to completion docs
- [ ] Commit with message: `chore: replace assistant.ledger-mind.org with correct domains`
- [ ] Create PR referencing this checklist
- [ ] Close `ASSISTANT_DOMAIN_CLEANUP_SUMMARY.md` when done

## Notes
- ~600 total references found (see `ASSISTANT_DOMAIN_CLEANUP_SUMMARY.md`)
- Most are in historical documentation
- Focus on user-facing docs and active configs
- Archive old deployment guides rather than updating them
