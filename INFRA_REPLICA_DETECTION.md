# Infrastructure Detection (Replicas & HPA)

## Overview

The infrastructure orchestration system now **detects current state** from the cluster before generating scale plans:
- **Replica counts**: Shows `3 → 6 replicas` instead of `→ 6 replicas`
- **HPA settings**: Shows `min **2 → 4** · max **10 → 12** · cpu **70% → 65%**` instead of static values

This provides reviewers with clear visibility into **actual changes** rather than just target values.

**Key principle**: Detection is **read-only, optional, and safe**. Plans still generate successfully even if kubectl is unavailable or cluster access is denied.

---

## How It Works

### 1. Detection at Plan Time

When `makePlan()` runs in `scripts/planners/k8s-planner.mjs`:

1. For each workload with a `replicas` field, calls `detectReplicas(kind, name, namespace)`
2. Runs: `kubectl -n <namespace> get <kind>/<name> -o json`
3. Extracts `spec.replicas` (desired) or `status.replicas` (actual) from JSON
4. Sets `action.from` to the detected value (e.g., `3`)
5. If detection fails: sets `action.from = "unknown"` and adds a note

### 2. Detection Control

**Environment Variable**: `SKIP_CLUSTER_DETECT=1` → Detection disabled

**CLI Flag**: `--detect=off` → Sets `SKIP_CLUSTER_DETECT=1` automatically

**Default**: Detection enabled (tries kubectl, fails gracefully)

### 3. Fallback Behavior

If kubectl is missing, access is denied, or resource not found:
- `detectReplicas()` returns `{ ok: false }`
- Plan action shows `from: "unknown"`
- Detection note added: `"Could not detect current replicas for Deployment/web (no kubectl or no access)."`
- **Plan generation continues normally**

### 4. No-Change Detection

If detected replicas match the target:
- Detection note added: `"No change: Deployment/web already at 6 replicas."`
- Action still included in plan (not filtered out)
- Reviewers can see the no-op explicitly

### 5. HPA Detection

When `makePlan()` encounters HPA actions:

1. Calls `detectHPA(name, namespace)` for each HPA
2. Runs: `kubectl -n <namespace> get hpa <name> -o json`
3. Extracts:
   - `spec.minReplicas` → `from.min`
   - `spec.maxReplicas` → `from.max`
   - `spec.metrics[*].resource.target.averageUtilization` (CPU) → `from.targetCPU`
4. Sets `action.from` object with detected values
5. If detection fails: sets all from values to `"unknown"` and adds a note

**HPA Detection Notes**:
- `"Could not detect current HPA for Deployment/web (no kubectl or no access)."`

---

## Usage Examples

### Default (Detection Enabled)

```bash
node scripts/infra.scale.mjs --apply \
  --target=prod --namespace=assistant \
  --workload=Deployment:web:6 --workload=Deployment:api:4 \
  --hpa=min:4,max:12,cpu:65
```

**Result**: PR body shows `replicas **3 → 6**` (if current is 3)

---

### Disable Detection (CI without kubeconfig)

**Option 1: CLI flag**
```bash
node scripts/infra.scale.mjs --apply --detect=off \
  --target=prod --namespace=assistant \
  --workload=Deployment:web:6
```

**Option 2: Environment variable**
```bash
SKIP_CLUSTER_DETECT=1 node scripts/infra.scale.mjs --apply \
  --target=prod --namespace=assistant \
  --workload=Deployment:web:6
```

**Result**: PR body shows `replicas → **6**` (no from value)

---

## PR Body Changes

### Replica Detection

**With Detection (from=3, to=6)**:

```markdown
| Action | Target | Details |
|:--|:--|:--|
| Scale | Deployment/web (ns: `assistant`) | replicas **3 → 6** |
```

**Without Detection (from=unknown, to=6)**:

```markdown
| Action | Target | Details |
|:--|:--|:--|
| Scale | Deployment/web (ns: `assistant`) | replicas → **6** |
```

### HPA Detection

**With Detection (from: min=2, max=10, cpu=70%)**:

```markdown
| Action | Target | Details |
|:--|:--|:--|
| HPA | web (ns: `assistant`) | min **2 → 4** · max **10 → 12** · cpu **70% → 65%** |
```

**Without Detection (from=unknown)**:

```markdown
| Action | Target | Details |
|:--|:--|:--|
| HPA | web (ns: `assistant`) | min **4** · max **12** · cpu **65%** |
```

