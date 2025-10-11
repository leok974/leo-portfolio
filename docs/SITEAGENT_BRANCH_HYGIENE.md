# SiteAgent Branch Hygiene Guide

## Overview

SiteAgent uses an intelligent branch reuse strategy to keep the repository tidy and avoid PR proliferation. This guide explains how the system works and how to use it effectively.

## Branch Strategy

### One Branch Per Stream

SiteAgent reuses category-based branches instead of creating new ones for every change:

| Category | Branch Name | Purpose |
|----------|-------------|---------|
| `seo` | `siteagent/seo` | SEO metadata optimizations (title, description, keywords) |
| `content` | `siteagent/content` | Content updates and improvements |
| `og` | `siteagent/og` | Open Graph metadata for social sharing |
| `deps` | `siteagent/deps` | Dependency updates and package upgrades |
| `misc` | `siteagent/misc` | Miscellaneous changes (default fallback) |

### PR Updates, Not Duplication

When changes are made to a category:

1. **Check for existing PR**: Search for open PRs with the same head branch
2. **If PR exists** → **Update it**:
   - Force-push new commit with `--force-with-lease` (safe)
   - Add comment describing the update
   - Update labels if needed
   - Return status: `"updated"`
3. **If no PR exists** → **Create new PR**:
   - Create branch from base
   - Push changes
   - Open PR with generated title/body
   - Return status: `"created"`

**Result**: Maximum one active PR per category at any time.

### Single-Commit Rolling Branches

Each category branch maintains a **clean one-commit history**:

```bash
# When updating a branch:
git reset --soft origin/main          # Reset to base
git commit -m "chore: update seo"     # Create single squashed commit
git push --force-with-lease origin siteagent/seo
```

**Benefits**:
- ✅ Easy to review (no messy commit history)
- ✅ Clean rebase/merge conflicts
- ✅ Simple to revert if needed
- ✅ Safe force-pushing prevents data loss

## Automatic Cleanup

### Merge Strategy

**Squash merge only**: All automation PRs must be merged via **squash**:
- Keeps main branch history linear and tidy
- Single commit per PR in main branch
- Easy to track what changed and when

**Repository Settings** (configure in Settings → Pull Requests):
- ✅ Allow squash merging (only)
- ❌ Disable merge commits
- ❌ Disable rebase merging
- ✅ Automatically delete head branches

### Auto-Delete on Merge

GitHub automatically deletes `siteagent/*` branches after PR merge when "Automatically delete head branches" is enabled.

**Workflow**: `.github/workflows/delete-merged-branch.yml`
- Triggers on `pull_request.closed` event
- Only runs if PR was actually merged
- Uses GitHub API to delete the head branch
- Graceful error handling if branch already deleted

### Nightly Pruning

**Workflow**: `.github/workflows/prune-stale-siteagent-branches.yml`

Runs daily at **03:17 UTC** to clean up stale automation branches:

```yaml
schedule:
  - cron: "17 3 * * *"
```

**Logic**:
1. List all `siteagent/*` branches via GitHub API
2. For each branch:
   - Check if there's an open PR (keep if yes)
   - Get last commit date
   - Calculate age in days
   - Delete if age ≥ 14 days AND no open PR

**Manual trigger**: Workflow supports `workflow_dispatch` for on-demand cleanup.

## Concurrency Protection

All SiteAgent workflows use **concurrency groups** to prevent race conditions:

```yaml
concurrency:
  group: siteagent-<category>
  cancel-in-progress: false
```

**Examples**:
- `siteagent-nightly` — Nightly maintenance workflow
- `siteagent-prune` — Stale branch cleanup
- `siteagent-pr-backend-siteagent/seo` — PR creation per branch
- `siteagent-automerge-123` — Auto-merge per PR number

**Effect**: Only one job at a time can mutate `siteagent/*` branches, preventing:
- Simultaneous pushes to same branch
- Conflicting PR updates
- Race conditions in branch creation/deletion

