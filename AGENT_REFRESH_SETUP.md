# Agent Content Refresh - Deployment Guide

## Overview

This system enables the AI agent to trigger content refreshes (projects, skills, OG images) by dispatching a GitHub Actions workflow through a Cloudflare Worker.

---

## Architecture

```
User/Agent → Cloudflare Worker → GitHub Actions → Docker Build → Deploy
              (agent-refresh)      (refresh-content.yml)
```

**Flow:**
1. User asks agent: "update skills" or "sync projects"
2. Agent detects intent via `apps/portfolio-ui/src/agent/commands.ts`
3. Agent calls Cloudflare Worker at `api.leoklemet.com/agent/refresh`
4. Worker authenticates request and dispatches GitHub Actions workflow
5. Workflow runs: `projects:sync` → `skills:gen` → `og:gen` → `build:portfolio`
6. Docker image built and pushed to GHCR
7. Watchtower auto-updates production container

---

## Setup Instructions

### 1. GitHub Secrets

Add to repository settings → Secrets & Variables → Actions:

```
GHCR_TOKEN = <GitHub PAT with write:packages>
```

If your default `GITHUB_TOKEN` already has `write:packages`, you can skip this.

### 2. Cloudflare Worker Deployment

**Create Worker:**
```bash
cd cloudflare-workers
wrangler login
wrangler deploy
```

**Set Secrets:**
```bash
# GitHub PAT with workflow dispatch permission
wrangler secret put GH_PAT
# Paste token when prompted: ghp_...

# Shared authentication key (generate random string)
wrangler secret put ALLOW_KEY
# Paste key when prompted: <random-64-char-string>
```

**Set Variables (via Dashboard):**
- `REPO` = `leok974/leo-portfolio`

**Custom Route (optional):**
1. Cloudflare Dashboard → Workers Routes
2. Add route: `api.leoklemet.com/agent/refresh*`
3. Select worker: `agent-refresh`

### 3. Frontend Environment Variables

Add to `.env` (NOT committed):
```env
VITE_AGENT_REFRESH_URL=https://api.leoklemet.com/agent/refresh
VITE_AGENT_ALLOW_KEY=<same-as-worker-ALLOW_KEY>
```

For production, set these in:
- **Cloudflare Pages:** Environment Variables
- **Docker:** Build args in `docker-compose.yml`
- **GitHub Actions:** Repository secrets

### 4. Verify Setup

**Test Worker Directly:**
```bash
curl -X POST https://api.leoklemet.com/agent/refresh \
  -H "Content-Type: application/json" \
  -H "x-agent-key: <ALLOW_KEY>" \
  -d '{"reason":"test","ref":"main"}'
```

Expected response:
```json
{
  "ok": true,
  "dispatched": true,
  "reason": "test",
  "workflow": "refresh-content.yml",
  "timestamp": "2025-01-XX..."
}
```

**Check GitHub Actions:**
1. Go to repo → Actions → Refresh Content & Deploy
2. Should see new workflow run triggered by "test"

---

## Usage

### Agent Commands

Users can trigger refreshes via chat:

| Command | Action | Workflow Steps |
|---------|--------|----------------|
| "sync projects" | Fetch latest repos from GitHub | `projects:sync` |
| "update skills" | Regenerate skills.json | `projects:sync` → `skills:gen` |
| "refresh portfolio" | Full rebuild + redeploy | All steps + Docker push |

### Agent Integration

The agent detects intent via regex patterns in `apps/portfolio-ui/src/agent/commands.ts`:

```typescript
import { detectCommand, executeCommand } from '@/agent/commands';

async function onUserSend(message: string) {
  const cmd = detectCommand(message);
  if (cmd) {
    appendAssistant('Starting refresh…');
    try {
      await executeCommand(cmd);
      appendAssistant('Refresh dispatched! I'll notify you when CI finishes.');
    } catch (e: any) {
      appendAssistant(`Failed: ${e.message}`);
    }
    return;
  }
  // Normal LLM flow...
}
```

### Manual Workflow Dispatch

Via GitHub UI:
1. Go to Actions → Refresh Content & Deploy
2. Click "Run workflow"
3. Enter reason (e.g., "manual-test")
4. Click "Run workflow"

Via CLI:
```bash
gh workflow run refresh-content.yml -f reason="manual-test"
```

---

## Security

### Authentication

- **Worker → GitHub:** Uses GitHub PAT (`GH_PAT`) with `workflow` scope
- **Client → Worker:** Uses shared secret (`ALLOW_KEY`) in header `x-agent-key`

### Best Practices

