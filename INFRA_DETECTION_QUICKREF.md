# Replica Detection - Quick Reference

## TL;DR

Infrastructure scale plans now **detect current replicas** from the cluster and show **deltas** in PR bodies (`3 → 6` instead of `→ 6`).

**Safe by design**: Read-only, optional, gracefully falls back to `unknown` if kubectl unavailable.

---

## Quick Examples

### ✅ Default (Detection On)
```bash
node scripts/infra.scale.mjs --apply \
  --target=prod --namespace=assistant \
  --workload=Deployment:web:6
```

**PR Body Shows**:
```markdown
| Scale | Deployment/web | replicas **3 → 6** |
```

---

### ❌ Detection Off (CI Mode)
```bash
# Option 1: Flag
node scripts/infra.scale.mjs --apply --detect=off ...

# Option 2: Env
SKIP_CLUSTER_DETECT=1 node scripts/infra.scale.mjs --apply ...
```

**PR Body Shows**:
```markdown
| Scale | Deployment/web | replicas → **6** |
```

---

## Detection Flags

| Method | Syntax | Use Case |
|:-------|:-------|:---------|
| **CLI Flag** | `--detect=off` | One-off disable for single run |
| **Env Var** | `SKIP_CLUSTER_DETECT=1` | CI pipelines without kubectl |
| **Default** | (no flag) | Local dev with cluster access |

---

## PR Body Format

### With Detection
```markdown
## Infra Scale Plan — **prod**

### Actions (summary)
| Action | Target | Details |
|:--|:--|:--|
| Scale | Deployment/web (ns: `assistant`) | replicas **3 → 6** |
| Scale | Deployment/api (ns: `assistant`) | replicas **2 → 4** |
```

### Without Detection
```markdown
## Infra Scale Plan — **prod**

### Actions (summary)
| Action | Target | Details |
|:--|:--|:--|
| Scale | Deployment/web (ns: `assistant`) | replicas → **6** |
| Scale | Deployment/api (ns: `assistant`) | replicas → **4** |
```

---

## Detection Notes

### Successful Detection (No Change)
```yaml
notes:
  - "No change: Deployment/web already at 6 replicas."
```

### Failed Detection
```yaml
notes:
  - "Could not detect current replicas for Deployment/web (no kubectl or no access)."
```

---

## When to Disable

### ✅ Disable Detection
- CI/CD pipelines without kubeconfig
- Automated scripts without cluster access
- Bulk operations (100+ workloads)
- Performance testing/benchmarking

### ❌ Keep Detection On
- Manual developer runs
- Interactive planning sessions
- PR review workflows
- When kubectl is available

---

## Safety Guarantees

| Feature | Status | Details |
|:--------|:-------|:--------|
| **Read-Only** | ✅ | Only `kubectl get -o json` (no mutations) |
| **Non-Blocking** | ✅ | Plans succeed even if detection fails |
| **Optional** | ✅ | Can be disabled with flag/env var |
| **Silent Failure** | ✅ | Adds note on failure, doesn't throw |
| **No Executor Impact** | ✅ | Apply/rollback ignore `from` field |

---

## Troubleshooting

### Q: Detection always shows "unknown"
**A**: Check kubectl access:
```bash
kubectl config current-context
kubectl get deployments -n assistant
```

### Q: Detection slow for large plans
**A**: Disable for bulk operations:
```bash
SKIP_CLUSTER_DETECT=1 node scripts/infra.scale.mjs --apply ...
```

### Q: Wrong cluster detected
**A**: Switch kubectl context:
```bash
kubectl config use-context production
```

---

## Implementation Files

| File | Changes |
|:-----|:--------|
| `scripts/planners/k8s-planner.mjs` | `detectReplicas()`, `shouldDetect()`, detection loop |
| `scripts/infra.scale.mjs` | `--detect` flag, env var setting, PR body from→to |
| `tests/infra.prbody.spec.ts` | Test fixture with `from:3`, regex for `3 → 6` |

---

## See Also

- **INFRA_REPLICA_DETECTION.md** - Comprehensive guide (373 lines)
- **INFRA_ORCHESTRATOR_QUICKREF.md** - Main orchestration reference
- **INFRA_ROLLBACK_COMPLETE.md** - Rollback system
- **INFRA_CHECKLIST_COMMANDS_COMPLETE.md** - PR commands

---

## Key Insight

Detection is **informational only** - it never blocks plan generation or execution. If kubectl fails, plans just show `from: "unknown"` and continue normally. This makes detection risk-free! 🎉
