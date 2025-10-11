# Agent Runner Quick Reference

**Script**: `scripts/agents-run.mjs`
**Exit Codes**: 0 = success, 1 = failure, 2 = bad args

---

## Basic Usage

```bash
node scripts/agents-run.mjs --agent <name> --task <name> [--payload <file|json>] [--token <token>]
```

---

## NPM Scripts

```bash
npm run agent:run                # Generic (requires --agent --task)
npm run agent:seo:validate       # SEO validation
npm run agent:seo:tune           # SEO auto-tune
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_API_BASE` | `http://127.0.0.1:8001` | API base URL |
| `AGENT_TOKEN` | (none) | Auth token ("dev" for dev bypass) |
| `AGENT_TIMEOUT_MS` | `120000` | Timeout (ms) |

---

## Quick Examples

### Local Dev (Dev Bypass)
```powershell
# PowerShell
$env:AGENT_API_BASE = "http://127.0.0.1:8001"
$env:AGENT_TOKEN = "dev"
npm run agent:seo:validate
```

```bash
# Bash
AGENT_API_BASE=http://127.0.0.1:8001 AGENT_TOKEN=dev npm run agent:seo:validate
```

### With Payload File
```bash
node scripts/agents-run.mjs --agent seo --task validate --payload scripts/payloads/seo-validate.json
```

### Inline JSON Payload
```bash
node scripts/agents-run.mjs --agent seo --task validate --payload '{"url":"https://siteagents.app"}'
```

### Production API
```powershell
$env:AGENT_API_BASE = "https://api.siteagents.app"
$env:AGENT_TOKEN = "$env:SITEAGENT_SERVICE_TOKEN"
npm run agent:seo:validate
```

---

## GitHub Actions

```yaml
- name: Run Agent
  env:
    AGENT_API_BASE: ${{ vars.PUBLIC_API_ORIGIN || 'https://api.siteagents.app' }}
    AGENT_TOKEN: ${{ secrets.SITEAGENT_TOKEN }}
    AGENT_TIMEOUT_MS: "180000"
  run: npm run agent:seo:validate
```

---

## Payload Examples

### SEO Validate
```json
{
  "url": "https://siteagents.app",
  "strict": false,
  "check_lighthouse": true
}
```

### SEO Tune
```json
{
  "url": "https://siteagents.app",
  "strict": true,
  "require_pr": false,
  "only_changed": true
}
```

---

## Common Issues

| Issue | Fix |
|-------|-----|
| Missing args | Add `--agent <name> --task <name>` |
| Timeout | Set `AGENT_TIMEOUT_MS=300000` |
| Invalid JSON | Validate with `jq` or online tool |
| 401 Unauthorized | Set `AGENT_TOKEN=dev` (local) or use service token |
| Network error | Check `AGENT_API_BASE` and API availability |

---

## Output Format

```json
{
  "ok": true,
  "status": 200,
  "duration_ms": 1234,
  "agent": "seo",
  "task": "validate",
  "result": { "checks_passed": 42 },
  "_url": "http://127.0.0.1:8001/agent/run"
}
```

---

**Full Guide**: See `AGENT_RUNNER_GUIDE.md`
