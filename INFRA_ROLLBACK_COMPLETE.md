# Infrastructure Rollback System - Implementation Complete

**Date**: October 11, 2025  
**Status**: ✅ Complete

## Overview

Successfully implemented a safe, label-gated rollback executor for the infrastructure orchestration system. The rollback system provides multiple safety gates and automatic execution via CI workflows.

## Components Created

### 1. Rollback Executor Script

**File**: `scripts/infra.rollback.mjs`

**Features**:
- Reads `plan.yaml` and reverses executed actions
- Uses `rollbackHints` for concrete previous manifests
- Falls back to `kubectl rollout undo` for deployments
- Handles HPA deletion or restoration
- **Dry-run by default** (safe preview mode)
- **Label-gated execution** (requires `rollback-plan` label)
- **PR validation** via GitHub API (Octokit)

**Usage**:
```bash
# Preview rollback (safe, no execution)
node scripts/infra.rollback.mjs --plan=ops/plans/infra-scale/prod/plan.yaml --dry-run

# Execute rollback (requires rollback-plan label on PR)
node scripts/infra.rollback.mjs --plan=ops/plans/infra-scale/prod/plan.yaml --execute --pr=123
```

**How It Works**:

1. **Parse Plan**: Reads `plan.yaml` to identify executed actions
2. **Apply Hints**: If `rollbackHints` contains file paths (e.g., `previous-hpa.yaml`):
   ```bash
   kubectl -n <namespace> apply -f previous-hpa.yaml
   ```
3. **Rollback Deployments**: For each `scale_workload` and `update_resources`:
   ```bash
   kubectl -n <namespace> rollout undo deployment/<name>
   ```
4. **Handle HPA**: If plan applied HPA and no hint was used:
   ```bash
   kubectl -n <namespace> delete hpa <name>
   ```

### 2. CI Workflow

**File**: `.github/workflows/infra-rollback.yml`

**Trigger**: `pull_request_target` on `labeled`, `opened`, `reopened`, `synchronize`

**Label Gate**: Only runs when PR has `rollback-plan` label

**Steps**:
1. Checkout PR head SHA
2. Setup Node.js 20
3. Install dependencies (`npm ci`)
4. **Dry-run preview**: Run with `KUBECTL=echo` to preview commands
5. **Execute rollback**: Run with real kubectl (if kubeconfig available)

**Environment Variables**:
- `GH_OWNER`: From `github.repository_owner`
- `GH_REPO`: From `github.event.pull_request.head.repo.name`
- `GITHUB_TOKEN`: From `secrets.GITHUB_TOKEN`

### 3. Package Scripts

**File**: `package.json`

**Added Scripts**:
```json
{
  "scripts": {
    "infra:rollback:dry": "node scripts/infra.rollback.mjs --dry-run",
    "infra:rollback": "node scripts/infra.rollback.mjs --execute"
  }
}
```

### 4. Tests

**File**: `tests/infra.rollback.spec.ts`

**Test Coverage**:
- Dry-run mode validation
- Rollout undo preview for deployments
- HPA hint apply preview
- Success/failure output validation

**Sample Test**:
```typescript
it("previews rollout undo and HPA hint apply", () => {
  const out = execSync(`node scripts/infra.rollback.mjs --plan=${file} --dry-run`, { encoding: "utf8" });
  expect(out).toMatch(/preview: kubectl -n testns rollout undo deployment\/web/);
  expect(out).toMatch(/preview: kubectl -n testns apply -f previous-hpa.yaml/);
  expect(out).toMatch(/succeeded/);
});
```

## Documentation Updates

### 1. INFRA_ORCHESTRATOR_QUICKREF.md

**Updated Section**: `## Rollback`

**Changes**:
- Complete rollback system overview
- Quick commands for preview and execution
- Label-gated execution documentation
- How rollback works (3-step process)
- Rollback strategies (pre-execution, post-execution, manual)
- Safety gates explanation

**Added to Package Scripts Table**:
```markdown
| `infra:rollback:dry` | Preview rollback (safe, no execution) |
| `infra:rollback` | Execute rollback (requires label gate) |
```

### 2. INFRA_SCALE_ORCHESTRATOR.md

**Updated Section**: `## Rollback System`

**Changes**:
- Safe, label-gated rollback executor overview
- Key features list (dry-run, label-gated, PR validation)
- Complete rollback workflow (3 steps)
- How rollback works (detailed 4-step process)
- Package scripts
- CI workflow documentation
- Trigger instructions

**Key Addition**:
```yaml
rollbackHints:
  - kubectl rollout undo deployment/web -n assistant
  - kubectl rollout undo deployment/api -n assistant
  - kubectl apply -f previous-hpa.yaml
```

### 3. INFRA_ORCHESTRATOR_IMPLEMENTATION.md

**New Section**: `## Rollback System`

**Content**:
- Component overview (`scripts/infra.rollback.mjs`)
- Key features (5 items)
- Usage examples
- Package scripts
- CI workflow integration
- How rollback works (4-step detailed process)
- Test coverage

**Updated Section**: `## Quick Test Commands`

