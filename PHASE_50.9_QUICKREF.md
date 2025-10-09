# Phase 50.9 Quick Reference

**Nightly SEO & Analytics Auto-PR System**

---

## Quick Sta### 4. Autofix Report Generator
```bash
# Generate Markdown report from JSON
node scripts/seo-autofix-report.mjs --in=reports/seo-autofix.json > reports/seo-autofix.md

# Or pipe from stdin
node scripts/seo-autofix.mjs --base http://localhost:5173 --dry-run | \
  node scripts/seo-autofix-report.mjs > reports/seo-autofix.md

# Post to PR (manual)
gh pr comment <PR_NUMBER> --body-file reports/seo-autofix.md
```

**Output**: Concise Markdown summary with:
- Base URL and scan statistics
- List of files needing fixes
- List of files written (in apply mode)

### 5. Playwright Summary Generator
```bash
# Generate Markdown report from Playwright JSON
node scripts/playwright-summary.mjs --in=reports/playwright.json --out=reports/playwright.md

# Generate JSON summary
node scripts/playwright-summary.mjs --in=reports/playwright.json --json > reports/playwright-summary.json

# View on stdout
node scripts/playwright-summary.mjs --in=reports/playwright.json
```

**Output**: Test summary with:
- Pass/fail percentage with color chips (🟢/🟡/🔴)
- Pass/fail/skip/flaky counts
- Duration in seconds
- Detailed metrics table

---

## Workflow

### Manual Trigger (GitHub CLI)
```bash
```` (Full Sequence)
```bash
# 1. Start backend
python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001 &

# 2. Start frontend
python -m http.server 5173 &

# 3. Run scanner
node scripts/seo-intel.mjs

# 4. Review reports
cat reports/summary.md

# 5. Generate PR body (optional)
node scripts/seo-pr-body.mjs > pr-body.md
```

### One-Liner (with defaults)
```bash
node scripts/seo-intel.mjs && cat reports/summary.md
```

---

## Scripts

### 1. SEO Intelligence Scanner
```bash
# Basic
node scripts/seo-intel.mjs

# Custom URLs
node scripts/seo-intel.mjs --base http://localhost:5173 --backend http://localhost:8001

# Custom output
node scripts/seo-intel.mjs --out custom.json --md custom.md
```

**Checks**: Title, meta description, OG tags, canonical, JSON-LD, backend health, assets, privacy

**Exit codes**: 0 = pass, 1 = fail (CI integration)

### 2. PR Body Generator
```bash
# Default path
node scripts/seo-pr-body.mjs > pr-body.md

# Custom path
node scripts/seo-pr-body.mjs --summary reports/custom.json > pr-body.md
```

**Output**: Formatted PR body with summary, categories, action items

### 3. Safe Autofixes
```bash
# Dry run (show changes, don't apply)
node scripts/seo-autofix.mjs --base http://localhost:5173 --dry-run

# Apply fixes
node scripts/seo-autofix.mjs --base http://localhost:5173 --apply

# Workflow auto mode
AUTO_FIX=true BASE_URL=http://localhost:5173 node scripts/seo-autofix.mjs
```

**Enhanced with Cheerio HTML parser**

**Comprehensive fixes**:
- Meta description (derived from H1 or fallback)
- Canonical URL
- Open Graph tags (type, url, title, description, image)
- Twitter Card (summary_large_image)
- Image alt text (humanized from filename)
- Viewport meta

**Smart features**:
- Scans multiple HTML files (index.html, public/, src/pages/)
- Framework-aware (React/Next.js detection)
- Idempotent (only writes when needed)
- JSON output for CI integration
- Exit code 3 if changes in dry-run

### 4. Autofix Report Generator
```bash
# Generate Markdown report from JSON
node scripts/seo-autofix-report.mjs --in=reports/seo-autofix.json > reports/seo-autofix.md

# Or pipe from stdin
node scripts/seo-autofix.mjs --base http://localhost:5173 --dry-run | \
  node scripts/seo-autofix-report.mjs > reports/seo-autofix.md

