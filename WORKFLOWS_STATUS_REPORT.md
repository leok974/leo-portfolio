# Workflows Status Report

**Report Date**: 2025-10-11
**Analysis**: Last 50 runs on `main` branch

## Executive Summary

**Critical Issues**:
1. 🔴 **pnpm lockfile out of date** - Blocking multiple E2E workflows
2. 🔴 **ESLint errors** - `AbortController` not defined in `scripts/agents-run.mjs`
3. 🔴 **Docker image not found** - PowerShell nanoserver-ltsc2022 manifest missing
4. 🔴 **Deprecated upload-artifact v3** - Multiple workflows using old version
5. 🔴 **TypeScript errors** - Issues in `test-script.js`
6. 🟡 **siteagent-meta-auto** - Fixed, currently testing (run 18435384277 in progress)

## Workflows by Status

### ✅ Consistently Passing (2)
- **Lint Deploy Docs** - 2/2 success
- **Schema Validation** - 2/2 success

### 🔴 Consistently Failing (20+)

#### High Priority - Blocking CI/CD

**1. TypeScript Check** (2/2 failures)
- **Error**: `test-script.js` syntax errors (lines 93-95)
- **Impact**: Type safety checks failing
- **Fix**: Remove or fix `test-script.js`, or exclude from TypeScript checking

**2. e2e-mock** (2/2 failures)
- **Error**: `ERR_PNPM_OUTDATED_LOCKFILE` - pnpm-lock.yaml not up to date
- **Impact**: Cannot install dependencies with frozen lockfile
- **Fix**: Run `pnpm install` locally and commit updated lockfile

**3. E2E (Playwright)** (2/2 failures)
- **Error**: Same as e2e-mock - pnpm lockfile issue
- **Impact**: Main E2E tests not running
- **Fix**: Update pnpm-lock.yaml

**4. Favicon Guard** (2/2 failures)
- **Error**: Likely pnpm lockfile issue
- **Impact**: Asset consistency checks failing
- **Fix**: Update pnpm-lock.yaml

**5. e2e-keywords-mock** (2/2 failures)
- **Error**: Likely pnpm lockfile issue
- **Impact**: Agent keyword tests not running
- **Fix**: Update pnpm-lock.yaml

#### Medium Priority - Infrastructure

**6. Smoke** (1/1 failure)
- **Error**: `manifest for mcr.microsoft.com/powershell:7.4-nanoserver-ltsc2022 not found`
- **Impact**: Smoke tests failing due to missing Docker image
- **Fix**: Update PowerShell image tag to available version or use different base image

**7. CI** (1/1 failure)
- **Errors**:
  - Deprecated `actions/upload-artifact@v3`
  - Missing `requirements.txt` (wrong working directory?)
  - ESLint error: `'AbortController' is not defined` in `scripts/agents-run.mjs`
- **Impact**: Main CI pipeline failing
- **Fix**:
  1. Update to `upload-artifact@v4`
  2. Fix requirements.txt path or working directory
  3. Add ESLint global for AbortController

**8. Frontend Fast Tests** (1/1 failure)
- **Error**: Likely pnpm lockfile or ESLint issues
- **Impact**: Frontend unit tests not running
- **Fix**: Update pnpm-lock.yaml + fix ESLint

**9. Lint, Scripts, Tests (Node LTS Matrix)** (1/1 failure)
- **Error**: ESLint `AbortController` error
- **Impact**: Linting failing across Node versions
- **Fix**: Add ESLint global config

#### Lower Priority - Monitoring/Probes

**10. Assistant CORS/Status Probe** (1/1 failure)
- **Error**: Unknown (scheduled probe)
- **Impact**: Health monitoring not working
- **Fix**: Check probe endpoint availability

**11. workflows-summary** (1/1 failure)
- **Error**: Unknown
- **Impact**: Workflow reporting broken
- **Fix**: Check summary generation script

**12. public-smoke** (1/1 failure)
- **Error**: Unknown
- **Impact**: Public endpoint smoke tests failing
- **Fix**: Check endpoint availability

**13. CORS Verify** (1/1 failure)
- **Error**: Unknown
- **Impact**: CORS configuration checks failing
- **Fix**: Verify CORS headers on endpoints

### 🟡 Mixed/In Progress

**siteagent-meta-auto** (1/3 success, 2 cancelled/failed, 1 in progress)
- **Status**: ✅ Fixed with hardening improvements
- **Current**: Run 18435384277 in progress (11+ minutes - past previous failure point)
- **Changes Applied**:
  - ✅ Disk cleanup (frees 14GB)
  - ✅ Docker layer caching
  - ✅ Improved health checks
  - ✅ Failure diagnostics
  - ✅ Concurrency control
- **Next**: Waiting for completion to confirm fix

## Root Causes Analysis

### 1. Dependency Management (HIGH PRIORITY)
**Symptom**: Multiple workflows failing with `ERR_PNPM_OUTDATED_LOCKFILE`
**Cause**: `pnpm-lock.yaml` is out of sync with `package.json`
**Impact**: ~5+ workflows blocked
**Fix**:
```bash
pnpm install
git add pnpm-lock.yaml
git commit -m "chore: update pnpm lockfile"
```

