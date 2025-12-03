# Production Runner Security Lockdown

**Date**: 2025-10-22
**Status**: ✅ Code changes complete, UI configuration required
**Goal**: Lock down self-hosted "prod" runner to prevent unauthorized access and PR execution

---

## 🎯 Security Goals

1. **Never run on PRs** - PRs from forks cannot execute on production infrastructure
2. **Require approvals** - All prod deployments require manual approval
3. **Minimal permissions** - Workflows use least-privileged access
4. **Label-gated** - Only `[self-hosted, prod, deploy]` labels can target runner
5. **Concurrency control** - Only one prod deploy at a time

---

## ✅ Part 1: Code Changes (COMPLETE)

### Workflows Hardened

**1. `.github/workflows/bootstrap-watchtower.yml`**
- ✅ Added `permissions: contents: read` (minimal)
- ✅ Added `concurrency: prod-deploy` (no parallel deploys)
- ✅ Added PR guard: `if: github.event_name != 'pull_request'`
- ✅ Added `environment: production` (requires approval)
- ✅ Changed to self-hosted runner: `runs-on: [self-hosted, prod, deploy]`

**2. `.github/workflows/smoke-selfhosted.yml`**
- ✅ Added `permissions: contents: read` (minimal)
- ✅ Added `concurrency: prod-runner-smoke` (no parallel tests)
- ✅ Added PR guard: `if: github.event_name != 'pull_request'`
- ✅ Added `environment: production` (requires approval)
- ✅ Already using: `runs-on: [self-hosted, prod, deploy]`

**3. `.github/workflows/redeploy-backend.yml`**
- ✅ Added `permissions: contents: read` (minimal)
- ✅ Added `concurrency: prod-deploy` (no parallel deploys)
- ✅ Added PR guard: `if: github.event_name == 'workflow_dispatch'` (manual only)
- ✅ Added `environment: production` (requires approval)
- ✅ Changed to self-hosted: `runs-on: [self-hosted, prod, deploy]`

### Verification

```bash
# Confirm only 3 workflows use self-hosted
grep -r "runs-on.*self-hosted" .github/workflows/*.yml | wc -l
# Expected: 3 matches

# Confirm PR workflows use ubuntu-latest
grep -A2 "pull_request:" .github/workflows/*.yml | grep "runs-on" | grep "ubuntu-latest" | wc -l
# Expected: Many matches (all PR workflows safe)
```

---

## ⏳ Part 2: GitHub UI Configuration (REQUIRED)

### Step 1: Create Protected Environment

**Location**: https://github.com/leok974/leo-portfolio/settings/environments

**Steps**:
1. Click **"New environment"**
2. Name: `production`
3. Click **"Configure environment"**

**Protection Rules**:
- ✅ **Required reviewers**: Add yourself (leok974) and any trusted maintainers
  - Click "Add required reviewers"
  - Search for your username
  - Click "Add"

- ✅ **Wait timer**: 0 minutes (optional - add delay if you want)
  - Leave at 0 for immediate approval after clicking

- ✅ **Allow administrators to bypass**: ❌ OFF (even admins need approval)

- ✅ **Prevent self-review**: ❌ OFF (you can approve your own for solo project)

**Environment Secrets** (move from repo secrets):

Click **"Add secret"** for each:

| Secret Name | Source | Notes |
|------------|--------|-------|
| `WATCHTOWER_HTTP_API_TOKEN` | Repo secret | Move to environment |
| `WATCHTOWER_UPDATE_URL` | Repo secret | Move to environment |
| `FIGMA_PAT` | Repo secret | Move to environment |
| `FIGMA_TEMPLATE_KEY` | Repo secret | Move to environment |
| `FIGMA_TEAM_ID` | Repo secret | Move to environment (can be empty) |
| `OPENAI_API_KEY` | Repo secret | Move to environment (fallback) |

**Why move secrets?**
- Environment-scoped secrets are only accessible when `environment: production` is declared
- Adds another layer of protection against PR secret leakage

