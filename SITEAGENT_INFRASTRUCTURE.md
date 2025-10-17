# SiteAgent Infrastructure - Complete Setup

**Date**: October 15, 2025
**Status**: ✅ Infrastructure configured, tests created, automation ready
**Mode**: Approval-based auto-updates (switch to autonomous mode optional)

## Overview

Complete SiteAgent infrastructure for autonomous portfolio management:
- **Agent orchestration**: Multi-task pipelines (projects.sync, links.suggest, og.generate, etc.)
- **SEO Intelligence Loop**: Automated SEO optimization with LLM or heuristics
- **Content automation**: Link suggestions, OG image generation, media optimization
- **Dev overlay**: Cookie-based development tools
- **Nightly automation**: GitHub Actions workflow for hands-free updates

## 1. ✅ nginx Configuration

### Split Routing

**File**: `deploy/nginx.assistant.conf`

**Routes**:
- `/agent/*` → Backend (SSE/events support, 3600s timeout)
- `/chat` → Backend (streaming support)
- `/api/*` → Backend (standard API)
- `/` → Static portfolio (portfolio.int:80)

**Configuration** (already deployed):
```nginx
upstream portfolio_backend {
    server ai-finance-api.int:8000;
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name assistant.ledger-mind.org;

    # Agent endpoints (dev overlay, orchestration, events, artifacts)
    location /agent/ {
        proxy_pass http://portfolio_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Connection "";
        proxy_buffering off;          # SSE/stream
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # Chat & API
    location /chat { proxy_pass http://portfolio_backend; proxy_buffering off; }
    location /api/ { proxy_pass http://portfolio_backend; }

    # Static portfolio
    location / {
        proxy_pass http://portfolio.int:80;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

**Status**: ✅ Already configured and reloaded (Oct 15, 03:48:24)

## 2. ✅ Backend Environment

### SiteAgent Variables

**File**: `c:\ai-finance-agent-oss-clean\docker-compose.yml`

**Added Configuration**:
```yaml
environment:
  # Cookies & overlay
  COOKIE_DOMAIN: ".ledger-mind.org"
  COOKIE_SECURE: "1"
  COOKIE_SAMESITE: "lax"
  ALLOW_DEV_ROUTES: "1"
  SITEAGENT_DEV_COOKIE_KEY: "${SITEAGENT_DEV_COOKIE_KEY:-dev-secret-change-me}"

  # SEO Intelligence Loop
  SEO_LLM_ENABLED: "1"
  ANALYTICS_ENABLED: "1"
  # Optional: GSC_JSON: "/secrets/gsc.json"
  # Optional: GA4_JSON: "/secrets/ga4.json"

  # Content Automation
  SITE_BASE_URL: "https://assistant.ledger-mind.org"
  ALLOW_LINK_APPLY: "1"
  ALLOW_OG_GENERATE: "1"
  ALLOW_MEDIA_OPTIMIZE: "1"

  # RAG/Knowledge
  RAG_DB: "/app/data/rag.sqlite"

  # CORS (added assistant.ledger-mind.org)
  CORS_ALLOW_ORIGINS: "...,https://assistant.ledger-mind.org,..."
```

**Deployment**:
```bash
cd c:\ai-finance-agent-oss-clean
docker-compose up -d backend
# Output: Container ai-finance-backend-1 Started ✅
```

**Status**: ✅ Backend restarted with SiteAgent configuration (Oct 15, 00:01:49)

## 3. ✅ Smoke Tests

### Manual Smoke Test Script

**File**: `scripts/smoke-siteagent.ps1`

**Usage**:
```powershell
cd d:\leo-portfolio
.\scripts\smoke-siteagent.ps1
```

**Tests**:
1. **Dev overlay enable**: Sets `sa_dev` cookie
2. **Orchestrator status**: Verifies `/agent/status` endpoint
3. **Dry-run tasks**: Runs projects.sync, links.suggest, og.generate
4. **SEO tune**: Runs SEO intelligence loop
5. **Artifacts**: Lists generated artifacts
6. **Events stream**: Tests SSE endpoint

**Expected Output**:
```
=== SiteAgent Smoke Tests ===

