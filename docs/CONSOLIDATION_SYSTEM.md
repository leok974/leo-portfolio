---
title: CONSOLIDATION SYSTEM
---

# Docs & Workflows Consolidation System

## Overview

This tooling provides automated docs and workflows consolidation with **guardrails by default** - all operations are dry-run unless explicitly confirmed with `--apply`.

## Components

### 1. Docs Consolidation (`scripts/docs-consolidate.mjs`)

**Purpose**: Organize, clean, and maintain docs/ directory with enforced rules.

**Features**:
- ✅ **Required docs enforcement** - Ensures critical docs exist
- ✅ **Keep list management** - Preserves allowlisted docs
- ✅ **Deprecation flagging** - Identifies outdated docs
- ✅ **Safe deletion** - Only deletes explicitly listed files
- ✅ **Link fixing** - Updates internal markdown links using renameMap
- ✅ **Frontmatter** - Ensures all kept docs have YAML frontmatter
- ✅ **INDEX generation** - Creates organized docs/INDEX.md
- ✅ **Traceability** - Generates JSON report with file hash

**Usage**:
```bash
# Dry-run audit (safe, no changes)
npm run docs:audit

# Apply changes (requires --apply flag)
npm run docs:apply
```

**Configuration**: `docs/docs.config.json`
```json
{
  "required": [...],      // Must exist
  "keep": [...],          // Preserve these
  "deprecated": [...],    // Flag for review
  "delete": [...],        // OK to delete (only with --apply)
  "renameMap": {...},     // Old path → new path
  "indexGroups": [...]    // Organized groups for INDEX.md
}
```

### 2. Workflows Consolidation (`scripts/workflows-consolidate.mjs`)

**Purpose**: Detect and remove duplicate/unnecessary GitHub Actions workflows.

**Features**:
- ✅ **Allowlist validation** - Only keeps approved workflows
- ✅ **Duplicate detection** - Finds identical trigger+jobs signatures
- ✅ **Safe removal** - Only deletes explicit duplicates with --apply
- ✅ **YAML parsing** - Validates workflow syntax
- ✅ **Traceability** - JSON report of keep/remove/flagged files

**Usage**:
```bash
# Dry-run audit (safe, no changes)
npm run wf:audit

# Apply deletions (requires --apply flag)
npm run wf:apply
```

**Allowlist** (hardcoded in script):
- `.github/workflows/ci.yml` - Main CI pipeline
- `.github/workflows/release.yml` - Release automation
- `.github/workflows/docs-audit.yml` - This audit workflow

### 3. CI Integration (`.github/workflows/docs-audit.yml`)

**Purpose**: Automated docs/workflows validation on PRs and pushes.

**Behavior**:
- ✅ Runs on all PRs and pushes to main
- ✅ **Non-blocking** - Reports issues, never fails the build
- ✅ Uploads JSON reports as artifacts
- ✅ Dry-run only (never applies changes in CI)

**Artifacts**:
- `docs/consolidation-report.<hash>.json` - Docs audit results

## Guardrails

### 🛡️ **Dry-Run by Default**
All scripts require explicit `--apply` flag to mutate files. Default mode only generates reports.

### 🛡️ **Explicit Deletion Rules**
Files are only deleted if:
1. Listed in `delete` array (docs)
2. Identified as exact duplicate (workflows)
3. User runs with `--apply` flag
4. **NEW**: File hasn't been modified in last 14 days (time-based safeguard)

### 🛡️ **Time-Based Safeguard**
The docs consolidation script checks modification time before deleting:
- Files modified within 14 days are flagged as `recent_change` instead of deleted
- Prevents accidental deletion of actively maintained files
- Provides safety buffer for ongoing work

### 🛡️ **Code Ownership Protection**
`.github/CODEOWNERS` enforces review requirements:
- All `docs/**` changes require @leok974 review
- All `.github/workflows/**` changes require @leok974 review
- Consolidation scripts and config require @leok974 review

### 🛡️ **Strict Mode (Optional)**
CI workflow supports optional strict mode enforcement:
- Set `STRICT_AUDIT=1` in workflow env to fail on violations
- Checks for flagged docs and extra workflows
- Can be enabled per-branch or per-PR
- Default: `STRICT_AUDIT=0` (report only, non-blocking)

### 🛡️ **Traceability**
Every operation generates a JSON report with:
- Files kept/renamed/removed/flagged
- Reasons for each action
- Hash of config file (docs)

### 🛡️ **Link Preservation**
Docs script fixes internal links automatically using `renameMap`, preventing broken references.

### 🛡️ **Frontmatter Enforcement**
All kept docs get YAML frontmatter if missing, ensuring consistency.

## Workflow

### Initial Audit (Done)

```bash
# 1. Install dependencies
npm install

# 2. Run audits
npm run docs:audit
npm run wf:audit

# 3. Review reports
cat docs/consolidation-report.*.json
# Check console output for workflows report
```

### Customize Rules

**Edit `docs/docs.config.json`**:
```json
{
  "deprecated": [
    "docs/OLD_README.md"  // Flag this file
  ],
  "delete": [
    "docs/OLD_README.md"  // OK to delete with --apply
  ],
  "renameMap": {
    "docs/ARCH.md": "docs/ARCHITECTURE.md"  // Auto-fix links
  }
}
```

