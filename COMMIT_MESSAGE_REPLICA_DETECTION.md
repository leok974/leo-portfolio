# Replica Detection Feature - Implementation Summary

## Commits

### 1. Core Implementation (051cd40)
**infra: add replica detection with safe fallback**

- Added `detectReplicas()` function to `scripts/planners/k8s-planner.mjs`
  - Queries cluster: `kubectl -n <ns> get <kind>/<name> -o json`
  - Extracts `spec.replicas` or `status.replicas`
  - Returns `{ ok: true, replicas: N }` or `{ ok: false }`
  
- Added `shouldDetect()` gate function
  - Checks `SKIP_CLUSTER_DETECT` env var
  - Returns false if `SKIP_CLUSTER_DETECT=1`
  
- Enhanced `makePlan()` in k8s-planner
  - Detection loop for each workload with replicas
  - Sets `action.from` to detected value or "unknown"
  - Adds detection notes (no-change or unavailable messages)
  - Merges detection notes into plan
  
- Added `--detect=on|off` CLI flag to `scripts/infra.scale.mjs`
  - Sets `SKIP_CLUSTER_DETECT=1` when `--detect=off`
  - Default: `on` (detection enabled)
  
- Enhanced `buildActionsTable()` for from → to display
  - Shows `replicas **3 → 6**` when from detected
  - Shows `replicas → **6**` when from=unknown
  
- Enhanced `toSummary()` with fallback
  - Shows `(from 3)` or `(from unknown)` in summary
  
- Updated test fixture in `tests/infra.prbody.spec.ts`
  - Added `from: 3` to scale action
  - Updated regex to match `replicas **3 → 6**`

**Files**: 4 changed, 86 insertions(+), 9 deletions(-)

---

### 2. Comprehensive Documentation (7476ee6)
**docs: add comprehensive replica detection guide**

Created `INFRA_REPLICA_DETECTION.md` (373 lines) covering:
- How detection works (kubectl get -o json)
- Control flags and environment variables
- Fallback behavior and safety guarantees
- PR body and SUMMARY.md format changes
- Detection notes in plan
- Usage examples with/without detection
- Testing approach and fixtures
- Troubleshooting guide (Q&A)
- Future enhancements
- Complete implementation details

**File**: 1 new file, 373 lines

---

### 3. Quick Reference (64a8585)
**docs: add replica detection quick reference**

Created `INFRA_DETECTION_QUICKREF.md` (167 lines) with:
- TL;DR and quick examples
- Detection flags comparison table
- PR body format side-by-side
- Detection notes examples
- When to disable guidance
- Safety guarantees table
- Troubleshooting Q&A
- Implementation files overview
- Links to full documentation

**File**: 1 new file, 167 lines

---

### 4. Main Quickref Update (e7a902e)
**docs: update quickref with detection feature**

Updated `INFRA_ORCHESTRATOR_QUICKREF.md`:
- Changed PR body example from `→ 6` to `3 → 6`
- Added note explaining detection and fallback
- Added detection docs to References section
- Points readers to quick reference

**File**: 1 changed, 6 insertions(+), 1 deletion(-)

---

## Summary Statistics

**Total Commits**: 4
**Files Changed**: 7
- **Implementation**: 4 files (planner, CLI, test, quickref)
- **Documentation**: 3 files (full guide, quick ref, main quickref update)

**Total Lines**:
- Implementation: 86 lines added, 9 deleted
- Documentation: 540+ lines added

---

## Feature Overview

### What It Does
Detects current replica counts from the cluster before generating scale plans, showing **change deltas** (`3 → 6`) instead of just target values (`→ 6`).

### Key Design Principles

1. **Read-Only**: Only `kubectl get -o json` (no cluster mutations)
2. **Optional**: Can be disabled with `--detect=off` or `SKIP_CLUSTER_DETECT=1`
3. **Non-Blocking**: Plans succeed even if detection fails
4. **Graceful Fallback**: Shows `from: "unknown"` when kubectl unavailable
5. **Informational**: Apply/rollback workflows ignore `from` field