# Post to PR (manual)
gh pr comment <PR_NUMBER> --body-file reports/seo-autofix.md
```

**Output**: Concise Markdown summary with:
- Base URL and scan statistics
- List of files needing fixes
- List of files written (in apply mode)

---

## Workflow

### Manual Trigger (GitHub CLI)
```bash
gh workflow run seo-intel-nightly.yml
```

### Manual Trigger (GitHub UI)
Actions → SEO & Analytics Nightly Auto-PR → Run workflow

### Schedule
Daily at **02:30 ET** (06:30 UTC)

### Configuration
Set in **Settings → Secrets and variables → Actions → Variables**:
- `BASE_URL`: Frontend URL
- `BACKEND_URL`: Backend API URL

### Enable Autofixes
Edit workflow: `AUTO_FIX: "true"`

---

## Reports

### Directory Structure
```
reports/
├── .gitkeep           # Keep directory in git
├── summary.json       # Machine-readable results
├── summary.md         # Human-readable report
└── autofixes.json     # Fix log (if AUTO_FIX=true)
```

### JSON Structure
```json
{
  "base": "http://localhost:5173",
  "backend_url": "http://localhost:8001",
  "generated_at": "2025-10-09T10:30:00.000Z",
  "totals": {
    "passed": 18,
    "failed": 2,
    "total": 20
  },
  "checks": [
    {
      "key": "home.title",
      "ok": true,
      "note": "Title: \"...\" (24 chars)"
    }
  ]
}
```

---

## Checks Performed

### Frontend (6 checks)
- ✅ `home.title` - Title length (1-60 chars)
- ✅ `home.meta.description` - Description (50-160 chars)
- ✅ `home.og.title` - Open Graph title
- ✅ `home.og.image` - Open Graph image
- ✅ `home.canonical` - Canonical URL
- ✅ `home.jsonld` - JSON-LD structured data

### Backend (3 checks)
- ✅ `backend.ready` - Ready endpoint
- ✅ `backend.metrics.health` - Metrics health
- ✅ `backend.metrics.snapshot` - Behavior snapshot

### Assets (1 check)
- ✅ `assets.webp_ratio` - WebP optimization

### Privacy (4 checks)
- ✅ `privacy.page` - privacy.html accessible
- ✅ `privacy.data_collection` - Data collection explained
- ✅ `privacy.retention` - Retention policy present
- ✅ `privacy.opt_out` - Opt-out instructions present

**Total**: 14 checks (expandable)

---

## PR Review Workflow

### 1. Check Workflow Run
```bash
# Via GitHub CLI
gh run list --workflow=seo-intel-nightly.yml

# Via GitHub UI
Actions → SEO & Analytics Nightly Auto-PR → Latest run
```

### 2. Download Artifacts
```bash
# Via GitHub CLI
gh run download <run-id> -n seo-intel-artifacts

# Via GitHub UI
Actions → Run → Artifacts → seo-intel-artifacts
```

### 3. Review PR
- **Title**: "Nightly SEO & Analytics Report (YYYY-MM-DD)"
- **Labels**: `automation`, `seo`, `analytics`
- **Body**: Summary → Categories → Action Items

### 4. Action Items
If checks failed:
- [ ] Review failed checks
- [ ] Fix issues manually or via autofix
- [ ] Re-run workflow to verify
- [ ] Merge when all green

---

## Troubleshooting

### Scanner Fails

**Symptom**: Scanner exits with code 1

**Check**:
```bash
# 1. Verify services running
curl http://localhost:5173       # Frontend
curl http://localhost:8001/ready # Backend

# 2. Check scanner output
node scripts/seo-intel.mjs | grep "❌"

# 3. Review reports
cat reports/summary.md
```

**Common issues**:
- Services not running (start backend/frontend)
- Wrong URLs (check `--base` and `--backend` args)
- Missing files (e.g., privacy.html)

### Workflow Fails

**Symptom**: Workflow run fails (red X)

**Check**:
```bash
# 1. View workflow logs
gh run view --log

# 2. Check variables
gh variable list

# 3. Verify permissions
# Settings → Actions → General → Workflow permissions
```

**Common issues**:
- Missing variables (`BASE_URL`, `BACKEND_URL`)
- Permissions not granted (contents: write, pull-requests: write)
- Node/npm installation issues

### Autofixes Not Applied

**Symptom**: `AUTO_FIX=true` but files unchanged

**Check**:
```bash
# 1. Review autofix log
cat reports/autofixes.json

# 2. Run locally with dry run
node scripts/seo-autofix.mjs

