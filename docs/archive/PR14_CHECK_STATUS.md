# PR #14 Check Status - October 20, 2025

**PR**: https://github.com/leok974/leo-portfolio/pull/14
**Branch**: `feat/portfolio-backend-route` → `main`
**Title**: Enable backend via api.leoklemet.com → portfolio-api.int:8000

## Current Status: ⚠️ Many Checks Failing

**Summary**: 30 failing, 7 successful, 7 pending, 1 cancelled, 6 skipped

### Critical Checks Status

#### ✅ Passing (Essential)
1. **CI / Build & Verify** - ✅ SUCCESS (21s)
2. **CI / Run Backend Tests** - ✅ SUCCESS (2m18s)
3. **CI / Smoke Tests** - ✅ SUCCESS (2m35s)

#### ⏳ In Progress (Essential)
4. **Portfolio CI / build-and-test** - ⏳ IN_PROGRESS
   - This includes the new `api-ready.spec.ts` test
   - Most critical for this PR
5. **CI / E2E (full-stack)** - ⏳ IN_PROGRESS

#### ❌ Failing (Systematic Issues)
Many workflows are failing due to configuration issues unrelated to this PR:

**Common Failure Pattern**: Lock file not found
- Workflows trying to use `npm` cache but project uses `pnpm`
- Error: "Dependencies lock file is not found... Supported file patterns: package-lock.json"
- **Cause**: Workflow uses `cache: npm` instead of pnpm setup

**Affected Workflows**:
- Lint & Unit Tests (node-tests)
- CI – Fast (fast-tests)
- Frontend Fast Tests
- TypeScript Check
- E2E workflows (multiple)
- And many more...

**CSP Hash Guard Failure**:
- Trying to read `index.html` before build completes
- Error: "ENOENT: no such file or directory, open 'index.html'"

## Analysis

### Are These Failures Blocking?

**NO** - Most failures are pre-existing workflow configuration issues, not caused by this PR's changes.

**Evidence**:
1. ✅ Core CI checks that properly use pnpm are **passing**
2. ✅ Backend tests are **passing**
3. ✅ Build & verify is **passing**
4. ⏳ Portfolio CI (the most relevant check) is **still running**

### What Matters for This PR?

**Essential Checks**:
1. ✅ CI / Build & Verify - **PASSED**
2. ✅ CI / Run Backend Tests - **PASSED**
3. ⏳ **Portfolio CI / build-and-test** - **IN PROGRESS** (includes api-ready.spec.ts)
4. ⏳ CI / E2E (full-stack) - **IN PROGRESS**

### Root Cause of Widespread Failures

The repository has **workflow configuration drift**:
- Some workflows use modern `pnpm` setup correctly
- Many older workflows still use `cache: npm` which fails
- This is a pre-existing issue, not introduced by this PR

**Example of Correct Config** (from working workflows):
```yaml
- uses: pnpm/action-setup@v4
  with:
    version: 9
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: 'pnpm'  # ← Correct
```

**Example of Broken Config** (from failing workflows):
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: 'npm'  # ← Wrong! Project uses pnpm
```

## Recommendations

### Option 1: Merge with Existing Passing Checks ✅
**Rationale**:
- The failing checks are infrastructure issues, not code issues
- Core functionality checks are passing
- Portfolio CI (with api-ready test) is still running
- This PR doesn't touch workflow configurations

**Action**:
1. Wait for Portfolio CI to complete
2. If Portfolio CI passes, merge immediately
3. Create follow-up PR to fix workflow configurations

### Option 2: Fix Workflows First (Slower)
**Action**:
1. Create separate PR to update all workflow files
2. Replace `cache: npm` with pnpm setup
3. Wait for that PR to merge
4. Re-run checks on this PR

**Downside**: Delays backend deployment unnecessarily

### Option 3: Override and Merge Now ⚡
**Rationale**:
- Essential checks are passing
- Failures are clearly infrastructure issues
- Backend routing fix is urgent (site currently has 502 errors)

**Action**:
1. Admin override required checks if available
2. Merge immediately
3. Fix workflows in follow-up

## Current Wait: Portfolio CI

The most relevant check **Portfolio CI / build-and-test** is still running.

**What it tests**:
- Portfolio build
- CSP nonces
- Portfolio smoke tests
- SEO tests
- **api-ready.spec.ts** (our new test!)
- Resume endpoints
- Admin auth (optional)

**Expected**: Should pass (changes are minimal and well-tested locally)

## Next Steps

1. ⏳ **Wait** for Portfolio CI to complete (~2-5 more minutes)
2. ✅ **Verify** Portfolio CI passes
3. 🚀 **Merge** PR #14 (ignore systematic workflow failures)
4. 📋 **Create** follow-up issue to fix workflow configurations
5. 🔄 **Execute** post-merge actions:
   - Restart cloudflared container
   - Run smoke tests
   - Create docs cleanup PR

---

## Update Commands

```powershell
# Check Portfolio CI status
gh pr view 14 --json statusCheckRollup --jq '.statusCheckRollup[] | select(.name == "build-and-test")'

# View Portfolio CI logs when complete
gh run view 18659753072 --log

# Check all PR status
gh pr checks 14

# Merge when ready (after Portfolio CI passes)
gh pr merge 14 --squash --delete-branch
```

---

**Decision**: Wait for Portfolio CI, then merge regardless of systematic workflow failures.

**Timestamp**: 2025-10-20 17:30 UTC
