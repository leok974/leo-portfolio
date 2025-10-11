# Infrastructure Scaling - Orchestrator Integration Complete

**Status**: ✅ Complete
**Date**: October 11, 2025

## Overview

The infrastructure scaling system is integrated into the nightly orchestrator with automatic plan generation and PR creation for Kubernetes workload scaling.

## Required Environment Variables

To enable infrastructure scaling in the orchestrator, set these environment variables:

```bash
# Turn it on
export ENABLE_INFRA_SCALE=1

# Repo for the draft PR with the plan
export GH_OWNER="ledger-mind"        # <-- your GitHub org/user
export GH_REPO="website"             # <-- your repo
export GITHUB_TOKEN="<token with: contents:write,pull-requests:write,issues:write,actions:read>"

# Optional metrics (if you wired /metrics)
export METRICS_URL="https://analytics.your-domain/metrics"
export METRICS_KEY="<shared-key-or-empty>"

# Already used elsewhere
export SITE_BASE_URL="https://assistant.ledger-mind.org"
```

**GitHub Token Permissions Required**:
- `contents:write` - Create/update branches and files
- `pull-requests:write` - Create draft PRs
- `issues:write` - Add labels (needs-approval)
- `actions:read` - Check workflow status

## Orchestrator Configuration

### Current Task Configuration

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

**What This Does**:

Generates a plan for namespace `assistant`:
- **Deployment/web** → 6 replicas, req cpu=500m,mem=1Gi, lim cpu=1,mem=2Gi
- **Deployment/api** → 4 replicas, req cpu=400m,mem=1Gi, lim cpu=1,mem=2Gi
- **HPA** for both: min 4, max 12, target CPU 65%

Opens a draft PR with:
- `ops/plans/infra-scale/prod/plan.yaml`
- `ops/plans/infra-scale/prod/SUMMARY.md`

Prints `outputs_uri=<PR URL>` and sets task to `awaiting_approval`.

## Changes Made

### Modified File: `scripts/orchestrator.nightly.mjs`

#### 1. Added infra.scale Task to PLAN

Updated with multiple workloads and resource specifications as shown above.

**Enabled**: Only when `ENABLE_INFRA_SCALE=1` environment variable is set

#### 2. Updated outputs_uri Extraction

```javascript
function extractOutputsUri(stdout, stderr) {
  const combined = stdout + stderr;

  // Look for outputs_uri= format (from infra.scale contract)
  const outputsUriMatch = combined.match(/outputs_uri=(.+?)(?:\r?\n|$)/);
  if (outputsUriMatch) {
    const uri = outputsUriMatch[1].trim();
    if (uri) return uri;
  }
  // ... also checks for direct PR URLs
}
```

This parses the `outputs_uri=<URL>` format from infra.scale output.

#### 3. Task Filtering Logic (Already Present)

```javascript
// Filter enabled tasks
const enabledPlan = PLAN.filter(step => step.enabled !== false);
console.log(`Plan: ${enabledPlan.map(s => s.task).join(', ')}`);

for (const step of enabledPlan) {
  // ... execute task
}
```

Tasks with `enabled: false` are automatically skipped.
- `ENABLE_INFRA_SCALE` - Set to "1" to enable infrastructure scaling task

## Usage

### Quick Run

```bash
ENABLE_INFRA_SCALE=1 \
GH_OWNER=ledger-mind GH_REPO=website GITHUB_TOKEN=<token> \
node scripts/orchestrator.nightly.mjs
```

### Optional: Staging Profile

```bash
node scripts/infra.scale.mjs --dry-run \
  --target=staging --namespace=assistant-staging \
  --workload=Deployment:web:2 --workload=Deployment:api:2 \
  --hpa=min:2,max:6,cpu:70 \
  --req=web:cpu=300m,mem=512Mi --lim=web:cpu=700m,mem=1Gi \
  --req=api:cpu=300m,mem=512Mi --lim=api:cpu=700m,mem=1Gi
```

### Kubernetes Discovery

If you're unsure of resource names:

```bash
kubectl config current-context
kubectl get ns
kubectl -n assistant get deploy
kubectl -n assistant get hpa
```

### Disable Infrastructure Scaling (Default)

