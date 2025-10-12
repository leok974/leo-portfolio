# Tunnel Alias Guard & SiteAgent CI Checks

**Created**: October 11, 2025
**Purpose**: Prevent Docker network alias conflicts and ensure SiteAgent brand integrity

---

## Overview

This system provides automated guards and smoke tests to prevent the alias conflict issue that caused siteagents.app to serve LedgerMind content (resolved Oct 11, 2025).

### Components

1. **Tunnel Guard Script** (`scripts/tunnel-guard.sh`) - Detects duplicate network aliases
2. **Brand Smoke Test** (`scripts/smoke-siteagents.ps1`) - Verifies SiteAgent content integrity
3. **CI Workflow** (`.github/workflows/tunnel-guard.yml`) - Automated checks on PRs
4. **Default 404 Vhost** (`infra/nginx/conf.d/000-default-404.conf`) - Prevents brand bleed
5. **NPM Scripts** - Easy local testing

---

## Tunnel Guard Script

**File**: `scripts/tunnel-guard.sh`

### Purpose
Scans all running Docker containers on the `infra_net` network and ensures:
- `siteagent-ui.int` alias is **only** on `portfolio-nginx-*` containers
- `siteagent-api.int` alias is **only** on `portfolio-backend-*` containers

### Usage
```bash
# Direct execution
bash scripts/tunnel-guard.sh

# Via npm/pnpm
pnpm run guard:tunnel

# Exit codes
# 0 = no duplicates found ✅
# 1 = duplicates detected ❌
```

### Example Output
```bash
[tunnel-guard] scanning containers on infra_net for duplicate aliases…
✅ no duplicate aliases found
```

### Error Example
```bash
[tunnel-guard] scanning containers on infra_net for duplicate aliases…
❌ duplicate siteagent-ui.int on ai-finance-nginx-1
```

### How It Works
1. Lists all running containers
2. Inspects each container's network settings
3. Checks if container is on `infra_net`
4. Extracts network aliases using `jq`
5. Flags any non-portfolio containers with SiteAgent aliases
6. Returns exit code 1 if duplicates found

---

## Brand Smoke Test

**File**: `scripts/smoke-siteagents.ps1`

### Purpose
Verifies public SiteAgent site integrity:
1. **Brand check**: Ensures "SiteAgent" present, "LedgerMind" absent
2. **API health**: Tests `https://api.siteagents.app/ready`
3. **CSP check**: Verifies CSP header points to `api.siteagents.app`

### Usage
```powershell
# Direct execution
pwsh -File scripts/smoke-siteagents.ps1

# Via npm/pnpm
pnpm run smoke:siteagent
```

### Example Output
```
[smoke-siteagent] Testing https://siteagents.app/...
✅ Brand check passed: SiteAgent content, no LedgerMind

[smoke-siteagent] Testing API health...
✅ API health OK: db=True, migrations=True

[smoke-siteagent] Testing CSP header...
✅ CSP points to api.siteagents.app

✅ All SiteAgent smoke tests passed!
```

### Failure Scenarios

**Brand leakage detected**:
```
❌ Found LedgerMind on SiteAgent domain - brand leakage detected!
```

**Wrong branding**:
```
❌ Missing SiteAgent branding on SiteAgent domain!
```

**API down**:
```
❌ API health check failed: ok=False
```

**Wrong CSP**:
```
❌ CSP does not point to api.siteagents.app
```

---

## CI Workflow

**File**: `.github/workflows/tunnel-guard.yml`

### Trigger Conditions
- **Push** to `main` branch
- **Pull requests** that modify:
  - `deploy/**`
  - `**/docker-compose*.yml`
  - `infra/nginx/**`
  - `scripts/tunnel-guard.sh`

### Workflow Steps
1. **Checkout code**
2. **Docker info**: Print Docker version and networks
3. **Start minimal stack**: `docker compose up -d --no-build`
4. **List containers**: Show running containers
5. **Show network topology**: Display `infra_net` aliases
6. **Run tunnel guard**: Execute `scripts/tunnel-guard.sh`
7. **Show logs on failure**: Display container logs if guard fails
8. **Teardown**: Clean up containers (`docker compose down -v`)

### Example CI Run
```yaml
✅ Checkout code
✅ Docker info
✅ Start minimal stack (no build)
✅ List running containers
✅ Show network topology
✅ Verify unique tunnel aliases
   [tunnel-guard] scanning containers on infra_net for duplicate aliases…
   ✅ no duplicate aliases found
✅ Teardown
```