**How to move**:
1. Copy value from: Settings → Secrets and variables → Actions → Repository secrets
2. Add to: Environments → production → Environment secrets
3. (Optional) Delete from repo secrets after confirming workflows work

---

### Step 2: Restrict Runner to Repository

**Location**: https://github.com/leok974/leo-portfolio/settings/actions/runners

**Current Runner**:
- Name: `prod-runner-1`
- Status: Should be "Idle" (green)
- Labels: `self-hosted`, `prod`, `deploy`

**Actions Required**:

1. **Create Runner Group** (if not exists):
   - Organization Settings → Actions → Runner groups → New runner group
   - Name: `production-runners`
   - Repository access: **Selected repositories** → `leo-portfolio` ONLY
   - Workflow access: **Selected workflows** → Choose:
     - `bootstrap-watchtower.yml`
     - `smoke-selfhosted.yml`
     - `redeploy-backend.yml`

2. **Assign Runner to Group**:
   - Click on `prod-runner-1`
   - Change runner group: `production-runners`
   - Verify labels: `self-hosted`, `prod`, `deploy`

3. **Verify No Other Workflows Target These Labels**:
   ```bash
   # Search for any workflow using self-hosted that isn't one of the 3
   grep -l "self-hosted" .github/workflows/*.yml | \
     grep -v -e bootstrap-watchtower -e smoke-selfhosted -e redeploy-backend
   # Expected: No output (empty)
   ```

---

### Step 3: Tighten Repository Action Settings

**Location**: https://github.com/leok974/leo-portfolio/settings/actions

**Required Settings**:

**General → Workflow permissions**:
- ✅ **Read repository contents and packages permissions** (not write)
- ❌ **Allow GitHub Actions to create and approve pull requests**: OFF

**General → Fork pull request workflows**:
- ✅ **Require approval for first-time contributors**: ON
- ✅ **Require approval for all outside collaborators**: ON

**General → Actions permissions**:
- ✅ **Allow all actions and reusable workflows** (current setting OK)
- OR ✅ **Allow select actions** → Add allowlist if you want strict control

**Runners → Runner groups**:
- ✅ Verify `prod-runner-1` is in restricted group

---

### Step 4: Verify PR Workflows Don't Use Self-Hosted

**Command**:
```bash
# Check all workflows triggered by pull_request
grep -l "pull_request" .github/workflows/*.yml | \
  xargs grep -L "self-hosted" | wc -l
# Expected: Many files (all PR workflows avoid self-hosted)

# Ensure no PR workflow uses self-hosted
grep -l "pull_request" .github/workflows/*.yml | \
  xargs grep "self-hosted" | wc -l
# Expected: 0
```

**Manual Spot Check** (critical workflows):
- ✅ `ci.yml` → `ubuntu-latest` ✓
- ✅ `e2e-hermetic.yml` → `ubuntu-latest` ✓
- ✅ `backend-tests.yml` → `ubuntu-latest` ✓
- ✅ `frontend-fast.yml` → `ubuntu-latest` ✓

---

## 🧪 Part 3: Testing (SAFE)

### Test 1: Approval Gate Works

**Action**: Trigger smoke test
```bash
gh workflow run smoke-selfhosted.yml
```

**Expected**:
1. Workflow appears in Actions tab with status: **"Waiting"**
2. Yellow badge: **"Waiting for approval"**
3. Button: **"Review pending deployments"**
4. Click "Approve and deploy"
5. Workflow runs successfully ✅

**If it runs immediately without approval** → Environment protection not set up correctly

---

### Test 2: PR Cannot Target Prod Runner

**Action**: Create test PR from fork (or branch)
```bash
# Create test branch
git checkout -b test/runner-security
echo "# Test" >> README.md
git add README.md
git commit -m "test: verify runner security"
git push origin test/runner-security
```

**Create PR**: https://github.com/leok974/leo-portfolio/compare/test/runner-security