By default, infra.scale is **disabled**. Simply omit the `ENABLE_INFRA_SCALE` variable:

```bash
node scripts/orchestrator.nightly.mjs
```

Output will show:
```
Plan: seo.validate, code.review, dx.integrate
```

### With Infrastructure Scaling Enabled

```bash
ENABLE_INFRA_SCALE=1 node scripts/orchestrator.nightly.mjs
```

Output will show:
```
Plan: seo.validate, code.review, dx.integrate, infra.scale
```

## Orchestrator Workflow

When `ENABLE_INFRA_SCALE=1`:

1. **Task Creation** - Creates `infra.scale` task record with status `running`
2. **Command Execution** - Runs `infra.scale.mjs --apply` with configured parameters
3. **Status Detection** - Checks output for PR URL
4. **Task Update** - Updates task record:
   - Status: `awaiting_approval` (if PR created)
   - `outputs_uri`: GitHub PR URL
   - `approval_state`: `pending`
5. **Metrics Emission**:
   - `agent.task_started`
   - `agent.task_finished`
   - `agent.awaiting_approval`
6. **Webhook Notification** - Sends approval request to Slack/Email

## Default Configuration

The orchestrator runs infra.scale with these specifications:

| Parameter | Value | Description |
|-----------|-------|-------------|
| `--target` | `prod` | Production environment |
| `--namespace` | `assistant` | Kubernetes namespace |
| **Workloads** | | |
| `Deployment:web` | 6 replicas | Web deployment |
| └─ Requests | cpu=500m, mem=1Gi | Resource requests |
| └─ Limits | cpu=1, mem=2Gi | Resource limits |
| `Deployment:api` | 4 replicas | API deployment |
| └─ Requests | cpu=400m, mem=1Gi | Resource requests |
| └─ Limits | cpu=1, mem=2Gi | Resource limits |
| **HPA** | min:4, max:12, cpu:65% | Applies to both deployments |

**To customize**: Edit the `cmd` array in the PLAN configuration.

## Approval Gates

### Gate 1: Plan Generation (needs-approval label)

When the orchestrator runs infra.scale:

1. Creates draft PR with `needs-approval` label
2. PR contains:
   - `ops/plans/infra-scale/prod/plan.yaml` - Full ScalePlan
   - `ops/plans/infra-scale/prod/SUMMARY.md` - Human-readable summary
3. Task status: `awaiting_approval`
4. Human review required before execution

### Gate 2: Plan Execution (execute-plan label)

After reviewing the plan:

1. Add `execute-plan` label to PR
2. Triggers `.github/workflows/infra-apply.yml` workflow
3. Workflow validates label presence
4. Executes kubectl commands from plan
5. PR can be merged for audit trail

**Safety**: Two separate labels for two separate actions (generate vs. execute)

## Rollback System

### Safe, Label-Gated Rollback Executor

The infrastructure system includes a dedicated rollback executor (`scripts/infra.rollback.mjs`) with multiple safety gates:

**Key Features:**
- Reads `plan.yaml` and reverses executed actions
- Uses `rollbackHints` for concrete previous manifests (e.g., `previous-hpa.yaml`)
- Falls back to `kubectl rollout undo` for deployments
- Handles HPA deletion or restoration from hints
- **Dry-run by default** - requires explicit `--execute` flag
- **Label-gated** - requires `rollback-plan` label on PR for execution
- **PR validation** - verifies label via GitHub API before executing

### Rollback Workflow

#### 1. Generate Plan with Rollback Hints

Every generated plan includes rollback commands:

```yaml
rollbackHints:
  - kubectl rollout undo deployment/web -n assistant
  - kubectl rollout undo deployment/api -n assistant
  - kubectl apply -f previous-hpa.yaml
```

These are included in `SUMMARY.md` for quick reference during incidents.

#### 2. Preview Rollback (Safe)

```bash
# Dry-run locally (no execution)
node scripts/infra.rollback.mjs --plan=ops/plans/infra-scale/prod/plan.yaml --dry-run

# Output shows preview commands:
# preview: kubectl -n assistant apply -f previous-hpa.yaml
# preview: kubectl -n assistant rollout undo deployment/web
# preview: kubectl -n assistant rollout undo deployment/api
```

