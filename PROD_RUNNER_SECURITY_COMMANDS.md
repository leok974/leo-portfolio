# Production Runner Security - Quick Commands

**Quick reference for CLI operations and verification**

---

## Verification Commands

### Check Workflow Hardening
```bash
# Verify only 3 workflows use self-hosted runner
grep -r "runs-on.*self-hosted" .github/workflows/*.yml
# Expected: bootstrap-watchtower.yml, smoke-selfhosted.yml, redeploy-backend.yml

# Verify PR workflows use ubuntu-latest (safe)
grep -l "pull_request" .github/workflows/*.yml | xargs grep "runs-on" | grep "ubuntu-latest" | wc -l
# Expected: Many (all PR workflows)

# Ensure no PR workflow uses self-hosted (dangerous)
grep -l "pull_request" .github/workflows/*.yml | xargs grep "self-hosted"
# Expected: Empty (no results)

# Check all prod workflows have environment protection
grep -A10 "runs-on.*self-hosted" .github/workflows/*.yml | grep "environment:"
# Expected: 3 matches (all say "production")

# Check all prod workflows have PR guards
grep -B5 "runs-on.*self-hosted" .github/workflows/*.yml | grep "pull_request"
# Expected: Guards preventing PR execution
```

---

## Testing Commands

### Test 1: Smoke Test with Approval
```bash
# Trigger smoke test
gh workflow run smoke-selfhosted.yml

# Watch for approval prompt
gh run list --workflow=smoke-selfhosted.yml --limit 1

# After approving in UI, watch execution
gh run watch $(gh run list --workflow=smoke-selfhosted.yml --limit 1 --json databaseId --jq '.[0].databaseId')
```

---

### Test 2: Bootstrap with Confirmation
```bash
# Wrong: No confirmation (should skip)
gh workflow run bootstrap-watchtower.yml
# Expected: Job skipped

# Correct: With confirmation
gh workflow run bootstrap-watchtower.yml -f confirm=bootstrap
# Expected: Waits for approval, then runs

# Watch execution
gh run watch $(gh run list --workflow=bootstrap-watchtower.yml --limit 1 --json databaseId --jq '.[0].databaseId')
```

---

### Test 3: Redeploy Backend
```bash
# Trigger redeploy
gh workflow run redeploy-backend.yml

# Check status
gh run list --workflow=redeploy-backend.yml --limit 1

# Watch execution (after approval)
gh run watch $(gh run list --workflow=redeploy-backend.yml --limit 1 --json databaseId --jq '.[0].databaseId')

# Verify it used prod runner (check hostname in logs)
gh run view $(gh run list --workflow=redeploy-backend.yml --limit 1 --json databaseId --jq '.[0].databaseId') --log | grep -i "hostname"
```

---

### Test 4: Create Test PR (Verify PR Safety)
```bash
# Create test branch
git checkout -b test/runner-security-$(date +%s)
echo "# Security test" >> README.md
git add README.md
git commit -m "test: verify prod runner cannot be accessed from PR"
git push origin HEAD

# Create PR (via CLI or UI)
gh pr create --title "Test: Runner Security" --body "Verifying PR cannot use self-hosted runner"

# Watch PR checks
gh pr checks
# Expected: All checks use ubuntu-latest (no self-hosted)

# Clean up
gh pr close <PR_NUMBER>
git checkout main
git branch -D test/runner-security-*
```

---

### Test 5: Concurrent Deploy Prevention
```bash
# Start first deploy
gh workflow run bootstrap-watchtower.yml -f confirm=bootstrap

# Immediately start second deploy
sleep 2
gh workflow run bootstrap-watchtower.yml -f confirm=bootstrap

# Check both runs
gh run list --workflow=bootstrap-watchtower.yml --limit 2
# Expected: One running, one queued/waiting
```

---

## Environment Setup Commands (GitHub CLI)

