# Agent Content Refresh - Quick Reference

## Commands

| User Says | Command | Action |
|-----------|---------|--------|
| "sync projects" | `sync-projects` | Fetch repos from GitHub |
| "update skills" | `update-skills` | Regenerate skills.json |
| "refresh portfolio" | `refresh-portfolio` | Full rebuild + redeploy |

## Workflow

```
User → Agent → Worker → GitHub Actions → Deploy
```

## API Endpoints

### Dispatch
```
POST https://<worker-url>/
Headers: { "x-agent-key": "<ALLOW_KEY>" }
Body: { "reason": "<command>", "ref": "main" }
```

### Status
```
GET https://<worker-url>/agent/refresh/status
Headers: { "x-agent-key": "<ALLOW_KEY>" }
Response: { id, status, conclusion, html_url, name, created_at }
```

## Hardening

- **Allow-list**: Only `sync-projects`, `update-skills`, `refresh-portfolio`, `agent-request`, `manual-test`
- **Branch guard**: Only `ref: "main"` accepted
- **Rate limit**: 6 requests/minute per worker instance
- **CORS**: Preflight + response headers configured

## Secrets

- `GH_PAT` - GitHub PAT with `workflow` scope (Worker env)
- `ALLOW_KEY` - Shared auth key (Worker + frontend env)
- `GHCR_TOKEN` - Docker registry push token (GitHub Actions secret)

## Files

- `.github/workflows/refresh-content.yml` - Workflow orchestration
- `cloudflare-workers/agent-refresh.ts` - Worker (dispatch + status)
- `apps/portfolio-ui/src/agent/commands.ts` - Command detection + helpers
- `tests/e2e/agent.refresh.spec.ts` - E2E dispatch tests
- `tests/e2e/agent.refresh.status.spec.ts` - E2E status tests

## Deploy Worker

See `AGENT_REFRESH_DEPLOYMENT.md` for full checklist.

Quick version:
```powershell
cd cloudflare-workers
.\deploy-complete.ps1
```

## Smoke Tests

```powershell
.\scripts\test-agent-refresh.ps1 -WorkerUrl "https://..." -AllowKey "..."
```

## UX Integration

### Detect & Execute
```typescript
import { detectCommand, executeCommand, getCommandDescription } from './agent/commands';

const cmd = detectCommand(userInput);
if (cmd) {
  await executeCommand(cmd);
  // Show success message
}
```

### Status Polling
```typescript
import { getRefreshStatus } from './agent/commands';

const status = await getRefreshStatus();
// status.status: 'queued' | 'in_progress' | 'completed'
// status.conclusion: 'success' | 'failure' | null
```

### Quick-Reply Example
```typescript
// After dispatch:
appendMessage('✅ Refresh dispatched. Want me to check status in ~2 min? [Check now]');

// On click "Check now":
const { status, conclusion, html_url } = await getRefreshStatus();
if (status === 'completed' && conclusion === 'success') {
  appendMessage('✅ Refresh completed successfully!');
} else if (status === 'in_progress') {
  appendMessage('⏳ Refresh in progress...');
}
```

## Check Status

- GitHub Actions: https://github.com/leok974/leo-portfolio/actions/workflows/refresh-content.yml
- Via API: `GET /agent/refresh/status` (see above)
- Via gh CLI: `gh run list --workflow=refresh-content.yml --limit 3`

## Copilot Rule

When user requests content update → Detect command → Call Worker → Dispatch workflow → Never expose secrets → Poll status if requested