### Safety Guarantees

✅ No cluster mutations during planning
✅ Plans always succeed (detection failure is non-fatal)
✅ Can be disabled for CI/automated workflows
✅ Clear feedback via detection notes
✅ No impact on executors

---

## Usage Examples

### Default (Detection On)
```bash
node scripts/infra.scale.mjs --apply \
  --target=prod --namespace=assistant \
  --workload=Deployment:web:6
```
**Result**: `replicas **3 → 6**` in PR body

### Detection Off
```bash
node scripts/infra.scale.mjs --apply --detect=off \
  --target=prod --namespace=assistant \
  --workload=Deployment:web:6
```
**Result**: `replicas → **6**` in PR body

---

## Benefits

### For Reviewers
- **Clear Deltas**: See `3 → 6` instead of just `→ 6`
- **No-Op Visibility**: Know when scaling is redundant
- **Context Awareness**: Understand impact of changes

### For Safety
- **Read-Only**: No mutations during detection
- **Graceful Degradation**: Works with or without kubectl
- **Non-Blocking**: Plans always succeed

### For Observability
- **Detection Notes**: Clear feedback on what was detected
- **Audit Trail**: `from` values captured in plan YAML
- **Debugging**: Understand plan behavior differences

---

## Files Modified

### Implementation
1. **scripts/planners/k8s-planner.mjs**
   - `shouldDetect()` - Check env var
   - `detectReplicas(kind, name, namespace)` - Query cluster
   - Enhanced `makePlan()` with detection loop
   - Added `detectionNotes` array

2. **scripts/infra.scale.mjs**
   - Added `DETECT` CLI flag
   - Set env var in `main()`
   - Enhanced `buildActionsTable()` for from → to
   - Enhanced `toSummary()` with fallback

3. **tests/infra.prbody.spec.ts**
   - Added `from: 3` to test fixture
   - Updated regex for `3 → 6` pattern

4. **INFRA_ORCHESTRATOR_QUICKREF.md**
   - Updated example output
   - Added detection note
   - Added docs to references

### Documentation
5. **INFRA_REPLICA_DETECTION.md** (NEW)
   - Comprehensive 373-line guide
   - Full implementation details
   - Troubleshooting and examples

6. **INFRA_DETECTION_QUICKREF.md** (NEW)
   - Quick 167-line reference
   - Side-by-side comparisons
   - Fast lookup tables

---

## Testing

### Unit Tests
- Test fixture includes `from: 3`
- Regex validates `replicas **3 → 6**` pattern
- No failures introduced

### Manual Testing
```bash
# With detection (requires kubectl + cluster access)
node scripts/infra.scale.mjs --dry-run \
  --target=prod --namespace=assistant \
  --workload=Deployment:web:6

# Without detection (CI mode)
node scripts/infra.scale.mjs --dry-run --detect=off \
  --target=prod --namespace=assistant \
  --workload=Deployment:web:6
```

---

## Related Work

This feature builds on recent infrastructure enhancements:
1. **PR Body Summarizer** (2e8aa05) - Actions table with details
2. **PR Checklist & Commands** (4c3a325) - Interactive review workflow
3. **Rollback System** (f5070a2) - Safe rollback with PR comments

**Detection complements these** by showing change context in the PR body table.

---

## Documentation Links

- **Full Guide**: `INFRA_REPLICA_DETECTION.md`
- **Quick Ref**: `INFRA_DETECTION_QUICKREF.md`
- **Main Quickref**: `INFRA_ORCHESTRATOR_QUICKREF.md`
- **Rollback**: `INFRA_ROLLBACK_COMPLETE.md`
- **Commands**: `INFRA_CHECKLIST_COMMANDS_COMPLETE.md`

---

## Branch

`siteagent/auto-43404`

**Commits**:
- 051cd40 - Core implementation
- 7476ee6 - Full documentation
- 64a8585 - Quick reference
- e7a902e - Quickref update

**Status**: ✅ All pushed to remote
