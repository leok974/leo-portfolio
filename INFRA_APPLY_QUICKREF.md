# Infrastructure Apply Quick Reference

## Commands

### Preview (Dry-run)

```bash
# By plan path
npm run infra:apply:dry -- --plan=ops/plans/infra-scale/prod/plan.yaml

# By target shorthand
npm run infra:apply:dry -- --target=prod

# With fake kubectl
KUBECTL=echo npm run infra:apply:dry -- --target=prod
```

### Execute (Real)

```bash
# Direct execution (⚠️ modifies cluster)
npm run infra:apply -- --plan=ops/plans/infra-scale/prod/plan.yaml --execute

# With PR gate
npm run infra:apply -- --plan=ops/plans/infra-scale/prod/plan.yaml --execute --pr=123
```

## CLI Flags

| Flag | Description |
|------|-------------|
| `--plan=<path>` | Path to plan.yaml |
| `--target=<env>` | Shorthand for plan path |
| `--dry-run` | Preview only (default) |
| `--execute` | Actually run kubectl |
| `--pr=<num>` | PR number for gate check |

## Environment Variables

```bash
# kubectl override
export KUBECTL=echo  # Preview without execution

# GitHub (for PR gate)
export GH_OWNER=your-org
export GH_REPO=your-repo
export GITHUB_TOKEN=ghp_...
```

## Action Types

### scale_workload
```yaml
- action: scale_workload
  kind: Deployment
  name: web
  to: 6
```
→ `kubectl -n <ns> scale deployment/web --replicas=6`

### update_resources
```yaml
- action: update_resources
  kind: Deployment
  name: api
  requests: { cpu: 500m, mem: 1Gi }
  limits: { cpu: 1, mem: 2Gi }
```
→ `kubectl -n <ns> set resources deployment/api --requests cpu=500m,mem=1Gi --limits cpu=1,mem=2Gi`

### apply_hpa
```yaml
- action: apply_hpa
  name: web
  hpa: { min: 4, max: 12, targetCPU: 65 }
```
→ `kubectl -n <ns> autoscale deployment web --min=4 --max=12 --cpu-percent=65`

## GitHub Workflow

### Trigger

Add `execute-plan` label to PR:

```bash
gh pr edit 123 --add-label execute-plan
```

### Workflow File

`.github/workflows/infra-apply.yml`

```yaml
on:
  pull_request_target:
    types: [labeled, opened, reopened, synchronize]

jobs:
  apply:
    if: contains(github.event.pull_request.labels.*.name, 'execute-plan')
    steps:
      - name: Preview
        env: { KUBECTL: echo }
        run: node scripts/infra.apply.mjs --plan=... --dry-run

      - name: Execute
        run: node scripts/infra.apply.mjs --plan=... --execute --pr=${{ github.event.pull_request.number }}
```

## Output Format

### Dry-run

```
preview: kubectl -n assistant scale deployment/web --replicas=6
{
  "ok": true,
  "executed": false,
  "namespace": "assistant",
  "results": [...]
}
succeeded
```

### Execute

```
{
  "ok": true,
  "executed": true,
  "namespace": "assistant",
  "results": [
    { "ok": true, "action": "scale_workload", "note": "scaled deployment/web to 6" }
  ]
}
succeeded
```

### Error

```
kubectl scale ... failed: connection refused
{
  "ok": true,
  "executed": true,
  "results": [
    { "ok": false, "action": "scale_workload", "error": "..." }
  ]
}
failed
```

## Safety Checklist

- [ ] Dry-run first
- [ ] Review plan.yaml
- [ ] Check rollback hints
- [ ] Verify kubectl access
- [ ] Add execute-plan label
- [ ] Monitor workflow
- [ ] Verify cluster state

## Rollback

```bash
# Revert deployment
kubectl rollout undo deployment/web -n assistant

# Delete HPA
kubectl delete hpa web -n assistant

# Apply previous config
kubectl apply -f previous-hpa.yaml
```

## Testing

```bash
# Run all tests
npm run test:unit -- tests/infra.apply.spec.ts

# Specific test
npm run test:unit -- tests/infra.apply.spec.ts -t "dry-run"
```

## Complete Flow

```bash
# 1. Generate plan
npm run infra:scale -- --target=prod --workload=Deployment:web:8
# → Creates PR #123

# 2. Preview apply
npm run infra:apply:dry -- --target=prod

# 3. Trigger execution
gh pr edit 123 --add-label execute-plan

# 4. Monitor
gh run watch

# 5. Verify
kubectl get deployment web -n assistant

# 6. Merge
gh pr merge 123 --squash
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Plan not found | Check path: `ls ops/plans/infra-scale/prod/plan.yaml` |
| kubectl not found | Install: `brew install kubectl` or `apt install kubectl` |
| Missing label | Add: `gh pr edit 123 --add-label execute-plan` |
| Connection refused | Check kubeconfig: `kubectl cluster-info` |
| Workflow doesn't run | Verify label: `execute-plan` (exact match) |

## NPM Scripts

```json
{
  "infra:apply:dry": "node scripts/infra.apply.mjs --dry-run",
  "infra:apply": "node scripts/infra.apply.mjs --execute"
}
```

## Files

- `scripts/infra.apply.mjs` - Executor (193 lines)
- `.github/workflows/infra-apply.yml` - Workflow (41 lines)
- `tests/infra.apply.spec.ts` - Tests (350+ lines)
- `INFRA_APPLY_COMPLETE.md` - Full documentation

## Key Points

✅ **Dry-run by default** - Requires `--execute` for real changes
✅ **PR label gate** - Requires `execute-plan` label
✅ **Preview step** - KUBECTL=echo shows commands
✅ **JSON output** - Structured results for CI
✅ **Rollback hints** - Included in every plan

## See Also

- Full docs: `INFRA_APPLY_COMPLETE.md`
- Plan generation: `INFRA_SCALE_COMPLETE.md`
- Orchestrator: `INFRA_SCALE_ORCHESTRATOR.md`
- Test suite: `tests/infra.apply.spec.ts`
