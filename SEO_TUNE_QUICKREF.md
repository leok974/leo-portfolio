# SEO Tune Automation - Quick Reference

**Purpose**: Automated safe SEO fixes for HTML files with draft PR creation

---

## Quick Start

```bash
# 1. Set token and site URL
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
export SITE_BASE_URL=https://leok.dev

# 2. Dry-run (preview changes)
npm run seo:tune:dry | jq

# 3. Apply fixes and open draft PR
npm run seo:tune
```

---

## npm Scripts

| Command | Description |
|---------|-------------|
| `npm run seo:tune` | Scan HTML → apply safe fixes → draft PR |
| `npm run seo:tune:dry` | Show proposed changes (JSON) without writing |

---

## Environment Variables

| Variable | Required | Default | Example |
|----------|----------|---------|---------|
| `GITHUB_TOKEN` | ✅ | — | `ghp_xxxxxxxxxxxxxxxxxxxx` |
| `SITE_BASE_URL` | ❌ | `""` | `https://leok.dev` |
| `GH_OWNER` | ❌ | Inferred from git remote | `leok974` |
| `GH_REPO` | ❌ | Inferred from git remote | `leo-portfolio` |
| `SEO_GLOBS` | ❌ | `public/**/*.html,src/**/*.html` | `dist/**/*.html` |
| `PR_LABELS` | ❌ | `automation,needs-approval,seo-tune` | `bot,seo` |
| `PR_ASSIGNEES` | ❌ | `""` | `leok974` |
| `PR_DRAFT` | ❌ | `true` | `false` |

---

## CLI Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--dry-run` | Preview changes without writing | `node scripts/seo.tune.mjs --dry-run` |
| `--base <branch>` | Target branch (default: repo default) | `--base main` |
| `--branch <name>` | Custom branch name | `--branch feat/seo-2025` |
| `--only <csv>` | Limit to specific files | `--only public/index.html,public/about.html` |

---

## Safe Edits (Idempotent)

### 1. Title Trimming
- **Condition**: Existing title > 70 characters
- **Action**: Trim to ≤70 chars at word boundary (preserves >30 chars)
- **Never**: Invents new titles

### 2. Meta Description
- **Condition**: Missing or empty `<meta name="description">`
- **Action**: Extract from first `<p>` tag text (max 160 chars)
- **Never**: Overwrites existing descriptions

### 3. Canonical Link
- **Condition**: Missing `<link rel="canonical">` AND `SITE_BASE_URL` set
- **Action**: Generate from file path (e.g., `/public/foo/index.html` → `https://site.com/foo/`)
- **Never**: Adds without `SITE_BASE_URL`

### 4. Open Graph Tags
- **Condition**: `og:title` or `og:description` missing/mismatched
- **Action**: Ensure parity with `<title>` and `<meta name="description">`
- **Never**: Creates OG tags when base tags missing

---

## Example Dry-Run Output

```json
{
  "dry_run": true,
  "changed_files": 2,
  "files": [
    {
      "file": "public/index.html",
      "changes": ["description-added", "og-updated"]
    },
    {
      "file": "public/about/index.html",
      "changes": ["canonical-added", "title-trimmed"]
    }
  ]
}
```

---

## Example PR Output

**Created draft PR** (requires approval before merge):

```
[seo.tune] Opened PR: https://github.com/leok974/leo-portfolio/pull/789
outputs_uri=https://github.com/leok974/leo-portfolio/pull/789
```

**PR Body** (auto-generated):
```markdown
Automated SEO tune (safe meta fixes):
- Title trimmed to ≤70 chars (if needed)
- Added meta description when missing
- Added canonical (if SITE_BASE_URL provided)
- Ensured OG title/description parity

#### Changed files (summary)
- `public/index.html` · description-added, og-updated
- `public/about/index.html` · canonical-added
```

**Labels**: `automation`, `needs-approval`, `seo-tune`
**Status**: Draft (approval gate)

---

## GitHub Actions

**Schedule**: Tuesdays 08:30 UTC
**Manual**: `gh workflow run seo-tune.yml`
**File**: `.github/workflows/seo-tune.yml`

**Permissions Required**:
- `contents: write` (push branch)
- `pull-requests: write` (create draft PR)

**Output**: Uploads artifact with summary, posts comment with link

---

