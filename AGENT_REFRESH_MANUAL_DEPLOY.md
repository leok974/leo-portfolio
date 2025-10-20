# Agent Refresh - Manual Deployment Guide

## Issue: Cloudflare Authentication Required

The automated deployment script requires Cloudflare authentication. Follow these steps to complete deployment manually.

---

## Prerequisites

### 1. Cloudflare Authentication

You have two options:

**Option A: OAuth Login (Recommended)**
```powershell
# Clear any existing token
$env:CLOUDFLARE_API_TOKEN = $null

# Login via browser
wrangler login
```

**Option B: API Token**
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Create token with "Edit Cloudflare Workers" template
3. Set environment variable:
```powershell
$env:CLOUDFLARE_API_TOKEN = "your-token-here"
```

### 2. GitHub Personal Access Token

Create a PAT at: https://github.com/settings/tokens

**Required scopes:**
- Classic PAT: `repo`, `workflow`
- Fine-grained PAT: `Actions: Read/Write`, `Contents: Read`

---

## Step-by-Step Deployment

### Step 1: Authenticate with Cloudflare

```powershell
cd d:\leo-portfolio\cloudflare-workers

# Test authentication
wrangler whoami
```

Expected output: Your Cloudflare account email and ID.

### Step 2: Set Worker Secrets

**GH_PAT Secret:**
```powershell
# You'll be prompted to paste your GitHub PAT
wrangler secret put GH_PAT
```

**ALLOW_KEY Secret:**
```powershell
# Paste this value when prompted:
# SZdbVu7AlUZJ5Ce6d5hsO393tyuTwz5COc3VdxN0jZU=

wrangler secret put ALLOW_KEY
```

### Step 3: Deploy Worker

```powershell
wrangler deploy
```

**Expected output:**
```
✨ Successfully published agent-refresh (X.XX sec)
   https://agent-refresh.leoklemet.workers.dev

Current Deployment ID: ...
```

**📝 Save the Worker URL!** You'll need it for the frontend config.

---

## Step 4: Configure Frontend

Create `d:\leo-portfolio\apps\portfolio-ui\.env.local`:

```env
VITE_AGENT_REFRESH_URL=https://agent-refresh.leoklemet.workers.dev
VITE_AGENT_ALLOW_KEY=SZdbVu7AlUZJ5Ce6d5hsO393tyuTwz5COc3VdxN0jZU=
```

**Note:** Replace the URL with your actual worker URL from Step 3.

---

## Step 5: Smoke Tests

```powershell
# Set environment variables for testing
$env:VITE_AGENT_REFRESH_URL = "https://agent-refresh.leoklemet.workers.dev"
$env:VITE_AGENT_ALLOW_KEY = "SZdbVu7AlUZJ5Ce6d5hsO393tyuTwz5COc3VdxN0jZU="

# Run automated smoke tests
.\scripts\test-agent-refresh.ps1 `
  -WorkerUrl $env:VITE_AGENT_REFRESH_URL `
  -AllowKey $env:VITE_AGENT_ALLOW_KEY
```

**Or test manually:**

**Test 1: Status Endpoint**
```powershell
$headers = @{
    "x-agent-key" = "SZdbVu7AlUZJ5Ce6d5hsO393tyuTwz5COc3VdxN0jZU="
}

Invoke-RestMethod -Uri "https://agent-refresh.leoklemet.workers.dev/agent/refresh/status" `
    -Headers $headers
```

Expected: JSON with workflow run status or `{state: "unknown"}` if no runs.

**Test 2: Dispatch (Optional - triggers real workflow!)**
```powershell
$headers = @{
    "content-type" = "application/json"
    "x-agent-key" = "SZdbVu7AlUZJ5Ce6d5hsO393tyuTwz5COc3VdxN0jZU="
}