---

## SUMMARY.md Changes

### Replica Detection

**With Detection**:
```markdown
1. **Scale** Deployment/web → replicas: 6 (from 3)
```

**Without Detection**:
```markdown
1. **Scale** Deployment/web → replicas: 6 (from unknown)
```

### HPA Detection

**With Detection**:
```markdown
3. **HPA** web (min:4 from:2 · max:12 from:10 · cpu:65% from:70%)
```

**Without Detection**:
```markdown
3. **HPA** web (min:4 from:? · max:12 from:? · cpu:65% from:?%)
```

---

## Detection Notes in Plan

Plans include `notes` array with detection results:

### Replica Detection Notes

**Successful detection with no change**:
```yaml
notes:
  - "No change: Deployment/web already at 6 replicas."
```

**Failed detection**:
```yaml
notes:
  - "Could not detect current replicas for Deployment/web (no kubectl or no access)."
```

### HPA Detection Notes

**Failed detection**:
```yaml
notes:
  - "Could not detect current HPA for Deployment/web (no kubectl or no access)."
```

---

## Safety Guarantees

### ✅ Read-Only
- Only runs `kubectl get ... -o json` (no mutations)
- No cluster state changes during detection

### ✅ Non-Blocking
- Detection failure does not stop plan generation
- Plans build successfully with `from: "unknown"`

### ✅ Optional
- Can be disabled with `SKIP_CLUSTER_DETECT=1` or `--detect=off`
- Useful for CI environments without cluster access

### ✅ Silent Failure
- Uses `try/catch` around `execSync()`
- Returns `{ ok: false }` on any error
- Errors are logged as notes, not thrown

### ✅ No Executor Impact
- Apply workflow ignores `from` field (only uses `to`)
- Rollback workflow has its own detection logic
- Detection is purely informational for reviewers

---

## Implementation Details

### `shouldDetect()` Logic

```javascript
function shouldDetect() {
  // SKIP_CLUSTER_DETECT=1 to force off
  return String(process.env.SKIP_CLUSTER_DETECT || "").trim() !== "1";
}
```

### `detectReplicas()` Function

```javascript
export function detectReplicas(kind, name, namespace) {
  if (!shouldDetect()) return { ok: false };
  try {
    const k = kind.toLowerCase();
    const out = execSync(
      `kubectl -n ${namespace} get ${k}/${name} -o json`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
    const obj = JSON.parse(out);
    // Prefer spec.replicas (desired) with fallback to status.replicas
    const current = obj?.spec?.replicas ?? obj?.status?.replicas;
    if (typeof current === "number") return { ok: true, replicas: current };
    return { ok: false };
  } catch {
    return { ok: false };
  }
}
```

### `detectHPA()` Function

```javascript
export function detectHPA(name, namespace) {
  if (!shouldDetect()) return { ok: false };
  try {
    const out = execSync(
      `kubectl -n ${namespace} get hpa ${name} -o json`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
    const h = JSON.parse(out);
    const min = h?.spec?.minReplicas;
    const max = h?.spec?.maxReplicas;
    // Find CPU target % in metrics array
    let cpu = null;
    const metrics = h?.spec?.metrics || [];
    for (const m of metrics) {
      if (m?.resource?.name?.toLowerCase() === "cpu") {
        cpu = m?.resource?.target?.averageUtilization ?? cpu;
      }
    }
    return { ok: true, min, max, cpu };
  } catch {
    return { ok: false };
  }
}
```

### CLI Integration

```javascript
const DETECT = val("--detect", "on"); // CLI flag

(async function main() {
  if (DETECT === "off") {
    process.env.SKIP_CLUSTER_DETECT = "1";
  }
  // ... rest of main
})();
```

---

## Testing

### Replica Detection Tests

**Test Fixture (tests/infra.prbody.spec.ts)**:

```typescript
const plan = {
  actions: [
    { action: "scale_workload", kind: "Deployment", name: "web", from: 3, to: 6 }
  ]
};
```

**Test Assertion**:

```typescript
expect(md).toMatch(/Scale \| Deployment\/web .* replicas \*\*3 → 6\*\*/);
```

### HPA Detection Tests

**Test Fixture (tests/infra.prbody.spec.ts)**:

```typescript
const plan = {
  actions: [
    { action: "apply_hpa", kind: "HorizontalPodAutoscaler", name: "web",
      hpa: { min: 4, max: 12, targetCPU: 65 },
      from: { min: 2, max: 10, targetCPU: 70 } }
  ]
};
```

