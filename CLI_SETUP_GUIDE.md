# Production Runner Setup - Complete CLI Guide

**Status**: Workflows deployed ✅
**Next**: Configure secrets and test

---

## ✅ Step 1: Workflows Deployed (COMPLETE)

**Files created/updated**:
- ✅ `.github/workflows/policy-block-selfhosted-on-pr.yml`
- ✅ `.github/workflows/bootstrap-watchtower.yml`
- ✅ `.github/workflows/redeploy-backend.yml`
- ✅ `.github/workflows/runner-health.yml` (NEW)

**Committed**: e4fd2a1
**Pushed to**: main

---

## ⏭️ Step 2: Configure Production Environment Secrets

### Quick Method (PowerShell)

```powershell
# Run the automated script
.\scripts\setup-prod-secrets.ps1
```

**What it does**:
1. Sets `WATCHTOWER_UPDATE_URL` automatically
2. Prompts for each required secret:
   - `WATCHTOWER_HTTP_API_TOKEN`
   - `FIGMA_PAT`
   - `FIGMA_TEMPLATE_KEY`
   - `FIGMA_TEAM_ID`
3. Optionally sets `OPENAI_API_KEY`
4. Verifies all secrets set correctly

### Manual Method (CLI)

```bash
# 1. WATCHTOWER_UPDATE_URL (known value)
echo "https://api.leoklemet.com/ops/watchtower/update" | gh secret set WATCHTOWER_UPDATE_URL --env production

# 2. WATCHTOWER_HTTP_API_TOKEN (copy from repo secrets)
gh secret set WATCHTOWER_HTTP_API_TOKEN --env production
# Paste: dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE (or current value)

# 3. FIGMA_PAT (copy from repo secrets)
gh secret set FIGMA_PAT --env production
# Paste: figd_xxx...

# 4. FIGMA_TEMPLATE_KEY (copy from repo secrets)
gh secret set FIGMA_TEMPLATE_KEY --env production
# Paste: your template key

# 5. FIGMA_TEAM_ID (can be empty)
gh secret set FIGMA_TEAM_ID --env production
# Paste: team ID or press Enter for empty

# 6. OPENAI_API_KEY (optional)
gh secret set OPENAI_API_KEY --env production
# Paste: sk-xxx... (if you want fallback)
```

### Verify Secrets

```bash
gh secret list --env production
```

**Expected output**:
```
NAME                       UPDATED
FIGMA_PAT                  just now
FIGMA_TEAM_ID              just now
FIGMA_TEMPLATE_KEY         just now
OPENAI_API_KEY             just now
WATCHTOWER_HTTP_API_TOKEN  just now
WATCHTOWER_UPDATE_URL      just now
```

### Alternative: Migrate from .env Files

If you have secrets in local `.env` files, use the migration scripts:

**PowerShell (Windows)**:
```powershell
.\scripts\migrate-env-to-gh-secrets.ps1 -RepoSlug "leok974/leo-portfolio" -EnvName "production"
```

**Bash (Linux/macOS/WSL)**:
```bash
ENV_NAME=production REPO_SLUG=leok974/leo-portfolio bash scripts/migrate-env-to-gh-secrets.sh
```

**What they do**:
- Scan `.env` files in this order:
  - `.env.production`, `.env.prod`
  - `deploy/.env.production`, `deploy/.env.prod`
  - `infra/.env.prod`
  - `apps/portfolio-ui/.env.production`, `apps/portfolio-ui/.env`
  - `assistant_api/.env.production`, `assistant_api/.env`
- Extract values for required keys (first match wins)
- Set them as GitHub environment secrets
- Strip quotes and handle whitespace automatically

**Safeguards**:
- Never echo secret values to console
- Skip keys not found in any file
- Use temporary files to pass values securely to `gh`

---

## ⏭️ Step 3: Configure Environment Protection (UI - One Time)

**URL**: https://github.com/leok974/leo-portfolio/settings/environments/production

**Required**:
1. **Required reviewers**: Add yourself (leok974)
2. **Deployment branches**: Select "Selected branches" → Add `main`
3. Click **"Save protection rules"**

**Why**: This enforces manual approval for all production deployments

---

## ⏭️ Step 4: Verify Runner Status

```bash
# Check if runner is online
gh api repos/leok974/leo-portfolio/actions/runners --jq '.runners[] | {name, status, labels: [.labels[].name]}'
```

**Expected**:
```json
{
  "name": "prod-runner-1",
  "status": "online",
  "labels": ["self-hosted", "prod", "deploy", "Linux", "X64"]
}
```

**If offline**: Start the runner on production server:
```bash
# On prod server
docker start gh-runner-prod
docker logs -f gh-runner-prod
# Wait for: "Connected to GitHub"
```

---