## Operational Controls

### Enable/Disable Automation

**Environment Variable**: `SITEAGENT_ENABLE_WRITE`

```bash
# Enable PR creation
export SITEAGENT_ENABLE_WRITE=1

# Disable (default)
unset SITEAGENT_ENABLE_WRITE
```

**Guard in Code** (`agent_act.py`):
```python
def _dev_guard():
    if os.getenv("SITEAGENT_ENABLE_WRITE") != "1":
        raise HTTPException(
            status_code=403,
            detail="Write actions disabled. Set SITEAGENT_ENABLE_WRITE=1 to enable."
        )
```

### Category Selection

**Three ways to specify category**:

1. **Via labels** (auto-detected):
   ```json
   {"labels": ["seo", "auto"]}  // → siteagent/seo
   ```

2. **Via explicit category field**:
   ```json
   {"category": "content", "labels": ["auto"]}  // → siteagent/content
   ```

3. **Default fallback**:
   ```json
   {"labels": ["auto"]}  // → siteagent/misc (default)
   ```

**Detection logic** (`_category_from_labels`):
```python
known = ["seo", "og", "deps", "content", "misc"]
for c in known:
    if c in labels:
        return c
return "misc"  # default
```

### Draft PRs

**Add `"draft"` to labels** to open PR as draft:

```json
{
  "labels": ["seo", "auto", "draft"],
  "title": "Work in progress: SEO improvements"
}
```

**Implementation** (`agent_act.py`):
```python
is_draft = any(lbl.lower() == "draft" for lbl in labels)
draft_flag = "--draft" if is_draft else ""

pr_url = _run(
    f'gh pr create --repo {repo} --base {payload.base} --head {branch} '
    f'--title "{safe_title}" --body "{safe_body}" {draft_flag}'.strip(),
    env=env
)
```

**Use cases**:
- Experimental changes needing review
- Work in progress before marking ready
- Preview before merging

### Auto-Merge (Optional)

**Workflow**: `.github/workflows/auto-merge-siteagent.yml`

**Triggers**:
- `pull_request` event with types `[labeled, synchronize]`

**Conditions** (all must be true):
1. PR has label `siteagent`
2. PR has label `auto`
3. PR state is `open`
4. All CI checks passed (success/neutral/skipped)

**Actions**:
1. Verify all check runs passed
2. Squash merge the PR
3. Add comment: "🤖 Auto-merged by SiteAgent workflow"

**Disable**: Remove workflow file or remove `auto` label from PRs.

## Local Commands

### Dry-Run (Preview)

Preview changes without pushing or creating PR:

```bash
curl -sS -X POST http://127.0.0.1:8001/agent/artifacts/pr \
  -H "Content-Type: application/json" \
  -d '{
    "dry_run": true,
    "labels": ["seo", "auto"],
    "use_llm": true
  }' | jq
```

**Response**:
```json
{
  "status": "dry-run",
  "branch": "siteagent/seo",
  "diff": "M index.html\nM sitemap.xml",
  "suggested_title": "feat(seo): optimize meta tags",
  "suggested_body": "Auto-generated improvements...",
  "labels": ["seo", "auto"]
}
```

### Create/Update PR

**Full workflow** with all environment variables:

```bash
# Set required env vars
export SITEAGENT_ENABLE_WRITE=1
export GITHUB_TOKEN="ghp_your_token_here"
export GITHUB_REPO="leok974/leo-portfolio"

# Create or update PR
curl -sS -X POST http://127.0.0.1:8001/agent/artifacts/pr \
  -H "Content-Type: application/json" \
  -d '{
    "labels": ["seo", "auto"],
    "use_llm": true,
    "attach_insights": true,
    "single_commit": true,
    "force_with_lease": true
  }' | jq
```

**PowerShell** (Windows):

