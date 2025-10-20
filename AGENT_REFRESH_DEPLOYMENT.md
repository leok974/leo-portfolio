# Agent Refresh - Deployment Checklist

## Generated Secrets

**ALLOW_KEY (Generated):**
```
SZdbVu7AlUZJ5Ce6d5hsO393tyuTwz5COc3VdxN0jZU=
```

**GH_PAT:** You need to create this with the following scopes:
- Classic PAT: `repo`, `workflow`
- Fine-grained: `Actions: Read/Write`, `Contents: Read`

Create at: https://github.com/settings/tokens

---

## Step 1: Deploy Cloudflare Worker

```powershell
cd d:\leo-portfolio\cloudflare-workers

# Set GH_PAT secret (paste your GitHub token when prompted)
wrangler secret put GH_PAT

# Set ALLOW_KEY secret (paste the generated key above)
wrangler secret put ALLOW_KEY

# Deploy the worker
wrangler deploy
```

After deployment, note your worker URL (e.g., `https://agent-refresh.leoklemet.workers.dev`)

---

## Step 2: Configure Frontend Environment

Create `d:\leo-portfolio\apps\portfolio-ui\.env.local`:

```env
VITE_AGENT_REFRESH_URL=https://agent-refresh.leoklemet.workers.dev
VITE_AGENT_ALLOW_KEY=SZdbVu7AlUZJ5Ce6d5hsO393tyuTwz5COc3VdxN0jZU=
```

**⚠️ IMPORTANT:** Add `.env.local` to `.gitignore` to prevent committing secrets!

For production deployment (Docker/server), set these environment variables in your deployment config.

---

## Step 3: Smoke Tests

### Test Status Endpoint

```powershell
$env:VITE_AGENT_ALLOW_KEY = "SZdbVu7AlUZJ5Ce6d5hsO393tyuTwz5COc3VdxN0jZU="
$env:VITE_AGENT_REFRESH_URL = "https://agent-refresh.leoklemet.workers.dev"

# Status check
curl -sS -H "x-agent-key: $env:VITE_AGENT_ALLOW_KEY" "$env:VITE_AGENT_REFRESH_URL/agent/refresh/status" | ConvertFrom-Json | Format-List
```

Expected output: JSON with `id`, `status`, `conclusion`, `html_url`, etc., or `{state: "unknown"}` if no runs exist.

### Test Dispatch

```powershell
$body = @{
    reason = "refresh-portfolio"
    ref = "main"
} | ConvertTo-Json

curl -X POST -H "content-type: application/json" -H "x-agent-key: $env:VITE_AGENT_ALLOW_KEY" -d $body $env:VITE_AGENT_REFRESH_URL | ConvertFrom-Json | Format-List
```

Expected: `{ok: true, dispatched: true, ...}`

### Verify GitHub Actions Run

```powershell
gh run list --workflow=refresh-content.yml --limit 3
```

You should see a new run. Get the ID and check logs:

```powershell
gh run view <RUN_ID> --log
```

---

## Step 4: Playwright E2E Test

Set environment variables for the test runner:

```powershell
$env:AGENT_REFRESH_URL = "https://agent-refresh.leoklemet.workers.dev"
$env:AGENT_ALLOW_KEY = "SZdbVu7AlUZJ5Ce6d5hsO393tyuTwz5COc3VdxN0jZU="

npx playwright test tests/e2e/agent.refresh.status.spec.ts
```

---

## Step 5: Hardening Verification ✅

### Allow-list Check
Worker allow-list: `sync-projects`, `update-skills`, `refresh-portfolio`, `agent-request`, `manual-test`
Frontend commands: `sync-projects`, `update-skills`, `refresh-portfolio`

✅ All frontend commands are in the allow-list.

### Branch Guard
✅ Only `ref: "main"` is accepted (enforced in worker).

### Rate Limiting
✅ In-memory: 6 requests/minute per worker instance.
For global rate-limiting, consider Cloudflare Rate Limiting or Durable Objects.

### CORS
✅ Preflight and response headers configured.
✅ Status route protected by `x-agent-key`.

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| 401 Unauthorized | `x-agent-key` mismatch | Verify `ALLOW_KEY` in worker and frontend match |
| 429 Too Many Requests | Hit rate limit | Wait 60 seconds |
| 400 / reason not allowed | Invalid `reason` value | Use: `sync-projects`, `update-skills`, `refresh-portfolio`, `agent-request`, or `manual-test` |
| 400 / Only ref "main" | Wrong branch | Only `ref: "main"` is allowed |
| 502 from Worker | PAT scope or repo wrong | Verify `GH_PAT` has `workflow` scope and `REPO` env var is correct |
| Action runs but no deploy | GHCR token issue | Check `GHCR_TOKEN` secret in GitHub Actions has `write:packages` scope |

---

## Optional: CI E2E Test

Add `.github/workflows/e2e-agent.yml` to run automated status tests (see next step in checklist).

---

## Security Notes

- **Never commit** `ALLOW_KEY` or `GH_PAT` to git
- Frontend gets `VITE_AGENT_ALLOW_KEY` (for worker auth only)
- Frontend **never** gets `GH_PAT` (stays in worker)
- Worker environment variables are encrypted at rest by Cloudflare
- Consider rotating `ALLOW_KEY` periodically (update worker + frontend)

---

## Next: UX Polish

See `AGENT_REFRESH_QUICKREF.md` for adding status check quick-reply to chat UI.