**Test Assertion**:

```typescript
expect(md).toMatch(/HPA \| web .* min \*\*2 → 4\*\* · max \*\*10 → 12\*\* · cpu \*\*70% → 65%\*\*/);
```

---

## When to Disable Detection

### ✅ Disable in CI
- GitHub Actions without kubeconfig
- GitLab CI without cluster access
- Jenkins jobs without kubectl

### ✅ Disable for Speed
- Large-scale plans (100+ workloads)
- Benchmarking/performance testing
- Script automation without cluster

### ❌ Keep Enabled for PRs
- Manual developer runs
- Interactive planning sessions
- Review-focused workflows
- When cluster access is available

---

## Benefits

### 🎯 For Reviewers
- **Clear deltas**: See `3 → 6` instead of `→ 6`
- **No-op visibility**: Know when scaling is redundant
- **Context awareness**: Understand impact of changes

### 🔒 For Safety
- **Read-only**: No cluster mutations during planning
- **Graceful degradation**: Works with or without kubectl
- **Non-blocking**: Plans always succeed

### 📊 For Observability
- **Detection notes**: Clear feedback on what was detected
- **Audit trail**: From values captured in plan YAML
- **Debugging**: Understand why plans behave differently

---

## Troubleshooting

### Issue: Detection always fails

**Cause**: No kubectl or invalid kubeconfig

**Fix**: Ensure kubectl is in PATH and kubeconfig is valid
```bash
kubectl config current-context
kubectl get pods -n assistant
```

**Workaround**: Disable detection
```bash
node scripts/infra.scale.mjs --detect=off ...
```

---

### Issue: Detection shows wrong values

**Cause**: kubectl context pointing to wrong cluster

**Fix**: Set correct context
```bash
kubectl config use-context production
```

**Verify**:
```bash
kubectl config current-context
```

---

### Issue: Detection slow for large plans

**Cause**: Each workload makes a kubectl call

**Fix**: Disable detection for bulk operations
```bash
SKIP_CLUSTER_DETECT=1 node scripts/infra.scale.mjs --apply ...
```

---

## Future Enhancements

### Potential Improvements
1. **Batch detection**: Single `kubectl get deployments,statefulsets -o json` call
2. **Cache detection**: Store results in temp file for repeated runs
3. **Diff rendering**: Show resource changes (cpu/mem) as `500m → 1` format
4. **HPA detection**: Detect current HPA config for comparison

### Not Planned
- ❌ **Mandatory detection**: Always optional/fallback-safe
- ❌ **Cluster mutations**: Detection remains read-only
- ❌ **Blocking on failure**: Plans always succeed

---

## Files Modified

### `scripts/planners/k8s-planner.mjs`
- Added `shouldDetect()` function
- Added `detectReplicas()` function (exported)
- Enhanced `makePlan()` with detection loop
- Added `detectionNotes` array
- Merged detection notes into plan

### `scripts/infra.scale.mjs`
- Added `DETECT` constant (CLI flag)
- Added env var setting in `main()`
- Enhanced `buildActionsTable()` to show from → to
- Enhanced `toSummary()` to show from value

### `tests/infra.prbody.spec.ts`
- Added `from: 3` to test fixture
- Updated regex to match `replicas **3 → 6**`

### `INFRA_ORCHESTRATOR_QUICKREF.md`
- Updated PR body example with detection output
- Added detection note to review workflow

---

## Related Documentation

- **INFRA_ORCHESTRATOR_QUICKREF.md** - Quick reference for orchestration system
- **INFRA_ROLLBACK_COMPLETE.md** - Rollback system (has separate detection)
- **INFRA_CHECKLIST_COMMANDS_COMPLETE.md** - PR checklist and commands
- **scripts/planners/k8s-planner.mjs** - Planner implementation
- **scripts/infra.scale.mjs** - CLI and PR body generation

---

## Summary

Replica detection is a **safe, optional, read-only enhancement** that:
- ✅ Improves PR review clarity with actual change deltas
- ✅ Falls back gracefully when cluster unavailable
- ✅ Adds no risk to plan generation or execution
- ✅ Can be disabled for CI/automated workflows
- ✅ Provides clear feedback via detection notes

**Default behavior**: Try detection, continue on failure → Best of both worlds! 🎉
