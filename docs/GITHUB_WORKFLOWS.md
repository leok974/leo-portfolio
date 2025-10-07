# GitHub Actions Workflows Guide

## Overview
This project uses GitHub Actions for CI/CD automation, including backend-assisted PR creation using the `/agent/pr/open` endpoint.

## Available Workflows

### 1. siteagent-pr-via-backend
**Purpose:** Manual PR creation via backend endpoint

**Trigger:** Manual (workflow_dispatch)

**How to Use:**
1. Go to GitHub: `Actions` → `siteagent-pr-via-backend` → `Run workflow`
2. Fill in inputs:
   - **Title**: PR title (default: "chore(siteAgent): automated changes")
   - **Branch**: Head branch name (default: "siteagent/auto/update")
   - **Body**: PR description markdown (optional)
3. Click `Run workflow`

**What It Does:**
1. Checks out repository
2. Installs Python dependencies
3. Starts FastAPI backend with GITHUB_TOKEN
4. Generates HMAC signature for authentication
5. Calls `/agent/pr/open` endpoint
6. Creates pull request via GitHub API
7. Displays PR URL in logs

**Required Secrets:**
- `SITEAGENT_HMAC_SECRET` - Backend authentication secret

**Permissions:**
- `contents: write` - Push branches
- `pull-requests: write` - Create PRs

---

### 2. siteagent-nightly-pr
**Purpose:** Automated nightly maintenance with PR creation

**Trigger:** 
- Scheduled: `03:27 UTC` daily
- Manual: workflow_dispatch

**What It Does:**
1. Runs maintenance tasks:
   - `links.validate --safe`
   - `media.optimize --safe --dry-run`
   - `sitemap.media.update --safe`
2. Checks for changes in git
3. **If changes exist:**
   - Creates branch: `siteagent/nightly/YYYY-MM-DD`
   - Commits all changes
   - Pushes branch to remote
   - Starts backend with GITHUB_TOKEN
   - Creates PR via `/agent/pr/open`
4. **If no changes:** Skips PR creation

**Branch Naming:**
- Pattern: `siteagent/nightly/YYYY-MM-DD`
- Example: `siteagent/nightly/2025-01-15`

**PR Details:**
- Title: `chore(siteAgent): nightly maintenance YYYY-MM-DD`
- Body: Checklist of completed tasks
- Labels: (none, can be added manually)

---

### 3. siteagent-nightly (Legacy)
**Purpose:** Direct commit to main (no PR)

**Status:** ⚠️ Consider deprecating in favor of `siteagent-nightly-pr`

**Trigger:** 
- Scheduled: `03:27 UTC` daily
- Manual: workflow_dispatch

**What It Does:**
1. Runs same maintenance tasks
2. Commits directly to main branch
3. Pushes without PR review

**Recommendation:** Use `siteagent-nightly-pr` for better change visibility

---

## Setup Requirements

### GitHub Secrets
Add these secrets via: `Settings` → `Secrets and variables` → `Actions` → `New repository secret`

| Secret Name | Purpose | Required For |
|-------------|---------|--------------|
| `SITEAGENT_HMAC_SECRET` | Backend authentication | siteagent-pr-via-backend, siteagent-nightly-pr |

**Generate HMAC secret:**
```bash
# 64-character hex string (recommended)
openssl rand -hex 32
```

### Workflow Permissions
Ensure Actions have required permissions:

1. Go to: `Settings` → `Actions` → `General`
2. Under **Workflow permissions**, select:
   - ✅ Read and write permissions
   - ✅ Allow GitHub Actions to create and approve pull requests
3. Click `Save`

---

## Architecture

### Backend-Assisted PR Creation

**Flow Diagram:**
```
GitHub Actions
    ↓ (1) Trigger workflow
    ↓ (2) Start backend with GITHUB_TOKEN
Backend (/agent/pr/open)
    ↓ (3) Receive HMAC-authenticated request
    ↓ (4) Call GitHub API with token
GitHub API
    ↓ (5) Create pull request
    ↓ (6) Return PR details
Backend
    ↓ (7) Return PR URL to workflow
GitHub Actions
    ↓ (8) Log PR URL, mark success
```

**Why This Approach?**
- ✅ Reuses existing `/agent/pr/open` endpoint (DRY)
- ✅ Backend validates all inputs and handles errors
- ✅ Uses built-in `github.token` (no PAT needed)
- ✅ Token only available in CI (secure by default)
- ✅ HMAC authentication prevents abuse
- ✅ Same endpoint works in CI and manual workflows

---

## Token Security

### Built-in GitHub Token
Both workflows use `${{ github.token }}` (built-in):

