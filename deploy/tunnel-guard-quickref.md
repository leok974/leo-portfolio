# Tunnel Guard Quick Reference

## Commands

```bash
# Check for alias conflicts
pnpm run guard:tunnel

# Verify SiteAgent brand integrity
pnpm run smoke:siteagent

# Manual alias inspection
docker network inspect infra_net --format '{{range .Containers}}{{.Name}}: {{range .Aliases}}{{.}} {{end}}{{"\n"}}{{end}}'
```

## Expected Aliases (infra_net)

✅ **SiteAgent UI**: `siteagent-ui.int` → `portfolio-nginx-*` only
✅ **SiteAgent API**: `siteagent-api.int` → `portfolio-backend-*` only
✅ **LedgerMind UI**: `ai-finance.int` → `ai-finance-nginx-*` only
✅ **ApplyLens UI**: `applylens.int` → `applylens-nginx` only

## Guard Script Output

**Success** (exit 0):
```
[tunnel-guard] scanning containers on infra_net for duplicate aliases…
✅ no duplicate aliases found
```

**Failure** (exit 1):
```
[tunnel-guard] scanning containers on infra_net for duplicate aliases…
❌ duplicate siteagent-ui.int on ai-finance-nginx-1
```

## Smoke Test Output

**Success** (exit 0):
```
[smoke-siteagent] Testing https://siteagents.app/...
✅ Brand check passed: SiteAgent content, no LedgerMind

[smoke-siteagent] Testing API health...
✅ API health OK: db=True, migrations=True

[smoke-siteagent] Testing CSP header...
✅ CSP points to api.siteagents.app

✅ All SiteAgent smoke tests passed!
```

**Failure** (exit 1):
```
❌ Found LedgerMind on SiteAgent domain - brand leakage detected!
```

## CI Workflow

**Triggers**:
- Push to `main`
- PRs modifying: `deploy/**`, `**/docker-compose*.yml`, `infra/nginx/**`

**Result**:
- ✅ **Pass**: No alias conflicts → merge allowed
- ❌ **Fail**: Duplicate aliases detected → blocks merge

## Quick Fix for Conflicts

```bash
# 1. Find the conflicting container's compose file
docker inspect <container-name> --format '{{.Config.Labels}}'

# 2. Edit compose file, remove duplicate alias
# Example: c:\ai-finance-agent-oss-clean\docker-compose.yml
#   Remove: - siteagent-ui.int

# 3. Restart container
cd <compose-directory>
docker compose stop <service>
docker compose rm -f <service>
docker compose up -d <service>

# 4. Verify fix
pnpm run guard:tunnel
```

## Files

- `scripts/tunnel-guard.sh` - Alias conflict detector
- `scripts/smoke-siteagents.ps1` - Brand integrity tester
- `.github/workflows/tunnel-guard.yml` - CI workflow
- `infra/nginx/conf.d/000-default-404.conf` - Default catch-all vhost
- `deploy/tunnel-guard-docs.md` - Full documentation

## Common Issues

**jq not found**:
```bash
sudo apt-get install jq  # Ubuntu
brew install jq          # macOS
```

**SSL errors in smoke test**: Already using `-k` flag, should work

**False positives**: Check container name pattern in `tunnel-guard.sh` line 17-22

## Pre-Deployment Checklist

```bash
# 1. Check aliases
pnpm run guard:tunnel || exit 1

# 2. Verify brand
pnpm run smoke:siteagent || exit 1

# 3. Build & deploy
docker compose -f deploy/docker-compose.yml build
docker compose -f deploy/docker-compose.yml up -d

# 4. Wait & re-check
sleep 5
pnpm run smoke:siteagent || { docker compose down; exit 1; }
```

## References

- Original issue: `deploy/siteagents.vhost.fix.md`
- Complete report: `deploy/siteagents.fix.complete.md`
- Full docs: `deploy/tunnel-guard-docs.md`
