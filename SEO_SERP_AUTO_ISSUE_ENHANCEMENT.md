# SEO SERP — Auto-Issue Filing Enhancement ✅

**Date**: 2025-10-08
**Enhancement**: Added automatic GitHub Issue creation to nightly SERP workflow

---

## What Was Added

### GitHub Actions Enhancement

Updated `.github/workflows/seo-serp-cron.yml` to automatically create/update GitHub Issues when SERP anomalies are detected.

**New Features**:
1. **Permissions**: Added `issues: write` permission to workflow
2. **Threshold**: Configurable `ANOMALY_THRESHOLD` (default: 2)
3. **Auto-Issue Creation**: New step using `actions/github-script@v7`
4. **Smart Updates**: Updates existing issue if one exists for same day (no duplicates)

---

## How It Works

### Workflow Steps

1. **Fetch SERP Data**: Backend fetches GSC data (or mock)
2. **Generate Report**: Analyze anomalies and write `serp-latest.json`
3. **Check Threshold**: Read anomaly count from report
4. **Create/Update Issue**: If count ≥ threshold:
   - Create labels (`seo`, `serp`, `automated`) if missing
   - Search for existing issue for today
   - Build Markdown table with top 10 anomalies
   - Create new issue OR update existing one

### Issue Content

**Title Format**: `SEO: SERP anomalies YYYY-MM-DD (N)`

**Body Includes**:
- **Median CTR**: Overall median across all pages
- **Total Anomalies**: Count with threshold reference
- **Markdown Table**: Top 10 anomalies with:
  - Page URL (clickable)
  - Impressions
  - CTR
  - Position
  - Reasons for flagging (e.g., "ctr<0.5×median")
  - Actionable suggestions
- **Artifacts Path**: Location of generated artifacts
- **Auto-filed Note**: Attribution to workflow

**Labels**: `seo`, `serp`, `automated`

---

## Example Issue

```markdown
## SERP Anomalies — 2025-10-08

**Median CTR:** 0.147

**Total anomalies:** 3 (threshold: 2)

| Page | Impressions | CTR | Position | Reasons | Suggestions |
|---|---:|---:|---:|---|---|
| https://example.com/projects/terminality | 500 | 0.004 | 35.0 | ctr<0.5×median (0.004 < 0.074) | Run seo.rewrite on H1/description.; Validate JSON-LD types for this route.; Check internal links/anchor text.; Consider new thumbnail/OG image test. |
| https://example.com/projects/clarity | 200 | 0.015 | 28.5 | ctr<0.5×median (0.015 < 0.074) | Run seo.rewrite on H1/description.; Validate JSON-LD types for this route.; Check internal links/anchor text.; Consider new thumbnail/OG image test. |

**Artifacts:** `agent/artifacts/seo-serp/2025-10-08`

> This issue was auto-filed by the SEO SERP Nightly workflow.
```

---

## Configuration

### Environment Variables (Workflow)

```yaml
env:
  ANOMALY_THRESHOLD: "2"  # Minimum anomalies to trigger issue
```

**Adjusting Threshold**:
- Edit `.github/workflows/seo-serp-cron.yml`
- Change `ANOMALY_THRESHOLD` value
- Lower = more sensitive (more issues filed)
- Higher = less sensitive (fewer issues filed)

### Permissions

```yaml
permissions:
  contents: read
  issues: write
```

- `contents: read`: Required for checkout
- `issues: write`: Required to create/update issues and labels

---

## Key Features

### 1. **Idempotent**
- Re-running workflow multiple times per day is safe
- Updates existing issue instead of creating duplicates
- Searches for issue by title prefix: `SEO: SERP anomalies YYYY-MM-DD`

### 2. **Smart Labeling**
- Auto-creates labels if they don't exist
- Uses best-effort approach (ignores failures)
- Applies `seo`, `serp`, `automated` labels
- Default color: `0e8a16` (green)

### 3. **Graceful Fallback**
- Skips issue creation if `serp-latest.json` doesn't exist
- Logs info message instead of failing workflow
- Always runs (`if: always()`) even if previous steps fail

### 4. **Table Formatting**
- Limits to top 10 anomalies (avoids giant issues)
- Joins array fields with semicolons (`;`)
- Uses nullish coalescing (`??`) for missing values
- Proper Markdown table syntax with alignment

---

## Benefits

### For Developers
- **Visibility**: Issues appear in GitHub UI/notifications
- **Tracking**: Easy to see trends over time
- **Actionable**: Direct links to problematic pages
- **Automated**: No manual checking required

### For SEO Optimization
- **Proactive Alerts**: Know about issues immediately
- **Prioritization**: Top anomalies listed first
- **Context**: Full reasons and suggestions included
- **Historical**: Issues remain for trend analysis

### For CI/CD
- **Integration**: Issues can trigger other workflows
- **Audit Trail**: Permanent record of anomalies
- **Automation**: Can be closed automatically when resolved

---

## Technical Details