### Failure Handling
If duplicate aliases detected:
- CI job fails ❌
- Shows which container has conflicting alias
- Dumps last 50 lines of container logs
- Prevents merge until fixed

---

## Default 404 Vhost

**File**: `infra/nginx/conf.d/000-default-404.conf`

### Purpose
Catch-all server block that returns 404 for any unmatched `Host` headers, preventing one brand's content from being served for another brand's domain.

### Configuration
```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    location / {
        add_header X-Config "default-404" always;
        return 404;
    }

    location = /health {
        access_log off;
        add_header Content-Type text/plain;
        return 200 "default vhost\n";
    }
}
```

### Why 000- Prefix?
Nginx loads config files in alphabetical order. The `000-` prefix ensures this catch-all loads **first** and gets marked as `default_server`, preventing other vhosts from accidentally becoming the default.

### Health Check
```bash
curl -H "Host: invalid.example" http://nginx/health
# Returns: "default vhost"
```

---

## NPM Scripts

**File**: `package.json`

### Added Scripts
```json
{
  "scripts": {
    "guard:tunnel": "bash scripts/tunnel-guard.sh",
    "smoke:siteagent": "pwsh -File scripts/smoke-siteagents.ps1"
  }
}
```

### Usage

**Tunnel Guard**:
```bash
pnpm run guard:tunnel
# or
npm run guard:tunnel
```

**Brand Smoke**:
```bash
pnpm run smoke:siteagent
# or
npm run smoke:siteagent
```

### Pre-Deployment Checklist
```bash
# 1. Check for alias conflicts
pnpm run guard:tunnel

# 2. Verify brand integrity
pnpm run smoke:siteagent

# 3. Run full test suite
pnpm test
pnpm test:e2e
```

---

## Local Testing

### Test Tunnel Guard
```bash
# Should pass (no duplicates)
pnpm run guard:tunnel

# Simulate failure (add duplicate alias to another container)
# Edit another project's docker-compose.yml to add siteagent-ui.int
# Restart that container
# Run guard again - should fail ❌
```

### Test Brand Smoke
```bash
# Should pass (correct content)
pnpm run smoke:siteagent

# Simulate failure (serve wrong content)
# Edit nginx config to proxy to wrong backend
# Restart nginx
# Run smoke again - should fail ❌
```

### Manual Alias Inspection
```bash
# List all containers on infra_net
docker network inspect infra_net --format '{{range .Containers}}{{.Name}}: {{range .Aliases}}{{.}} {{end}}{{"\n"}}{{end}}'

# Expected output:
# portfolio-nginx-1: portfolio-nginx-1 nginx siteagent-ui.int portfolio.int
# portfolio-backend-1: portfolio-backend-1 backend siteagent-api.int
# ai-finance-nginx-1: ai-finance-nginx-1 nginx ai-finance.int
```

---

## Troubleshooting

### Tunnel Guard Fails with "jq: command not found"
**Solution**: Install `jq` on the host
```bash
# Ubuntu/Debian
sudo apt-get install jq

# macOS
brew install jq

# Windows (via Chocolatey)
choco install jq
```

### Smoke Test Fails with SSL Error
**Solution**: Script uses `-k` flag for curl, but if persistent:
```powershell
# Bypass cert verification completely
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
pnpm run smoke:siteagent
```

### CI Workflow Times Out on "Start minimal stack"
**Cause**: Container images not cached, need to build
**Solution**: Push pre-built images to registry or use `docker compose build` in CI

### False Positive: Guard Reports Duplicate on Correct Container
**Cause**: Container naming changed (e.g., `portfolio-nginx-2` instead of `portfolio-nginx-1`)
**Solution**: Update regex in `tunnel-guard.sh`:
```bash
# Current check
[[ "$c" != *"portfolio-nginx"* ]]

# If using different naming
[[ "$c" != *"portfolio-"* && "$c" != *"siteagent-"* ]]
```

---

## Integration with Existing Workflows

### Pre-Commit Hook
Add to `.husky/pre-commit`:
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run tunnel guard before committing compose changes
if git diff --cached --name-only | grep -qE 'docker-compose|deploy/'; then
  echo "🔍 Checking for tunnel alias conflicts..."
  pnpm run guard:tunnel || exit 1
fi
```

### Pre-Deployment Script
Add to `scripts/deploy.sh`:
```bash
#!/bin/bash
set -euo pipefail

echo "🔍 Pre-deployment checks..."

# 1. Check aliases
if ! pnpm run guard:tunnel; then
  echo "❌ Tunnel alias conflict detected. Fix before deploying."
  exit 1
fi

# 2. Build images
docker compose -f deploy/docker-compose.yml build

