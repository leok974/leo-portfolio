# Agent Runner Updates - Payload Files & PR Template

**Date**: 2025-10-11
**Status**: ✅ Complete
**Branch**: siteagent/auto-43404

---

## Summary

Updated agent runner payload files with production-ready schemas and enhanced PR template with agent validation checklist.

---

## Changes Made

### 1. Updated Payload Files

**`scripts/payloads/seo-validate.json`** (Updated)
```json
{
  "url": "https://siteagents.app",
  "mode": "full",
  "dry_run": true,
  "notes": "Default payload for seo.validate from agents-run.mjs"
}
```

**Fields**:
- `mode`: "fast" or "full" (controls depth of validation)
- `dry_run`: true = no changes proposed, false = generate PRs
- `notes`: Documentation for payload purpose

**`scripts/payloads/seo-tune.json`** (Updated)
```json
{
  "urls": ["https://siteagents.app/"],
  "strategy": "ctr-remediate",
  "max_changes": 5,
  "dry_run": true
}
```

**Fields**:
- `urls`: Array of URLs to tune (note: plural)
- `strategy`: "ctr-remediate" or "heuristic"
- `max_changes`: Limit number of changes per run
- `dry_run`: true = preview only, false = apply changes

### 2. Added NPM Scripts (package.json)

```json
{
  "scripts": {
    "agent:seo:validate:file": "node scripts/agents-run.mjs --agent seo --task validate --payload scripts/payloads/seo-validate.json",
    "agent:seo:tune:file": "node scripts/agents-run.mjs --agent seo --task tune --payload scripts/payloads/seo-tune.json"
  }
}
```

**Usage**:
```bash
npm run agent:seo:validate:file  # Uses seo-validate.json payload
npm run agent:seo:tune:file      # Uses seo-tune.json payload
```

### 3. Enhanced PR Template (.github/PULL_REQUEST_TEMPLATE.md)

Added three new sections:

#### A. Agent Run Section
```markdown
## Agent run (CLI sugar)
> Uses `scripts/agents-run.mjs`

**Command**
```bash
AGENT_API_BASE=${AGENT_API_BASE:-https://api.siteagents.app} \
AGENT_TOKEN=${AGENT_TOKEN:-dev} \
node scripts/agents-run.mjs --agent seo --task validate --payload scripts/payloads/seo-validate.json
```

**Expected**
- Exit 0 on success
- JSON summary in logs with `ok`, `status`, `duration_ms`, and `result`|`errors`
```

#### B. Smoke Checklist (Brand-Correct)
```markdown
## Smoke checklist (brand-correct)

- [ ] DNS resolves (`siteagents.app` / `api.siteagents.app`)
- [ ] `GET https://api.siteagents.app/ready` → 200
- [ ] CORS preflight from `https://siteagents.app` → 200/204 + `access-control-allow-origin`
- [ ] UI loads `https://siteagents.app/` (no CSP/mixed content)
- [ ] `robots.txt` & `sitemap.xml` correct
- [ ] Cookies domain `.siteagents.app` (prod)
- [ ] (Optional) `/chat/stream` streams
```

#### C. DX Integrate Artifacts
```markdown
## DX integrate artifacts (optional)

Attach (if present):
- `agent/artifacts/dx-integrate/report.json`
- `storybook-static/` preview
```

---

## Verification

### Test Command
```bash
npm run agent:seo:validate:file
```

### Result
```json
{
  "ok": true,
  "status": 200,
  "duration_ms": 3865,
  "agent": "seo",
  "task": "validate",
  "_url": "http://127.0.0.1:8001/agent/run"
}
```

**Exit Code**: 0 ✅

---

## Key Improvements

### 1. Production-Ready Payloads
- **mode**: Fast vs full validation
- **strategy**: CTR-remediate vs heuristic tuning
- **max_changes**: Limit scope of changes
- **dry_run**: Safe preview before applying changes

### 2. Convenience Scripts
- `agent:seo:validate:file` - Quick validation with defaults
- `agent:seo:tune:file` - Quick tuning with defaults
- No need to type payload path every time

### 3. PR Template Enhancements
- **Agent validation**: Built-in CLI command for reviewers
- **Smoke checklist**: Brand-specific validation steps
- **DX artifacts**: Standardized artifact attachment

---

## Usage Examples

### Run Validation with Payload File
```bash
# Using new npm script
npm run agent:seo:validate:file

# Or directly
node scripts/agents-run.mjs --agent seo --task validate --payload scripts/payloads/seo-validate.json
```

### Run Tuning with Payload File
```bash
# Using new npm script
npm run agent:seo:tune:file

# Or directly
node scripts/agents-run.mjs --agent seo --task tune --payload scripts/payloads/seo-tune.json
```

### Production Run (Non-Dry)
**Option 1**: Edit payload file (set `dry_run: false`)
```bash
npm run agent:seo:validate:file
```

**Option 2**: Override with inline JSON
```bash
node scripts/agents-run.mjs --agent seo --task validate --payload '{"url":"https://siteagents.app","mode":"full","dry_run":false}'
```

---

## Payload Field Reference

### SEO Validate Payload

| Field | Type | Required | Values | Description |
|-------|------|----------|--------|-------------|
| `url` | string | ✅ Yes | URL | Target URL to validate |
| `mode` | string | ❌ No | "fast", "full" | Validation depth (default: "full") |
| `dry_run` | boolean | ❌ No | true, false | Preview only if true (default: true) |
| `notes` | string | ❌ No | Any | Documentation note |

### SEO Tune Payload

| Field | Type | Required | Values | Description |
|-------|------|----------|--------|-------------|
| `urls` | array | ✅ Yes | ["url1", "url2"] | URLs to tune (array) |
| `strategy` | string | ❌ No | "ctr-remediate", "heuristic" | Tuning strategy |
| `max_changes` | number | ❌ No | Integer | Max changes per run |
| `dry_run` | boolean | ❌ No | true, false | Preview only if true |

---

## PR Template Usage

### For Reviewers

1. **Run Agent Validation**:
   ```bash
   AGENT_API_BASE=https://api.siteagents.app \
   AGENT_TOKEN=dev \
   npm run agent:seo:validate:file
   ```

2. **Check Smoke Checklist**:
   - Verify all brand-specific items
   - Especially DNS, CORS, cookies domain

3. **Review DX Artifacts**:
   - Check `agent/artifacts/dx-integrate/report.json`
   - Preview Storybook if UI changes

### For PR Authors

**Fill out all sections**:
- Summary (what/why, scope, risk)
- Run agent validation and paste results
- Complete smoke checklist
- Attach DX artifacts if present
- Note any deployment requirements

---

## Integration with CI/CD

### GitHub Actions Workflow

The agent runner can be integrated into CI:

```yaml
- name: Validate SEO
  env:
    AGENT_API_BASE: https://api.siteagents.app
    AGENT_TOKEN: ${{ secrets.SITEAGENT_TOKEN }}
  run: npm run agent:seo:validate:file

- name: Check Exit Code
  if: failure()
  run: echo "SEO validation failed - check agent logs"
```

### Pre-PR Validation

Before creating PR:
```bash
# Run validation locally
npm run agent:seo:validate:file

# If exit code 0, proceed with PR
# If exit code 1, fix issues first
```

---

## Best Practices

### 1. Always Use Dry Run First
```json
{
  "dry_run": true  // Preview changes before applying
}
```

### 2. Limit Scope of Changes
```json
{
  "max_changes": 5  // Don't change too much at once
}
```

### 3. Start with Fast Mode
```json
{
  "mode": "fast"  // Quick validation first, then "full" if needed
}
```

### 4. Document Payload Purpose
```json
{
  "notes": "Default payload for seo.validate from agents-run.mjs"
}
```

---

## Files Changed

1. ✅ `scripts/payloads/seo-validate.json` - Updated schema
2. ✅ `scripts/payloads/seo-tune.json` - Updated schema
3. ✅ `package.json` - Added 2 new npm scripts
4. ✅ `.github/PULL_REQUEST_TEMPLATE.md` - Added 3 sections

---

## Related Documentation

- **Agent Runner Guide**: `AGENT_RUNNER_GUIDE.md` - Full usage guide
- **Quick Reference**: `AGENT_RUNNER_QUICKREF.md` - Quick commands
- **Complete Summary**: `AGENT_RUNNER_COMPLETE.md` - Implementation details
- **Payload README**: `scripts/payloads/README.md` - Payload documentation

---

**Status**: ✅ Ready for commit
**Tested**: npm run agent:seo:validate:file (exit code 0, 3.9s runtime)
**Next**: Commit changes and create PR using new template
