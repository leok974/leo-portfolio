# Production Deployment Execution - October 22, 2025

**Status**: In Progress
**Last Updated**: 2025-10-22

---

## ✅ Completed Steps

### Step 1: Workflows Deployed ✅
- ✅ Policy guard workflow created
- ✅ Bootstrap workflow simplified (4 steps)
- ✅ Redeploy workflow simplified (3 steps)
- ✅ Runner health workflow added
- ✅ Committed: e4fd2a1, 72731ba, 75dabdc, 1bd3a76

### Step 2: Production Environment Secrets ✅
All 6 secrets configured:
- ✅ `WATCHTOWER_HTTP_API_TOKEN` (from .env)
- ✅ `WATCHTOWER_UPDATE_URL` (known value)
- ✅ `FIGMA_PAT` (from .env)
- ✅ `FIGMA_TEAM_ID` (from .env)
- ✅ `FIGMA_TEMPLATE_KEY` (from .env)
- ✅ `OPENAI_API_KEY` (from secrets/openai_api_key)

**Verified**:
```bash
gh secret list --env production
# All 6 secrets present ✓
```

### Step 3: Migration Scripts Created ✅
- ✅ `scripts/migrate-env-to-gh-secrets.sh` (bash)
- ✅ `scripts/migrate-env-to-gh-secrets.ps1` (PowerShell)
- ✅ Migration executed successfully
- ✅ CLI_SETUP_GUIDE.md updated

---

## ⏳ Pending Steps

### Step 4: Configure Environment Protection (UI Required)
**URL**: https://github.com/leok974/leo-portfolio/settings/environments/production

**Required actions**:
- [ ] Add required reviewer: `leok974`
- [ ] Set deployment branches: Select "Selected branches" → Add `main`
- [ ] Click "Save protection rules"

**Why**: Enforces manual approval for all production deployments

---

### Step 5: Verify Runner Status ⚠️
**Current Status**: No runners found (offline or not registered)

**Command**:
```powershell
gh api repos/leok974/leo-portfolio/actions/runners --jq '.runners[] | {name,status,labels:[.labels[].name]}'
```

**Expected**:
```json
{
  "name": "prod-runner-1",
  "status": "online",
  "labels": ["self-hosted", "prod", "deploy"]
}
```

**If offline, start on prod host**:
```bash
# Get a new registration token first
gh api -X POST repos/leok974/leo-portfolio/actions/runners/registration-token --jq '.token'

# Then start the runner
docker run -d --restart unless-stopped --name gh-runner-prod \
  -e REPO_URL="https://github.com/leok974/leo-portfolio" \
  -e RUNNER_NAME="prod-runner-1" \
  -e RUNNER_LABELS="self-hosted,prod,deploy" \
  -e RUNNER_TOKEN="<NEW_REG_TOKEN>" \
  -e RUNNER_WORKDIR="/runner/_work" \
  -v /srv/gh-runner:/runner \
  -v /var/run/docker.sock:/var/run/docker.sock \
  myoung34/github-runner:latest

# Wait ~15 seconds, then verify
gh api repos/leok974/leo-portfolio/actions/runners --jq '.runners[] | {name,status}'
```

---

### Step 6: Bootstrap Watchtower (After runner online)

**Trigger workflow**:
```powershell
gh workflow run bootstrap-watchtower.yml
```

**Approve deployment**:
1. Go to: https://github.com/leok974/leo-portfolio/actions
2. Click "Bootstrap Watchtower on Prod" (waiting for approval)
3. Click "Review pending deployments"
4. Select "production"
5. Click "Approve and deploy"

**Watch execution**:
```powershell
Start-Sleep -Seconds 3
gh run watch $(gh run list --workflow="Bootstrap Watchtower on Prod" --limit 1 --json databaseId -q '.[0].databaseId')
```

**Verify Watchtower is live**:
```powershell
# Get the token first
$env:WATCHTOWER_HTTP_API_TOKEN = (gh secret list --repo leok974/leo-portfolio --json name | ConvertFrom-Json | Where-Object { $_.name -eq "WATCHTOWER_HTTP_API_TOKEN" }).name

# Test the endpoint
curl -sS -X POST "https://api.leoklemet.com/ops/watchtower/update" `
  -H "Authorization: Bearer $env:WATCHTOWER_HTTP_API_TOKEN"
```

**Expected**: HTTP 200 or 204

---

### Step 7: Redeploy Backend (After Watchtower verified)

**Trigger workflow**:
```powershell
gh workflow run redeploy-backend.yml
```

**Approve deployment** (same process as Step 6):
1. Go to Actions tab
2. Click "Redeploy Backend via Watchtower"
3. Approve the deployment

**Watch execution**:
```powershell
Start-Sleep -Seconds 3
gh run watch $(gh run list --workflow="Redeploy Backend via Watchtower" --limit 1 --json databaseId -q '.[0].databaseId')
```

**Verify backend is ready**:
```powershell
# 1. Health check
curl -sS https://api.leoklemet.com/api/ready | jq .
# Expected: {"status":"ready"}

# 2. Dev status (no auth)
curl -sS https://api.leoklemet.com/api/dev/status | jq .
# Expected: {"ok":true,"allowed":false,...}

# 3. Dev status (with auth)
curl -sS -H "x-dev-key: a61350cef0487532f2814a54499f3baeb8f207ead09bbc0e24472911ce6e0cc9" https://api.leoklemet.com/api/dev/status | jq .
# Expected: {"ok":true,"allowed":true,...}

# 4. List API routes
curl -sS https://api.leoklemet.com/openapi.json | jq '.paths | keys[]' | Select-Object -First 10
```

---

## 🧪 Optional: Test PR Protection

**Create test PR**:
```powershell
git checkout -b test/policy-guard
echo "# Test policy guard" >> README.md
git add README.md
git commit -m "test: verify policy guard"
git push origin test/policy-guard
gh pr create --title "Test: Policy Guard" --body "Testing automated PR protection"
```

**Verify policy runs**:
```powershell
gh pr checks
# Expected: "Policy — block self-hosted runners on PRs" should PASS
```

**Cleanup**:
```powershell
gh pr close --delete-branch
git checkout main
```

---

## 🎯 Success Criteria

- [x] All 6 secrets in production environment
- [ ] Required reviewers configured
- [ ] Runner status: online
- [ ] Bootstrap workflow completed successfully
- [ ] Watchtower endpoint returns 200/204
- [ ] Redeploy workflow completed successfully
- [ ] Backend `/api/ready` returns 200
- [ ] Backend `/api/dev/status` returns 200
- [ ] All API routes accessible

---

## 📊 Current Blockers

1. **Runner offline/not registered**: Need to start on prod host
2. **Environment protection not configured**: UI-only step required
3. **Cannot bootstrap until runner is online**: Dependency on #1

---

## 🔗 Quick Links

- **Actions**: https://github.com/leok974/leo-portfolio/actions
- **Environment Settings**: https://github.com/leok974/leo-portfolio/settings/environments/production
- **Runner Settings**: https://github.com/leok974/leo-portfolio/settings/actions/runners
- **Secrets**: https://github.com/leok974/leo-portfolio/settings/secrets/actions

---

## 📝 Notes

- Migration scripts work perfectly with stdin pipe approach
- FIGMA secrets were found and migrated successfully
- OPENAI_API_KEY retrieved from `secrets/openai_api_key` file
- Policy guard workflow is active and protecting PRs
- All workflows simplified and hardened with security controls

---

## 🚀 Next Action

**Immediate**: Configure environment protection in GitHub UI, then verify/start runner on prod host.

Once runner is online → Bootstrap → Deploy → Verify endpoints
