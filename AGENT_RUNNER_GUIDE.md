# Agent Runner Script - Usage Guide

**Script**: `scripts/agents-run.mjs`
**Purpose**: Minimal CLI runner for invoking agents via the public `/agent/run` API endpoint
**Exit Codes**: 0 = success, 1 = failure, 2 = bad args

---

## Quick Start

### Basic Usage
```bash
node scripts/agents-run.mjs --agent <name> --task <name> [--payload <file|json>] [--token <token>]
```

### NPM Scripts
```bash
npm run agent:run                # Generic runner (requires --agent --task args)
npm run agent:seo:validate       # Run SEO validation
npm run agent:seo:tune           # Run SEO tuning
```

---

## Command Line Arguments

| Argument | Required | Description | Example |
|----------|----------|-------------|---------|
| `--agent` | ✅ Yes | Agent name | `--agent seo` |
| `--task` | ✅ Yes | Task name | `--task validate` |
| `--payload` | ❌ No | JSON file path or inline JSON string | `--payload payload.json` or `--payload '{"url":"..."}' ` |
| `--token` | ❌ No | Auth token (or use `AGENT_TOKEN` env var) | `--token dev` |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_API_BASE` | `http://127.0.0.1:8001` | Base URL for agent API |
| `PUBLIC_API_ORIGIN` | (fallback) | Alternative to `AGENT_API_BASE` |
| `AGENT_TOKEN` | (none) | Auth token (use "dev" for dev bypass) |
| `AGENT_TIMEOUT_MS` | `120000` | Request timeout in milliseconds (2 minutes) |

---

## Usage Examples

### 1. Local Development (Dev Bypass)

**PowerShell**:
```powershell
$env:AGENT_API_BASE = "http://127.0.0.1:8001"
$env:AGENT_TOKEN = "dev"
node scripts/agents-run.mjs --agent seo --task validate --payload '{"url":"https://siteagents.app"}'
```

**Bash**:
```bash
AGENT_API_BASE=http://127.0.0.1:8001 AGENT_TOKEN=dev \
node scripts/agents-run.mjs --agent seo --task validate --payload '{"url":"https://siteagents.app"}'
```

### 2. Using Payload Files

**Create payload file** (`scripts/payloads/seo-validate.json`):
```json
{
  "url": "https://siteagents.app",
  "strict": false,
  "check_lighthouse": true
}
```

**Run with file**:
```bash
node scripts/agents-run.mjs --agent seo --task validate --payload scripts/payloads/seo-validate.json
```

### 3. Production API

**PowerShell**:
```powershell
$env:AGENT_API_BASE = "https://api.siteagents.app"
$env:AGENT_TOKEN = "$env:SITEAGENT_SERVICE_TOKEN"  # Your service token
node scripts/agents-run.mjs --agent seo --task validate
```

**Bash**:
```bash
AGENT_API_BASE=https://api.siteagents.app \
AGENT_TOKEN=$SITEAGENT_SERVICE_TOKEN \
node scripts/agents-run.mjs --agent seo --task validate
```

### 4. Using NPM Scripts

**SEO Validation** (with custom env):
```powershell
$env:AGENT_API_BASE = "https://api.siteagents.app"
npm run agent:seo:validate
```

**SEO Tuning** (with payload):
```bash
AGENT_API_BASE=http://127.0.0.1:8001 \
AGENT_TOKEN=dev \
npm run agent:seo:tune -- --payload scripts/payloads/seo-tune.json
```

**Note**: Use `--` to pass additional args through npm scripts.

### 5. Custom Timeout

**Long-running agent** (5 minutes):
```bash
AGENT_TIMEOUT_MS=300000 node scripts/agents-run.mjs --agent seo --task validate
```

---

## Output Format

The script outputs compact JSON summaries for CI/CD integration:

### Success Example
```json
{
  "ok": true,
  "status": 200,
  "duration_ms": 1234,
  "agent": "seo",
  "task": "validate",
  "result": {
    "checks_passed": 42,
    "checks_failed": 0
  },
  "_url": "http://127.0.0.1:8001/agent/run"
}
```