[0] Dev overlay enable...
✅ Dev overlay cookie set: sa_dev=1

[1] Orchestrator status...
✅ Status: {"enabled":true,...}

[2] Dry-run task list...
✅ Run result: {"completed_tasks":[...]}

[3] SEO tune (dry-run)...
✅ SEO tune result: {"recommendations":[...]}

[4] Artifacts list...
✅ Artifacts (first 200 chars): ...

[5] Events stream (SSE)...
✅ SSE stream active: event: agent.task.start...

=== Smoke Tests Complete ===
```

### cURL Smoke Tests (Linux/macOS)

```bash
# 0) Dev overlay
curl -s -i -H "Authorization: Bearer dev" https://assistant.ledger-mind.org/agent/dev/enable | grep -i set-cookie

# 1) Status
curl -s https://assistant.ledger-mind.org/agent/status

# 2) Dry-run tasks
curl -s -X POST https://assistant.ledger-mind.org/agent/run \
  -H 'Content-Type: application/json' \
  -d '{"tasks":["projects.sync","links.suggest","og.generate"],"dry_run":true}'

# 3) SEO tune
curl -s -X POST https://assistant.ledger-mind.org/agent/seo.tune \
  -H 'Content-Type: application/json' \
  -d '{"dry_run":true}'

# 4) Artifacts
curl -s https://assistant.ledger-mind.org/agent/artifacts | head -n 40

# 5) Events stream
curl -s https://assistant.ledger-mind.org/agent/events?level=info --max-time 3
```

## 4. ✅ Playwright E2E Tests

### Test Files Created

#### `tests/agent-orchestrator.spec.ts`

Tests core orchestration features:
- `/agent/status` endpoint
- `/agent/run` with dry-run tasks
- `/agent/artifacts` listing
- `/agent/events` SSE stream
- `/agent/dev/enable` cookie setting

```typescript
test.describe('Agent orchestration', () => {
  test('status and dry-run tasks work', async ({ request }) => {
    const status = await request.get('https://assistant.ledger-mind.org/agent/status');
    expect(status.ok()).toBeTruthy();

    const run = await request.post('https://assistant.ledger-mind.org/agent/run', {
      data: { tasks: ['projects.sync', 'links.suggest', 'og.generate'], dry_run: true }
    });
    expect(run.ok()).toBeTruthy();

    const artifacts = await request.get('https://assistant.ledger-mind.org/agent/artifacts');
    expect(artifacts.ok()).toBeTruthy();
  });
});
```

#### `tests/seo-intel.spec.ts`

Tests SEO intelligence loop:
- `/agent/seo.tune` dry-run
- SEO artifact generation
- Analytics integration (optional)

```typescript
test('SEO tune creates artifacts (heuristic or LLM)', async ({ request }) => {
  const res = await request.post('https://assistant.ledger-mind.org/agent/seo.tune', {
    data: { dry_run: true }
  });
  expect(res.ok()).toBeTruthy();

  const artifacts = await request.get('https://assistant.ledger-mind.org/agent/artifacts');
  const list = await artifacts.text();
  expect(list).toMatch(/seo-tune\.(json|md)/);
});
```

#### `tests/auto-update.spec.ts`

Tests automatic website updates:
- Link suggestions with diff artifacts
- Full pipeline (projects.sync → seo.tune → links.apply)
- Approval flow (dry-run mode)

```typescript
test('links suggest + apply (dry-run) produces diff', async ({ request }) => {
  const suggest = await request.post('https://assistant.ledger-mind.org/agent/run', {
    data: { tasks: ['links.suggest'], dry_run: true }
  });
  expect(suggest.ok()).toBeTruthy();

  const artifacts = await request.get('https://assistant.ledger-mind.org/agent/artifacts');
  const body = await artifacts.text();
  expect(body).toMatch(/link-apply\.(md|json|diff)/);
});
```

### Running Tests

```bash
# All agent tests
pnpm exec playwright test agent-orchestrator.spec.ts seo-intel.spec.ts auto-update.spec.ts

# Individual test suites
pnpm exec playwright test agent-orchestrator.spec.ts
pnpm exec playwright test seo-intel.spec.ts
pnpm exec playwright test auto-update.spec.ts

