# Phase 50.5 - Next Steps & Testing Guide

**Date:** 2025-10-08
**Current Status:** Backend Running ✅ | Frontend Built ✅ | Preview Running ✅
**Next Action:** Configure environment and test tools page

## ✅ Completed So Far

1. ✅ Backend running on port 8001
2. ✅ SEO endpoints tested and working:
   - `POST /agent/seo/tune?dry_run=true` → 200 OK
   - `GET /agent/seo/artifacts/diff` → 200 OK
   - `GET /agent/seo/artifacts/log` → 200 OK
3. ✅ Frontend built successfully (2610 modules)
4. ✅ Preview server running on port 5173
5. ✅ Tools page opened in browser

## ⏳ Immediate Next Steps

### Step 1: Configure Dev Overlay Cookie Key

The dev overlay requires an environment variable for security. Choose one of these options:

**Option A: Set in PowerShell (Temporary - This Session Only)**
```powershell
# Stop backend
Get-Process | Where-Object {$_.ProcessName -match 'python|uvicorn'} | Stop-Process -Force

# Set cookie key
$env:SITEAGENT_DEV_COOKIE_KEY = "dev-secret-key-12345"

# Restart backend
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001 --reload
```

**Option B: Create .env File (Persistent - Recommended)**
```powershell
# Create .env file in project root
@"
SITEAGENT_DEV_COOKIE_KEY=dev-secret-key-12345
"@ | Out-File -FilePath .env -Encoding utf8

# Stop backend
Get-Process | Where-Object {$_.ProcessName -match 'python|uvicorn'} | Stop-Process -Force

# Install python-dotenv if not installed
D:/leo-portfolio/.venv/Scripts/pip.exe install python-dotenv

# Update assistant_api/main.py to load .env (if not already)
# Then restart backend
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001 --reload
```

**Option C: Quick Test Without Cookie (Development Only)**
Temporarily modify the dev overlay check to skip cookie validation:
```powershell
# This is NOT recommended for production
# Only for quick testing during development
```

### Step 2: Enable Dev Overlay

After setting the cookie key:

```powershell
# Enable dev overlay
curl.exe -X POST http://localhost:8001/agent/dev/enable

# Expected response:
# {"enabled": true, "cookie_set": true}

# Verify status
curl.exe http://localhost:8001/agent/dev/status

# Expected response:
# {"enabled": true}
```

### Step 3: Test Tools Page

**Manual Testing Workflow:**

1. **Open Tools Page**
   ```powershell
   Start-Process "http://localhost:5173/tools.html"
   ```

   **Expected:**
   - ✅ Page loads without errors
   - ✅ "Site Agent Tools" heading visible
   - ✅ "SEO Tune & PR Preview" section displayed
   - ✅ Three buttons visible:
     - "Run SEO Tune (Dry Run)"
     - "Refresh"
     - "Approve & Create PR" (disabled initially)

2. **Test Dry Run Workflow**

   **Action:** Click "Run SEO Tune (Dry Run)" button

   **Expected:**
   - ✅ Button changes to "Running..."
   - ✅ Loading spinner appears
   - ✅ After ~2-3 seconds, success message:
     - "Dry run complete. Review changes above."
   - ✅ Before/After cards appear for each project
   - ✅ Diff section shows unified diff
   - ✅ Reasoning log shows markdown explanation
   - ✅ "Approve & Create PR" button becomes enabled

3. **Test Before/After Preview Cards**

   **Expected for each project:**
   - ✅ Project name as heading
   - ✅ Two columns: "Before" and "After"
   - ✅ Title comparison (old → new)
   - ✅ Description comparison (old → new)
   - ✅ OG Image comparison (old → new)
   - ✅ Visual differences highlighted

4. **Test Diff Display**

   **Expected:**
   - ✅ Unified diff format (git diff style)
   - ✅ Red lines (deletions) with `-` prefix
   - ✅ Green lines (additions) with `+` prefix
   - ✅ Context lines (unchanged) with space prefix
   - ✅ Collapsible section (if implemented)

5. **Test Reasoning Log**

   **Expected:**
   - ✅ Markdown formatted explanation
   - ✅ Headings, lists, and paragraphs rendered
   - ✅ Explains why each change was made
   - ✅ Mentions SEO best practices

### Step 4: Test PR Creation (Optional - Requires GitHub Token)

**Prerequisites:**
1. GitHub Personal Access Token with `repo` and `workflow` permissions
2. `gh` CLI installed and authenticated (optional but recommended)

**Setup:**
```powershell
# Option A: Set token as environment variable
$env:GITHUB_TOKEN = "ghp_your_actual_token_here"

# Option B: Add to .env file
@"
GITHUB_TOKEN=ghp_your_actual_token_here
"@ | Add-Content -Path .env

# Restart backend to load new environment
Get-Process | Where-Object {$_.ProcessName -match 'python|uvicorn'} | Stop-Process -Force
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001 --reload
```