### Failure Example
```json
{
  "ok": false,
  "status": 400,
  "duration_ms": 567,
  "agent": "seo",
  "task": "validate",
  "errors": [
    "Missing required meta description on /about"
  ],
  "_url": "http://127.0.0.1:8001/agent/run"
}
```

### Network Error Example
```json
{
  "ok": false,
  "error": "fetch failed",
  "agent": "seo",
  "task": "validate",
  "_url": "http://127.0.0.1:8001/agent/run"
}
```

---

## Exit Codes

| Code | Meaning | When |
|------|---------|------|
| `0` | Success | Agent completed successfully (`ok: true`) |
| `1` | Failure | Network error, HTTP error, or agent reported failure |
| `2` | Bad Args | Missing required arguments or invalid payload JSON |

**CI/CD Integration**: Scripts can use `$?` (bash) or `$LASTEXITCODE` (PowerShell) to detect failures.

---

## GitHub Actions Integration

### Example Workflow Step

```yaml
- name: Run SEO Validation
  env:
    AGENT_API_BASE: ${{ vars.PUBLIC_API_ORIGIN || 'https://api.siteagents.app' }}
    AGENT_TOKEN: ${{ secrets.SITEAGENT_TOKEN }}
    AGENT_TIMEOUT_MS: "180000"  # 3 minutes
  run: npm run agent:seo:validate
```

### With Payload File

```yaml
- name: Run SEO Tuning
  env:
    AGENT_API_BASE: https://api.siteagents.app
    AGENT_TOKEN: ${{ secrets.SITEAGENT_TOKEN }}
  run: |
    node scripts/agents-run.mjs \
      --agent seo \
      --task tune \
      --payload scripts/payloads/seo-tune.json
```

### Conditional Execution (Only on Main Branch)

```yaml
- name: Run Agent (Production)
  if: github.ref == 'refs/heads/main'
  env:
    AGENT_API_BASE: https://api.siteagents.app
    AGENT_TOKEN: ${{ secrets.SITEAGENT_TOKEN }}
  run: npm run agent:seo:validate
```

---

## Available Agents & Tasks

### SEO Agent

**Tasks**:
- `validate` - Check SEO meta tags, structure, lighthouse scores
- `tune` - Auto-tune SEO meta tags based on analysis

**Payload Fields**:
```json
{
  "url": "https://siteagents.app",       // Required: URL to analyze
  "strict": false,                       // Optional: Strict validation mode
  "check_lighthouse": true,              // Optional: Run Lighthouse audits
  "require_pr": false,                   // Optional: Create PR for changes (tune only)
  "only_changed": false                  // Optional: Only process changed files (tune only)
}
```

### Code Review Agent

**Tasks**:
- `review` - Review code changes for quality, security, performance

**Payload Fields**:
```json
{
  "diff": "HEAD~1..HEAD",                // Git diff range
  "files": ["src/**/*.ts"],              // File patterns to review
  "severity": "warning"                  // Minimum severity level
}
```

### DX Integration Agent

**Tasks**:
- `check` - Run linting, formatting, type checking, link validation

**Payload Fields**:
```json
{
  "skip_tests": false,                   // Skip test suites
  "fail_on_warning": false               // Fail on warnings (not just errors)
}
```

### Infrastructure Agent

**Tasks**:
- `scale` - Plan and execute infrastructure scaling
- `apply` - Apply infrastructure changes
- `rollback` - Rollback to previous state

**Payload Fields**:
```json
{
  "dry_run": true,                       // Plan only, don't apply
  "replicas": 3,                         // Target replica count
  "service": "backend"                   // Service to scale
}
```

---

## Troubleshooting

### Issue: "Usage: node scripts/agents-run.mjs..." Error

**Cause**: Missing required `--agent` or `--task` arguments
**Fix**: Provide both arguments:
```bash
node scripts/agents-run.mjs --agent seo --task validate
```

### Issue: "Failed to parse --payload" Error

**Cause**: Invalid JSON in payload file or inline JSON
**Fix**: Validate JSON syntax:
```bash
# Check file
cat scripts/payloads/seo-validate.json | jq .

# Escape quotes in inline JSON
node scripts/agents-run.mjs --agent seo --task validate --payload '{\"url\":\"https://siteagents.app\"}'
```

### Issue: Timeout After 2 Minutes

