# Agent Runner Implementation - Complete

**Date**: 2025-10-11
**Status**: ✅ Complete and tested
**Branch**: siteagent/auto-43404

---

## Summary

Implemented minimal CLI runner script for invoking agents via the public `/agent/run` API endpoint. Supports local dev, production, CI/CD integration with proper exit codes and JSON output.

---

## Files Created

### 1. Core Script
**File**: `scripts/agents-run.mjs` (92 lines)
- Minimal Node.js ESM script
- Arguments: `--agent`, `--task`, `--payload`, `--token`
- Environment: `AGENT_API_BASE`, `AGENT_TOKEN`, `AGENT_TIMEOUT_MS`
- Exit codes: 0 (success), 1 (failure), 2 (bad args)
- Output: Compact JSON summaries for CI/CD

### 2. NPM Scripts (package.json)
Added 3 new scripts:
```json
{
  "agent:run": "node scripts/agents-run.mjs",
  "agent:seo:validate": "node scripts/agents-run.mjs --agent seo --task validate",
  "agent:seo:tune": "node scripts/agents-run.mjs --agent seo --task tune"
}
```

### 3. Payload Examples
**Directory**: `scripts/payloads/`

**seo-validate.json**:
```json
{
  "url": "https://siteagents.app",
  "strict": false,
  "check_lighthouse": true
}
```

**seo-tune.json**:
```json
{
  "url": "https://siteagents.app",
  "strict": true,
  "require_pr": false,
  "only_changed": true
}
```

### 4. Documentation
**AGENT_RUNNER_GUIDE.md** (500+ lines):
- Usage examples (PowerShell, Bash, npm)
- Environment variables
- Output format
- Exit codes
- GitHub Actions integration
- Available agents & tasks
- Troubleshooting guide
- CI/CD best practices

**AGENT_RUNNER_QUICKREF.md** (150 lines):
- Quick reference card
- Common commands
- Payload examples
- Quick troubleshooting

### 5. GitHub Actions Workflow
**File**: `.github/workflows/agent-runner.yml`
- Automatic trigger on push/PR (HTML/TS changes)
- Manual workflow_dispatch with inputs
- Runs SEO validation by default
- Uploads artifacts
- Comments PR with results

---

## Usage Examples

### Local Development (Dev Bypass)

**PowerShell**:
```powershell
$env:AGENT_API_BASE = "http://127.0.0.1:8001"
$env:AGENT_TOKEN = "dev"
npm run agent:seo:validate
```

**Bash**:
```bash
AGENT_API_BASE=http://127.0.0.1:8001 AGENT_TOKEN=dev npm run agent:seo:validate
```

### With Payload File
```bash
node scripts/agents-run.mjs --agent seo --task validate --payload scripts/payloads/seo-validate.json
```

### Production API
```powershell
$env:AGENT_API_BASE = "https://api.siteagents.app"
$env:AGENT_TOKEN = "$env:SITEAGENT_SERVICE_TOKEN"
npm run agent:seo:validate
```

### GitHub Actions
```yaml
- name: Run Agent
  env:
    AGENT_API_BASE: ${{ vars.PUBLIC_API_ORIGIN || 'https://api.siteagents.app' }}
    AGENT_TOKEN: ${{ secrets.SITEAGENT_TOKEN }}
    AGENT_TIMEOUT_MS: "180000"
  run: npm run agent:seo:validate
```

---

## Test Results

**Test Command**:
```powershell
$env:AGENT_API_BASE = "http://127.0.0.1:8001"
$env:AGENT_TOKEN = "dev"
node scripts/agents-run.mjs --agent seo --task validate --payload scripts/payloads/seo-validate.json
```

**Output**:
```json
{
  "ok": true,
  "status": 200,
  "duration_ms": 10993,
  "agent": "seo",
  "task": "validate",
  "_url": "http://127.0.0.1:8001/agent/run"
}
```

**Exit Code**: 0 ✅

**Verification**: Script successfully invokes `/agent/run` endpoint with proper auth, payload, and timeout handling.

---

## Exit Code Behavior

| Code | Meaning | Example |
|------|---------|---------|
| `0` | Success | Agent completed, `ok: true` |
| `1` | Failure | Network error, HTTP 4xx/5xx, agent error |
| `2` | Bad Args | Missing `--agent` or `--task`, invalid JSON |

**CI/CD Integration**:
- Bash: `$?` contains exit code
- PowerShell: `$LASTEXITCODE` contains exit code
- GitHub Actions: Step fails on non-zero exit

---

## Features

### ✅ Implemented
1. **Minimal CLI** - Simple arg parsing, no heavy dependencies
2. **Environment Config** - `AGENT_API_BASE`, `AGENT_TOKEN`, timeout
3. **Payload Support** - File path or inline JSON
4. **Timeout Handling** - Configurable via `AGENT_TIMEOUT_MS`
5. **Exit Codes** - 0/1/2 for CI/CD integration
6. **JSON Output** - Compact summaries with all key info
7. **NPM Scripts** - Convenient shortcuts for common tasks
8. **Payload Examples** - Ready-to-use JSON files
9. **GitHub Actions** - Complete workflow with manual dispatch
10. **Documentation** - Full guide + quick reference

### 🎯 Use Cases
- **Local Development**: Test agents before deploy
- **CI/CD**: Automated validation on push/PR
- **Manual Runs**: Ad-hoc agent execution via workflow_dispatch
- **Debugging**: JSON output for troubleshooting
- **Monitoring**: Exit codes for alerting