# With headed browser (debug)
pnpm exec playwright test agent-orchestrator.spec.ts --headed

# Specific project
pnpm exec playwright test --project=chromium
```

## 5. ✅ Nightly Automation

### GitHub Actions Workflow

**File**: `.github/workflows/nightly-siteagent.yml`

**Schedule**: 3:07 AM UTC daily (configurable)

**Two Modes**:

#### Mode A: Approval-based (Default)
```yaml
jobs:
  nightly-sync:
    runs-on: ubuntu-latest
    steps:
      - name: Run nightly agent sync (with approvals)
        run: |
          curl -s -X POST https://assistant.ledger-mind.org/agent/run \
            -H 'Content-Type: application/json' \
            -d '{"tasks":["projects.sync","news.sync","og.generate","seo.tune","links.suggest","links.apply"],"dry_run":true}'
```

**Effect**: Generates artifacts for manual approval, no automatic changes

#### Mode B: Autonomous (Optional)
```yaml
jobs:
  autonomous-sync:
    if: true  # Enable by changing from false
    steps:
      - name: Run autonomous agent sync
        run: |
          curl -s -X POST https://assistant.ledger-mind.org/agent/run \
            -H 'Content-Type: application/json' \
            -d '{"tasks":["..."],"dry_run":false}'
```

**Effect**: Automatically applies all changes, site updates without intervention

### Enabling Nightly Automation

1. **Test locally first**:
   ```bash
   .\scripts\smoke-siteagent.ps1
   ```

2. **Commit and push workflow**:
   ```bash
   git add .github/workflows/nightly-siteagent.yml
   git commit -m "feat: add nightly SiteAgent automation"
   git push
   ```

3. **Verify in GitHub**:
   - Go to repository → Actions
   - Should see "Nightly SiteAgent Sync" workflow
   - Can trigger manually via "Run workflow"

4. **Switch to autonomous mode** (optional):
   - Edit `.github/workflows/nightly-siteagent.yml`
   - Change `if: false` to `if: true` in `autonomous-sync` job
   - Disable `nightly-sync` job by setting `if: false`

## 6. Auto-Update Modes

### Mode A: Approval-based (Recommended)

**How it works**:
1. Agent runs tasks with `dry_run: true`
2. Generates diff artifacts (markdown/JSON)
3. Review artifacts via dev overlay or `/agent/artifacts`
4. Approve via overlay UI or `/agent/approve` API
5. Backend applies approved changes
6. nginx serves updated static files

**Configuration**:
```yaml
# .github/workflows/nightly-siteagent.yml
data: { dry_run: true }  # ← Approval mode
```

**Backend Environment**:
```yaml
ALLOW_LINK_APPLY: "1"  # Required
```

**Approval Flow**:
```bash
# 1. Run with dry_run
curl -X POST https://assistant.ledger-mind.org/agent/run \
  -d '{"tasks":["links.suggest","links.apply"],"dry_run":true}'

# 2. Review artifacts
curl https://assistant.ledger-mind.org/agent/artifacts

# 3. Approve specific artifact (if endpoint exists)
curl -X POST https://assistant.ledger-mind.org/agent/approve \
  -d '{"artifact_id":"link-apply-2025-10-15","approved":true}'
```

### Mode B: Autonomous (Fast)

**How it works**:
1. Agent runs tasks with `dry_run: false`
2. Immediately applies all changes
3. Artifacts still generated for audit trail
4. Site updates automatically

**Configuration**:
```yaml
# .github/workflows/nightly-siteagent.yml
data: { dry_run: false }  # ← Autonomous mode
```

**One-shot Command**:
```bash
curl -s -X POST https://assistant.ledger-mind.org/agent/run \
  -H 'Content-Type: application/json' \
  -d '{"tasks":["projects.sync","news.sync","og.generate","seo.tune","links.suggest","links.apply"],"dry_run":false}'