**Expected**:
- ✅ PR workflows run on `ubuntu-latest` (CI, tests, linting)
- ✅ No workflow tries to use `self-hosted` runner
- ✅ No "Waiting for runner" errors

**If PR tries to use self-hosted** → Workflow still has incorrect `runs-on` or missing PR guard

---

### Test 3: Bootstrap Requires Confirmation

**Action**: Trigger bootstrap without typing "bootstrap"
```bash
gh workflow run bootstrap-watchtower.yml
# Don't type anything in confirm field (leave default empty)
```

**Expected**:
- ✅ Workflow is skipped with: "Job skipped due to conditional check"

**Action**: Trigger with correct confirmation
```bash
gh workflow run bootstrap-watchtower.yml -f confirm=bootstrap
```

**Expected**:
1. ✅ Waits for approval
2. ✅ After approval, runs successfully
3. ✅ Deploys to production

---

### Test 4: Redeploy Uses Prod Runner

**Action**: Trigger redeploy
```bash
gh workflow run redeploy-backend.yml
```

**Expected**:
1. ✅ Waits for approval (environment protection)
2. ✅ After approval, runs on `prod-runner-1` (check logs for hostname)
3. ✅ Calls Watchtower endpoint successfully
4. ✅ Backend health check passes

**Verify Runner Used**:
```bash
gh run list --workflow=redeploy-backend.yml --limit 1 --json conclusion,headBranch
gh run view <RUN_ID> --log | grep "Runner hostname"
# Should show prod server hostname (not GitHub-hosted)
```

---

### Test 5: Concurrent Deploy Blocked

**Action**: Trigger two bootstrap workflows rapidly
```bash
gh workflow run bootstrap-watchtower.yml -f confirm=bootstrap &
sleep 2
gh workflow run bootstrap-watchtower.yml -f confirm=bootstrap &
```

**Expected**:
- ✅ First workflow runs (after approval)
- ✅ Second workflow queued with: "Waiting for pending jobs in the prod-deploy concurrency group"
- ✅ Second workflow starts only after first completes

---

## 🔒 Security Audit Checklist

### Pre-Deployment
- [ ] All prod workflows have `permissions: contents: read`
- [ ] All prod workflows have PR guards (`if: github.event_name != 'pull_request'`)
- [ ] All prod workflows use `environment: production`
- [ ] All prod workflows use `runs-on: [self-hosted, prod, deploy]`
- [ ] All prod workflows have `concurrency: prod-deploy` (or unique group)

### GitHub Configuration
- [ ] Environment `production` created
- [ ] Required reviewers added (at least 1)
- [ ] Environment secrets moved from repo scope
- [ ] Runner group created and restricted to this repo
- [ ] `prod-runner-1` assigned to restricted group
- [ ] Workflow permissions set to "Read" only
- [ ] Fork PR approval required

### Verification
- [ ] No PR workflow uses `self-hosted` labels
- [ ] Smoke test requires approval before running
- [ ] Bootstrap requires approval + confirmation
- [ ] Redeploy requires approval (manual only)
- [ ] Test PR cannot trigger prod runner
- [ ] Concurrent deploys are blocked/queued

---

## 📊 Before/After Comparison

| Aspect | Before | After |
|--------|--------|-------|
| **PR Safety** | ❌ PRs could trigger prod runner | ✅ PRs blocked by guards + labels |
| **Approval** | ❌ Direct deployment (no review) | ✅ Requires approval for every run |
| **Permissions** | ❌ Default write access | ✅ Read-only (least privilege) |
| **Concurrency** | ❌ Multiple deploys possible | ✅ Queued (one at a time) |
| **Secrets** | ⚠️  Repo-scoped (accessible by all) | ✅ Environment-scoped (gated) |
| **Runner Access** | ⚠️  Any workflow could target | ✅ Label-gated + group-restricted |

---

## 🚨 Incident Response

### Unauthorized Workflow Runs Prod Runner

**Detection**: Check runner logs
```bash
docker logs gh-runner-prod | grep "Running job"
```