#### 3. Execute Rollback (Label-Gated)

**Via CI (Recommended)**:
1. Add `rollback-plan` label to PR:
   ```bash
   gh pr edit <PR-NUMBER> --add-label rollback-plan
   ```
2. CI workflow (`.github/workflows/infra-rollback.yml`) triggers automatically
3. Validates label presence
4. Executes rollback with kubectl

**Locally** (requires kubeconfig):
```bash
node scripts/infra.rollback.mjs --plan=ops/plans/infra-scale/prod/plan.yaml --execute --pr=123
```

**Safety Gate**: Script validates PR has `rollback-plan` label before executing. Without label, exits with `skipped`.

### How Rollback Works

1. **Parse Plan**: Reads `plan.yaml` to identify actions that were executed
2. **Apply Hints First**: If `rollbackHints` contains file paths (e.g., `previous-hpa.yaml`), applies them via `kubectl apply -f`
3. **Rollback Deployments**: For each `scale_workload` and `update_resources` action, runs `kubectl rollout undo deployment/<name> -n <namespace>`
4. **Handle HPA**: If plan applied HPA and no hint was used, deletes HPA to revert: `kubectl delete hpa <name> -n <namespace>`

### Package Scripts

```bash
# Preview rollback (safe, no execution)
npm run infra:rollback:dry

# Execute rollback (requires label gate)
npm run infra:rollback
```

### CI Workflow

`.github/workflows/infra-rollback.yml` provides automated rollback:

```yaml
name: infra-rollback
on:
  pull_request_target:
    types: [labeled, opened, reopened, synchronize]

jobs:
  rollback:
    if: contains(github.event.pull_request.labels.*.name, 'rollback-plan')
    # ... runs dry-run preview first
    # ... executes rollback with kubectl
```

**Trigger**: Add `rollback-plan` label to PR

## Database Tracking

The orchestrator automatically logs infra.scale tasks to the database:

```sql
INSERT INTO agents_tasks (
  task,
  run_id,
  status,
  started_at,
  finished_at,
  duration_ms,
  outputs_uri,
  approval_state,
  log_excerpt
) VALUES (
  'infra.scale',
  'nightly-2025-10-11',
  'awaiting_approval',
  '2025-10-11T02:00:00Z',
  '2025-10-11T02:00:03Z',
  3000,
  'https://github.com/org/repo/pull/123',
  'pending',
  'artifacts_dir=...\nplan_yaml=...\noutputs_uri=https://github.com/org/repo/pull/123\nawaiting_approval'
);
```

## Approval Badge Integration

The approval badge (`ApprovalBadge.tsx`) will automatically show:
- **Count**: Tasks with `approval_state=pending` (including infra.scale)
- **Includes**: infra.scale PRs awaiting human review

## Admin UI Integration

The admin UI (`/ops/agents` and overlay) displays infra.scale tasks:
- **Task column**: "infra.scale"
- **Status**: "awaiting_approval"
- **Actions**: Approve/Reject/Cancel buttons
- **Outputs**: Link to GitHub PR

## Testing the Integration

### 1. Dry-run Test (No Orchestrator)

```bash
npm run infra:scale:dry -- --target=prod --namespace=assistant --workload=Deployment:web:6
```

Verify output:
```
artifacts_dir=/path/to/.artifacts/infra-scale/...
plan_yaml=/path/to/plan.yaml
summary_md=/path/to/SUMMARY.md
succeeded
```

### 2. Apply Test (No Orchestrator)

```bash
export GH_OWNER=your-org GH_REPO=your-repo GITHUB_TOKEN=ghp_...
npm run infra:scale -- --target=prod --namespace=assistant --workload=Deployment:web:6
```

Verify output:
```
outputs_uri=https://github.com/your-org/your-repo/pull/123
awaiting_approval
```

### 3. Orchestrator Test (Enabled)

```bash
export ENABLE_INFRA_SCALE=1
export GH_OWNER=your-org
export GH_REPO=your-repo
export GITHUB_TOKEN=ghp_...
node scripts/orchestrator.nightly.mjs
```

