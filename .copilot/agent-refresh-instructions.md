# Agent Content Refresh - Copilot Instructions

## When User Requests Content Updates

If the user says any of:
- "sync projects"
- "update skills"
- "refresh portfolio"
- "pull repos"
- "redeploy"
- "rebuild skills"

**You must:**
1. Detect the command intent using `apps/portfolio-ui/src/agent/commands.ts`
2. Call `https://api.leoklemet.com/agent/refresh` with:
   ```json
   POST /agent/refresh
   Headers: {
     "Content-Type": "application/json",
     "x-agent-key": "<VITE_AGENT_ALLOW_KEY>"
   }
   Body: {
     "reason": "<command>",
     "ref": "main"
   }
   ```
3. Respond to user: "✅ Refresh dispatched! I'll notify you when CI finishes."

## Workflow Steps

The endpoint dispatches `.github/workflows/refresh-content.yml` which:
1. Runs `pnpm projects:sync` - Fetch latest repos from GitHub
2. Runs `pnpm skills:gen` - Generate skills.json from projects
3. Runs `pnpm og:gen` - Generate OG social images
4. Runs `pnpm build:portfolio` - Build frontend
5. Builds & pushes Docker image to GHCR
6. Watchtower auto-updates production container

## Security Rules

**NEVER:**
- Expose `GH_PAT` (GitHub PAT) in client code
- Expose `ALLOW_KEY` in client code (only via env var)
- Commit secrets to git
- Use client-side tokens for GitHub API

**ALWAYS:**
- Keep secrets in Cloudflare Worker environment variables
- Use `VITE_AGENT_ALLOW_KEY` from environment (not hardcoded)
- Validate all requests with `x-agent-key` header
- Log workflow dispatch attempts

## Command Mappings

| User Input | Command | Description |
|------------|---------|-------------|
| "sync projects", "pull repos" | `sync-projects` | Fetch latest repos |
| "update skills", "refresh skills" | `update-skills` | Regenerate skills.json |
| "refresh portfolio", "redeploy" | `refresh-portfolio` | Full rebuild + deploy |

## Error Handling

If dispatch fails:
- Log error to console
- Show user-friendly message: "Failed to dispatch refresh: [error]"
- Suggest manual workflow run if critical

## Testing

Use `tests/e2e/agent.refresh.spec.ts` to validate:
- Command detection works
- Worker endpoint responds correctly
- GitHub workflow triggers successfully

## Related Files

- `.github/workflows/refresh-content.yml` - Workflow definition
- `cloudflare-workers/agent-refresh.ts` - Worker implementation
- `apps/portfolio-ui/src/agent/commands.ts` - Command detection
- `AGENT_REFRESH_SETUP.md` - Full setup guide