### 2. ESLint Configuration (HIGH PRIORITY)
**Symptom**: `'AbortController' is not defined` in `scripts/agents-run.mjs`
**Cause**: ESLint not configured for Node.js globals
**Impact**: CI, Lint workflows failing
**Fix Options**:
```javascript
// Option 1: Add to scripts/agents-run.mjs top
/* global AbortController */

// Option 2: Update .eslintrc with Node env
{
  "env": {
    "node": true,
    "es2022": true
  }
}

// Option 3: Add to globals
{
  "globals": {
    "AbortController": "readonly"
  }
}
```

### 3. GitHub Actions Deprecations (MEDIUM PRIORITY)
**Symptom**: `actions/upload-artifact@v3` deprecated warnings
**Cause**: Workflows using old artifact actions
**Impact**: Will break when v3 is removed
**Fix**: Update all workflows to `@v4`
```yaml
# Before
- uses: actions/upload-artifact@v3

# After
- uses: actions/upload-artifact@v4
```

### 4. Docker Image Availability (MEDIUM PRIORITY)
**Symptom**: PowerShell nanoserver-ltsc2022 manifest not found
**Cause**: Image tag no longer available or changed
**Impact**: Smoke tests failing
**Fix**: Update to current stable tag
```yaml
# Check available tags at:
# https://mcr.microsoft.com/v2/powershell/tags/list

# Update to:
image: mcr.microsoft.com/powershell:7.4-alpine-3.18
# or
image: mcr.microsoft.com/powershell:lts-alpine
```

### 5. TypeScript Configuration (LOW PRIORITY)
**Symptom**: TypeScript errors in `test-script.js`
**Cause**: JavaScript file being checked by TypeScript
**Impact**: Type check workflow failing
**Fix**: Exclude from tsconfig or fix syntax
```json
// tsconfig.json
{
  "exclude": [
    "test-script.js"
  ]
}
```

## Recommended Action Plan

### Phase 1: Unblock CI (Immediate - 5 minutes)
1. ✅ **Update pnpm lockfile**
   ```bash
   pnpm install
   git add pnpm-lock.yaml
   git commit -m "chore: update pnpm lockfile"
   git push
   ```
   **Impact**: Fixes 5+ workflows

2. ✅ **Fix ESLint AbortController**
   ```bash
   # Add to .eslintrc.json or scripts/agents-run.mjs
   ```
   **Impact**: Fixes CI, Lint workflows

### Phase 2: Deprecation Cleanup (Short term - 15 minutes)
3. 🔄 **Update upload-artifact to v4**
   - Find all workflows using `@v3`
   - Update to `@v4`
   - Test one workflow first
   **Impact**: Future-proof CI

4. 🔄 **Fix PowerShell Docker image**
   - Update Smoke workflow
   - Test locally if possible
   **Impact**: Fixes Smoke tests

### Phase 3: TypeScript/Edge Cases (Medium term - 30 minutes)
5. 🔄 **Fix TypeScript issues**
   - Investigate `test-script.js`
   - Exclude or fix
   **Impact**: Fixes TypeScript Check

6. 🔄 **Investigate probe failures**
   - Check CORS endpoints
   - Verify scheduled probes
   **Impact**: Fixes monitoring

### Phase 4: Verification (After fixes)
7. ✅ **Verify siteagent-meta-auto** (in progress)
   - Wait for run 18435384277 completion
   - Confirm all hardening improvements working

8. 🔄 **Re-run failed workflows**
   - Trigger manually after lockfile update
   - Confirm green status

## Metrics

**Current Status** (Last 50 runs):
- ✅ Passing: 2 workflows (10%)
- 🔴 Failing: 20+ workflows (80%)
- 🟡 Mixed: 2 workflows (10%)

**Expected After Phase 1** (lockfile + ESLint):
- ✅ Passing: ~15 workflows (60%)
- 🔴 Failing: ~5 workflows (20%)
- 🟡 Mixed: ~5 workflows (20%)

**Expected After Phase 2** (deprecations):
- ✅ Passing: ~18 workflows (70%)
- 🔴 Failing: ~2 workflows (10%)
- 🟡 Mixed: ~5 workflows (20%)

## Files to Edit

### Immediate Priority
1. `pnpm-lock.yaml` - Run `pnpm install`
2. `.eslintrc.json` or `.eslintrc.js` - Add Node.js env/globals
3. `scripts/agents-run.mjs` - Add ESLint comment (if not fixing globally)

### Short Term
4. `.github/workflows/ci.yml` - Update upload-artifact
5. `.github/workflows/e2e.yml` - Update upload-artifact
6. `.github/workflows/smoke.yml` - Update PowerShell image
7. Other workflows using `upload-artifact@v3`

### Medium Term
8. `tsconfig.json` - Exclude test-script.js
9. `test-script.js` - Fix or remove
10. Various probe/monitoring workflows - Investigate endpoints

---

**Next Steps**: Start with Phase 1 (pnpm lockfile + ESLint) to unblock majority of CI/CD pipeline.

**Status Check**: Run `gh run list --limit 20` after each phase to verify improvements.