# 3. Deploy
docker compose -f deploy/docker-compose.yml up -d

# 4. Wait for services
sleep 5

# 5. Run smoke tests
if ! pnpm run smoke:siteagent; then
  echo "❌ Smoke tests failed. Rolling back..."
  docker compose -f deploy/docker-compose.yml down
  exit 1
fi

echo "✅ Deployment successful!"
```

---

## Maintenance

### When to Update Tunnel Guard

**Add new aliases**:
```bash
# If adding new-service.int alias
alias_new="new-service.int"

# Add check in for loop
if echo "$aliases" | grep -qx "$alias_new" && [[ "$c" != *"expected-container"* ]]; then
  echo "❌ duplicate $alias_new on $c"
  fail=1
fi
```

**Change network name**:
```bash
# If moving from infra_net to prod_net
net="prod_net"
```

### When to Update Smoke Test

**Add new endpoints**:
```powershell
# Check additional endpoint
Write-Host "`n[smoke-siteagent] Testing chat endpoint..." -ForegroundColor Cyan
$chatResponse = curl -k -X POST -H "Content-Type: application/json" `
  -d '{"message":"test"}' `
  https://api.siteagents.app/chat | ConvertFrom-Json

if ($chatResponse.reply) {
    Write-Host "✅ Chat endpoint working" -ForegroundColor Green
} else {
    Write-Error "❌ Chat endpoint failed"
    exit 1
}
```

**Add response time checks**:
```powershell
$start = Get-Date
$response = curl -k -s https://siteagents.app/
$duration = (Get-Date) - $start

if ($duration.TotalSeconds -gt 5) {
    Write-Warning "⚠️ Slow response: $($duration.TotalSeconds)s"
}
```

---

## Related Documentation

- **Alias Conflict Fix**: `deploy/siteagents.vhost.fix.md`
- **Complete Fix Report**: `deploy/siteagents.fix.complete.md`
- **Nginx Config**: `deploy/nginx.siteagent.conf`
- **Docker Compose**: `deploy/docker-compose.yml`

---

## Success Metrics

### Tunnel Guard
- ✅ Detects duplicate `siteagent-ui.int` alias
- ✅ Detects duplicate `siteagent-api.int` alias
- ✅ Runs in < 5 seconds locally
- ✅ Integrates with CI (< 30 seconds in workflow)

### Brand Smoke
- ✅ Catches "LedgerMind" brand leakage
- ✅ Verifies "SiteAgent" branding present
- ✅ Validates API health (db + migrations)
- ✅ Confirms CSP points to correct API domain
- ✅ Runs in < 10 seconds

### CI Workflow
- ✅ Triggers on compose file changes
- ✅ Prevents merge with alias conflicts
- ✅ Shows detailed error messages on failure
- ✅ Cleans up containers after run

---

## Commit Message

```
chore(siteagent): add tunnel alias guard, default 404 vhost, and brand smoke

Add automated guards to prevent Docker network alias conflicts:

- scripts/tunnel-guard.sh: Scans infra_net for duplicate siteagent-*.int aliases
  - Fails if siteagent-ui.int found on non-portfolio-nginx containers
  - Fails if siteagent-api.int found on non-portfolio-backend containers
  - Returns 0 if no duplicates, 1 if conflicts detected

- scripts/smoke-siteagents.ps1: Brand integrity smoke test
  - Checks https://siteagents.app/ for SiteAgent content (no LedgerMind)
  - Validates API health at https://api.siteagents.app/ready
  - Verifies CSP header points to api.siteagents.app
  - Returns 0 if all checks pass, 1 on any failure

- .github/workflows/tunnel-guard.yml: CI workflow
  - Triggers on push to main and PRs affecting deploy/**, compose files
  - Starts minimal Docker stack (no build)
  - Runs tunnel-guard.sh to detect alias conflicts
  - Shows container logs on failure
  - Cleans up with docker compose down -v

- infra/nginx/conf.d/000-default-404.conf: Default catch-all vhost
  - Returns 404 for unmatched Host headers
  - Prevents brand bleed when DNS/routing misconfigured
  - Prefix 000- ensures it loads first as default_server
  - Includes /health endpoint for monitoring

- package.json: Add npm scripts
  - guard:tunnel: Run tunnel guard locally
  - smoke:siteagent: Run brand smoke tests locally

Prevents recurrence of Oct 11 incident where ai-finance-nginx had duplicate
siteagent-ui.int alias, causing siteagents.app to serve LedgerMind content.

Refs: deploy/siteagents.vhost.fix.md, deploy/siteagents.fix.complete.md
```