### Create Environment (if using CLI beta features)
```bash
# Note: Environment creation via CLI is limited
# Use UI: https://github.com/leok974/leo-portfolio/settings/environments

# But you can verify environments exist
gh api repos/leok974/leo-portfolio/environments --jq '.environments[].name'
# Expected: Should list "production" after UI setup
```

---

### Add Environment Secrets
```bash
# Add secret to production environment
gh secret set WATCHTOWER_HTTP_API_TOKEN --env production
# Paste value when prompted

gh secret set WATCHTOWER_UPDATE_URL --env production
gh secret set FIGMA_PAT --env production
gh secret set FIGMA_TEMPLATE_KEY --env production
gh secret set FIGMA_TEAM_ID --env production
gh secret set OPENAI_API_KEY --env production

# Verify secrets (names only, not values)
gh secret list --env production
```

---

## Runner Management Commands

### Check Runner Status
```bash
# List runners in repo
gh api repos/leok974/leo-portfolio/actions/runners --jq '.runners[] | {name, status, labels: .labels[].name}'

# Expected output:
# {
#   "name": "prod-runner-1",
#   "status": "online",
#   "labels": ["self-hosted", "prod", "deploy", "Linux", "X64"]
# }
```

---

### Generate New Runner Token (if needed)
```bash
# Generate new registration token
gh api --method POST repos/leok974/leo-portfolio/actions/runners/registration-token --jq '.token'

# Output: New token (valid for 1 hour)
# Use this if you need to recreate runner container
```

---

### Check Recent Workflow Runs on Prod Runner
```bash
# List recent runs that used self-hosted runner
gh run list --limit 20 --json workflowName,conclusion,displayTitle,createdAt | \
  jq '.[] | select(.workflowName | contains("Self-Hosted") or contains("Bootstrap") or contains("Redeploy"))'

# Check runner logs on production server
docker logs gh-runner-prod --tail=50 --timestamps
```

---

## Security Audit Commands

### Audit Workflow Permissions
```bash
# Check all workflows have minimal permissions
for f in .github/workflows/*.yml; do
  echo "=== $f ==="
  grep -A10 "^permissions:" "$f" || echo "  (no explicit permissions - uses defaults)"
done

# Verify prod workflows have read-only
grep -A10 "^permissions:" .github/workflows/{bootstrap-watchtower,smoke-selfhosted,redeploy-backend}.yml | grep "contents:"
# Expected: All say "contents: read"
```

---

### Audit Concurrency Groups
```bash
# Check which workflows have concurrency control
grep -B2 "^concurrency:" .github/workflows/*.yml

# Verify prod workflows share group
grep -A2 "^concurrency:" .github/workflows/{bootstrap-watchtower,redeploy-backend}.yml
# Expected: Both use "prod-deploy" group
```

---

### Audit Runner Labels
```bash
# Find all workflows targeting specific labels
grep -h "runs-on:" .github/workflows/*.yml | sort | uniq -c | sort -rn

# Expected distribution:
#   ~80-90 ubuntu-latest (PR and CI workflows)
#   3 [self-hosted, prod, deploy] (prod workflows only)
```

---

## Incident Response Commands

### Emergency: Stop Runner
```bash
# On production server (via SSH or console)
docker stop gh-runner-prod

# Verify stopped
docker ps -a | grep gh-runner-prod
# Status should be "Exited"
```

---

### Check for Suspicious Activity
```bash
# Recent runs by event type
gh run list --limit 50 --json workflowName,event,conclusion | \
  jq 'group_by(.event) | map({event: .[0].event, count: length})'

# Check if any PR triggered prod workflows (should be zero)
gh run list --limit 100 --json workflowName,event,headBranch | \
  jq '.[] | select(.event == "pull_request" and (.workflowName | contains("Self-Hosted") or contains("Bootstrap")))'
# Expected: Empty (no results)
```

---