**Added Commands**:
```bash
# Preview rollback (safe, no execution)
npm run infra:rollback:dry

# Or directly
node scripts/infra.rollback.mjs --plan=ops/plans/infra-scale/prod/plan.yaml --dry-run

# Execute rollback (label-gated)
node scripts/infra.rollback.mjs --plan=ops/plans/infra-scale/prod/plan.yaml --execute --pr=123
```

## Safety Gates

The rollback system includes **three safety gates**:

### Gate 1: Dry-Run by Default
- Script runs in preview mode unless `--execute` flag is provided
- Previews all kubectl commands without executing
- Output: `preview: kubectl -n <namespace> <command>`

### Gate 2: Label Validation
- When `--execute` is used with `--pr=<number>`, validates PR has `rollback-plan` label
- Uses GitHub API (Octokit) to check PR labels
- Exits with `skipped` if label is missing
- Prevents accidental rollback execution

### Gate 3: PR Number Required
- `--execute` mode requires `--pr=<number>` parameter
- Ensures rollback is associated with specific PR
- Enables audit trail via PR comments and labels

## Usage Workflows

### Workflow 1: Preview Rollback Locally
```bash
# Safe preview (no execution)
node scripts/infra.rollback.mjs --plan=ops/plans/infra-scale/prod/plan.yaml --dry-run

# Expected output:
# preview: kubectl -n assistant apply -f previous-hpa.yaml
# preview: kubectl -n assistant rollout undo deployment/web
# preview: kubectl -n assistant rollout undo deployment/api
# { "ok": true, "executed": false, "namespace": "assistant", "results": [...] }
# succeeded
```

### Workflow 2: Execute Rollback via CI (Recommended)
```bash
# 1. Add rollback-plan label to PR
gh pr edit <PR-NUMBER> --add-label rollback-plan

# 2. CI workflow triggers automatically
# - Validates label presence
# - Runs dry-run preview
# - Executes rollback with kubectl

# 3. Review results in GitHub Actions logs
gh run view --job=<job-id>
```

### Workflow 3: Execute Rollback Locally
```bash
# Requires kubectl + kubeconfig configured
node scripts/infra.rollback.mjs --plan=ops/plans/infra-scale/prod/plan.yaml --execute --pr=123

# Verify rollback
kubectl -n assistant get deploy
kubectl -n assistant describe deploy web
kubectl -n assistant describe deploy api
```

### Workflow 4: Using Package Scripts
```bash
# Preview via npm
npm run infra:rollback:dry

# Execute via npm (requires environment variables)
GH_OWNER=ledger-mind GH_REPO=website GITHUB_TOKEN=<token> npm run infra:rollback
```

## Rollback Scenarios

### Scenario 1: Plan Hasn't Executed Yet
**Situation**: Draft PR created but `execute-plan` label not added

**Action**: Close PR without adding `execute-plan` label

**Result**: Plan never executes, no rollback needed

### Scenario 2: Plan Executed Successfully
**Situation**: `execute-plan` label added, kubectl commands executed

**Action**:
1. Add `rollback-plan` label to PR
2. CI workflow executes rollback automatically
3. Review rollback results in GitHub Actions

**Result**: Deployments rolled back to previous state

### Scenario 3: Plan Execution Failed Partially
**Situation**: Some kubectl commands succeeded, others failed

**Action**:
1. Review plan.yaml to identify succeeded actions
2. Add `rollback-plan` label to PR
3. Rollback executor reverses succeeded actions only

**Result**: Partial rollback, manual intervention may be needed

### Scenario 4: Urgent Manual Rollback
**Situation**: Need immediate rollback without waiting for CI

**Action**:
```bash
# Local execution (requires cluster access)
node scripts/infra.rollback.mjs --plan=ops/plans/infra-scale/prod/plan.yaml --execute --pr=<PR-NUMBER>
```

**Result**: Immediate rollback if kubeconfig is configured

## Rollback Output Format

### Dry-Run Output
```bash
preview: kubectl -n assistant apply -f previous-hpa.yaml
note: manual hint: previous-hpa.yaml
preview: kubectl -n assistant rollout undo deployment/web
preview: kubectl -n assistant rollout undo deployment/api
{
  "ok": true,
  "executed": false,
  "namespace": "assistant",
  "results": [
    { "ok": true, "type": "hint", "note": "applied previous-hpa.yaml" },
    { "ok": true, "type": "action", "action": "scale_workload", "note": "rolled back deployment/web" },
    { "ok": true, "type": "action", "action": "update_resources", "note": "rolled back deployment/web" }
  ]
}
succeeded
```

### Execute Output (Success)
```bash
{
  "ok": true,
  "executed": true,
  "namespace": "assistant",
  "results": [
    { "ok": true, "type": "hint", "note": "applied previous-hpa.yaml" },
    { "ok": true, "type": "action", "action": "scale_workload", "note": "rolled back deployment/web" },
    { "ok": true, "type": "action", "action": "update_resources", "note": "rolled back deployment/web" }
  ]
}
succeeded
```

### Execute Output (Label Missing)
```bash
Refusing to execute: PR missing label 'rollback-plan'.
skipped
```

