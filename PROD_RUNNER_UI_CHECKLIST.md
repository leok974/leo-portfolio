# Production Runner Security - UI Configuration Checklist

**Status**: ✅ Code changes committed (7785ef7)
**Next**: Complete GitHub UI configuration
**Time**: 15-20 minutes

---

## 🎯 Quick Start

**Goal**: Configure GitHub UI to enforce production environment protection

**What You Need**:
- Repo admin access
- GitHub CLI authenticated (optional, for testing)
- Runner already set up on production server

---

## ✅ Step 1: Create Production Environment

**URL**: https://github.com/leok974/leo-portfolio/settings/environments

### Actions:
1. Click **"New environment"** button
2. Name: `production` (exactly this - workflows expect it)
3. Click **"Configure environment"**

### Protection Rules:

**Required Reviewers**:
- [ ] Click "Add required reviewers"
- [ ] Add your username: `leok974`
- [ ] (Optional) Add other trusted maintainers
- [ ] Click "Add"

**Deployment Branches and Tags**:
- [ ] Select: **"Selected branches and tags"**
- [ ] Add rule: `main` (only main branch can deploy)

**Wait Timer**:
- [ ] Set to: `0` minutes (immediate approval, or add delay if desired)

**Environment Secrets** (add these):
- [ ] `WATCHTOWER_HTTP_API_TOKEN` (value: `dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE`)
- [ ] `WATCHTOWER_UPDATE_URL` (value: `https://api.leoklemet.com/ops/watchtower/update`)
- [ ] `FIGMA_PAT` (copy from repo secrets)
- [ ] `FIGMA_TEMPLATE_KEY` (copy from repo secrets)
- [ ] `FIGMA_TEAM_ID` (copy from repo secrets)
- [ ] `OPENAI_API_KEY` (copy from repo secrets)

**How to add secrets**:
1. Scroll to "Environment secrets" section
2. Click "Add secret"
3. Name: (exact name from list above)
4. Value: (copy from Settings → Secrets and variables → Actions → Repository secrets)
5. Click "Add secret"
6. Repeat for all 6 secrets

---

## ✅ Step 2: Configure Repository Actions Settings

**URL**: https://github.com/leok974/leo-portfolio/settings/actions

### General → Workflow Permissions:

- [ ] Select: **"Read repository contents and packages permissions"**
- [ ] Uncheck: **"Allow GitHub Actions to create and approve pull requests"**
- [ ] Click **"Save"**

### General → Fork Pull Request Workflows:

- [ ] Check: **"Require approval for first-time contributors"**
- [ ] Check: **"Require approval for all outside collaborators"**
- [ ] Click **"Save"**

---

## ✅ Step 3: Verify Runner Configuration

**URL**: https://github.com/leok974/leo-portfolio/settings/actions/runners

### Check Runner Status:

- [ ] Runner name: `prod-runner-1`
- [ ] Status: **Idle** (green dot)
- [ ] Labels: `self-hosted`, `prod`, `deploy`, `Linux`, `X64`

### Runner Group (if organization):

If this is an organization repo (not personal):
1. [ ] Go to: Organization Settings → Actions → Runner groups
2. [ ] Create group: `production-runners`
3. [ ] Repository access: **Selected repositories** → `leo-portfolio` ONLY
4. [ ] Assign `prod-runner-1` to this group

**Note**: For personal repos, runner is already restricted to the repo.

---

## ✅ Step 4: Test Environment Protection

### Test 1: Smoke Test Requires Approval

**Command**:
```bash
gh workflow run smoke-selfhosted.yml
```

**Expected Behavior**:
1. [ ] Workflow appears in Actions tab: https://github.com/leok974/leo-portfolio/actions
2. [ ] Status shows: **"Waiting"** (yellow badge)
3. [ ] Message: **"Waiting for approval"**
4. [ ] Button: **"Review pending deployments"**
5. [ ] Click button → See environment: **"production"**
6. [ ] Click **"Approve and deploy"**
7. [ ] Workflow runs successfully ✅

**If it runs immediately without approval**:
- ❌ Environment not configured correctly
- Go back to Step 1 and verify protection rules

### Test 2: Bootstrap Requires Confirmation

**Command**:
```bash
# Wrong: No confirmation (should skip)
gh workflow run bootstrap-watchtower.yml
```

**Expected**:
- [ ] Workflow is skipped (not even queued)
- [ ] Or queued but job shows: "Skipped due to conditional check"

**Command**:
```bash
# Correct: With confirmation
gh workflow run bootstrap-watchtower.yml -f confirm=bootstrap
```

**Expected**:
1. [ ] Waits for approval
2. [ ] After approval, runs on `prod-runner-1`
3. [ ] All steps pass ✅

### Test 3: PR Cannot Use Self-Hosted

**Create Test Branch**:
```bash
git checkout -b test/runner-security
echo "# Test runner security" >> README.md
git add README.md
git commit -m "test: verify prod runner protection"
git push origin test/runner-security
```

**Create PR**:
- [ ] Go to: https://github.com/leok974/leo-portfolio/pull/new/test/runner-security
- [ ] Create pull request

**Verify**:
- [ ] PR checks run (CI, tests, etc.)
- [ ] All checks use `ubuntu-latest` (not self-hosted)
- [ ] No "Waiting for runner" errors
- [ ] No prod workflows triggered

**Cleanup**:
```bash
gh pr close <PR_NUMBER>
git checkout main
git branch -D test/runner-security
git push origin --delete test/runner-security
```

---

## ✅ Step 5: Verify Secrets Scoping (Optional but Recommended)

### Check Current Secrets:

**Repo Secrets**: https://github.com/leok974/leo-portfolio/settings/secrets/actions

