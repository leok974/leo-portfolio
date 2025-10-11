# Infrastructure Documentation Update Summary

**Date**: October 11, 2025
**Status**: ✅ Complete

## Overview

Updated all infrastructure orchestrator documentation with actual environment configuration for `ledger-mind/website` repository.

## Files Updated

### 1. INFRA_ORCHESTRATOR_QUICKREF.md

**Changes**:
- ✅ Updated environment variables section with actual `ledger-mind/website` repo
- ✅ Added optional metrics variables (`METRICS_URL`, `METRICS_KEY`)
- ✅ Added `SITE_BASE_URL` configuration
- ✅ Added PowerShell examples alongside bash
- ✅ Added staging profile example with reduced resource specs
- ✅ Added Kubernetes discovery commands section
- ✅ Enhanced troubleshooting with specific examples
- ✅ Updated PR path to `ops/plans/infra-scale/prod/`

**Key Sections Added**:
```bash
# Environment variables with actual values
export GH_OWNER="ledger-mind"
export GH_REPO="website"
export SITE_BASE_URL="https://assistant.ledger-mind.org"

# Optional metrics
export METRICS_URL="https://analytics.your-domain/metrics"
export METRICS_KEY="<shared-key-or-empty>"
```

**Staging Profile Example**:
```bash
node scripts/infra.scale.mjs --dry-run \
  --target=staging --namespace=assistant-staging \
  --workload=Deployment:web:2 --workload=Deployment:api:2 \
  --hpa=min:2,max:6,cpu:70 \
  --req=web:cpu=300m,mem=512Mi --lim=web:cpu=700m,mem=1Gi \
  --req=api:cpu=300m,mem=512Mi --lim=api:cpu=700m,mem=1Gi
```

**Kubernetes Discovery**:
```bash
kubectl config current-context
kubectl get ns
kubectl -n assistant get deploy
kubectl -n assistant get hpa
```

### 2. INFRA_SCALE_ORCHESTRATOR.md

**Changes**:
- ✅ Updated "Required Environment Variables" with actual config
- ✅ Added comprehensive variable descriptions with comments
- ✅ Updated task configuration documentation with clearer format
- ✅ Added "What This Does" section explaining plan generation
- ✅ Replaced "Usage" section with practical examples
- ✅ Added "Quick Run" one-liner command
- ✅ Added staging profile example
- ✅ Added Kubernetes discovery commands
- ✅ Updated all GitHub org references to `ledger-mind/website`

**Enhanced Task Configuration Documentation**:
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
- Generates plan for namespace `assistant`
- Opens draft PR with `ops/plans/infra-scale/prod/plan.yaml` and `SUMMARY.md`
- Prints `outputs_uri=<PR URL>` and sets task to `awaiting_approval`

### 3. INFRA_ORCHESTRATOR_IMPLEMENTATION.md

**Changes**:
- ✅ Updated task configuration with clearer comment style
- ✅ Updated contract validation examples with actual repo
- ✅ Updated acceptance criteria with `ledger-mind/website`
- ✅ Enhanced usage example with all environment variables
- ✅ Added "Quick Test Commands" section
- ✅ Added staging profile dry-run example
- ✅ Added Kubernetes discovery commands
- ✅ Updated all example output with actual repository paths

**New Quick Test Commands Section**:
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

## Environment Variables Reference

### Required (CI + Local)

```bash
# Turn it on
export ENABLE_INFRA_SCALE=1

# Repo for the draft PR with the plan
export GH_OWNER="ledger-mind"        # <-- your GitHub org/user
export GH_REPO="website"             # <-- your repo
export GITHUB_TOKEN="<token with: contents:write,pull-requests:write,issues:write,actions:read>"
```

### Optional

```bash
# Optional metrics (if you wired /metrics)
export METRICS_URL="https://analytics.your-domain/metrics"
export METRICS_KEY="<shared-key-or-empty>"

# Already used elsewhere
export SITE_BASE_URL="https://assistant.ledger-mind.org"
```

## Orchestrator Task Configuration

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

## What This Does

Generates a plan for namespace `assistant`:

1. **Deployment/web** → 6 replicas, req cpu=500m,mem=1Gi, lim cpu=1,mem=2Gi
2. **Deployment/api** → 4 replicas, req cpu=400m,mem=1Gi, lim cpu=1,mem=2Gi
3. **HPA** for both: min 4, max 12, target CPU 65%

Opens a draft PR with:
- `ops/plans/infra-scale/prod/plan.yaml`
- `ops/plans/infra-scale/prod/SUMMARY.md`

Prints `outputs_uri=<PR URL>` and sets task to `awaiting_approval`.

## Quick Run

```bash
ENABLE_INFRA_SCALE=1 \
GH_OWNER=ledger-mind GH_REPO=website GITHUB_TOKEN=<token> \
node scripts/orchestrator.nightly.mjs
```

## Optional: Staging Profile

```bash
node scripts/infra.scale.mjs --dry-run \
  --target=staging --namespace=assistant-staging \
  --workload=Deployment:web:2 --workload=Deployment:api:2 \
  --hpa=min:2,max:6,cpu:70 \
  --req=web:cpu=300m,mem=512Mi --lim=web:cpu=700m,mem=1Gi \
  --req=api:cpu=300m,mem=512Mi --lim=api:cpu=700m,mem=1Gi
```

## Kubernetes Discovery

If you're unsure of resource names:

```bash
kubectl config current-context
kubectl get ns
kubectl -n assistant get deploy
kubectl -n assistant get hpa
```

## Files Status

| File | Status | Changes |
|------|--------|---------|
| `INFRA_ORCHESTRATOR_QUICKREF.md` | ✅ Updated | Env vars, staging profile, K8s discovery |
| `INFRA_SCALE_ORCHESTRATOR.md` | ✅ Updated | Actual config, quick run, what it does |
| `INFRA_ORCHESTRATOR_IMPLEMENTATION.md` | ✅ Updated | Usage examples, quick test commands |
| `scripts/orchestrator.nightly.mjs` | ✅ No changes | Already configured correctly |

## Validation

- ✅ No errors in any documentation files
- ✅ All examples use actual repository: `ledger-mind/website`
- ✅ All environment variables documented
- ✅ Staging profile examples added
- ✅ Kubernetes discovery commands included
- ✅ Quick run one-liners provided
- ✅ Token permissions clearly specified

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

5. **Merge PR**: Audit trail complete

## References

- **Quick Reference**: `INFRA_ORCHESTRATOR_QUICKREF.md`
- **Full Documentation**: `INFRA_SCALE_ORCHESTRATOR.md`
- **Implementation Details**: `INFRA_ORCHESTRATOR_IMPLEMENTATION.md`
- **Orchestrator Script**: `scripts/orchestrator.nightly.mjs`