### Rotate Watchtower Token
```bash
# 1. Generate new token (on production server)
docker run --rm ghcr.io/containrrr/watchtower:latest \
  /watchtower --http-api-token-generate

# Output: New token string

# 2. Update environment secret
gh secret set WATCHTOWER_HTTP_API_TOKEN --env production
# Paste new token

# 3. Trigger bootstrap to apply new token
gh workflow run bootstrap-watchtower.yml -f confirm=bootstrap

# 4. Test new token
curl -X POST https://api.leoklemet.com/ops/watchtower/update \
  -H "Authorization: Bearer <NEW_TOKEN>"
# Expected: 200/204
```

---

## Monitoring Commands

### Watch Active Workflow Runs
```bash
# Real-time view of all runs
gh run watch

# Filter to prod workflows only
gh run list --workflow=bootstrap-watchtower.yml --limit 5
gh run list --workflow=redeploy-backend.yml --limit 5
gh run list --workflow=smoke-selfhosted.yml --limit 5
```

---

### Check Workflow Run History
```bash
# Last 30 days of prod deployments
gh run list --workflow=redeploy-backend.yml --limit 100 --json workflowName,conclusion,createdAt | \
  jq '.[] | {workflow: .workflowName, status: .conclusion, date: .createdAt}'

# Success rate
gh run list --workflow=redeploy-backend.yml --limit 50 --json conclusion | \
  jq 'group_by(.conclusion) | map({status: .[0].conclusion, count: length})'
```

---

### Check Backend Health
```bash
# Quick health check
curl -sS https://api.leoklemet.com/api/ready | jq

# Expected: {"status":"ready"}

# Check specific endpoint
curl -sS https://api.leoklemet.com/api/dev/status | jq

# Expected: {"ok":true,"allowed":false,"mode":"denied",...}
```

---

## Cleanup Commands

### Delete Failed Runs
```bash
# List failed runs
gh run list --status failure --limit 10

# Delete specific run
gh run delete <RUN_ID>

# Delete all failed runs (careful!)
gh run list --status failure --json databaseId --jq '.[].databaseId' | \
  xargs -I {} gh run delete {}
```

---

### Remove Test Branch
```bash
# After testing PR safety
git branch -D test/runner-security-*
git push origin --delete test/runner-security-*
```

---

## Quick Health Check Script

```bash
#!/bin/bash
# save as: scripts/check-prod-runner-security.sh

echo "🔒 Production Runner Security Check"
echo "===================================="
echo ""

echo "1. Checking workflow hardening..."
SELF_HOSTED_COUNT=$(grep -r "runs-on.*self-hosted" .github/workflows/*.yml | wc -l)
echo "   Self-hosted workflows: $SELF_HOSTED_COUNT (expected: 3)"

echo ""
echo "2. Checking PR safety..."
PR_SELF_HOSTED=$(grep -l "pull_request" .github/workflows/*.yml | xargs grep -l "self-hosted" 2>/dev/null | wc -l)
echo "   PR workflows using self-hosted: $PR_SELF_HOSTED (expected: 0)"

echo ""
echo "3. Checking environment protection..."
ENV_COUNT=$(grep -r "environment: production" .github/workflows/*.yml | wc -l)
echo "   Workflows with environment protection: $ENV_COUNT (expected: 3)"

echo ""
echo "4. Checking runner status..."
gh api repos/leok974/leo-portfolio/actions/runners --jq '.runners[] | "   Runner: \(.name) - Status: \(.status)"'

echo ""
echo "5. Recent prod workflow runs..."
gh run list --limit 5 --json workflowName,conclusion,createdAt | \
  jq -r '.[] | "   \(.workflowName): \(.conclusion) at \(.createdAt)"'

echo ""
echo "✅ Security check complete"
```

**Usage**:
```bash
chmod +x scripts/check-prod-runner-security.sh
./scripts/check-prod-runner-security.sh
```

---

**Quick Links**:
- Runners: https://github.com/leok974/leo-portfolio/settings/actions/runners
- Environments: https://github.com/leok974/leo-portfolio/settings/environments
- Actions: https://github.com/leok974/leo-portfolio/actions
- Secrets: https://github.com/leok974/leo-portfolio/settings/secrets/actions

**Documentation**: See `PROD_RUNNER_SECURITY_LOCKDOWN.md` for full guide