## 🚀 Step 5: Bootstrap Watchtower (First-Time Setup)

### Trigger Bootstrap

```bash
gh workflow run bootstrap-watchtower.yml
```

### Watch the Run

```bash
# Wait a moment for workflow to queue
sleep 3

# Get the run ID
gh run list --workflow="Bootstrap Watchtower on Prod" --limit 1

# Watch it (will pause for approval)
gh run watch $(gh run list --workflow="Bootstrap Watchtower on Prod" --limit 1 --json databaseId -q '.[0].databaseId')
```

### Approve in UI

1. **Status**: Workflow will show "Waiting for approval"
2. **Go to**: https://github.com/leok974/leo-portfolio/actions
3. **Click**: The waiting workflow run
4. **Click**: "Review pending deployments"
5. **Select**: "production" environment
6. **Click**: "Approve and deploy"
7. **Watch**: Workflow completes

### Verify Bootstrap Success

```bash
# Check Watchtower endpoint (should return 200 or 204)
curl -sS -X POST https://api.leoklemet.com/ops/watchtower/update \
  -H "Authorization: Bearer $(gh secret list --env production | grep WATCHTOWER_HTTP_API_TOKEN | awk '{print $1}')" \
  -w "\nHTTP: %{http_code}\n"

# Expected: HTTP: 200 or HTTP: 204
```

---

## 🚀 Step 6: Deploy Backend (Force Pull)

### Trigger Redeploy

```bash
gh workflow run redeploy-backend.yml
```

### Watch the Run

```bash
# Wait a moment
sleep 3

# Watch the run (will pause for approval)
gh run watch $(gh run list --workflow="Redeploy Backend via Watchtower" --limit 1 --json databaseId -q '.[0].databaseId')
```

### Approve in UI

Same process as bootstrap:
1. Workflow waits for approval
2. Go to Actions → Review → Approve
3. Watchtower pulls latest backend image
4. Backend restarts
5. Health check passes

---

## ✅ Step 7: Verify Endpoints

### Backend Health

```bash
curl -sS https://api.leoklemet.com/api/ready | jq .
```

**Expected**:
```json
{
  "status": "ready"
}
```

### API Routes

```bash
curl -sS https://api.leoklemet.com/openapi.json | jq '.paths | keys[]' | head -20
```

**Expected**: List of routes including:
- `/api/dev/status`
- `/api/ready`
- `/api/chat`
- etc.

### Dev Status Endpoint

```bash
# Without auth (should deny)
curl -sS https://api.leoklemet.com/api/dev/status | jq .
```

**Expected**:
```json
{
  "ok": true,
  "allowed": false,
  "mode": "denied",
  ...
}
```

### With Auth

```bash
# With dev key (should allow)
curl -sS -H "x-dev-key: a61350cef0487532f2814a54499f3baeb8f207ead09bbc0e24472911ce6e0cc9" \
  https://api.leoklemet.com/api/dev/status | jq .
```

**Expected**:
```json
{
  "ok": true,
  "allowed": true,
  "mode": "token",
  ...
}
```

---

## 🧪 Step 8: Test PR Protection

### Create Test PR

```bash
# Create test branch
git checkout -b test/policy-guard
echo "# Test policy guard" >> README.md
git add README.md
git commit -m "test: verify policy guard works"
git push origin test/policy-guard
```

### Create PR via CLI

```bash
gh pr create \
  --title "Test: Policy Guard - Self-Hosted Runner Protection" \
  --body "Testing that policy guard prevents self-hosted runner usage on PRs."
```

### Verify Policy Check

```bash
# Wait for checks to run
sleep 10

# Check status
gh pr checks

# View policy workflow run
gh run list --workflow="Policy — block self-hosted runners on PRs" --limit 1
```

**Expected**:
- ✅ Policy check should **PASS** (no violations)
- ✅ No prod workflows should attempt to run on PR
- ✅ All PR checks use `ubuntu-latest`

### Test Violation (Optional)

Create a bad workflow to test policy enforcement:

```bash
# Add a violating workflow
cat > .github/workflows/test-violation.yml <<'YAML'
name: Test Violation
on:
  pull_request:
jobs:
  bad:
    runs-on: [self-hosted]  # This violates the policy
    steps:
      - run: echo "bad"
YAML

git add .github/workflows/test-violation.yml
git commit -m "test: intentional policy violation"
git push origin test/policy-guard
```

**Expected**: Policy check should **FAIL** with clear error message

### Cleanup

```bash
# Close PR
gh pr close test/policy-guard

# Delete branch
git checkout main
git branch -D test/policy-guard
git push origin --delete test/policy-guard

# Remove test violation file
git rm .github/workflows/test-violation.yml 2>/dev/null || true
```

---

## 🔄 Step 9: Test Runner Health Workflow

### Manual Trigger