```powershell
$env:SITEAGENT_ENABLE_WRITE = "1"
$env:GITHUB_TOKEN = (Get-Content .\secrets\github_token).Trim()

$body = @{
    labels = @("seo", "auto")
    use_llm = $true
    attach_insights = $true
} | ConvertTo-Json

Invoke-RestMethod `
    -Method POST `
    -Uri "http://127.0.0.1:8001/agent/artifacts/pr" `
    -ContentType "application/json" `
    -Body $body
```

### Response Status Values

| Status | Meaning | When |
|--------|---------|------|
| `"created"` | New PR created | No existing open PR for branch |
| `"updated"` | Existing PR updated | Open PR found and updated |
| `"noop"` | No changes detected | Git status empty, nothing to commit |
| `"dry-run"` | Dry run mode | `dry_run: true` in request |

**Example responses**:

```json
// Created
{
  "status": "created",
  "branch": "siteagent/seo",
  "pr": "https://github.com/leok974/leo-portfolio/pull/123",
  "labels": ["seo", "auto"],
  "diff": "M index.html",
  "message": "Created new PR"
}

// Updated
{
  "status": "updated",
  "branch": "siteagent/seo",
  "pr": "https://github.com/leok974/leo-portfolio/pull/123",
  "labels": ["seo", "auto"],
  "diff": "M index.html\nM sitemap.xml",
  "message": "Updated existing PR #123"
}

// No changes
{
  "status": "noop",
  "message": "No changes to commit.",
  "branch": "siteagent/seo",
  "open_pr": "https://github.com/leok974/leo-portfolio/pull/123"
}
```

## API Reference

### Endpoint: `POST /agent/artifacts/pr`

**Authentication**: Requires `SITEAGENT_ENABLE_WRITE=1`

**Request Body** (`PRCreateInput`):

```typescript
{
  // Branch and PR metadata
  branch?: string;              // Explicit branch name (overrides category)
  title?: string;               // PR title (auto-generated if empty)
  body?: string;                // PR body (auto-generated if empty)
  labels?: string[];            // Labels (default: ["auto", "siteagent"])
  base?: string;                // Base branch (default: "main")
  commit_message?: string;      // Commit message (default: auto-generated)

  // Behavior flags
  dry_run?: boolean;            // Preview mode (default: false)
  use_llm?: boolean;            // Use LLM for title/body (default: false)
  attach_insights?: boolean;    // Append analytics insights (default: true)
  single_commit?: boolean;      // Rolling single commit (default: true)
  force_with_lease?: boolean;   // Safe force push (default: true)

  // Category selection
  category?: string;            // Explicit category (seo/content/og/deps/misc)
}
```

**Response** (`PRCreateResponse`):

```typescript
{
  status: "created" | "updated" | "noop" | "dry-run";
  branch?: string;
  pr?: string;              // PR URL
  labels?: string[];
  diff?: string;            // Git diff summary
  message?: string;         // Human-readable status message
  open_pr?: string;         // Existing PR URL (for noop status)

  // Dry-run only
  suggested_title?: string;
  suggested_body?: string;
}
```

## Troubleshooting

### Common Issues

**1. "Write actions disabled"**
```
{"detail":"Write actions disabled. Set SITEAGENT_ENABLE_WRITE=1 to enable."}
```
**Fix**: Set environment variable before running:
```bash
export SITEAGENT_ENABLE_WRITE=1
```

**2. "GITHUB_TOKEN or GH_TOKEN environment variable required"**
```
{"detail":"GITHUB_TOKEN or GH_TOKEN environment variable required"}
```
**Fix**: Set GitHub token:
```bash
export GITHUB_TOKEN="ghp_your_token_here"
```

**3. Force push rejected**
```
{"detail":"Failed to push branch siteagent/seo: ..."}
```
**Fix**: Branch may have been updated by another process. Use `force_with_lease: true` (default) for safe force-pushing.

**4. PR creation fails with "head branch already exists"**