---

## PowerShell JSON Escaping Note

**Issue**: PowerShell requires complex escaping for inline JSON:
```powershell
# ❌ Doesn't work (single quotes inside double quotes)
--payload '{"url":"https://siteagents.app"}'

# ✅ Works (escaped double quotes)
--payload '{\"url\":\"https://siteagents.app\"}'

# ✅ Better (use payload file)
--payload scripts/payloads/seo-validate.json
```

**Recommendation**: Use payload files for PowerShell to avoid escaping issues.

---

## GitHub Actions Setup

### Required Secrets
```
SITEAGENT_TOKEN - Service token for agent API authentication
```

### Optional Variables
```
PUBLIC_API_ORIGIN - API base URL (defaults to https://api.siteagents.app)
```

### Setup Steps
1. Go to repository settings → Secrets and variables → Actions
2. Add secret: `SITEAGENT_TOKEN` (get from backend)
3. (Optional) Add variable: `PUBLIC_API_ORIGIN` if using different URL

---

## Agent & Task Reference

### SEO Agent
**Tasks**:
- `validate` - Check SEO meta tags, lighthouse scores
- `tune` - Auto-tune SEO based on analysis

**Payload**:
```json
{
  "url": "https://siteagents.app",
  "strict": false,
  "check_lighthouse": true,
  "require_pr": false,
  "only_changed": false
}
```

### Code Review Agent
**Tasks**:
- `review` - Review code changes

**Payload**:
```json
{
  "diff": "HEAD~1..HEAD",
  "files": ["src/**/*.ts"],
  "severity": "warning"
}
```

### DX Integration Agent
**Tasks**:
- `check` - Run linting, formatting, type checking

**Payload**:
```json
{
  "skip_tests": false,
  "fail_on_warning": false
}
```

### Infrastructure Agent
**Tasks**:
- `scale` - Plan/execute scaling
- `apply` - Apply infra changes
- `rollback` - Rollback to previous state

**Payload**:
```json
{
  "dry_run": true,
  "replicas": 3,
  "service": "backend"
}
```

---

## Troubleshooting

### "Usage: node scripts/agents-run.mjs..." Error
**Fix**: Add required `--agent` and `--task` arguments

### "Failed to parse --payload" Error
**Fix**: Use payload file or validate JSON syntax

### Timeout After 2 Minutes
**Fix**: Increase `AGENT_TIMEOUT_MS=300000`

### Network Error "fetch failed"
**Fix**: Check `AGENT_API_BASE` and backend availability

### HTTP 401 Unauthorized
**Fix**: Set `AGENT_TOKEN=dev` (local) or service token (prod)

---

## Next Steps

### Optional Enhancements
1. **Add More Agents**: Implement additional agents in backend
2. **Verbose Mode**: Add `--verbose` flag for detailed output
3. **Dry Run**: Add `--dry-run` flag for testing
4. **Config File**: Support `.agentrc.json` for defaults
5. **Result Caching**: Cache expensive operations
6. **Retry Logic**: Auto-retry on transient failures
7. **Progress Indicator**: Show progress for long-running tasks
8. **Result Formatting**: Support `--format` (json, text, table)

### Recommended CI/CD Additions
1. **Pre-commit Hook**: Run quick validation before commit
2. **PR Labels**: Auto-label PRs based on agent results
3. **Status Checks**: Required GitHub status checks
4. **Slack Notifications**: Alert on agent failures
5. **Dashboard**: Visualize agent results over time

---

## Related Documentation

- **Backend API**: `assistant_api/routes/agent.py` - `/agent/run` implementation
- **Agent Registry**: `assistant_api/agents/registry.py` - Available agents
- **Smoke Tests**: `scripts/smoke-siteagent.ps1` - Infrastructure validation
- **SiteAgent Ops**: `SITEAGENT_OPS_QUICKREF.md` - Operations guide

---

## Commit Message

```
feat(agents): add minimal CLI runner with CI/CD integration

Implement agent runner script (scripts/agents-run.mjs) for invoking
agents via public /agent/run endpoint. Supports local dev, production,
and GitHub Actions with proper exit codes and JSON output.

Features:
- Minimal Node.js ESM script (92 lines)
- Environment config (AGENT_API_BASE, AGENT_TOKEN, timeout)
- Payload support (file or inline JSON)
- Exit codes: 0 (success), 1 (failure), 2 (bad args)
- JSON output for CI/CD integration
- NPM scripts for common tasks
- GitHub Actions workflow with manual dispatch
- Payload examples (seo-validate.json, seo-tune.json)
- Comprehensive documentation (500+ line guide)

Usage:
  npm run agent:seo:validate
  node scripts/agents-run.mjs --agent seo --task validate --payload payload.json

CI/CD:
  AGENT_API_BASE=https://api.siteagents.app npm run agent:seo:validate

Tested: Local dev with dev bypass token (exit code 0, 10.9s runtime)

Files:
- scripts/agents-run.mjs (NEW)
- scripts/payloads/seo-validate.json (NEW)
- scripts/payloads/seo-tune.json (NEW)
- .github/workflows/agent-runner.yml (NEW)
- AGENT_RUNNER_GUIDE.md (NEW)
- AGENT_RUNNER_QUICKREF.md (NEW)
- package.json (updated: 3 new scripts)
```

---

**Status**: ✅ Ready for commit and deploy
**Tested**: Local dev (exit code 0, 10.9s runtime)
**Documentation**: Complete (guide + quick reference)
