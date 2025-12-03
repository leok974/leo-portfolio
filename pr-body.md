## Summary
Comprehensive repo audit and cleanup to create an agent-first documentation structure. Moves 300+ legacy markdown files to archive, creates minimal core documentation set, adds automated hygiene checks, and removes temporary artifacts.

## Changes
- **Documentation**: Moved 300+ legacy *_COMPLETE.md, *_SUMMARY.md, PHASE_*.md, COMMIT_MESSAGE_* files to `docs/archive/`
- **Agent Core Docs**: Created `AGENT_GUIDE.md` (single-screen agent reference) + `RUNBOOKS/DEPLOY.md` + `RUNBOOKS/ONCALL.md`
- **Automated Hygiene**: Added `.github/workflows/repo-hygiene.yml` with knip/depcheck checks, DEPRECATED/LEGACY marker detection, large file warnings, secret scanning
- **Cleanup**: Removed temporary HTML files (root.html, agent.html, etc.) and log files
- **.gitignore**: Added `dist-portfolio/`, `dist-siteagent/`, `agent_artifacts/`, `audit/`, `outputs/`, `artifacts/`
- **Workspace Files**: Cleaned up obsolete `.code-workspace` files

## Audit Results (Attached)
See `audit/` directory for full analysis:
- **knip.json** (4.36 KB): Unused TypeScript exports
- **depcheck.json** (30.43 KB): Unused npm dependencies
- **vulture.txt** (0.05 KB): Dead Python code findings
- **zero-byte-files.txt**: Empty Python files identified

## Testing
- ✅ Pre-commit hook passed (agent validation skipped - backend not running)
- ✅ All files staged and committed successfully
- ✅ Branch pushed without errors
- ⏳ CI will validate hygiene checks on this PR

## Rollback Safety
Created safety tag `pre-cleanup-20251203` before changes. To rollback:
```bash
git reset --hard pre-cleanup-20251203
```

## Next Steps
After merge:
1. Review knip/depcheck findings and delete truly unused code
2. Update existing workflows with concurrency controls (cancel-in-progress)
3. Monitor hygiene workflow on future PRs

cc: @leok974