```

**Safety**:
- Still requires `ALLOW_LINK_APPLY=1` in backend
- Artifacts provide audit trail
- Can roll back via version control

## 7. Cloudflare Cache Bypass

### Why Bypass Cache?

- `/agent/status` should reflect real-time state
- `/agent/dev/enable` sets cookies (must not be cached)
- `/agent/events` is SSE streaming (incompatible with cache)
- `/agent/artifacts` should show latest diffs

### Configuration

#### Option 1: Page Rules (Classic)

1. Cloudflare Dashboard → `assistant.ledger-mind.org`
2. **Rules** → **Page Rules**
3. **Create Page Rule**:
   - URL: `https://assistant.ledger-mind.org/agent/*`
   - Settings:
     - **Cache Level**: Bypass
     - **Browser Cache TTL**: Respect Existing Headers
4. Save and Deploy

#### Option 2: Cache Rules (Newer)

1. Cloudflare Dashboard → `assistant.ledger-mind.org`
2. **Caching** → **Cache Rules**
3. **Create Rule**:
   - **Match**: `http.request.uri.path starts with "/agent/"`
   - **Action**: Bypass cache
4. Save and Deploy

## 8. Architecture Summary

### Request Flow

```
User/CI → Cloudflare (cache bypass /agent/*)
       → applylens-nginx-prod (split routing)
       → ai-finance-backend-1 (SiteAgent API)
       → portfolio.int:80 (static files)
```

### Network Topology

```
infra_net (Docker network)
├── applylens-nginx-prod (port 80)
│   └── Routes: /agent/*, /chat, /api/* → backend
│                /                      → portfolio
│
├── ai-finance-backend-1 (ai-finance-api.int:8000)
│   └── FastAPI with SiteAgent endpoints
│
├── portfolio-ui (portfolio.int:80)
│   └── Static portfolio (nginx)
│
└── applylens-cloudflared-prod
    └── Tunnel: assistant.ledger-mind.org → nginx:80
```

### Key Components

1. **nginx**: Reverse proxy with split routing
2. **Backend**: FastAPI with SiteAgent orchestration, SEO loop, content automation
3. **Portfolio**: Static site served by nginx
4. **Cloudflare**: CDN with cache bypass for `/agent/*`
5. **GitHub Actions**: Nightly automation workflow

## 9. Verification Checklist

### Infrastructure

- [x] nginx routing configured (`/agent/*`, `/chat`, `/api/*`)
- [x] nginx config deployed and reloaded
- [x] Backend SiteAgent environment variables set
- [x] Backend container restarted
- [x] All containers on `infra_net` network

### Features

- [ ] `/agent/status` returns JSON
- [ ] `/agent/run` executes dry-run tasks
- [ ] `/agent/artifacts` lists generated files
- [ ] `/agent/events` streams SSE
- [ ] `/agent/dev/enable` sets cookie
- [ ] `/agent/seo.tune` runs SEO intelligence
- [ ] Link suggestions generate diffs

### Tests

- [x] Smoke test script created (`scripts/smoke-siteagent.ps1`)
- [x] Playwright tests created (3 files)
- [ ] Smoke tests pass (run `.\scripts\smoke-siteagent.ps1`)
- [ ] Playwright tests pass (run `pnpm exec playwright test agent-*.spec.ts`)

### Automation

- [x] GitHub Actions workflow created
- [ ] Workflow enabled in GitHub
- [ ] Nightly runs successful (check Actions tab)
- [ ] Cloudflare cache bypass configured

## 10. Troubleshooting

### Issue: 404 on `/agent/*` endpoints

**Cause**: nginx not routing correctly or backend endpoints not implemented

**Fix**:
```bash
# Check nginx config
docker exec applylens-nginx-prod nginx -t

# Test routing directly
docker exec applylens-nginx-prod curl -I http://localhost/agent/status

# Check backend logs
docker logs ai-finance-backend-1 --tail=50
```

### Issue: CORS errors on `/agent/*`

**Cause**: Missing CORS origin in backend

**Fix**: Verify `CORS_ALLOW_ORIGINS` includes `https://assistant.ledger-mind.org`

### Issue: SSE `/agent/events` not streaming

**Cause**: nginx buffering or timeout

**Fix**: Verify in `nginx.assistant.conf`:
```nginx
location /agent/ {
    proxy_buffering off;  # Critical for SSE
    proxy_read_timeout 3600s;
}
```