## Change Types

| Change | Description | Condition |
|--------|-------------|-----------|
| `title-trimmed` | Title shortened to ≤70 chars | Title > 70 chars |
| `description-added` | Meta description created | No description, <p> exists |
| `canonical-added` | Canonical link created | No canonical, SITE_BASE_URL set |
| `og-updated` | OG tags added/updated | Missing or mismatched with base tags |

---

## Behavior

### No Changes Detected
```
[seo.tune] No safe SEO changes detected; exiting.
```
**Result**: No branch, no commit, no PR

### Changes Detected
1. Write fixes to HTML files
2. Stage changed files
3. Create branch `chore/seo-tune-YYYYMMDD-HHMM`
4. Commit: "chore(seo): safe meta autofix (auto)"
5. Push to remote
6. Open **draft PR** with labels/assignees
7. Emit `outputs_uri=<PR URL>`

---

## Safety Guarantees

✅ **Never invents content**: Only trims/derives from existing content
✅ **Never overwrites**: Only adds when missing/empty
✅ **Idempotent**: Running twice = same result
✅ **Approval required**: Draft PR with `needs-approval` label
✅ **Fast-exit**: No changes → no git operations

---

## CI Integration

### Parse outputs_uri

```yaml
- name: Run SEO tune
  id: tune
  run: |
    OUT=$(npm run -s seo:tune)
    echo "$OUT"
    PR_URL=$(echo "$OUT" | sed -n 's/^outputs_uri=//p')
    echo "pr_url=$PR_URL" >> "$GITHUB_OUTPUT"
```

### Handle No Changes

```yaml
- name: Comment if PR created
  if: steps.tune.outputs.pr_url != ''
  run: |
    gh issue comment "${{ steps.tune.outputs.pr_url }}" --body "SEO tune complete!"
```

---

## File Path Mapping

**Goal**: Derive canonical URL from file path

**Examples**:
- `public/index.html` → `https://site.com/`
- `public/about/index.html` → `https://site.com/about/`
- `public/blog/post.html` → `https://site.com/blog/post.html`

**Logic**:
1. Find `/public` in path
2. Use everything after `/public` as relative URL
3. Strip `index.html` from end
4. Ensure trailing slash for directories

---

## Typical Workflow

1. **Weekly run** (Tuesday 08:30 UTC)
2. Script scans `public/**/*.html`
3. **Scenario A**: No changes → clean exit
4. **Scenario B**: Changes found → draft PR opened
5. Human reviews PR (checks diffs)
6. Human approves + merges (or requests changes)
7. PR merged → SEO improvements live

---

## Manual Override

### Force specific files

```bash
npm run seo:tune -- --only public/index.html,public/about.html
```

### Custom branch name

```bash
npm run seo:tune -- --branch feat/my-seo-fixes
```

### Skip draft mode (auto-ready PR)

```bash
PR_DRAFT=false npm run seo:tune
```

---

## Common Issues

### "Missing GITHUB_TOKEN"
**Solution**: Set `GITHUB_TOKEN` or `GH_TOKEN` env var with repo write permissions

### "Cannot infer GH owner/repo"
**Solution**: Set `GH_OWNER` and `GH_REPO` env vars, or fix git remote

### No canonical added
**Solution**: Set `SITE_BASE_URL` environment variable

### PR not draft
**Solution**: Verify `PR_DRAFT` env var is `true` (default)

---

## Testing

```bash
# Unit tests (interface validation)
npm test -- tests/seo.tune.spec.ts

# Dry-run (real HTML scan, no writes)
npm run seo:tune:dry

# Manual run (requires GITHUB_TOKEN)
GITHUB_TOKEN=xxx SITE_BASE_URL=https://example.com npm run seo:tune
```

---

## Best Practices

1. **Always dry-run first**: Verify proposed changes before committing
2. **Set SITE_BASE_URL**: Enables canonical link generation
3. **Review draft PRs**: Human approval prevents unwanted changes
4. **Limit globs**: Use `SEO_GLOBS` to target specific directories
5. **Monitor weekly runs**: Check GitHub Actions for failures

---

## Related Docs

- **SEO_TUNE_COMPLETE.md**: Full technical reference
- **.github/workflows/seo-tune.yml**: CI workflow configuration

---

**Status**: Production-ready ✅