### Execute Output (Failure)
```bash
{
  "ok": false,
  "executed": true,
  "namespace": "assistant",
  "results": [
    { "ok": true, "type": "hint", "note": "applied previous-hpa.yaml" },
    { "ok": false, "type": "action", "action": "scale_workload", "error": "deployment not found" }
  ]
}
failed
Error: deployment not found
```

## Environment Variables

### Required for Label Validation
```bash
GH_OWNER=ledger-mind           # GitHub org/user
GH_REPO=website                # Repository name
GITHUB_TOKEN=<token>           # Token with read permissions
PRNUM=123                      # PR number (or use --pr flag)
```

### Optional
```bash
KUBECTL=echo                   # Override kubectl command (for testing)
```

## Integration with Existing System

### 1. Plan Generation (infra.scale.mjs)
Every plan includes `rollbackHints`:
```yaml
rollbackHints:
  - previous-hpa.yaml
  - kubectl rollout undo deployment/web -n assistant
  - kubectl rollout undo deployment/api -n assistant
```

### 2. Plan Execution (infra.apply.mjs)
Applies kubectl commands from plan:
- Scale deployments
- Update resources
- Apply HPA

### 3. Rollback Execution (infra.rollback.mjs) **[NEW]**
Reverses plan execution:
- Apply rollbackHints
- Rollout undo deployments
- Delete HPA (if no hint)

### 4. Orchestrator (orchestrator.nightly.mjs)
Coordinates tasks:
- `infra.scale` (generate plan, create PR)
- `infra.apply` (execute plan, triggered by label)
- `infra.rollback` (reverse plan, triggered by label) **[NEW]**

## Files Summary

| File | Status | Purpose |
|------|--------|---------|
| `scripts/infra.rollback.mjs` | ✅ Created | Rollback executor with label gates |
| `.github/workflows/infra-rollback.yml` | ✅ Created | CI workflow for rollback |
| `tests/infra.rollback.spec.ts` | ✅ Created | Rollback tests |
| `package.json` | ✅ Updated | Added rollback scripts |
| `INFRA_ORCHESTRATOR_QUICKREF.md` | ✅ Updated | Rollback section + scripts table |
| `INFRA_SCALE_ORCHESTRATOR.md` | ✅ Updated | Complete rollback system docs |
| `INFRA_ORCHESTRATOR_IMPLEMENTATION.md` | ✅ Updated | Rollback component details |

## Verification Checklist

- ✅ Script created: `scripts/infra.rollback.mjs`
- ✅ CI workflow created: `.github/workflows/infra-rollback.yml`
- ✅ Tests created: `tests/infra.rollback.spec.ts`
- ✅ Package scripts added: `infra:rollback:dry`, `infra:rollback`
- ✅ Documentation updated: All 3 orchestrator docs
- ✅ No TypeScript/lint errors
- ✅ Dry-run by default (safe mode)
- ✅ Label gate implemented (rollback-plan)
- ✅ PR validation via GitHub API
- ✅ Rollback hints support
- ✅ kubectl rollout undo fallback
- ✅ HPA handling (apply hint or delete)
- ✅ Committed and pushed to remote

## Quick Reference

### Preview Rollback
```bash
npm run infra:rollback:dry
# or
node scripts/infra.rollback.mjs --plan=ops/plans/infra-scale/prod/plan.yaml --dry-run
```

### Execute Rollback (via CI)
```bash
gh pr edit <PR-NUMBER> --add-label rollback-plan
```

### Execute Rollback (locally)
```bash
node scripts/infra.rollback.mjs --plan=ops/plans/infra-scale/prod/plan.yaml --execute --pr=123
```

### Verify Rollback
```bash
kubectl -n assistant get deploy
kubectl -n assistant describe deploy web
kubectl -n assistant describe deploy api
kubectl -n assistant get hpa
```

## Next Steps

1. **Test rollback in staging**:
   ```bash
   # Create a staging plan
   node scripts/infra.scale.mjs --dry-run --target=staging --namespace=assistant-staging \
     --workload=Deployment:web:2 --workload=Deployment:api:2
   
   # Preview rollback
   node scripts/infra.rollback.mjs --plan=<staging-plan-path> --dry-run
   ```

2. **Verify CI workflow**:
   - Create test PR with infra scale plan
   - Add `rollback-plan` label
   - Check GitHub Actions logs

3. **Update runbooks**:
   - Add rollback procedures to incident response docs
   - Include rollback commands in deployment checklists

4. **Monitor first production rollback**:
   - Review rollback execution logs
   - Verify all deployments rolled back correctly
   - Check HPA restoration

## Success Criteria

✅ **Safety**: Multiple gates prevent accidental execution
✅ **Automation**: CI workflow handles rollback on label addition
✅ **Flexibility**: Supports dry-run preview and manual execution
✅ **Audit Trail**: PR association for all rollbacks
✅ **Documentation**: Complete usage guide in 3 docs
✅ **Testing**: Dry-run tests validate preview mode
✅ **Integration**: Works with existing infra.scale and infra.apply

---

**Implementation Complete** - Safe, label-gated rollback system ready for production use