This shouldn't happen with the new update-if-exists logic, but if it does:
- Check if an open PR exists manually
- Delete the branch manually: `git push origin --delete siteagent/<category>`
- Re-run the PR creation

**5. Stale branches not pruning**

Check workflow logs: `.github/workflows/prune-stale-siteagent-branches.yml`
- Ensure workflow is enabled
- Check STALE_DAYS setting (default: 14)
- Verify no open PRs exist for the branch
- Check branch age calculation logic

### Debug Mode

**Enable verbose logging** in workflows:

```yaml
- name: Create/Update PR
  run: |
    set -x  # Enable bash debug mode
    curl -v http://127.0.0.1:8001/agent/artifacts/pr ...
```

**Check backend logs**:
```bash
# Local uvicorn
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001 --log-level debug

# Docker
docker compose logs -f assistant_api
```

## Best Practices

### 1. Use Category Labels Consistently

**Good**:
```json
{"labels": ["seo", "auto"]}          // → siteagent/seo
{"labels": ["content", "auto"]}      // → siteagent/content
```

**Avoid**:
```json
{"labels": ["misc", "random", "stuff"]}  // → confusing categorization
```

### 2. Let LLM Generate Titles/Bodies

Enable `use_llm: true` for better PR descriptions:

```json
{
  "use_llm": true,
  "attach_insights": true,
  "labels": ["seo", "auto"]
}
```

### 3. Use Dry-Run First

Preview changes before creating PRs:

```bash
# 1. Dry-run to preview
curl ... -d '{"dry_run": true, ...}'

# 2. Review output

# 3. Create PR if satisfied
curl ... -d '{"dry_run": false, ...}'
```

### 4. Monitor Stale Branches

Check for abandoned branches periodically:

```bash
# List all siteagent branches
gh api repos/leok974/leo-portfolio/branches \
  | jq -r '.[] | select(.name | startswith("siteagent/")) | .name'

# Check for open PRs
gh pr list --label siteagent --state open
```

### 5. Squash Merge Only

Enforce squash-only merges in repository settings to keep history clean.

## Repository Settings Checklist

Configure these in **Settings → Pull Requests**:

- [ ] ✅ Allow squash merging
- [ ] ❌ Disallow merge commits
- [ ] ❌ Disallow rebase merging
- [ ] ✅ Automatically delete head branches
- [ ] ✅ Allow auto-merge (optional, for auto-merge workflow)
- [ ] ✅ Require status checks before merging (recommended)

## Workflows Reference

| Workflow | Path | Schedule | Purpose |
|----------|------|----------|---------|
| Prune Stale Branches | `.github/workflows/prune-stale-siteagent-branches.yml` | Daily 03:17 UTC | Delete old branches (>14d, no PR) |
| Delete Merged Branch | `.github/workflows/delete-merged-branch.yml` | On PR close | Delete branch after merge |
| Auto-Merge | `.github/workflows/auto-merge-siteagent.yml` | On PR label/sync | Auto-merge when checks pass |
| Nightly PR | `.github/workflows/siteagent-nightly-pr.yml` | Daily 03:27 UTC | Nightly maintenance PR |
| Meta Auto | `.github/workflows/siteagent-meta-auto.yml` | Daily 03:28 UTC | SEO metadata updates |

All workflows use concurrency groups to prevent race conditions.

## Summary

SiteAgent's branch hygiene system provides:

✅ **Clean repository**: One branch per category, no proliferation
✅ **Easy reviews**: Single-commit rolling branches
✅ **Automatic cleanup**: Merged and stale branches deleted
✅ **Safe operations**: Concurrency guards and force-with-lease
✅ **Flexible control**: Categories, drafts, auto-merge options
✅ **Comprehensive API**: Full control via REST endpoints

For more information, see:
- [Agent Act API](../assistant_api/routers/agent_act.py)
- [Workflow Files](../.github/workflows/)
- [Main README](../README.md)
