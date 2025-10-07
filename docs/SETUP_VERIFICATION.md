# GitHub Actions Setup Verification

## ✅ Setup Checklist

Use this checklist to verify your GitHub Actions PR automation is ready to use.

### 1. GitHub Secrets Configuration ✅

**Check that `SITEAGENT_HMAC_SECRET` is added:**

1. Go to: `https://github.com/leok974/leo-portfolio/settings/secrets/actions`
2. Verify `SITEAGENT_HMAC_SECRET` appears in the list
3. If not, add it:
   ```bash
   # Generate a new secret (64-character hex)
   openssl rand -hex 32
   ```
4. Copy the output and add as repository secret

**Status:** ✅ **COMPLETE** (you mentioned it's added)

---

### 2. Workflow Permissions

**Enable read/write permissions for Actions:**

1. Go to: `https://github.com/leok974/leo-portfolio/settings/actions`
2. Scroll to **Workflow permissions**
3. Select: ✅ **Read and write permissions**
4. Check: ✅ **Allow GitHub Actions to create and approve pull requests**
5. Click **Save**

**Why needed:**
- `contents: write` - Push branches to repository
- `pull-requests: write` - Create and update PRs

---

### 3. Workflows Available

**Check that workflows are active:**

1. Go to: `https://github.com/leok974/leo-portfolio/actions`
2. Verify these workflows appear in the left sidebar:
   - ✅ **siteagent-pr-via-backend** (manual PR creation)
   - ✅ **siteagent-nightly-pr** (scheduled nightly PRs)

**Note:** Workflows become available after merging to `main` branch

---

### 4. Branch Status

**Current branch:** `auth`
**Workflow status:** ⏳ Pending (not active until merged to `main`)

**To activate workflows:**
```bash
# Option 1: Merge via GitHub UI
# Create PR from auth → main, review, and merge

# Option 2: Merge via command line
git checkout main
git merge auth
git push origin main
```

---

## 🧪 Testing the Setup

### Test 1: Manual PR Creation (Recommended First Test)

1. **Merge `auth` branch to `main`** (see above)

2. **Trigger workflow manually:**
   - Go to: `Actions` → `siteagent-pr-via-backend`
   - Click `Run workflow`
   - Fill in:
     - **Branch:** `main`
     - **Title:** `test: Verify PR automation works`
     - **Branch name:** `test/pr-automation`
     - **Body:** `Testing backend-assisted PR creation`
   - Click `Run workflow` (green button)

3. **Monitor execution:**
   - Click on the running workflow
   - Watch the steps execute:
     - ✅ Checkout repository
     - ✅ Setup Python
     - ✅ Install dependencies
     - ✅ Start backend (background)
     - ✅ Generate HMAC signature and call /agent/pr/open
   - **Expected:** All steps green ✅
   - **Output:** PR URL like `https://github.com/leok974/leo-portfolio/pull/XXX`

4. **Verify PR created:**
   - Go to: `Pull Requests` tab
   - You should see: `test: Verify PR automation works`
   - Check that it has correct title, branch, and body

**Success criteria:**
- ✅ Workflow completes successfully
- ✅ PR is created with correct details
- ✅ No error messages in logs

---

### Test 2: Dry-Run Nightly Workflow (Safe Test)

1. **Trigger workflow manually:**
   - Go to: `Actions` → `siteagent-nightly-pr`
   - Click `Run workflow`
   - Select branch: `main`
   - Click `Run workflow`

2. **Monitor execution:**
   - Watch maintenance tasks run
   - Check for changes detection
   - If changes exist, PR will be created

3. **Expected outcomes:**

**Scenario A: No changes detected**
```
ℹ️ No changes detected, skipping PR
```
- Workflow completes successfully
- No PR created (expected)

**Scenario B: Changes detected**
```
✅ Changes detected, will create PR
✅ PR created successfully!
https://github.com/leok974/leo-portfolio/pull/XXX
```
- New branch created: `siteagent/nightly/2025-01-XX`
- PR created with checklist
- PR ready for review

---

## 🔍 Troubleshooting

### Error: "pr_disabled: missing GITHUB_TOKEN"

**Cause:** Workflow not passing GITHUB_TOKEN to backend

**Fix:**
```yaml
# Verify this is in workflow YAML:
env:
  GITHUB_TOKEN: ${{ github.token }}  # ← Must be present
  SITEAGENT_HMAC_SECRET: ${{ secrets.SITEAGENT_HMAC_SECRET }}
```

**Action:** Check `.github/workflows/*.yml` files have correct env vars

---

### Error: "401 Unauthorized"

**Cause:** HMAC signature mismatch or missing secret

**Fix 1: Verify secret is set**
```bash
# Check GitHub Secrets page
https://github.com/leok974/leo-portfolio/settings/secrets/actions
```

**Fix 2: Verify secret name matches**
```yaml
# In workflow YAML, must be:
SITEAGENT_HMAC_SECRET: ${{ secrets.SITEAGENT_HMAC_SECRET }}
#                               ^^^^^^^ Must match secret name exactly
```

---

### Error: "Backend not ready" / Health check timeout

**Cause:** Backend taking too long to start

**Fix:** Increase wait time in workflow:
```yaml
# In workflow YAML:
- name: Start backend (background)
  run: |
    nohup python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8010 > backend.log 2>&1 &
    sleep 5  # ← Increase to 10 if needed

    for i in {1..30}; do  # ← Increase to 60 if needed
      if curl -sf http://127.0.0.1:8010/ready > /dev/null 2>&1; then
        echo "Backend is ready!"
        break
      fi
      sleep 1
    done
```

---

### Error: "422 Unprocessable Entity"

**Cause:** PR already exists for that branch

**Fix:** Either:
1. Close/merge the existing PR
2. Use a different branch name
3. Workflow will treat 422 as success (PR already exists is OK)

---

### Error: "github_repo_error"

**Cause:** GitHub API returned error

**Check:**
1. GitHub API status: https://www.githubstatus.com/
2. Network connectivity in Actions runner
3. GITHUB_TOKEN permissions

**Fix:** Retry workflow (temporary GitHub API issues)

---

## 📊 Verification Commands

### Local Verification (Before Merging)

**Test backend endpoint locally:**
```bash
# 1. Set environment variables
export GITHUB_TOKEN="ghp_your_test_pat"  # Get from https://github.com/settings/tokens
export GITHUB_REPO="leok974/leo-portfolio"
export SITEAGENT_HMAC_SECRET="your-secret-from-github"

# 2. Start backend
python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8010 &
sleep 3

# 3. Test health check
curl http://127.0.0.1:8010/ready
# Expected: {"status":"ready",...}

# 4. Generate HMAC and test PR endpoint
BODY='{"title":"Test PR","branch":"test-branch","body":"Test"}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SITEAGENT_HMAC_SECRET" | sed 's/^.* //')

curl -X POST http://127.0.0.1:8010/agent/pr/open \
  -H "Content-Type: application/json" \
  -H "X-SiteAgent-Signature: sha256=$SIG" \
  -d "$BODY"

# Expected: {"ok":true,"repo":"leok974/leo-portfolio","url":"https://github.com/...","number":XXX,"status":"created"}
```

**Test without GITHUB_TOKEN (should fail gracefully):**
```bash
# 1. Unset token
unset GITHUB_TOKEN

# 2. Start backend
python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8010 &

# 3. Try to create PR
curl -X POST http://127.0.0.1:8010/agent/pr/open \
  -H "Content-Type: application/json" \
  -H "X-SiteAgent-Signature: sha256=$SIG" \
  -d "$BODY"

# Expected: {"detail":"pr_disabled: missing GITHUB_TOKEN. Set GITHUB_TOKEN env var to enable PR automation."}
```

---

## ✅ Final Checklist

Before using in production:

- [ ] `SITEAGENT_HMAC_SECRET` added to GitHub Secrets
- [ ] Workflow permissions enabled (read/write + PR creation)
- [ ] `auth` branch merged to `main`
- [ ] Manual PR workflow tested successfully
- [ ] Nightly PR workflow tested (dry-run)
- [ ] Local backend testing passed
- [ ] Documentation reviewed

---

## 🎯 Next Steps

After successful testing:

1. **Use manual workflow for on-demand PRs:**
   - Use when you have changes to PR
   - Customize title/body as needed
   - Great for routine maintenance

2. **Let nightly workflow run automatically:**
   - Runs daily at 03:27 UTC
   - Creates PR only if changes detected
   - Review and merge PRs as needed

3. **Monitor workflow runs:**
   - Check `Actions` tab regularly
   - Review any failures
   - Adjust timings if needed

4. **Consider enhancements:**
   - Add labels to PRs automatically
   - Enable auto-merge for trivial changes
   - Add Slack/email notifications
   - Customize maintenance tasks

---

## 📚 Related Documentation

- **PHASE_47_AGENT_ENHANCEMENTS.md** - Backend implementation details
- **docs/GITHUB_WORKFLOWS.md** - Complete workflow documentation
- **AGENT_TOOLS_WEB_UI.md** - Agent tools web interface
- **DEV_OVERLAY_COOKIE_AUTH.md** - Development overlay access

---

## 🆘 Getting Help

If you encounter issues:

1. **Check workflow logs:**
   - Go to `Actions` → Click failing run → View logs
   - Look for `Backend logs` section in failed runs

2. **Check backend logs in workflow:**
   ```yaml
   - name: Show backend logs on failure
     if: failure()
     run: cat backend.log
   ```

3. **Test locally** using commands above

4. **Verify all secrets and permissions** are configured correctly