### Apply Changes

```bash
# 1. Apply docs consolidation
npm run docs:apply

# 2. Apply workflows cleanup
npm run wf:apply

# 3. Review changes
git status
git diff

# 4. Commit if satisfied
git add -A
git commit -m "chore(docs,ci): consolidate docs & workflows"
```

### Continuous Maintenance

The `docs-audit.yml` workflow runs automatically on every PR, reporting any drift from the rules without blocking merges.

## Current State

### Docs Audit Results
- **Kept**: 8 files (required + keep list)
  - docs/a11y.md, API.md, ARCHITECTURE.md, BACKEND_QUICKSTART.md
  - docs/DEPLOY.md, DEVELOPMENT.md, PHASE_0.3.0.md, SECURITY.md
- **Flagged**: ~100 extra docs files marked for review
- **Removed**: None (no files in delete list)
- **Renamed**: None (empty renameMap)

### Workflows Audit Results
- **Kept**: 0 (allowlist not matching existing paths)
- **Flagged**: 91 workflows for review
- **Duplicates**: 3 detected
  - docs-audit.yml → duplicate of deps-audit.yml
  - prod-assistant-probe.yml → duplicate of assistant-probe.yml
  - prune-stale-siteagent-branches.yml → duplicate of agents-prune.yml
- **Remove**: 3 duplicates (with --apply)

## Next Steps

### 1. Update Docs Config
Review flagged docs and decide:
- Add to `keep` if needed
- Add to `deprecated` to flag
- Add to `delete` to remove

### 2. Clean Up Duplicates
```bash
npm run wf:apply  # Removes 3 duplicate workflows
```

### 3. Consolidate Workflows
Review the 91 flagged workflows and:
- Merge overlapping functionality into `ci.yml`
- Keep essential standalone workflows
- Archive/delete unnecessary ones

### 4. Generate INDEX
```bash
npm run docs:apply  # Creates docs/INDEX.md
```

### 5. Automate in CI
The audit workflow is already in place and will report on future PRs.

## Maintenance

### Adding New Docs
1. Create file in `docs/`
2. Add to `required` or `keep` in `docs.config.json`
3. Run `npm run docs:audit` to verify
4. Run `npm run docs:apply` to regenerate INDEX.md

### Adding New Workflows
1. Create workflow in `.github/workflows/`
2. Add to allowlist in `scripts/workflows-consolidate.mjs`
3. Run `npm run wf:audit` to verify no duplicates

### Renaming/Moving Docs
1. Add entry to `renameMap` in `docs.config.json`
2. Run `npm run docs:apply` - links auto-fix
3. Commit changes

## Advanced: Strict Mode

### Enabling Strict Mode

To make audits **block PRs/pushes** when violations exist:

**Option 1: Always On (Main Branch)**
Edit `.github/workflows/docs-audit.yml`:
```yaml
env:
  STRICT_AUDIT: "${{ github.ref_name == 'main' && '1' || '0' }}"
```

**Option 2: Manual Toggle**
Set in workflow env:
```yaml
env:
  STRICT_AUDIT: "1"  # Enable strict mode
```

**Option 3: Per-Branch**
```yaml
env:
  STRICT_AUDIT: "${{ startsWith(github.ref, 'refs/tags/') && '1' || '0' }}"
```

### What Strict Mode Checks

When `STRICT_AUDIT=1`:
1. ❌ **Fails if any docs are flagged** (deprecated or extra)
2. ❌ **Fails if extra workflows exist** (not in allowlist)
3. ✅ **Provides clear error messages** with fix commands
4. ✅ **Still uploads reports** for debugging

### Recommended Strategy

- **Feature branches**: `STRICT_AUDIT=0` (report only)
- **Main branch**: `STRICT_AUDIT=1` (enforce)
- **Release tags**: `STRICT_AUDIT=1` (enforce)

This allows flexibility during development while maintaining quality gates for production.

## Safety Features

✅ **All mutations require --apply flag**
✅ **JSON reports for every operation**
✅ **Link fixing prevents broken references**
✅ **Frontmatter enforcement ensures consistency**
✅ **CI audit configurable (report-only or blocking)**
✅ **Explicit deletion lists (no wildcards)**
✅ **Duplicate detection uses content signatures**
✅ **Time-based safeguard (14-day modified check)**
✅ **Code ownership protection via CODEOWNERS**
✅ **PR template includes audit checklist**

## Files Created

- `scripts/docs-consolidate.mjs` - Docs consolidation script
- `scripts/workflows-consolidate.mjs` - Workflows consolidation script
- `docs/docs.config.json` - Docs rules configuration
- `.github/workflows/docs-audit.yml` - CI audit workflow
- `docs/consolidation-report.*.json` - Audit result report

## Package Scripts

```json
{
  "docs:audit": "node scripts/docs-consolidate.mjs",
  "docs:apply": "node scripts/docs-consolidate.mjs --apply",
  "wf:audit": "node scripts/workflows-consolidate.mjs",
  "wf:apply": "node scripts/workflows-consolidate.mjs --apply"
}
```
