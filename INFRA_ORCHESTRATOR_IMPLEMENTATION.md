# Infrastructure Scaling Orchestrator Integration - Implementation Summary

**Date**: October 11, 2025
**Status**: ✅ Complete

## Changes Made

### 1. Updated Orchestrator Configuration

**File**: `scripts/orchestrator.nightly.mjs`

#### Added Multi-Workload Infrastructure Scaling Task

```javascript
{
  task: "infra.scale",
  enabled: process.env.ENABLE_INFRA_SCALE === "1",
  cmd: ["node", [
    "scripts/infra.scale.mjs", "--apply",
    "--target=prod", "--namespace=assistant",
    "--workload=Deployment:web:6",
    "--workload=Deployment:api:4",
    "--hpa=min:4,max:12,cpu:65",
    "--req=web:cpu=500m,mem=1Gi", "--lim=web:cpu=1,mem=2Gi",
    "--req=api:cpu=400m,mem=1Gi", "--lim=api:cpu=1,mem=2Gi"
  ]],
  env: {} // uses GH_* + GITHUB_TOKEN from process.env
}
```

#### Enhanced outputs_uri Extraction

```javascript
function extractOutputsUri(stdout, stderr) {
  const combined = stdout + stderr;

  // Look for outputs_uri= format (from infra.scale contract)
  const outputsUriMatch = combined.match(/outputs_uri=(.+?)(?:\r?\n|$)/);
  if (outputsUriMatch) {
    const uri = outputsUriMatch[1].trim();
    if (uri) return uri;
  }

  // Look for PR URLs
  const prMatch = combined.match(/https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/);
  if (prMatch) return prMatch[0];

  // Look for artifact URLs
  const artifactMatch = combined.match(/https:\/\/[^\s]+\/artifacts\/[^\s]+/);
  if (artifactMatch) return artifactMatch[0];

  return null;
}
```

Now properly parses the `outputs_uri=<URL>` contract format from infra.scale CLI.

### 2. Updated Documentation

**File**: `INFRA_SCALE_ORCHESTRATOR.md`

Added comprehensive sections:
- **Required Environment Variables** with token permissions
- **Current Task Configuration** with exact workload specs
- **Approval Gates** (needs-approval and execute-plan)
- **Rollback Hints** documentation

## Workload Configuration

### Deployment: web
- **Replicas**: 6
- **Requests**: cpu=500m, mem=1Gi
- **Limits**: cpu=1, mem=2Gi

### Deployment: api
- **Replicas**: 4
- **Requests**: cpu=400m, mem=1Gi
- **Limits**: cpu=1, mem=2Gi

### HPA (Both Deployments)
- **Min**: 4 replicas
- **Max**: 12 replicas
- **Target CPU**: 65%

## Required Environment Variables

```bash
ENABLE_INFRA_SCALE=1
GH_OWNER=<your-github-org>
GH_REPO=<your-repo-name>
GITHUB_TOKEN=<token>
```

**Token Permissions**:
- `contents:write` - Create/update branches and files
- `pull-requests:write` - Create draft PRs
- `issues:write` - Add labels (needs-approval)
- `actions:read` - Check workflow status

## Contract Validation

### infra.scale CLI Contracts

#### Dry-run Mode
```bash
node scripts/infra.scale.mjs --dry-run --target=prod --namespace=assistant --workload=Deployment:web:6
```

**Output**:
```
artifacts_dir=/path/to/.artifacts/infra-scale/2025-10-11...
plan_yaml=/path/to/.artifacts/infra-scale/2025-10-11.../plan.yaml
summary_md=/path/to/.artifacts/infra-scale/2025-10-11.../SUMMARY.md
succeeded
```

#### Apply Mode (with GitHub credentials)
```bash
ENABLE_INFRA_SCALE=1 \
GH_OWNER=ledger-mind \
GH_REPO=website \
GITHUB_TOKEN=<token> \
node scripts/orchestrator.nightly.mjs
```