**Test PR Creation:**

**Action:** Click "Approve & Create PR" button (after running dry run)

**Expected:**
- ✅ Button changes to "Creating PR..."
- ✅ Loading spinner appears
- ✅ After ~5-10 seconds, success message:
  - "PR created: https://github.com/leok974/leo-portfolio/pull/XXX"
  - "Branch: seo-tune-20251008-HHMMSS"
- ✅ Link is clickable
- ✅ Event logged in `data/agent_events.jsonl`:
  ```json
  {"task": "seo.pr", "phase": "success", "pr_url": "...", "branch": "..."}
  ```

**Verify on GitHub:**
- ✅ New PR exists in repository
- ✅ PR title: "SEO: Tune meta tags for projects"
- ✅ PR description includes:
  - Summary of changes
  - Link to diff artifact
  - Link to reasoning artifact
- ✅ PR has correct branch name
- ✅ PR is mergeable (no conflicts)

### Step 5: Run E2E Tests

**Prerequisites:**
- Backend running on port 8001
- Frontend preview running on port 5173
- Dev overlay enabled

**Execute Tests:**
```powershell
# Run SEO PR preview tests
npm run test:e2e tests/e2e/seo-pr-preview.spec.ts

# Or run with Playwright test runner
npx playwright test tests/e2e/seo-pr-preview.spec.ts --project=chromium
```

**Expected Results:**
```
Running 4 tests using 1 worker

  ✓  tests/e2e/seo-pr-preview.spec.ts:6:1 › should load SEO tune panel (1.2s)
  ✓  tests/e2e/seo-pr-preview.spec.ts:12:1 › should run dry run and display preview (3.5s)
  ✓  tests/e2e/seo-pr-preview.spec.ts:24:1 › should show before/after cards (2.8s)
  ✓  tests/e2e/seo-pr-preview.spec.ts:35:1 › should enable approve button after dry run (3.1s)

  4 passed (10.6s)
```

## 🔍 Troubleshooting

### Issue: Dev Overlay Not Working

**Symptom:** Tools page shows "Unavailable" or access denied

**Solutions:**
1. Check cookie key is set:
   ```powershell
   $env:SITEAGENT_DEV_COOKIE_KEY
   # Should output: dev-secret-key-12345 (or your chosen key)
   ```

2. Verify dev overlay is enabled:
   ```powershell
   curl.exe http://localhost:8001/agent/dev/status
   # Should return: {"enabled": true}
   ```

3. Check cookie in browser:
   - Open DevTools (F12)
   - Go to Application → Cookies → http://localhost:5173
   - Look for `sa_dev=1` cookie
   - If missing, run enable command again

### Issue: SeoTunePanel Not Rendering

**Symptom:** Tools page loads but SEO section is missing

**Solutions:**
1. Check browser console for errors (F12 → Console)
2. Verify frontend build included SeoTunePanel:
   ```powershell
   Get-Content dist/assets/tools-*.js | Select-String "SeoTunePanel"
   # Should find the component code
   ```
3. Rebuild frontend:
   ```powershell
   npm run build
   # Restart preview server
   ```

### Issue: Dry Run Fails

**Symptom:** "Run SEO Tune" button shows error message

**Solutions:**
1. Check backend is running:
   ```powershell
   curl.exe http://localhost:8001/ready
   # Should return: {"ready": true}
   ```

2. Check SEO endpoint directly:
   ```powershell
   curl.exe -X POST "http://localhost:8001/agent/seo/tune?dry_run=true"
   # Should return JSON with diff and log
   ```

3. Check backend logs for errors:
   ```powershell
   # Look for Python tracebacks in backend terminal
   ```

### Issue: PR Creation Fails

**Symptom:** "Approve & Create PR" button shows error

**Solutions:**
1. Verify GITHUB_TOKEN is set:
   ```powershell
   $env:GITHUB_TOKEN
   # Should output your token (ghp_...)
   ```

2. Test token manually:
   ```powershell
   curl.exe -H "Authorization: token $env:GITHUB_TOKEN" https://api.github.com/user
   # Should return your GitHub user info
   ```

3. Check git remote is configured:
   ```powershell
   git remote -v
   # Should show GitHub remote
   ```

4. Verify repository permissions:
   - Token needs `repo` and `workflow` scopes
   - User needs push access to repository

### Issue: E2E Tests Fail

**Symptom:** Playwright tests timeout or fail assertions

**Solutions:**
1. Ensure both servers are running:
   ```powershell
   # Check backend
   curl.exe http://localhost:8001/ready

   # Check frontend
   curl.exe http://localhost:5173/tools.html
   ```

