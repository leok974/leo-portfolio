# Infrastructure Scaling Quick Reference

## Common Commands

### Dry-run (Local Artifacts)

```bash
# Simple replica scaling
npm run infra:scale:dry -- --target=prod --namespace=assistant --workload=Deployment:web:8

# Full config with HPA
npm run infra:scale:dry -- \
  --target=prod --namespace=assistant \
  --workload=Deployment:web:6 \
  --req=web:cpu=500m,mem=1Gi \
  --lim=web:cpu=1,mem=2Gi \
  --hpa=min:4,max:12,cpu:65

# Multiple workloads
npm run infra:scale:dry -- \
  --target=staging --namespace=app \
  --workload=Deployment:api:4 \
  --workload=Deployment:worker:2
```

### Apply (GitHub PR)

```bash
# Set credentials first
export GH_OWNER=your-org
export GH_REPO=your-repo
export GITHUB_TOKEN=ghp_...

# Open PR with plan
npm run infra:scale -- \
  --target=prod --namespace=assistant \
  --workload=Deployment:web:10 \
  --hpa=min:6,max:15,cpu:70
```

## CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--dry-run` | true | Generate local artifacts only |
| `--apply` | false | Open GitHub PR with plan |
| `--target=<env>` | "prod" | Target environment |
| `--namespace=<ns>` | "default" | Kubernetes namespace |
| `--autoscaling=<mode>` | "hpa" | "hpa" or "none" |
| `--branch=<name>` | `infra/scale-{ts}` | Custom branch name |

## Workload Arguments

### Syntax

```bash
# Replica scaling
--workload=Kind:name:replicas

# Resource requests
--req=workloadName:cpu=500m,mem=1Gi

# Resource limits
--lim=workloadName:cpu=1,mem=2Gi

# HPA (applies to all workloads)
--hpa=min:4,max:12,cpu:65
```

### Examples

```bash
# Scale to 6 replicas
--workload=Deployment:web:6

# Set requests
--req=web:cpu=300m,mem=512Mi

# Set limits
--lim=web:cpu=1,mem=2Gi

# Configure HPA
--hpa=min:3,max:10,cpu:70
```

## Action Types

### scale_workload
Changes replica count

```yaml
- action: scale_workload
  kind: Deployment
  name: web
  from: "${detect}"
  to: 6
```

### update_resources
Sets requests/limits

```yaml
- action: update_resources
  kind: Deployment
  name: web
  requests:
    cpu: 500m
    mem: 1Gi
  limits:
    cpu: 1
    mem: 2Gi
```

### apply_hpa
Configures autoscaling

```yaml
- action: apply_hpa
  kind: HorizontalPodAutoscaler
  name: web
  hpa:
    min: 4
    max: 12
    targetCPU: 65
```

## Output Contracts

### Dry-run

```
artifacts_dir=/path/to/.artifacts/infra-scale/...
plan_yaml=/path/to/.artifacts/infra-scale/.../plan.yaml
summary_md=/path/to/.artifacts/infra-scale/.../SUMMARY.md
succeeded
```

### Apply (with GitHub)

```
outputs_uri=https://github.com/org/repo/pull/123
awaiting_approval
```

### Apply (no GitHub)

```
outputs_uri=
awaiting_approval
```

### Error

```
[error details]
failed
```

## Risk Detection

| Risk | Trigger | Message |
|------|---------|---------|
| High replicas | Count > 10 | "High replica count → watch pod scheduling / quotas" |
| HPA mismatch | Replicas > HPA max | "Requested replicas (X) > HPA max (Y); HPA will cap" |

## Artifacts

### Location

`.artifacts/infra-scale/{timestamp}/`

### Files

- `plan.yaml` - Full ScalePlan (machine-readable)
- `SUMMARY.md` - Human-readable summary

## Rollback

```bash
# Revert deployment
kubectl rollout undo deployment/web -n assistant

# Restore HPA
kubectl apply -f previous-hpa.yaml

# Verify
kubectl get deployment web -n assistant
kubectl get hpa web -n assistant
```

## Testing

```bash
# Run all infra.scale tests
npm run test:unit -- tests/infra.scale.spec.ts

# Specific test
npm run test:unit -- tests/infra.scale.spec.ts -t "dry-run"
```

## Troubleshooting

### "No workloads specified"
Add `--workload=Kind:name:replicas`

### Empty outputs_uri
Set `GH_OWNER`, `GH_REPO`, `GITHUB_TOKEN`

### "kubectl: command not found"
Install kubectl (or ignore - context is optional)

## NPM Scripts

```json
{
  "infra:scale:dry": "node scripts/infra.scale.mjs --dry-run",
  "infra:scale": "node scripts/infra.scale.mjs --apply"
}
```

## Files

- `scripts/planners/k8s-planner.mjs` - Planner module (147 lines)
- `scripts/infra.scale.mjs` - CLI tool (409 lines)
- `tests/infra.scale.spec.ts` - Test suite (300+ lines)
- `INFRA_SCALE_COMPLETE.md` - Full documentation

## Environment Variables

```bash
# GitHub integration (required for --apply)
export GH_OWNER=your-org
export GH_REPO=your-repo
export GITHUB_TOKEN=ghp_...

# Optional: Enable in orchestrator
export ENABLE_INFRA_SCALE=1
```

## Quick Examples

### Basic Scale

```bash
npm run infra:scale:dry -- \
  --target=prod \
  --namespace=assistant \
  --workload=Deployment:web:8
```

### Full Config

```bash
npm run infra:scale:dry -- \
  --target=prod \
  --namespace=assistant \
  --workload=Deployment:web:6 \
  --req=web:cpu=500m,mem=1Gi \
  --lim=web:cpu=1,mem=2Gi \
  --hpa=min:4,max:12,cpu:65
```

### Multi-Workload

```bash
npm run infra:scale:dry -- \
  --target=staging \
  --namespace=app \
  --workload=Deployment:api:4 \
  --workload=Deployment:worker:2 \
  --req=api:cpu=300m \
  --req=worker:cpu=200m
```

### Open PR

```bash
export GH_OWNER=myorg GH_REPO=myrepo GITHUB_TOKEN=ghp_...
npm run infra:scale -- \
  --target=prod \
  --namespace=assistant \
  --workload=Deployment:web:10
```

## Status Meanings

- `succeeded` - Dry-run completed, artifacts written
- `awaiting_approval` - PR created, needs human review
- `failed` - Error occurred, check output

## Key Features

✅ Stateless (no cluster mutations)
✅ Risk detection (high replicas, HPA)
✅ Rollback hints in plan
✅ GitHub PR with approval gate
✅ Contract output for CI/CD
✅ Multiple workloads support
✅ HPA configuration
✅ Resource requests/limits

## See Also

- Full docs: `INFRA_SCALE_COMPLETE.md`
- K8s HPA: https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/
- Test suite: `tests/infra.scale.spec.ts`