**Response**:
1. Stop runner immediately:
   ```bash
   docker stop gh-runner-prod
   ```

2. Check workflow run in GitHub Actions:
   - Identify: Job name, trigger event, PR/branch
   - Review: Workflow file in `.github/workflows/`

3. Fix workflow:
   - Add PR guard: `if: github.event_name != 'pull_request'`
   - Add environment: `environment: production`
   - Change runner: `runs-on: [self-hosted, prod, deploy]`

4. Restart runner:
   ```bash
   docker start gh-runner-prod
   ```

---

### PR Attempts to Use Prod Runner

**Detection**: PR check fails with "No runner matching labels"

**Response**:
1. Verify PR workflow uses `ubuntu-latest`:
   ```bash
   grep -A5 "pull_request:" .github/workflows/<WORKFLOW>.yml
   ```

2. If workflow incorrectly uses `self-hosted`:
   - Request changes in PR
   - Or fix directly if you're the author

**Prevention**: Add pre-commit hook or CI check:
```bash
# .github/workflows/workflow-lint.yml
name: Workflow Lint
on: [pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: No self-hosted in PR workflows
        run: |
          files=$(grep -l "pull_request" .github/workflows/*.yml || true)
          if echo "$files" | xargs grep -l "self-hosted" 2>/dev/null; then
            echo "❌ PR workflows must not use self-hosted runners"
            exit 1
          fi
          echo "✅ All PR workflows use GitHub-hosted runners"
```

---

### Secrets Leaked in Logs

**Detection**: Secrets appear in workflow logs (should be masked)

**Response**:
1. Delete workflow run immediately:
   - Actions → Workflow → Run → Delete workflow run

2. Rotate secrets:
   - `WATCHTOWER_HTTP_API_TOKEN`: Regenerate and update
   - `FIGMA_PAT`: Rotate in Figma settings
   - `OPENAI_API_KEY`: Rotate in OpenAI dashboard

3. Update environment secrets with new values

4. Check if secret was committed to git:
   ```bash
   git log -S"<SECRET_VALUE>" --all
   ```

**Prevention**: Use `::add-mask::` in workflows:
```yaml
- name: Mask custom value
  run: echo "::add-mask::${{ secrets.MY_SECRET }}"
```

---

## 📚 References

**GitHub Docs**:
- [Deployment protection rules](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment#environment-protection-rules)
- [Self-hosted runners security](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/about-self-hosted-runners#self-hosted-runner-security)
- [Workflow permissions](https://docs.github.com/en/actions/using-jobs/assigning-permissions-to-jobs)

**Best Practices**:
- Never run self-hosted runners on public repos (PRs from forks)
- Always use environment protection for production
- Scope secrets to environments, not repos
- Use minimal permissions in workflows
- Implement concurrency controls for critical operations

---

## ✅ Completion Checklist

### Code Changes
- [x] Harden `bootstrap-watchtower.yml`
- [x] Harden `smoke-selfhosted.yml`
- [x] Harden `redeploy-backend.yml`
- [x] Verify no other workflows use self-hosted
- [x] Commit and push changes

### GitHub UI Configuration
- [ ] Create `production` environment
- [ ] Add required reviewers
- [ ] Move secrets to environment scope
- [ ] Create runner group (if org)
- [ ] Assign runner to restricted group
- [ ] Set workflow permissions to read-only
- [ ] Enable fork PR approval

### Testing
- [ ] Test approval gate (smoke test)
- [ ] Test PR cannot use runner (create test PR)
- [ ] Test bootstrap requires confirmation
- [ ] Test redeploy uses prod runner
- [ ] Test concurrent deploy blocked

### Documentation
- [x] Create security lockdown guide
- [x] Document UI configuration steps
- [x] Document testing procedures
- [x] Document incident response

---

**Status**: Code complete, awaiting UI configuration
**Next**: Complete "GitHub UI Configuration" steps above
**ETA**: 15-20 minutes for full setup
**Security Level**: 🔒🔒🔒 High (after completion)