### GitHub Script Action

Uses `actions/github-script@v7` with Node.js to:
- Read `serp-latest.json` from filesystem
- Parse JSON and extract anomalies
- Use GitHub REST API to create/update issues
- Handle label creation and assignment

**Dependencies**:
- `fs`: Read report file
- `@actions/core`: Logging and workflow control
- `github.rest.issues.*`: GitHub API client

### API Calls Made

1. **Get Label**: Check if label exists
2. **Create Label**: Create if missing (best-effort)
3. **List Issues**: Search for existing issue (open state only)
4. **Update Issue**: Update existing issue (if found)
5. **Create Issue**: Create new issue (if not found)

**Rate Limits**: Uses authenticated `GITHUB_TOKEN`, higher limits apply

---

## Testing

### Manual Test (Requires Backend)

```bash
# 1. Start backend
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001

# 2. Populate mock data with anomalies
curl -X POST http://127.0.0.1:8001/agent/seo/serp/mock/populate \
  -H "Content-Type: application/json" -d '{"days": 2}'

# 3. Generate report
curl http://127.0.0.1:8001/agent/seo/serp/report | tee serp-latest.json | jq .

# 4. Check anomaly count
jq '.analysis.anomalies | length' serp-latest.json
# Should be >= 1 (mock data includes low-CTR page)
```

### Workflow Test

```bash
# GitHub UI: Actions → SEO SERP Nightly → Run workflow
# OR via gh CLI:
gh workflow run seo-serp-cron.yml

# Check workflow logs for:
# - "Anomalies: N" in "Summarize latest report" step
# - "Created issue #N" or "Updated existing issue #N" in issue step

# Verify issue created:
gh issue list --label seo,serp,automated
```

---

## Troubleshooting

### Issue Not Created

**Check**:
1. Anomaly count >= threshold? (logs show count)
2. `serp-latest.json` exists? (workflow should create it)
3. `issues: write` permission set? (workflow level)
4. `GITHUB_TOKEN` valid? (automatically provided by GitHub Actions)

**Debug**:
```bash
# View workflow logs
gh run view --log

# Check for errors in "Create/Update GitHub Issue" step
# Look for: "No serp-latest.json found" or "Anomalies N below threshold M"
```

### Duplicate Issues

**Cause**: Title search not matching existing issue

**Fix**: Workflow already prevents duplicates by searching for `SEO: SERP anomalies YYYY-MM-DD` prefix. If duplicates appear:
1. Check workflow logs for "Updated existing issue" vs "Created issue"
2. Verify issue titles match expected format
3. Manually close duplicate issues

### Labels Not Applied

**Cause**: Label creation failed (permissions or API issue)

**Fix**:
1. Manually create labels: `seo`, `serp`, `automated`
2. Workflow will then apply them successfully
3. Label creation uses best-effort (doesn't fail workflow)

---

## Files Modified

### Primary Change
- `.github/workflows/seo-serp-cron.yml` (+75 lines)
  - Added `permissions` block
  - Added `ANOMALY_THRESHOLD` env var
  - Added "Create/Update GitHub Issue" step with `actions/github-script@v7`

### Documentation Updates
- `SEO_SERP_QUICKREF.md` (+30 lines)
  - Added "GitHub Issue Automation" section
  - Added example issue format
  - Updated workflow behavior description

- `SEO_SERP_PHASE_50_9_COMPLETE.md` (+60 lines)
  - Expanded nightly workflow section
  - Added auto-issue feature documentation
  - Added example issue format

- `CHANGELOG.md` (+5 lines)
  - Added auto-issue bullet to v0.2.3 entry

### New File
- `SEO_SERP_AUTO_ISSUE_ENHANCEMENT.md` (this file)

---

## Next Steps

### Immediate
1. ✅ Commit changes with updated workflow
2. ✅ Push to main branch
3. ✅ Manually trigger workflow to test
4. ✅ Verify issue is created/updated

### Optional Enhancements
- [ ] **Email Notifications**: Configure GitHub notifications for `seo` label
- [ ] **Slack Integration**: Post to Slack when issue created
- [ ] **Auto-Close**: Close issue when anomaly count drops below threshold
- [ ] **Trending**: Compare with previous day's issue to show trends
- [ ] **Dashboard**: Create GitHub Project board for SEO issues
- [ ] **Actions**: Link issues to automated fix workflows

---

## Summary

✅ **GitHub Issue automation added to SEO SERP workflow**

**Key Benefits**:
- Proactive anomaly alerts via GitHub Issues
- Clean Markdown tables with actionable data
- No duplicate issues (updates existing)
- Auto-creates labels for organization
- Configurable threshold for sensitivity
- Works with or without real GSC credentials (uses mock data)

**Configuration**:
- Threshold: `ANOMALY_THRESHOLD=2` (in workflow env)
- Permissions: `issues: write` (already set)
- Auto-runs: Daily at 07:00 UTC

**Status**: ✅ Production ready, fully documented, tested locally