$body = @{
    reason = "manual-test"
    ref = "main"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://agent-refresh.leoklemet.workers.dev" `
    -Method Post `
    -Headers $headers `
    -Body $body
```

Expected: `{ok: true, dispatched: true, ...}`

---

## Step 6: Verify GitHub Actions

```powershell
# List recent workflow runs
gh run list --workflow=refresh-content.yml --limit 3

# View details of the latest run
gh run view --workflow=refresh-content.yml

# Watch logs in real-time (if dispatched)
gh run watch
```

---

## Step 7: E2E Tests (Optional)

```powershell
# Set environment for Playwright
$env:AGENT_REFRESH_URL = "https://agent-refresh.leoklemet.workers.dev"
$env:AGENT_ALLOW_KEY = "SZdbVu7AlUZJ5Ce6d5hsO393tyuTwz5COc3VdxN0jZU="

# Run E2E test
npx playwright test tests/e2e/agent.refresh.status.spec.ts
```

---

## Verification Checklist

After deployment, verify:

- [ ] `wrangler whoami` shows your Cloudflare account
- [ ] Secrets are set: `wrangler secret list` shows `GH_PAT` and `ALLOW_KEY`
- [ ] Worker is deployed: URL accessible
- [ ] Status endpoint returns JSON (no 401/403)
- [ ] Frontend `.env.local` created with correct values
- [ ] Smoke tests pass (status + dispatch)
- [ ] GitHub Actions workflow triggers successfully
- [ ] E2E test passes (optional)

---

## Troubleshooting

### Cloudflare Auth Issues

**Error: "Invalid request headers"**
- Clear token: `$env:CLOUDFLARE_API_TOKEN = $null`
- Login: `wrangler login`

**Error: "Unable to authenticate"**
- Token expired - create new one at https://dash.cloudflare.com/profile/api-tokens
- Ensure token has "Edit Cloudflare Workers" permission

### Deployment Issues

**Error: "No such worker"**
- First deployment? Use `wrangler deploy` (not `wrangler publish`)

**Error: "Route pattern already exists"**
- Check if route `api.leoklemet.com/agent/refresh` conflicts
- Update `wrangler.toml` if needed

### Testing Issues

**401 Unauthorized**
- Verify ALLOW_KEY matches in both worker and frontend
- Check `wrangler secret list` shows secrets

**502 Bad Gateway**
- Check GH_PAT is valid and has correct scopes
- Verify REPO variable: `leok974/leo-portfolio`

**429 Rate Limited**
- Wait 60 seconds and retry
- Rate limit is 6 requests/minute per worker instance

---

## Post-Deployment

### Monitor Worker
```powershell
# Tail live logs
wrangler tail

# View recent deployments
wrangler deployments list
```

### Check GitHub Actions
```powershell
# View recent runs
gh run list --workflow=refresh-content.yml --limit 5

# View specific run
gh run view <RUN_ID> --log
```

### Test from Frontend
Once `.env.local` is configured, rebuild and test:
```powershell
cd d:\leo-portfolio\apps\portfolio-ui
pnpm dev
```

Then in browser console:
```javascript
import { getRefreshStatus } from './agent/commands';
await getRefreshStatus();
```

---

## Generated Secrets Reference

**ALLOW_KEY:**
```
SZdbVu7AlUZJ5Ce6d5hsO393tyuTwz5COc3VdxN0jZU=
```

**Use this value for:**
1. Cloudflare Worker secret: `wrangler secret put ALLOW_KEY`
2. Frontend `.env.local`: `VITE_AGENT_ALLOW_KEY=...`
3. E2E tests: `AGENT_ALLOW_KEY=...`

**Security Notes:**
- ✅ Already in `.gitignore` (`.env.local`)
- ⚠️ Never commit this to git
- 🔄 Rotate every 3-6 months
- 📝 Store securely (password manager)

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `wrangler login` | Authenticate with Cloudflare |
| `wrangler whoami` | Check authentication |
| `wrangler secret put <KEY>` | Set secret value |
| `wrangler secret list` | List secret names |
| `wrangler deploy` | Deploy worker |
| `wrangler tail` | Live logs |
| `gh run list` | View workflow runs |

---

## Success Criteria

✅ **Deployment is successful when:**

1. Status endpoint responds:
   ```json
   {"id": 123, "status": "completed", "conclusion": "success", ...}
   ```

2. Dispatch triggers workflow:
   ```json
   {"ok": true, "dispatched": true, "workflow": "refresh-content.yml"}
   ```

3. Security hardening active:
   - Invalid reasons → 400
   - Invalid branch → 400
   - Rate limit → 429
   - Missing key → 401

4. GitHub Actions completes:
   - Projects synced ✅
   - Skills generated ✅
   - OG images created ✅
   - Frontend built ✅
   - Docker pushed ✅

---

## Next Steps After Deployment

1. **Optional: Add to GitHub Secrets** (for CI E2E tests)
   - Go to: https://github.com/leok974/leo-portfolio/settings/secrets/actions
   - Add: `AGENT_REFRESH_URL` and `AGENT_ALLOW_KEY`

2. **Optional: Integrate Chat UI**
   - See `AGENT_REFRESH_UX_GUIDE.md`
   - Add command detection to `assistant.main.tsx`

3. **Monitor First Run**
   - Watch workflow: https://github.com/leok974/leo-portfolio/actions
   - Check Docker image: https://github.com/leok974/leo-portfolio/pkgs/container/leo-portfolio%2Fportfolio

---

## Support

- **Worker issues:** Check `wrangler tail` for live logs
- **GitHub Actions:** View run logs at https://github.com/leok974/leo-portfolio/actions
- **Frontend errors:** Check browser console
- **Documentation:** See `AGENT_REFRESH_SHIP_CHECKLIST.md` for complete reference
