# Infrastructure Orchestrator Quick Reference

## Overview
The nightly orchestrator now includes infrastructure scaling that generates Kubernetes scaling plans and creates draft PRs for review.

## Quick Start

### 1. Enable Infrastructure Scaling
```bash
# Bash/Linux
export ENABLE_INFRA_SCALE=1
export GH_OWNER="ledger-mind"
export GH_REPO="website"
export GITHUB_TOKEN="<token with: contents:write,pull-requests:write,issues:write,actions:read>"

# Optional metrics (if wired)
export METRICS_URL="https://analytics.your-domain/metrics"
export METRICS_KEY="<shared-key-or-empty>"

# Already used elsewhere
export SITE_BASE_URL="https://assistant.ledger-mind.org"

# Run orchestrator
node scripts/orchestrator.nightly.mjs
```

```powershell
# PowerShell
$env:ENABLE_INFRA_SCALE = "1"
$env:GH_OWNER = "ledger-mind"
$env:GH_REPO = "website"
$env:GITHUB_TOKEN = "<token>"
$env:SITE_BASE_URL = "https://assistant.ledger-mind.org"

node scripts/orchestrator.nightly.mjs
```

### 2. Review Generated Plan
The orchestrator will:
1. Create a draft PR with `needs-approval` label
2. Include `plan.yaml` with 6 scaling actions:
   - Scale `web` deployment to 6 replicas
   - Scale `api` deployment to 4 replicas
   - Update `web` resources (cpu: 500m/1, mem: 1Gi/2Gi)
   - Update `api` resources (cpu: 400m/1, mem: 1Gi/2Gi)
   - Apply HPA to `web` (min: 4, max: 12, cpu: 65%)
   - Apply HPA to `api` (min: 4, max: 12, cpu: 65%)
3. Include `SUMMARY.md` with execution preview

### 3. Execute Plan
```bash
# Add label to trigger execution
gh pr edit <PR-NUMBER> --add-label execute-plan

# Or manually via GitHub UI:
# - Navigate to the PR
# - Add label: execute-plan
# - CI workflow will execute the plan
```

## Current Configuration

| Component | Spec |
|-----------|------|
| **web Deployment** | |
| Replicas | 6 |
| CPU Request | 500m |
| CPU Limit | 1 |
| Memory Request | 1Gi |
| Memory Limit | 2Gi |
| **api Deployment** | |
| Replicas | 4 |
| CPU Request | 400m |
| CPU Limit | 1 |
| Memory Request | 1Gi |
| Memory Limit | 2Gi |
| **HPA (both)** | |
| Min Replicas | 4 |
| Max Replicas | 12 |
| Target CPU | 65% |

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `ENABLE_INFRA_SCALE` | Yes | Gate (must be "1") |
| `GH_OWNER` | Yes | GitHub org/user |
| `GH_REPO` | Yes | Repository name |
| `GITHUB_TOKEN` | Yes | Token with permissions |

### Token Permissions
```yaml
permissions:
  contents: write          # Create/update branches
  pull-requests: write     # Create draft PRs
  issues: write           # Add labels
  actions: read           # Check workflow status
```

## Approval Gates

### Gate 1: needs-approval
- **Added by**: `infra.scale` automatically
- **Purpose**: Review gate
- **Action**: Review `plan.yaml` and `SUMMARY.md`

### Gate 2: execute-plan
- **Added by**: Human reviewer
- **Purpose**: Execution gate
- **Action**: Triggers CI workflow to run `kubectl` commands

## Orchestrator Output

### Success Pattern
```
Plan: seo.validate, code.review, dx.integrate, infra.scale
=== Running task: infra.scale ===
outputs_uri=https://github.com/your-org/your-repo/pull/123
awaiting_approval
Storing record for task: infra.scale
```

### Database Record
```json
{
  "task": "infra.scale",
  "status": "awaiting_approval",
  "outputs_uri": "https://github.com/your-org/your-repo/pull/123",
  "ts": "2025-01-25T12:00:00.000Z"
}
```

## Dry-Run Testing