**Advantages:**
- 🔒 Automatically provided by GitHub Actions
- 🔒 Limited permissions (read/write to current repo)
- 🔒 Expires when job completes
- 🔒 No long-lived PAT to manage/rotate

**Scope:**
```yaml
permissions:
  contents: write          # Push branches
  pull-requests: write     # Create/update PRs
```

### HMAC Authentication
All backend requests require HMAC-SHA256 signature:

```bash
# Generate signature (OpenSSL)
BODY='{"title":"Test","branch":"test","body":""}'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')

# Include in request
curl -H "X-SiteAgent-Signature: sha256=$SIGNATURE" ...
```

**Why HMAC?**
- ✅ Prevents unauthorized API calls
- ✅ Validates request integrity
- ✅ No token exposed in logs
- ✅ Works in CI and production

---

## Monitoring & Debugging

### View Workflow Runs
1. Go to: `Actions` tab in GitHub
2. Click workflow name (left sidebar)
3. Click specific run to see logs

### Check Logs
**Success:**
```
✅ PR created successfully!
https://github.com/owner/repo/pull/123
```

**Failure:**
```
❌ PR creation failed!
HTTP Status: 502
Response: {"detail":"github_repo_error"}
=== Backend logs ===
[backend startup and error logs]
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "pr_disabled: missing GITHUB_TOKEN" | Token not in environment | Check workflow env vars |
| "401 Unauthorized" | HMAC signature invalid | Verify SITEAGENT_HMAC_SECRET |
| "422 Unprocessable Entity" | PR already exists | Close/merge existing PR |
| "github_repo_error" | GitHub API fetch failed | Check GitHub status, retry |
| Backend not ready | Health check timeout | Increase sleep duration |

---

## Local Testing

### Simulate CI Environment
```bash
# 1. Export required variables
export GITHUB_TOKEN="ghp_your_test_pat"  # Create PAT with repo scope
export GITHUB_REPO="owner/repo"
export SITEAGENT_HMAC_SECRET="your-secret"

# 2. Start backend
python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8010 &
sleep 3

# 3. Wait for health check
curl http://127.0.0.1:8010/ready

# 4. Generate HMAC and call endpoint
BODY='{"title":"Test PR","branch":"test-branch","body":"Test description"}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SITEAGENT_HMAC_SECRET" | sed 's/^.* //')

curl -X POST http://127.0.0.1:8010/agent/pr/open \
  -H "Content-Type: application/json" \
  -H "X-SiteAgent-Signature: sha256=$SIG" \
  -d "$BODY"

# Expected response:
# {"ok":true,"repo":"owner/repo","url":"https://github.com/...","number":123,"status":"created"}
```

### Test Without Token (Expected 503)
```bash
# Unset token
unset GITHUB_TOKEN

# Start backend
python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8010 &

# Call endpoint (should return 503)
curl -X POST http://127.0.0.1:8010/agent/pr/open \
  -H "Content-Type: application/json" \
  -H "X-SiteAgent-Signature: sha256=$SIG" \
  -d "$BODY"

# Expected response:
# {"detail":"pr_disabled: missing GITHUB_TOKEN. Set GITHUB_TOKEN env var to enable PR automation."}
```

---

## Best Practices

### Workflow Naming
- ✅ Use descriptive names: `siteagent-pr-via-backend`
- ✅ Include purpose: `nightly`, `manual`, `on-demand`
- ❌ Avoid generic names: `workflow.yml`, `ci.yml`

### Branch Naming
- ✅ Use prefixes: `siteagent/`, `feature/`, `fix/`
- ✅ Include date for scheduled: `siteagent/nightly/2025-01-15`
- ✅ Use kebab-case: `siteagent/auto/update`

### PR Descriptions
- ✅ Include task checklist
- ✅ Link to workflow run
- ✅ Mention auto-generated
- ✅ Add review instructions if needed

### Error Handling
- ✅ Show backend logs on failure
- ✅ Use `if: failure()` for debug steps
- ✅ Exit with non-zero on errors
- ✅ Log HTTP status codes

### Security
- ✅ Use built-in `github.token` when possible
- ✅ Store secrets in GitHub Secrets (never in code)
- ✅ Require HMAC authentication for all API calls
- ✅ Fail-safe: disable features when token missing

---

## Related Documentation
- `PHASE_47_AGENT_ENHANCEMENTS.md` - Backend PR automation implementation
- `AGENT_TOOLS_WEB_UI.md` - Agent tools web interface
- `DEV_OVERLAY_COOKIE_AUTH.md` - Development overlay authentication
- `OPERATIONS.md` - System operations guide