2. Enable headed mode to see what's happening:
   ```powershell
   npx playwright test tests/e2e/seo-pr-preview.spec.ts --headed
   ```

3. Check test selectors are correct:
   ```powershell
   # Update selectors if UI changed
   # See tests/e2e/seo-pr-preview.spec.ts
   ```

## 📊 Success Checklist

### Backend
- [ ] Server running on port 8001 without errors
- [ ] `SITEAGENT_DEV_COOKIE_KEY` environment variable set
- [ ] SEO endpoints responding (tune, artifacts, act)
- [ ] Events logged to `data/agent_events.jsonl`

### Frontend
- [ ] Build successful (npm run build)
- [ ] Preview server running on port 5173
- [ ] Tools page loads without console errors
- [ ] SeoTunePanel component renders

### Dev Overlay
- [ ] Cookie key configured
- [ ] Dev overlay enabled via API
- [ ] `sa_dev=1` cookie set in browser
- [ ] Tools page accessible

### SEO Workflow
- [ ] "Run SEO Tune" button triggers dry run
- [ ] Before/After cards display correctly
- [ ] Diff shows unified diff format
- [ ] Reasoning log shows markdown
- [ ] "Approve & Create PR" button enables after dry run

### PR Creation (Optional)
- [ ] GITHUB_TOKEN environment variable set
- [ ] gh CLI installed and authenticated
- [ ] PR created successfully
- [ ] PR visible in GitHub repository
- [ ] Event logged in agent_events.jsonl

### E2E Tests
- [ ] All 4 tests pass
- [ ] No timeout errors
- [ ] Browser automation works correctly
- [ ] Assertions validate expected behavior

## 🎯 Next Phase - Phase 50.6

After Phase 50.5 is validated and working, we'll move to Phase 50.6:

### Phase 50.6 Features
1. **Scheduler Integration**
   - Add `seo.tune` task to `schedule.policy.yml`
   - Configure daily/weekly cadence
   - Auto-approve rules (optional)

2. **Email Notifications**
   - Send email on PR creation
   - Include summary of changes
   - Link to approve PR

3. **Analytics Integration**
   - Track SEO performance over time
   - Before/After CTR comparison
   - Impact metrics dashboard

4. **Rollback Mechanism**
   - Revert failed SEO changes
   - Restore previous meta tags
   - Safety net for production

## 📚 Quick Reference

### Environment Variables
```powershell
# Required for dev overlay
$env:SITEAGENT_DEV_COOKIE_KEY = "dev-secret-key-12345"

# Optional for PR creation
$env:GITHUB_TOKEN = "ghp_your_token_here"
```

### Key Endpoints
```
POST /agent/seo/tune?dry_run=true   - Run SEO tune (dry run)
GET  /agent/seo/artifacts/diff      - Get unified diff
GET  /agent/seo/artifacts/log       - Get reasoning markdown
POST /agent/seo/act?action=seo.pr   - Create PR with changes
POST /agent/dev/enable              - Enable dev overlay
GET  /agent/dev/status              - Check dev overlay status
```

### Key Files
```
Backend:
- assistant_api/services/seo_pr.py       - PR automation service
- assistant_api/routers/seo.py           - SEO router with /act endpoint
- assistant_api/routers/agent_public.py  - Dev overlay endpoints

Frontend:
- src/components/SeoTunePanel.tsx        - SEO tune UI component
- src/components/AgentToolsPanel.tsx     - Tools page integration

Tests:
- tests/e2e/seo-pr-preview.spec.ts       - E2E tests for SEO workflow

Documentation:
- docs/PHASE_50.5_SEO_PR_PREVIEW.md      - Complete specification
- PHASE_50.5_IMPLEMENTATION_SUMMARY.md   - Implementation details
- PHASE_50.5_QUICKREF.md                 - Quick reference
- PHASE_50.5_DEPLOYMENT_STATUS.md        - Deployment status
- PHASE_50.5_NEXT_STEPS.md               - This file
```

## 🎉 Completion Criteria

Phase 50.5 will be considered complete when:

1. ✅ Dev overlay configured and working
2. ✅ Tools page accessible with SeoTunePanel
3. ✅ Dry run executes successfully
4. ✅ Before/After preview displays correctly
5. ✅ Diff and reasoning log render properly
6. ✅ (Optional) PR creation works with GitHub token
7. ✅ E2E tests pass (4/4)
8. ✅ No console errors in browser
9. ✅ No Python errors in backend
10. ✅ Events logged correctly

**Current Progress:** 3/10 completed (Backend ready, frontend built, servers running)

**Next Immediate Action:** Configure `SITEAGENT_DEV_COOKIE_KEY` and enable dev overlay (Step 1 above)

---

**Last Updated:** 2025-10-08
**Commit:** 5d6587a
**Branch:** LINKEDIN-OPTIMIZED