**Cause**: Agent takes longer than default `AGENT_TIMEOUT_MS` (120000ms)
**Fix**: Increase timeout:
```bash
AGENT_TIMEOUT_MS=300000 node scripts/agents-run.mjs --agent seo --task validate
```

### Issue: Network Error "fetch failed"

**Cause**: API endpoint unreachable
**Fixes**:
1. Check `AGENT_API_BASE` is correct:
   ```bash
   echo $env:AGENT_API_BASE  # PowerShell
   echo $AGENT_API_BASE      # Bash
   ```

2. Test endpoint manually:
   ```bash
   curl https://api.siteagents.app/ready
   ```

3. Check local backend is running:
   ```bash
   curl http://127.0.0.1:8001/ready
   ```

### Issue: HTTP 401 Unauthorized

**Cause**: Missing or invalid `AGENT_TOKEN`
**Fixes**:
1. For dev: Use token "dev":
   ```bash
   AGENT_TOKEN=dev node scripts/agents-run.mjs --agent seo --task validate
   ```

2. For production: Use service token:
   ```bash
   AGENT_TOKEN=$SITEAGENT_SERVICE_TOKEN node scripts/agents-run.mjs --agent seo --task validate
   ```

### Issue: HTTP 404 Not Found

**Cause**: Agent or task doesn't exist
**Fix**: Verify agent/task names match backend implementation:
```bash
# List available agents (if endpoint exists)
curl http://127.0.0.1:8001/agent/list
```

---

## Development Notes

### Adding New Agents

1. Implement agent in backend (`assistant_api/agents/`)
2. Register in agent registry
3. Add npm script to `package.json`:
   ```json
   "agent:myagent:mytask": "node scripts/agents-run.mjs --agent myagent --task mytask"
   ```
4. Create payload example in `scripts/payloads/myagent-mytask.json`
5. Document in this file

### Testing Locally

**Start backend**:
```powershell
cd D:\leo-portfolio
.\.venv\Scripts\python.exe -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001
```

**Run agent**:
```powershell
$env:AGENT_API_BASE = "http://127.0.0.1:8001"
$env:AGENT_TOKEN = "dev"
npm run agent:seo:validate
```

### Debugging

**Enable verbose output** (if agent supports it):
```bash
node scripts/agents-run.mjs --agent seo --task validate --payload '{"url":"...","verbose":true}'
```

**Inspect full HTTP response**:
```bash
# Add --verbose to see full response (requires modification)
# Or use curl directly:
curl -X POST http://127.0.0.1:8001/agent/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev" \
  -d '{"agent":"seo","task":"validate","payload":{"url":"https://siteagents.app"}}'
```

---

## CI/CD Best Practices

### 1. Use Secrets for Tokens
Never hardcode tokens in workflows. Use GitHub Secrets:
```yaml
env:
  AGENT_TOKEN: ${{ secrets.SITEAGENT_TOKEN }}
```

### 2. Set Appropriate Timeouts
Match timeout to agent's expected runtime:
```yaml
env:
  AGENT_TIMEOUT_MS: "180000"  # 3 minutes for slow agents
```

### 3. Fail Fast on Errors
Don't use `|| true` - let failures propagate:
```yaml
run: npm run agent:seo:validate  # Will fail workflow if agent fails
```

### 4. Cache Results (If Applicable)
For expensive operations, consider caching:
```yaml
- uses: actions/cache@v3
  with:
    path: .agent-cache
    key: agent-${{ hashFiles('**/*.html') }}
```

### 5. Conditional Execution
Run expensive agents only when needed:
```yaml
- name: Run SEO Validation
  if: contains(github.event.head_commit.message, '[seo]') || github.ref == 'refs/heads/main'
  run: npm run agent:seo:validate
```

---

## Related Documentation

- **Backend API**: See `assistant_api/routes/agent.py` for `/agent/run` implementation
- **Agent Registry**: See `assistant_api/agents/registry.py` for available agents
- **Smoke Tests**: See `scripts/smoke-siteagent.ps1` for infrastructure validation
- **GitHub Actions**: See `.github/workflows/` for CI/CD examples

---

**Last Updated**: 2025-10-11
**Maintainer**: DevOps Team