```bash
gh workflow run runner-health.yml
```

### Watch Execution

```bash
sleep 3
gh run watch $(gh run list --workflow="Runner Health (prod)" --limit 1 --json databaseId -q '.[0].databaseId')
```

**Expected**:
- ✅ Shows runner hostname
- ✅ Shows timestamp
- ✅ Completes successfully

### Scheduled Runs

The workflow runs daily at 03:17 UTC. Check recent runs:

```bash
gh run list --workflow="Runner Health (prod)" --limit 5
```

---

## 📊 Monitoring Commands

### Check All Workflow Runs

```bash
# Last 10 runs across all workflows
gh run list --limit 10

# Filter by workflow
gh run list --workflow="Bootstrap Watchtower on Prod" --limit 5
gh run list --workflow="Redeploy Backend via Watchtower" --limit 5
gh run list --workflow="Runner Health (prod)" --limit 5
```

### Check Runner Status

```bash
# Quick status
gh api repos/leok974/leo-portfolio/actions/runners --jq '.runners[].status'

# Detailed info
gh api repos/leok974/leo-portfolio/actions/runners | jq '.runners[] | {name, status, busy, labels: [.labels[].name]}'
```

### View Logs

```bash
# Get run ID
RUN_ID=$(gh run list --limit 1 --json databaseId -q '.[0].databaseId')

# View logs
gh run view $RUN_ID --log

# Or watch live
gh run watch $RUN_ID
```

---

## 🚨 Troubleshooting

### Workflow Doesn't Request Approval

**Symptom**: Workflow runs immediately without approval prompt

**Cause**: Environment protection not configured

**Fix**:
1. Go to: https://github.com/leok974/leo-portfolio/settings/environments/production
2. Add required reviewers
3. Save protection rules
4. Re-run workflow

---

### Secret Not Found Error

**Symptom**: Workflow fails with "Secret not found"

**Cause**: Secret not in environment scope

**Fix**:
```bash
# List env secrets
gh secret list --env production

# Add missing secret
gh secret set <SECRET_NAME> --env production
```

---

### Watchtower Endpoint Returns 404

**Symptom**: `/ops/watchtower/update` returns 404

**Cause**: Nginx config not loaded or Watchtower not running

**Fix**:
```bash
# Re-run bootstrap
gh workflow run bootstrap-watchtower.yml

# Or on prod server, reload nginx
docker compose -f deploy/docker-compose.portfolio-prod.yml restart nginx
```

---

### Runner Offline

**Symptom**: Workflow fails with "No runner matching labels"

**Cause**: Runner container stopped

**Fix** (on prod server):
```bash
# Check status
docker ps -a | grep gh-runner-prod

# Start if stopped
docker start gh-runner-prod

# Check logs
docker logs -f gh-runner-prod
# Should see: "Connected to GitHub"

# Verify in GitHub
gh api repos/leok974/leo-portfolio/actions/runners --jq '.runners[].status'
# Should show: "online"
```

---

## 📚 Quick Reference

### Environment URLs
- **Prod API**: https://api.leoklemet.com
- **Watchtower**: https://api.leoklemet.com/ops/watchtower/update
- **Health**: https://api.leoklemet.com/api/ready

### GitHub URLs
- **Actions**: https://github.com/leok974/leo-portfolio/actions
- **Runners**: https://github.com/leok974/leo-portfolio/settings/actions/runners
- **Environments**: https://github.com/leok974/leo-portfolio/settings/environments
- **Secrets**: https://github.com/leok974/leo-portfolio/settings/secrets/actions

### Key Commands
```bash
# Trigger workflows
gh workflow run bootstrap-watchtower.yml
gh workflow run redeploy-backend.yml
gh workflow run runner-health.yml

# Watch runs
gh run watch $(gh run list --limit 1 --json databaseId -q '.[0].databaseId')

# Check runner
gh api repos/leok974/leo-portfolio/actions/runners --jq '.runners[].status'

# List secrets
gh secret list --env production

# Verify backend
curl -sS https://api.leoklemet.com/api/ready | jq .
```

---

## ✅ Completion Checklist

- [ ] Workflows deployed (bootstrap, redeploy, runner-health)
- [ ] Production environment secrets set (5-6 secrets)
- [ ] Environment protection configured (required reviewers)
- [ ] Runner online and connected
- [ ] Bootstrap completed successfully
- [ ] Watchtower endpoint returns 200/204
- [ ] Backend deployed and healthy
- [ ] Policy guard tested with PR
- [ ] Runner health workflow tested

---

**Status**: Ready to execute
**Time**: 20-30 minutes end-to-end
**Next**: Run `.\scripts\setup-prod-secrets.ps1` to configure secrets
**Then**: Bootstrap Watchtower with `gh workflow run bootstrap-watchtower.yml`