**Output**:
```
outputs_uri=https://github.com/ledger-mind/website/pull/123
awaiting_approval
```

### infra.apply CLI Contracts

#### Dry-run Preview
```bash
node scripts/infra.apply.mjs --plan=ops/plans/infra-scale/prod/plan.yaml --dry-run
```

**Output**:
```
preview: kubectl -n assistant scale deployment/web --replicas=6
preview: kubectl -n assistant scale deployment/api --replicas=4
preview: kubectl -n assistant set resources deployment/web --requests cpu=500m,mem=1Gi --limits cpu=1,mem=2Gi
preview: kubectl -n assistant set resources deployment/api --requests cpu=400m,mem=1Gi --limits cpu=1,mem=2Gi
preview: kubectl -n assistant autoscale deployment web --min=4 --max=12 --cpu-percent=65
preview: kubectl -n assistant autoscale deployment api --min=4 --max=12 --cpu-percent=65
{
  "ok": true,
  "executed": false,
  "namespace": "assistant",
  "results": [...]
}
succeeded
```

#### Execute Mode (with KUBECTL=echo)
```bash
KUBECTL=echo node scripts/infra.apply.mjs --plan=ops/plans/infra-scale/prod/plan.yaml --execute
```

**Output**: JSON summary with `"executed": true` and `succeeded` status

## Approval Workflow

### Gate 1: Plan Generation (needs-approval)

1. Orchestrator runs `infra.scale` task
2. Creates draft PR with `needs-approval` label
3. PR contains:
   - `ops/plans/infra-scale/prod/plan.yaml`
   - `ops/plans/infra-scale/prod/SUMMARY.md`
4. Task status: `awaiting_approval`
5. Human review required

### Gate 2: Plan Execution (execute-plan)

1. After reviewing plan, add `execute-plan` label to PR
2. Triggers `.github/workflows/infra-apply.yml` workflow
3. Workflow validates label presence
4. Executes kubectl commands from plan
5. PR can be merged for audit trail

## Generated Plan Structure

```yaml
apiVersion: infra.scale/v1
kind: ScalePlan
metadata:
  createdAt: 2025-10-11T00:00:00Z
  target: prod
context:
  kubeContext: production
  namespace: assistant
assumptions:
  autoscaling: hpa
actions:
  - action: scale_workload
    kind: Deployment
    name: web
    namespace: assistant
    from: "${detect}"
    to: 6
    reason: requested_scale
  - action: update_resources
    kind: Deployment
    name: web
    namespace: assistant
    requests:
      cpu: 500m
      mem: 1Gi
    limits:
      cpu: 1
      mem: 2Gi
  - action: scale_workload
    kind: Deployment
    name: api
    namespace: assistant
    from: "${detect}"
    to: 4
    reason: requested_scale
  - action: update_resources
    kind: Deployment
    name: api
    namespace: assistant
    requests:
      cpu: 400m
      mem: 1Gi
    limits:
      cpu: 1
      mem: 2Gi
  - action: apply_hpa
    kind: HorizontalPodAutoscaler
    name: web
    namespace: assistant
    hpa:
      min: 4
      max: 12
      targetCPU: 65
  - action: apply_hpa
    kind: HorizontalPodAutoscaler
    name: api
    namespace: assistant
    hpa:
      min: 4
      max: 12
      targetCPU: 65
rollbackHints:
  - kubectl rollout undo deployment/web -n assistant
  - kubectl rollout undo deployment/api -n assistant
  - kubectl apply -f previous-hpa.yaml
risks:
  []
notes:
  []
```

## Test Coverage

### infra.scale Tests (`tests/infra.scale.spec.ts`)

✅ **Dry-run Mode**:
- Emits `artifacts_dir=`, `plan_yaml=`, `summary_md=` paths
- Prints `succeeded` status
- Generates valid YAML with expected actions
- Handles multiple workloads

✅ **Apply Mode**:
- Prints `outputs_uri=` (empty when GitHub token missing)
- Prints `awaiting_approval` status

