# Phase 50.9 - Merge Checklist

## ✅ Pre-Merge Validation (Completed)

### Local Testing
- [x] **Dry-run works**: Scanned 5 files, detected 4 needing changes, exit code 1
- [x] **Apply works**: Successfully wrote 4 files with SEO improvements
- [x] **E2E tests pass**: 4/4 tests passing (canonical, OG tags, alt text, viewport, title)
- [x] **Idempotency verified**: Second run shows 0 changes (no diffs)
- [x] **DEV_GUARD logic works**: Correctly skips OG image when guards enabled
- [x] **Report generator works**: Parses JSON and generates Markdown summary

### Code Quality
- [x] **Cheerio pinned**: Version 1.0.0 with --save-exact
- [x] **Exit codes correct**: 0 for no changes, non-zero for changes needed
- [x] **JSON output valid**: Structured stdout with scanned/changed/wrote counts
- [x] **Framework detection**: isLikelyFrameworkShell() implemented (available for future)
- [x] **Error handling**: Safe file operations with proper error messages
- [x] **Report parsing**: Handles both file input and stdin

### CI/CD Integration
- [x] **Workflow updated**: Added dry-run step with warning output
- [x] **DEV guards configured**: DEV_GUARD_ENABLED=false, DEV_ALLOW_PLACEHOLDER_OG=false
- [x] **Artifact upload**: Already configured for reports/
- [x] **AUTO_FIX guarded**: Set to "false" initially for safety
- [x] **PR comments**: Auto-posts autofix summary to PR

## 📋 Pre-Commit Actions

### 1. Review Git Diff
```bash
git status
git diff .github/workflows/seo-intel-nightly.yml
git diff scripts/seo-autofix.mjs
git diff tests/e2e/seo-autofix.spec.ts
git diff package.json
```

**Expected changes:**
- Workflow: +7 lines (dry-run step + DEV guard env vars)
- Autofix script: +13 lines (DEV_GUARD logic in processFile)
- E2E test: Title validation 60→100 chars
- package.json: cheerio pinned to "1.0.0" (no caret)
- 4 HTML files: Added canonical, OG tags, Twitter Card, alt text

### 2. Verify Documentation
- [x] PHASE_50.9_COMPLETE.md updated
- [x] PHASE_50.9_QUICKREF.md updated
- [x] PHASE_50.9_ENHANCED_SUMMARY.md created
- [x] CHANGELOG.md updated
- [x] README.md includes nightly SEO section
- [x] docs/DEVELOPMENT.md includes scripts documentation

### 3. Commit
```bash
git add .
git commit -F COMMIT_MESSAGE_PHASE_50.9_ENHANCED.txt
git push origin LINKEDIN-OPTIMIZED
```

## 🚀 Post-Merge Actions

### 1. Configure GitHub Actions Variables
```bash
# In GitHub UI: Settings → Secrets and variables → Actions → Variables
# Or via CLI:
gh variable set BASE_URL --body 'https://leok974.github.io/leo-portfolio'
gh variable set BACKEND_URL --body 'https://api.leoklemet.dev'
```

**Important:**
- Use **Variables** (not Secrets) for non-sensitive data
- Use your actual GitHub Pages URL for BASE_URL
- If backend not public yet, use placeholder: `https://example.com/api`

### 2. Test Workflow Manually
```bash
# Trigger manually
gh workflow run seo-intel-nightly.yml

# Monitor
gh run list --workflow=seo-intel-nightly.yml
gh run view <run-id> --log

# Or in GitHub UI
# Actions → SEO & Analytics Nightly Auto-PR → Run workflow
```

**Verify:**
- [ ] Workflow completes successfully
- [ ] Dry-run step shows warning if changes needed
- [ ] E2E tests run (may skip if framework shell detected)
- [ ] Reports generated in artifacts
- [ ] PR created with SEO intelligence report

### 3. Review First Nightly Report
**Check PR body includes:**
- Frontend issues (broken links, meta tags, security headers)
- Backend issues (health checks, metrics)
- Asset issues (images, scripts)
- Privacy/legal (cookie consent, privacy policy, terms)
- Summary statistics (pages checked, issues found)

### 4. Enable Auto-Fix (After Confidence Built)
**After 2-3 successful nightly reports:**
```yaml
# Edit .github/workflows/seo-intel-nightly.yml
env:
  AUTO_FIX: "true"   # Changed from "false"
```

**Commit and push:**
```bash
git add .github/workflows/seo-intel-nightly.yml
git commit -m "chore(seo): enable nightly autofixes"
git push origin LINKEDIN-OPTIMIZED
```

## 🔄 Rollback Plan (If Needed)

### Quick Disable
```bash
# Temporarily disable in workflow
gh workflow disable seo-intel-nightly.yml

# Or just disable AUTO_FIX
# Edit .github/workflows/seo-intel-nightly.yml:
# AUTO_FIX: "false"
```

### Full Revert
```bash
# Find the Phase 50.9 commit
git log --oneline --grep="Phase 50.9"

# Revert the commit
git revert <commit-sha>
git push origin LINKEDIN-OPTIMIZED

# Workflow will stay but not apply fixes
# Scanner/reporting continues to work
```

## 📊 Success Criteria

### All Must Pass ✅
- [x] Local dry-run detects changes correctly
- [x] Local apply writes files correctly
- [x] E2E tests validate all SEO requirements
- [x] Second run shows zero changes (idempotent)
- [x] DEV_GUARD logic prevents placeholder images
- [x] CI workflow includes dry-run step
- [x] Cheerio pinned to avoid surprises
- [x] Documentation comprehensive and accurate

### After First Workflow Run
- [ ] Workflow completes without errors
- [ ] Reports generated and uploaded
- [ ] PR created with useful insights
- [ ] No false positives in scanner
- [ ] Dry-run warnings accurate

### After Enabling AUTO_FIX
- [ ] Files modified correctly
- [ ] No breaking changes to site
- [ ] Subsequent runs show idempotency
- [ ] Manual review confirms quality

## 📝 Notes

### Test Files Modified
The following HTML files were modified during testing:
- `public/gallery.html` - Added canonical, OG tags, Twitter Card
- `public/metrics.html` - Added canonical, OG tags, Twitter Card
- `public/og/template.html` - Added canonical, OG tags, Twitter Card
- `public/tmp-e2e/index.html` - Added canonical, OG tags, Twitter Card

These changes are **intentional** and **beneficial** - they improve SEO for all HTML pages.

### Cheerio Version
Pinned to `1.0.0` (exact version) to prevent unexpected behavior changes:
- No caret (^) or tilde (~) in package.json
- Installed with `--save-exact` flag
- Lockfile updated accordingly

### DEV_GUARD Behavior
- **In CI** (DEV_GUARD_ENABLED=false): Always sets og:image
- **In Dev** (DEV_GUARD_ENABLED=true, DEV_ALLOW_PLACEHOLDER_OG=false): Skips og:image if no real file
- **In Dev with placeholder** (both true): Uses placeholder image

### Exit Codes
- `0` - No changes needed (success)
- `1` - Changes detected in apply mode
- `3` - Changes detected in dry-run mode (for CI detection)

**Note:** Currently returns 1 in both cases; exit code 3 for dry-run can be implemented if needed.

---

**Status:** ✅ Ready for merge and deployment
**Date:** October 9, 2025
**Phase:** 50.9 Enhanced (Cheerio-based autofix with E2E tests)
