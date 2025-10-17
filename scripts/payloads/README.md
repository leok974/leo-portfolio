# Agent Payloads

This directory contains example payload files for agent runner script (`scripts/agents-run.mjs`).

---

## Quick Start

### Validate Payloads
```bash
pnpm run payload:validate  # Validates all payloads against JSON schemas
```

### Run Agent with Payload
```bash
pnpm run agent:seo:validate:file  # Uses seo-validate.json
pnpm run agent:seo:tune:file      # Uses seo-tune.json
```

---

## Schema Validation

All payload files are validated against JSON schemas to prevent drift and ensure correctness.

**Schema files**:
- `schema.seo-validate.json` - Schema for SEO validation payloads
- `schema.seo-tune.json` - Schema for SEO tuning payloads

**Validation**:
- **Pre-commit**: Automatic validation via Husky hook
- **Manual**: `pnpm run payload:validate`
- **CI/CD**: Runs in GitHub Actions before agent execution

---

## Usage

```bash
node scripts/agents-run.mjs --agent <name> --task <name> --payload scripts/payloads/<file>.json
```

---

## Available Payloads

### seo-validate.json
**Agent**: `seo`  
**Task**: `validate`  
**Purpose**: Validate SEO meta tags and lighthouse scores  
**Schema**: `schema.seo-validate.json`

```json
{
  "url": "https://siteagents.app",
  "mode": "full",
  "dry_run": true,
  "notes": "Default payload for seo.validate from agents-run.mjs"
}
```

**Usage**:
```bash
pnpm run agent:seo:validate:file
# or
node scripts/agents-run.mjs --agent seo --task validate --payload scripts/payloads/seo-validate.json
```

### seo-tune.json
**Agent**: `seo`  
**Task**: `tune`  
**Purpose**: Auto-tune SEO meta tags based on analysis  
**Schema**: `schema.seo-tune.json`

```json
{
  "urls": ["https://siteagents.app/"],
  "strategy": "ctr-remediate",
  "max_changes": 5,
  "dry_run": true
}
```

**Usage**:
```bash
pnpm run agent:seo:tune:file
# or
node scripts/agents-run.mjs --agent seo --task tune --payload scripts/payloads/seo-tune.json
```

---

## Creating Custom Payloads

1. Create JSON file in this directory
2. Include required fields for agent/task
3. Reference in agent runner:
   ```bash
   node scripts/agents-run.mjs --agent myagent --task mytask --payload scripts/payloads/custom.json
   ```

---

## Field Reference

### SEO Agent Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `url` | string | ✅ Yes | - | URL to analyze |
| `strict` | boolean | ❌ No | `false` | Strict validation mode |
| `check_lighthouse` | boolean | ❌ No | `true` | Run Lighthouse audits |
| `require_pr` | boolean | ❌ No | `false` | Create PR for changes (tune only) |
| `only_changed` | boolean | ❌ No | `false` | Only process changed files (tune only) |

### Code Review Agent Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `diff` | string | ✅ Yes | Git diff range (e.g., "HEAD~1..HEAD") |
| `files` | string[] | ❌ No | File patterns to review |
| `severity` | string | ❌ No | Minimum severity ("info", "warning", "error") |

### DX Integration Agent Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `skip_tests` | boolean | ❌ No | Skip test suites |
| `fail_on_warning` | boolean | ❌ No | Fail on warnings (not just errors) |

### Infrastructure Agent Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dry_run` | boolean | ❌ No | Plan only, don't apply |
| `replicas` | number | ❌ No | Target replica count |
| `service` | string | ❌ No | Service to scale/modify |

---

## PowerShell Note

PowerShell has issues with inline JSON escaping. **Always use payload files** when working with PowerShell:

```powershell
# ✅ Good (payload file)
node scripts/agents-run.mjs --agent seo --task validate --payload scripts/payloads/seo-validate.json

# ❌ Bad (inline JSON - escaping nightmare)
node scripts/agents-run.mjs --agent seo --task validate --payload '{"url":"..."}'
```

---

## Related Documentation

- **Agent Runner Guide**: `AGENT_RUNNER_GUIDE.md` - Full usage guide
- **Quick Reference**: `AGENT_RUNNER_QUICKREF.md` - Quick commands
- **Implementation**: `AGENT_RUNNER_COMPLETE.md` - Complete summary