### infra.apply Tests (`tests/infra.apply.spec.ts`)

✅ **Dry-run Mode**:
- Prints `preview: kubectl ...` lines for all actions
- Outputs JSON summary with action results
- Prints `succeeded` status

✅ **Execute Mode**:
- With `KUBECTL=echo`: Outputs JSON with `"executed": true`
- Prints `succeeded` status

## Acceptance Criteria

### ✅ Orchestrator Execution

```bash
ENABLE_INFRA_SCALE=1 \
GH_OWNER=ledger-mind \
GH_REPO=website \
GITHUB_TOKEN=<token> \
node scripts/orchestrator.nightly.mjs
```

**Expected**:
1. Creates `agents_tasks` entry for `infra.scale`
2. Status: `awaiting_approval`
3. Prints `outputs_uri=<PR-URL>`
4. PR created with `needs-approval` label

### ✅ PR Contents

**Files**:
- `ops/plans/infra-scale/prod/plan.yaml` - Complete ScalePlan
- `ops/plans/infra-scale/prod/SUMMARY.md` - Human-readable summary

**Label**: `needs-approval`

### ✅ Apply Preview

```bash
node scripts/infra.apply.mjs --plan=ops/plans/infra-scale/prod/plan.yaml --dry-run
```

**Expected**: Prints `preview: kubectl ...` for:
- Scale web to 6 replicas
- Scale api to 4 replicas
- Set resources for web
- Set resources for api
- Apply HPA to web
- Apply HPA to api

### ✅ CI Workflow Trigger

Add `execute-plan` label to PR → Triggers `.github/workflows/infra-apply.yml`

**Workflow**:
1. Preview step (KUBECTL=echo)
2. Execute step (real kubectl or echo if configured)

## Package Scripts

Already present in `package.json`:

```json
{
  "infra:scale:dry": "node scripts/infra.scale.mjs --dry-run",
  "infra:scale": "node scripts/infra.scale.mjs --apply",
  "infra:apply:dry": "node scripts/infra.apply.mjs --dry-run",
  "infra:apply": "node scripts/infra.apply.mjs --execute"
}
```

## Planner Validation

**File**: `scripts/planners/k8s-planner.mjs`

✅ **Stateless**: No cluster mutations, only plan generation
✅ **Risk Detection**: Warns about high replica counts (>10)
✅ **Notes**: Detects HPA max caps vs. requested replicas
✅ **Rollback Hints**: Included in every plan

## Executor Validation

**File**: `scripts/infra.apply.mjs`

✅ **Gated Execution**: Requires `--execute` flag
✅ **PR Label Gate**: Checks for `execute-plan` label
✅ **Dry-run by Default**: Safe preview mode
✅ **KUBECTL Override**: Can use `echo` for testing

## Database Integration

Orchestrator logs to `agents_tasks` table:

```sql
{
  task: 'infra.scale',
  run_id: 'nightly-2025-10-11',
  status: 'awaiting_approval',
  started_at: '2025-10-11T02:00:00Z',
  finished_at: '2025-10-11T02:00:03Z',
  duration_ms: 3000,
  outputs_uri: 'https://github.com/org/repo/pull/123',
  approval_state: 'pending',
  log_excerpt: 'artifacts_dir=...\nplan_yaml=...\noutputs_uri=https://github.com/org/repo/pull/123\nawaiting_approval'
}
```

## Metrics Emission

Orchestrator emits:
- `agent.task_started` (task: infra.scale)
- `agent.task_finished` (task: infra.scale, status: awaiting_approval)
- `agent.awaiting_approval` (task: infra.scale, outputs_uri: <PR-URL>)

## Webhook Notifications

If configured:
- **Slack**: Message with PR link
- **Email**: Approval notification with task details

## Files Modified

1. `scripts/orchestrator.nightly.mjs` - Added multi-workload infra.scale task, enhanced outputs_uri parsing
2. `INFRA_SCALE_ORCHESTRATOR.md` - Updated with comprehensive configuration and approval gate documentation