### Issue: Nightly automation fails

**Cause**: Backend endpoints not implemented or authorization required

**Fix**:
```bash
# Test endpoint manually
curl -s -X POST https://assistant.ledger-mind.org/agent/run \
  -H 'Content-Type: application/json' \
  -d '{"tasks":["projects.sync"],"dry_run":true}'

# Check GitHub Actions logs
# Verify ALLOW_DEV_ROUTES=1 in backend
```

### Issue: Cookie not persisting

**Cause**: Domain mismatch or missing SameSite

**Fix**: Verify backend environment:
```bash
docker inspect ai-finance-backend-1 | grep -E "COOKIE_(DOMAIN|SECURE|SAMESITE)"
# Should show:
# COOKIE_DOMAIN=.ledger-mind.org
# COOKIE_SECURE=1
# COOKIE_SAMESITE=lax
```

## 11. Next Steps

### Immediate (Required for full functionality)

1. **Implement backend endpoints** (in `c:\ai-finance-agent-oss-clean\apps\backend`):
   - `/agent/status` - Orchestrator status
   - `/agent/run` - Task execution
   - `/agent/artifacts` - List generated files
   - `/agent/events` - SSE event stream
   - `/agent/dev/enable` - Dev overlay cookie
   - `/agent/seo.tune` - SEO intelligence
   - `/agent/approve` - Artifact approval (optional)

2. **Run smoke tests**:
   ```powershell
   .\scripts\smoke-siteagent.ps1
   ```

3. **Run Playwright tests**:
   ```bash
   pnpm exec playwright test agent-orchestrator.spec.ts seo-intel.spec.ts auto-update.spec.ts
   ```

### Short-term (Enable automation)

4. **Configure Cloudflare cache bypass** for `/agent/*`

5. **Enable GitHub Actions workflow**:
   ```bash
   git add .github/workflows/nightly-siteagent.yml
   git commit -m "feat: add nightly SiteAgent automation"
   git push
   ```

6. **Test nightly workflow** manually via GitHub Actions UI

### Long-term (Full autonomy)

7. **Implement frontend dev overlay** component:
   - Create `DevOverlay.tsx` in `apps/portfolio-ui/src/components`
   - Show artifacts, approval UI, agent status
   - Add to `index.html` with conditional rendering

8. **Add GSC/GA4 integration** (optional):
   - Set `GSC_JSON` and `GA4_JSON` in backend env
   - Mount secrets volumes in docker-compose
   - Enable real analytics data in SEO intelligence

9. **Switch to autonomous mode** (optional):
   - Change `dry_run: false` in workflow
   - Enable `autonomous-sync` job
   - Monitor artifacts for quality

## Files Created/Modified

### Created (6 files)
1. `apps/portfolio-ui/tests/agent-orchestrator.spec.ts` - Orchestration E2E tests
2. `apps/portfolio-ui/tests/seo-intel.spec.ts` - SEO intelligence E2E tests
3. `apps/portfolio-ui/tests/auto-update.spec.ts` - Auto-update E2E tests
4. `.github/workflows/nightly-siteagent.yml` - Nightly automation workflow
5. `scripts/smoke-siteagent.ps1` - Manual smoke test script
6. `SITEAGENT_INFRASTRUCTURE.md` - This file

### Modified (2 files)
1. `c:\ai-finance-agent-oss-clean\docker-compose.yml` - Added SiteAgent env vars
2. `deploy/nginx.assistant.conf` - Already had `/agent/*` routing (verified)

## Summary

✅ **Infrastructure configured**: nginx routing, backend env, network topology
✅ **Tests created**: 3 Playwright test suites, PowerShell smoke script
✅ **Automation ready**: GitHub Actions workflow for nightly sync
⏳ **Remaining**: Backend endpoint implementation, Cloudflare cache bypass

**Current Status**: Infrastructure is ready. Once backend endpoints are implemented, run `.\scripts\smoke-siteagent.ps1` to verify, then enable nightly automation for hands-free portfolio management.

**The defining feature** (automatic website updates) is configured and ready - just needs backend implementation to go live.
