# 🔒 Production Runner Security - Quick Reference

**Status**: ✅ Code complete (747ddf6)
**Action**: Complete UI setup (15-20 min)
**Guide**: PROD_RUNNER_UI_CHECKLIST.md

---

## ✅ What Was Done (Code)

### 3 Workflows Hardened
- `bootstrap-watchtower.yml` - Watchtower deployment
- `smoke-selfhosted.yml` - Runner health check
- `redeploy-backend.yml` - Backend force-pull

### 6 Security Controls Per Workflow
```yaml
✅ permissions: contents: read     # Read-only
✅ environment: production          # Requires approval
✅ if: != 'pull_request'           # PR guard
✅ runs-on: [self-hosted, prod]    # Label-gated
✅ concurrency: prod-deploy        # One at a time
✅ push: branches: [main]          # Main-only
```

---

## ⏭️ What's Next (UI - 15 min)

### Step 1: Create Environment (3 min)
```
URL: github.com/leok974/leo-portfolio/settings/environments
→ New environment → "production"
→ Add reviewers → Save
```

### Step 2: Move Secrets (5 min)
```
Environment → production → Add secret (×6):
- WATCHTOWER_HTTP_API_TOKEN
- WATCHTOWER_UPDATE_URL
- FIGMA_PAT
- FIGMA_TEMPLATE_KEY
- FIGMA_TEAM_ID
- OPENAI_API_KEY
```

### Step 3: Set Permissions (2 min)
```
URL: github.com/leok974/leo-portfolio/settings/actions
→ Workflow permissions: Read-only
→ Fork PR approval: Required
→ Save
```

### Step 4: Verify Runner (2 min)
```
URL: github.com/leok974/leo-portfolio/settings/actions/runners
→ Check: prod-runner-1 is "Idle" (green)
→ Verify labels: self-hosted, prod, deploy
```

### Step 5: Test (3 min)
```bash
# Should require approval
gh workflow run smoke-selfhosted.yml

# Go approve in UI:
# Actions → Smoke Test → Review pending → Approve
```

---

## 🧪 Quick Verification

### PowerShell (1 min)
```powershell
# Should all be 3
(Select-String -Path .github/workflows/*.yml -Pattern "runs-on.*self-hosted").Count
(Select-String -Path .github/workflows/*.yml -Pattern "environment: production").Count
(Select-String -Path .github/workflows/*.yml -Pattern "contents: read").Count
```

### Expected: All return `3` ✅

---

## 📊 Security Scorecard

| Control | Status | Notes |
|---------|--------|-------|
| PR Guard | ✅ Code | Blocks PR events |
| Environment | ⏳ UI | Need to create |
| Permissions | ✅ Code | Read-only |
| Labels | ✅ Code | self-hosted, prod |
| Concurrency | ✅ Code | One deploy/time |
| Secrets | ⏳ UI | Need to move |

---

## 🚨 If Something Goes Wrong

### Workflow Runs Without Approval
→ Environment not created or named wrong
→ Must be exactly: `production`

### Secret Not Found
→ Not in environment secrets
→ Move from repo → environment

### Runner Offline
```bash
# On prod server
docker start gh-runner-prod
docker logs gh-runner-prod
```

---

## 📚 Full Docs

**Start Here**: `PROD_RUNNER_UI_CHECKLIST.md`
**Commands**: `PROD_RUNNER_SECURITY_COMMANDS.md`
**Deep Dive**: `PROD_RUNNER_SECURITY_LOCKDOWN.md`
**Summary**: `PROD_RUNNER_LOCKDOWN_COMPLETE.md`
**Health Check**: `scripts/check-prod-runner-security.sh`

---

## 🎯 Success Criteria

After UI setup, test these:

```bash
# ✅ Requires approval
gh workflow run smoke-selfhosted.yml

# ✅ Requires confirmation + approval
gh workflow run bootstrap-watchtower.yml -f confirm=bootstrap

# ✅ Runs on prod runner (check hostname in logs)
gh run view <RUN_ID> --log | grep hostname
```

---

## 🔗 Quick Links

- **Environments**: https://github.com/leok974/leo-portfolio/settings/environments
- **Runners**: https://github.com/leok974/leo-portfolio/settings/actions/runners
- **Actions**: https://github.com/leok974/leo-portfolio/actions
- **Settings**: https://github.com/leok974/leo-portfolio/settings/actions

---

**Time Required**: 15-20 minutes
**Difficulty**: Easy (mostly clicking)
**Impact**: High (production security)
**Next Step**: Open `PROD_RUNNER_UI_CHECKLIST.md` 🚀