## Files Verified (No Changes Needed)

- `scripts/infra.scale.mjs` - Contract already implemented ✅
- `scripts/infra.apply.mjs` - Gating already implemented ✅
- `scripts/planners/k8s-planner.mjs` - Stateless planner already complete ✅
- `tests/infra.scale.spec.ts` - Contract tests already present ✅
- `tests/infra.apply.spec.ts` - Dry-run and execute tests already present ✅
- `package.json` - Scripts already present ✅

## Usage Example

```bash
# Enable infrastructure scaling
export ENABLE_INFRA_SCALE=1
export GH_OWNER=ledger-mind
export GH_REPO=website
export GITHUB_TOKEN=<token>

# Optional
export METRICS_URL="https://analytics.your-domain/metrics"
export METRICS_KEY="<shared-key>"
export SITE_BASE_URL="https://assistant.ledger-mind.org"

# Run orchestrator
node scripts/orchestrator.nightly.mjs

# Output will include:
# Plan: seo.validate, code.review, dx.integrate, infra.scale
# === Running task: infra.scale ===
# Task created: ID=123
# Task infra.scale: awaiting_approval (3000ms)
# outputs_uri=https://github.com/ledger-mind/website/pull/456

# Review PR at the URL above
# Add execute-plan label to trigger CI workflow
gh pr edit 456 --add-label execute-plan

# CI workflow will execute the plan
```

## Quick Test Commands

```bash
# Quick run
ENABLE_INFRA_SCALE=1 \
GH_OWNER=ledger-mind GH_REPO=website GITHUB_TOKEN=<token> \
node scripts/orchestrator.nightly.mjs

# Optional: Staging profile dry-run
node scripts/infra.scale.mjs --dry-run \
  --target=staging --namespace=assistant-staging \
  --workload=Deployment:web:2 --workload=Deployment:api:2 \
  --hpa=min:2,max:6,cpu:70 \
  --req=web:cpu=300m,mem=512Mi --lim=web:cpu=700m,mem=1Gi \
  --req=api:cpu=300m,mem=512Mi --lim=api:cpu=700m,mem=1Gi

# If unsure of resource names
kubectl config current-context
kubectl get ns
kubectl -n assistant get deploy
kubectl -n assistant get hpa
```

## Commit Messages

```
orchestrator: add infra.scale nightly task (gated by ENABLE_INFRA_SCALE)

- Add multi-workload configuration: web (6 replicas) and api (4 replicas)
- Configure resource requests/limits for both deployments
- Apply HPA with min:4, max:12, cpu:65% to both
- Enhanced outputs_uri extraction to parse infra.scale contract format
- Task gated by ENABLE_INFRA_SCALE=1 environment variable
```

```
infra.scale: confirm PR artifact paths + outputs_uri contract

- Dry-run outputs: artifacts_dir, plan_yaml, summary_md, succeeded
- Apply mode outputs: outputs_uri=<PR-URL>, awaiting_approval
- Contract already implemented, tests already passing
```

```
docs: infra scale orchestrator usage + env

- Document required environment variables with token permissions
- Add current task configuration with exact workload specs
- Document approval gates (needs-approval and execute-plan)
- Add rollback hints section
```

```
tests: infra.scale + infra.apply contracts

- infra.scale tests cover dry-run artifact paths and apply mode outputs_uri
- infra.apply tests cover preview: kubectl lines and JSON summary
- All contracts verified and passing
```

## Success Criteria Summary

✅ **Orchestrator Integration**: Multi-workload task added with correct flags
✅ **Contract Compliance**: outputs_uri parsing implemented
✅ **Environment Gating**: ENABLE_INFRA_SCALE=1 required
✅ **Approval Gates**: needs-approval and execute-plan documented
✅ **Rollback Hints**: Included in every plan
✅ **Test Coverage**: All contracts covered by existing tests
✅ **Documentation**: Comprehensive usage guide with exact configuration

---

**Implementation Complete** - Infrastructure scaling orchestrator integration ready for nightly execution