# 3. Run locally with apply
node scripts/seo-autofix.mjs --apply
```

**Common issues**:
- Dry run mode (check `applied: false` in log)
- File permissions (ensure writable)
- Already fixed (no changes needed)

### Reports Not Generated

**Symptom**: `reports/` directory empty

**Check**:
```bash
# 1. Verify scanner ran
node scripts/seo-intel.mjs

# 2. Check directory exists
ls -la reports/

# 3. Check output paths
node scripts/seo-intel.mjs --out reports/test.json --md reports/test.md
cat reports/test.md
```

**Common issues**:
- Scanner failed early (check exit code)
- Wrong output path (use absolute paths if needed)
- Permission issues (ensure `reports/` writable)

---

## Integration with Existing Tools

### Phase 50.8 Metrics
- Scanner checks `/api/metrics/behavior/health`
- Verifies ring buffer operational
- Confirms JSONL sink exists

### Existing SEO Tests
- Workflow runs `seo-ld*.spec.ts` (JSON-LD validation)
- Results logged but don't block PR creation
- Use for additional validation

### Grafana (Optional)
Export scanner results to CSV for time-series analysis:
```bash
# Convert JSON to CSV
jq -r '.checks[] | [.key, .ok, .note] | @csv' reports/summary.json > reports/checks.csv
```

---

## Customization

### Add New Checks
Edit `scripts/seo-intel.mjs`:
```javascript
// Add to checkFrontend(), checkBackend(), etc.
checks.push({
  key: "custom.check",
  ok: someCondition,
  note: "Description of check result",
});
```

### Change Schedule
Edit `.github/workflows/seo-intel-nightly.yml`:
```yaml
on:
  schedule:
    # Change cron expression (UTC timezone)
    - cron: "0 12 * * *"  # Example: 12:00 UTC daily
```

### Add Safe Autofixes
Edit `scripts/seo-autofix.mjs`:
```javascript
async function newAutofixFunction() {
  // Add conservative fix logic
  // Update fixes[] array
}

// Call in main()
await newAutofixFunction();
```

---

## Files Reference

### Created (5 files)
```
.github/workflows/seo-intel-nightly.yml    # Nightly workflow
scripts/seo-intel.mjs                      # Intelligence scanner
scripts/seo-pr-body.mjs                    # PR body generator
scripts/seo-autofix.mjs                    # Safe autofix script
reports/.gitkeep                           # Reports directory keeper
```

### Updated (4 files)
```
.gitignore                # Added reports/ exclusion
README.md                 # Added nightly SEO section
docs/DEVELOPMENT.md       # Added scripts documentation
CHANGELOG.md              # Added Phase 50.9 entry
```

---

## Command Reference

### Development
```bash
# Run scanner
node scripts/seo-intel.mjs

# Generate PR body
node scripts/seo-pr-body.mjs > pr-body.md

# Dry-run autofixes
node scripts/seo-autofix.mjs

# Apply autofixes
node scripts/seo-autofix.mjs --apply

# Full sequence
node scripts/seo-intel.mjs && \
  node scripts/seo-pr-body.mjs > pr-body.md && \
  cat pr-body.md
```

### CI/CD
```bash
# Manual trigger
gh workflow run seo-intel-nightly.yml

# View runs
gh run list --workflow=seo-intel-nightly.yml

# View logs
gh run view --log

# Download artifacts
gh run download <run-id> -n seo-intel-artifacts
```

### Configuration
```bash
# Set variables
gh variable set BASE_URL --body "https://leok974.github.io/leo-portfolio"
gh variable set BACKEND_URL --body "http://127.0.0.1:8001"

# List variables
gh variable list

# Delete variables
gh variable delete BASE_URL
gh variable delete BACKEND_URL
```

---

## Success Indicators

✅ **All systems operational**:
- [ ] Workflow runs without errors
- [ ] Auto-PR created with formatted body
- [ ] Artifacts uploaded successfully
- [ ] All checks passed (or known failures documented)
- [ ] Reports readable and accurate

---

## Related Documentation

- **Full Guide**: [`PHASE_50.9_COMPLETE.md`](PHASE_50.9_COMPLETE.md)
- **Phase 50.8**: [`PHASE_50.8_COMPLETE_FINAL.md`](PHASE_50.8_COMPLETE_FINAL.md)
- **Development**: [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)
- **README**: [`README.md`](README.md)

---

**Phase 50.9**: ✅ COMPLETE
**Status**: Ready for configuration + deployment

_Quick Reference • October 9, 2025_