1. **Never commit secrets** - Use `.env` and `.gitignore`
2. **Rotate tokens regularly** - Update `GH_PAT` every 90 days
3. **Use scoped PATs** - Only grant `workflow` permission, not `repo`
4. **Monitor usage** - Check GitHub Actions logs for unauthorized runs
5. **Rate limiting** - Consider adding rate limits to Worker

### Production Hardening

For production, use:
- **Cloudflare Turnstile** - CAPTCHA verification
- **JWT tokens** - Short-lived authenticated tokens
- **Backend proxy** - Keep `ALLOW_KEY` server-side only
- **IP allowlisting** - Restrict Worker to specific origins

---

## Troubleshooting

### Workflow Not Triggering

**Check Worker logs:**
```bash
wrangler tail agent-refresh
```

**Common issues:**
- `ALLOW_KEY` mismatch → 401 Unauthorized
- `GH_PAT` expired → 502 GitHub dispatch failed
- Wrong `REPO` value → 404 Not Found

### Workflow Fails

**Check GitHub Actions logs:**
1. Go to Actions → failed run
2. Expand step logs

**Common failures:**
- `GHCR_TOKEN` missing → Docker push fails
- `GITHUB_TOKEN` insufficient → projects:sync fails
- Build errors → Check `pnpm build:portfolio` output

### Agent Not Detecting Commands

**Test command detection:**
```typescript
import { detectCommand } from '@/agent/commands';
console.log(detectCommand('update skills')); // → 'update-skills'
```

**Add more patterns:**
Edit `apps/portfolio-ui/src/agent/commands.ts`:
```typescript
'update-skills': [
  /update\s+skills?/i,
  /refresh\s+skills?/i,
  /regen(erate)?\s+skills?/i  // NEW
],
```

---

## E2E Testing

**Run tests:**
```bash
# Unit test command detection (no API calls)
pnpm test:e2e -g "@agent" --grep-invert "@refresh"

# Full test with actual Worker calls (requires ALLOW_KEY)
ENABLE_AGENT_REFRESH_TESTS=1 pnpm test:e2e -g "@agent @refresh"
```

**Test file:** `tests/e2e/agent.refresh.spec.ts`

---

## Workflow Output

**Successful run:**
```
✅ Content refresh completed
Reason: agent-request
Commit: abc123def456
```

**Artifacts:**
- Docker image: `ghcr.io/leok974/leo-portfolio/portfolio:latest`
- Updated files: `projects.json`, `skills.json`, `public/og/*.png`

**Deployment:**
- Watchtower detects new image
- Pulls and restarts `portfolio-nginx` container
- New content live in ~2 minutes

---

## Monitoring

### GitHub Actions

- **Workflow runs:** https://github.com/leok974/leo-portfolio/actions/workflows/refresh-content.yml
- **Badge:** `![Refresh Status](https://github.com/leok974/leo-portfolio/actions/workflows/refresh-content.yml/badge.svg)`

### Cloudflare Worker

- **Analytics:** Cloudflare Dashboard → Workers → agent-refresh → Metrics
- **Logs:** `wrangler tail agent-refresh --format pretty`

### Alerts (optional)

Add to workflow (after deploy step):
```yaml
- name: Notify on failure
  if: failure()
  run: |
    curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
      -d '{"text":"Content refresh failed: ${{ github.run_id }}"}'
```

---

## Related Files

- `.github/workflows/refresh-content.yml` - GitHub Actions workflow
- `cloudflare-workers/agent-refresh.ts` - Cloudflare Worker
- `cloudflare-workers/wrangler.toml` - Worker config
- `apps/portfolio-ui/src/agent/commands.ts` - Intent detection
- `tests/e2e/agent.refresh.spec.ts` - E2E tests
- `SKILLS_AUTOGEN_COMPLETE.md` - Skills system docs

---

## Copilot Instructions

**When user asks:**
- "sync projects" → Call `https://api.leoklemet.com/agent/refresh` with `{"reason":"sync-projects","ref":"main"}`
- "update skills" → Call `https://api.leoklemet.com/agent/refresh` with `{"reason":"update-skills","ref":"main"}`
- "refresh portfolio" → Call `https://api.leoklemet.com/agent/refresh` with `{"reason":"refresh-portfolio","ref":"main"}`

**Always:**
- Include header `x-agent-key` with `ALLOW_KEY` value
- Dispatch `.github/workflows/refresh-content.yml`
- Never expose `GH_PAT` or `ALLOW_KEY` in client code
- Keep secrets in Cloudflare Worker environment variables

**Workflow must run:**
```bash
pnpm projects:sync  # Fetch repos
pnpm skills:gen     # Generate skills.json
pnpm og:gen         # Generate OG images
pnpm build:portfolio # Build frontend
docker build + push  # Deploy
```