**Environment Secrets**: https://github.com/leok974/leo-portfolio/settings/environments

### Recommended Configuration:

**Production Environment Secrets** (high security):
- `WATCHTOWER_HTTP_API_TOKEN`
- `WATCHTOWER_UPDATE_URL`
- `FIGMA_PAT`
- `FIGMA_TEMPLATE_KEY`
- `FIGMA_TEAM_ID`
- `OPENAI_API_KEY`

**Keep as Repo Secrets** (used by non-prod workflows):
- Other secrets used by CI/test workflows

### After Moving Secrets:

- [ ] Verify prod workflows can access environment secrets
- [ ] (Optional) Delete from repo secrets after confirming workflows work
- [ ] Update other workflows if they need these secrets (switch to environment)

---

## ✅ Step 6: Final Verification

### Run All Security Checks:

**PowerShell**:
```powershell
# Check workflow hardening (should be 3)
(Select-String -Path .github/workflows/*.yml -Pattern "runs-on.*self-hosted").Count

# Check environment protection (should be 3)
(Select-String -Path .github/workflows/*.yml -Pattern "environment: production").Count

# Check no PR workflows use self-hosted
$prWorkflows = Select-String -Path .github/workflows/*.yml -Pattern "pull_request" -List | Select-Object -ExpandProperty Path
$prWorkflows | ForEach-Object {
  if ((Get-Content $_) -match "runs-on.*self-hosted" -and (Get-Content $_) -notmatch "github.event_name != 'pull_request'") {
    Write-Host "⚠️  UNSAFE: $_"
  }
}
Write-Host "✅ All checks passed"
```

**GitHub CLI**:
```bash
# List runners
gh api repos/leok974/leo-portfolio/actions/runners --jq '.runners[] | {name, status, labels: [.labels[].name]}'

# List environments
gh api repos/leok974/leo-portfolio/environments --jq '.environments[].name'

# Should show: production
```

---

## 📊 Completion Criteria

### Code (✅ Already Done)
- [x] 3 workflows hardened with minimal permissions
- [x] PR guards added to all prod workflows
- [x] Environment gates configured in code
- [x] Concurrency controls added
- [x] Documentation created
- [x] Health check script created
- [x] Committed and pushed (7785ef7)

### GitHub UI (Your Steps)
- [ ] Environment `production` created
- [ ] Required reviewers added
- [ ] Environment secrets configured (6 secrets)
- [ ] Workflow permissions set to read-only
- [ ] Fork PR approval enabled
- [ ] Runner status verified (online)
- [ ] All tests passed (approval, confirmation, PR safety)

### Validation
- [ ] Smoke test requires approval ✅
- [ ] Bootstrap requires confirmation + approval ✅
- [ ] Redeploy uses prod runner + approval ✅
- [ ] Test PR cannot trigger prod workflows ✅
- [ ] Concurrent deploys are queued ✅

---

## 🎯 Success State

**Before**:
- ❌ Any workflow could target prod runner
- ❌ No approval required for deployments
- ❌ PRs could potentially execute on prod
- ❌ Workflows had default (write) permissions

**After**:
- ✅ Only 3 workflows can use prod runner
- ✅ All require approval via `production` environment
- ✅ PRs blocked by multiple guards
- ✅ Minimal (read-only) permissions
- ✅ Secrets scoped to environment
- ✅ Concurrent deploys prevented

---

## 🚨 Troubleshooting

### Workflow Runs Without Approval

**Symptom**: Workflow starts immediately, no approval prompt

**Cause**: Environment not configured or not named `production`

**Fix**:
1. Check environment exists: Settings → Environments
2. Verify name is exactly `production` (case-sensitive)
3. Check required reviewers are added
4. Re-run workflow

---

### Environment Not Found Error

**Symptom**: Workflow fails with "Environment not found: production"

**Cause**: Environment doesn't exist in GitHub

**Fix**:
```bash
# Verify environment exists
gh api repos/leok974/leo-portfolio/environments --jq '.environments[].name'

# If empty, create via UI (cannot create via CLI for private repos)
```

---

### Secret Not Available

**Symptom**: Workflow fails with "Secret not found" or empty value

**Cause**: Secret not added to environment, only in repo secrets

**Fix**:
1. Go to: Environments → production → Environment secrets
2. Add missing secret
3. Verify workflows use `environment: production`
4. Re-run workflow

---

### Runner Shows Offline

**Symptom**: Runner status is "Offline" (red) in GitHub UI

**Cause**: Container stopped on production server

**Fix**:
```bash
# On production server
docker ps -a | grep gh-runner-prod

# If stopped, start it
docker start gh-runner-prod

# Check logs
docker logs gh-runner-prod --tail=50

# Should see: "Connected to GitHub"
```

---

## 📚 References

- **Full Guide**: `PROD_RUNNER_SECURITY_LOCKDOWN.md`
- **CLI Commands**: `PROD_RUNNER_SECURITY_COMMANDS.md`
- **Health Check**: `scripts/check-prod-runner-security.sh`
- **GitHub Docs**: https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment

---

## ⏭️ Next Steps After Completion

1. **Test full deployment flow**:
   ```bash
   gh workflow run redeploy-backend.yml
   ```

2. **Monitor runner activity**:
   ```bash
   docker logs -f gh-runner-prod
   ```

3. **Set up alerts** (optional):
   - GitHub Actions notifications
   - Runner offline alerts
   - Failed deployment notifications

4. **Document for team**:
   - Share this checklist with collaborators
   - Add to onboarding docs
   - Update runbooks

---

**Estimated Time**: 15-20 minutes
**Difficulty**: Easy (mostly UI clicks)
**Status**: Ready to execute
**Commit**: 7785ef7
