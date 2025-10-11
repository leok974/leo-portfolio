# Projects Sync Quick Reference

**Purpose**: Automated GitHub → projects.json synchronization with PR creation

---

## Quick Start (3 commands)

```bash
# 1. Set token (get from https://github.com/settings/tokens/new)
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# 2. Dry-run (preview changes)
npm run projects:sync:dry | jq

# 3. Sync (opens PR)
npm run projects:sync
```

---

## npm Scripts

| Command | Description |
|---------|-------------|
| `npm run projects:sync` | Fetch repos → update projects.json → open PR |
| `npm run projects:sync:dry` | Show planned changes (JSON) without writing |
| `npm run projects:sync:only <repos>` | Limit to specific repos (csv) |

---

## Environment Variables

| Variable | Required | Default | Example |
|----------|----------|---------|---------|
| `GITHUB_TOKEN` | ✅ | — | `ghp_xxxxxxxxxxxxxxxxxxxx` |
| `GH_OWNER` | ❌ | Inferred from git remote | `leok974` |
| `GH_REPO` | ❌ | Inferred from git remote | `leo-portfolio` |
| `SYNC_INCLUDE_FORKS` | ❌ | `false` | `true` |
| `SYNC_MAX_REPOS` | ❌ | Unlimited | `30` |
| `PR_LABELS` | ❌ | `automation,projects-sync` | `bot,sync` |
| `PR_ASSIGNEES` | ❌ | `""` | `leok974` |
| `PR_COMMENT_EVERY_RUN` | ❌ | `true` | `false` |

---

## CLI Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--dry-run` | Preview changes without writing | `node scripts/projects.sync.mjs --dry-run` |
| `--base <branch>` | Target branch (default: repo default) | `--base main` |
| `--branch <name>` | Custom branch name | `--branch feat/sync-2025` |
| `--only <csv>` | Limit to specific repos | `--only ledger-mind,leo-portfolio` |

---

## Workflow

1. **Fetch**: Paginated repos from GitHub API (`GET /users/{owner}/repos`)
2. **Enrich**: Topics (`GET /repos/{owner}/{repo}/topics`) + languages
3. **Normalize**: Map to `projects.json` schema (slug, tags, stars, sources)
4. **Diff**: SHA256 hash comparison (skip if unchanged)
5. **Generate**: Run `generate-projects.js` to rebuild `/projects/*.html`
6. **PR Check**: Look for open or closed-unmerged PR on stable branch (`chore/projects-sync`)
7. **Commit**: Stage `projects.json` + `/projects` → stable or timestamped branch
8. **PR**: Reuse open PR, reopen closed unmerged PR, or create new PR

**Branch naming**:
- Stable: `chore/projects-sync` (reused when PR exists or reopenable)
- Timestamped: `chore/projects-sync-YYYYMMDDHHMMSS` (when no open/reopenable PR)

**Idempotency**: Weekly runs reuse the same PR instead of creating spam. Even handles accidental closes!---

## GitHub Actions

**Schedule**: Mondays 09:00 UTC
**Manual**: `gh workflow run projects-sync.yml`
**File**: `.github/workflows/projects-sync.yml`

**Permissions Required**:
- `contents: write` (push branch)
- `pull-requests: write` (open PR)

**Output**: `PR_URL=<url>` in `GITHUB_OUTPUT` for downstream jobs

---

## Dry-Run Output

```json
{
  "dry_run": true,
  "changed": true,
  "added": ["ledger-mind", "dotfiles"],
  "removed": [],
  "count_before": 10,
  "count_after": 12
}
```

---

## Successful Run Output

**New PR**:
```
[projects.sync] Repo: leok974/leo-portfolio
[projects.sync] projects.json updated (10 → 12)
[projects.sync] Regenerating /projects pages…
[projects.sync] Opened PR: https://github.com/leok974/leo-portfolio/pull/456
[projects.sync] Updated PR body status block.
[projects.sync] Posted run summary comment.
outputs_uri=https://github.com/leok974/leo-portfolio/pull/456
```

**Reused PR**:
```
[projects.sync] Repo: leok974/leo-portfolio
[projects.sync] projects.json updated (12 → 13)
[projects.sync] Regenerating /projects pages…
[projects.sync] Reusing open PR: https://github.com/leok974/leo-portfolio/pull/456
[projects.sync] Updated PR body status block.
[projects.sync] Posted run summary comment.
outputs_uri=https://github.com/leok974/leo-portfolio/pull/456
```

**PR Status Block**:
```markdown
### Sync Status
- **When:** 2025-10-10 15:30:45 UTC
- **Changed:** yes
- **Projects:** 10 → 12
- **Added (2):**
  - new-repo-1
  - new-repo-2
- **Removed (0):**
  - none
- **Pages regenerated:** yes
```
outputs_uri=https://github.com/leok974/leo-portfolio/pull/456
```

**Reopened PR** (closed unmerged):
```
[projects.sync] Repo: leok974/leo-portfolio
[projects.sync] projects.json updated (13 → 14)
[projects.sync] Regenerating /projects pages…
[projects.sync] Reopened PR: https://github.com/leok974/leo-portfolio/pull/456
outputs_uri=https://github.com/leok974/leo-portfolio/pull/456
```

---

## Testing

```bash
# Unit tests (4 passing)
npm test tests/projects.sync.spec.ts

# Token validation
npm run projects:sync:dry  # Should error without GITHUB_TOKEN

# Dry-run with token
export GITHUB_TOKEN=ghp_xxx
npm run projects:sync:dry | jq
```

---

## Troubleshooting

**Error: Missing GITHUB_TOKEN**
```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
# Get token: https://github.com/settings/tokens/new
# Scopes: repo (read/write), pull_request (write)
```

**Error: Cannot infer GH owner/repo**
```bash
export GH_OWNER=leok974
export GH_REPO=leo-portfolio
```

**Error: Bad credentials**
- Token expired or invalid
- Token lacks required scopes (repo, pull_request)
- Regenerate: https://github.com/settings/tokens

**No PR opened (but script succeeded)**
- Reusing existing open PR
- Check log for: `Reusing open PR: <url>`
- Or: No changes detected (projects.json unchanged)
- Check: `npm run projects:sync:dry` → `"changed": false`

**Rate limit exceeded**
- GitHub API limit: 5000/hour (authenticated)
- Wait 1 hour or reduce `SYNC_MAX_REPOS`

---

## Files

| File | Lines | Purpose |
|------|-------|---------|
| `scripts/projects.sync.mjs` | 255 | Main script |
| `tests/projects.sync.spec.ts` | 33 | Unit tests |
| `.github/workflows/projects-sync.yml` | 27 | GitHub Actions workflow |

**Docs**: [`PROJECTS_SYNC_COMPLETE.md`](PROJECTS_SYNC_COMPLETE.md) (full guide)

---

## Examples

### Selective Sync (Specific Repos)

```bash
npm run projects:sync:only ledger-mind,leo-portfolio
```

### Custom Branch Name

```bash
node scripts/projects.sync.mjs --branch feat/sync-q4-2025
```

### Include Forks

```bash
SYNC_INCLUDE_FORKS=true npm run projects:sync
```

### Limit Repos (Performance)

```bash
SYNC_MAX_REPOS=20 npm run projects:sync
```

---

**Status**: ✅ Production ready
**Next**: Run `npm run projects:sync` to create first PR