Expected output:
```
Starting nightly orchestration: nightly-2025-10-11
Plan: seo.validate, code.review, dx.integrate, infra.scale

=== Running task: infra.scale ===
Task created: ID=123
Task infra.scale: awaiting_approval (3000ms)
Sending approval webhooks...
```

### 4. Orchestrator Test (Disabled)

```bash
node scripts/orchestrator.nightly.mjs
```

Expected output:
```
Starting nightly orchestration: nightly-2025-10-11
Plan: seo.validate, code.review, dx.integrate

(infra.scale is skipped)
```

## Customizing the Configuration

Edit `scripts/orchestrator.nightly.mjs` to customize:

### Different Target Environment

```javascript
cmd: ['node', ['scripts/infra.scale.mjs', '--apply', '--target=staging', ...]]
```

### Different Workload

```javascript
cmd: ['node', ['scripts/infra.scale.mjs', '--apply',
  '--target=prod',
  '--namespace=app',
  '--workload=Deployment:api:8',
  '--hpa=min:5,max:15,cpu:70'
]]
```

### Multiple Workloads

```javascript
cmd: ['node', ['scripts/infra.scale.mjs', '--apply',
  '--target=prod',
  '--namespace=assistant',
  '--workload=Deployment:web:6',
  '--workload=Deployment:api:4',
  '--hpa=min:4,max:12,cpu:65'
]]
```

### Resource Specifications

```javascript
cmd: ['node', ['scripts/infra.scale.mjs', '--apply',
  '--target=prod',
  '--namespace=assistant',
  '--workload=Deployment:web:6',
  '--req=web:cpu=500m,mem=1Gi',
  '--lim=web:cpu=1,mem=2Gi',
  '--hpa=min:4,max:12,cpu:65'
]]
```

## Environment Variables Summary

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENABLE_INFRA_SCALE` | No | (disabled) | Set to "1" to enable infra.scale task |
| `GH_OWNER` | Yes* | - | GitHub organization or user |
| `GH_REPO` | Yes* | - | GitHub repository name |
| `GITHUB_TOKEN` | Yes* | - | GitHub personal access token |
| `API_BASE` | No | `https://api.assistant.ledger-mind.org` | FastAPI base URL |
| `SLACK_WEBHOOK` | No | - | Slack webhook for notifications |
| `EMAIL_WEBHOOK` | No | - | Email webhook for notifications |

*Required only when `ENABLE_INFRA_SCALE=1`

## Benefits of Orchestrator Integration

✅ **Automated Scheduling** - Runs nightly without manual intervention
✅ **Database Logging** - All runs tracked in agents_tasks table
✅ **Approval Tracking** - PRs appear in approval badge and admin UI
✅ **Webhook Notifications** - Slack/email alerts for approvals
✅ **Metrics Emission** - Analytics for infra.scale runs
✅ **Opt-in Design** - Disabled by default, enable with flag
✅ **Consistent Workflow** - Same orchestration pattern as other agents

## Next Steps

1. **Set Environment Variables** - Configure GitHub credentials
2. **Test Locally** - Run orchestrator with `ENABLE_INFRA_SCALE=1`
3. **Deploy to Production** - Add env vars to production environment
4. **Monitor Admin UI** - Watch for infra.scale tasks in overlay
5. **Approve PRs** - Review and approve scale plans

## Files Modified

- ✅ `scripts/orchestrator.nightly.mjs` - Added infra.scale task

## Related Documentation

- `INFRA_SCALE_COMPLETE.md` - Full infrastructure scaling documentation
- `INFRA_SCALE_QUICKREF.md` - Quick reference guide
- `scripts/infra.scale.mjs` - CLI implementation (409 lines)
- `scripts/planners/k8s-planner.mjs` - Planner module (147 lines)
- `tests/infra.scale.spec.ts` - Test suite (300+ lines)

## Phase 16 Complete! 🎉

All 6 tasks completed:
- ✅ K8s planner module
- ✅ infra.scale CLI
- ✅ Package.json scripts
- ✅ Test suite
- ✅ Orchestrator integration
- ✅ Documentation

The infrastructure scaling system is now fully integrated with the nightly orchestrator and ready for production use.