### Test Without Creating PR
```bash
# Dry-run mode (no PR creation)
node scripts/infra.scale.mjs --dry-run \
  --target=prod \
  --namespace=assistant \
  --workload=Deployment:web:6 \
  --workload=Deployment:api:4 \
  --hpa=min:4,max:12,cpu:65 \
  --req=web:cpu=500m,mem=1Gi \
  --lim=web:cpu=1,mem=2Gi \
  --req=api:cpu=400m,mem=1Gi \
  --lim=api:cpu=1,mem=2Gi

# Check artifacts
ls artifacts/infra-scale-*/*.yaml
cat artifacts/infra-scale-*/SUMMARY.md
```

### Optional: Staging Profile
```bash
node scripts/infra.scale.mjs --dry-run \
  --target=staging \
  --namespace=assistant-staging \
  --workload=Deployment:web:2 \
  --workload=Deployment:api:2 \
  --hpa=min:2,max:6,cpu:70 \
  --req=web:cpu=300m,mem=512Mi \
  --lim=web:cpu=700m,mem=1Gi \
  --req=api:cpu=300m,mem=512Mi \
  --lim=api:cpu=700m,mem=1Gi
```

### Preview Execution
```bash
# Preview kubectl commands (no execution)
npm run infra:apply:dry -- --plan-path artifacts/infra-scale-*/plan.yaml
```

## Rollback

### If Plan Hasn't Executed Yet
1. Close the PR without adding `execute-plan` label
2. Plan never executes

### If Plan Executed
1. Revert PR merge
2. Run rollback plan:
```bash
node scripts/infra.scale.mjs --apply \
  --target=prod --namespace=assistant \
  --workload=Deployment:web:<old-replicas> \
  --workload=Deployment:api:<old-replicas>
```

## Package Scripts

| Script | Command |
|--------|---------|
| `infra:scale:dry` | Generate plan without PR |
| `infra:scale` | Generate plan and create PR |
| `infra:apply:dry` | Preview kubectl commands |
| `infra:apply` | Execute plan |

## Kubernetes Discovery

If you're unsure of resource names:
```bash
# Check current context
kubectl config current-context

# List namespaces
kubectl get ns

# List deployments in namespace
kubectl -n assistant get deploy

# Check existing HPAs
kubectl -n assistant get hpa
```

## Troubleshooting

### Orchestrator Doesn't Run infra.scale
- Check: `ENABLE_INFRA_SCALE=1` is set
- Check: Task isn't in `SKIP_TASKS` array
- Check: `enabled` property in PLAN array

### No outputs_uri in Orchestrator Output
- Check: `infra.scale` printed `outputs_uri=<URL>` to stdout
- Check: `extractOutputsUri` function in orchestrator.nightly.mjs

### PR Not Created
- Check: `GH_OWNER`, `GH_REPO`, `GITHUB_TOKEN` environment variables
- Check: Token has required permissions (contents:write, pull-requests:write, issues:write, actions:read)
- Check: Repository exists and token has access
- Example: `GH_OWNER=ledger-mind GH_REPO=website`

### CI Workflow Doesn't Trigger
- Check: `execute-plan` label added to PR
- Check: `.github/workflows/infra-apply.yml` exists
- Check: Workflow enabled in repo settings

## Files Modified

| File | Changes |
|------|---------|
| `scripts/orchestrator.nightly.mjs` | Added infra.scale task + outputs_uri parsing |
| `INFRA_SCALE_ORCHESTRATOR.md` | Comprehensive documentation |
| `INFRA_ORCHESTRATOR_IMPLEMENTATION.md` | Implementation summary |

## Next Steps

1. **Test orchestrator**:
   ```bash
   ENABLE_INFRA_SCALE=1 \
   GH_OWNER=ledger-mind GH_REPO=website GITHUB_TOKEN=<token> \
   node scripts/orchestrator.nightly.mjs
   ```

2. **Review PR**: Check `ops/plans/infra-scale/prod/plan.yaml` and `SUMMARY.md`

3. **Add execute-plan label**: Trigger CI workflow

4. **Monitor execution**: GitHub Actions logs

5. **Merge PR**: Audit trail

## References

- **Full Documentation**: `INFRA_SCALE_ORCHESTRATOR.md`
- **Implementation Summary**: `INFRA_ORCHESTRATOR_IMPLEMENTATION.md`
- **Scale CLI**: `scripts/infra.scale.mjs`
- **Apply Executor**: `scripts/infra.apply.mjs`
- **K8s Planner**: `scripts/planners/k8s-planner.mjs`
