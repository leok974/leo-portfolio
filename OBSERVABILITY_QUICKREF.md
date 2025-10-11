# Observability Quick Reference

## 🎯 What Was Added

1. **Metrics Emission** — Lifecycle events sent to external analytics
2. **Recent Runs Panel** — Live monitoring in admin overlay

## 📊 Events Emitted

### Orchestrator Events
- `agent.task_started` — Task begins
- `agent.task_finished` — Task completes
- `agent.awaiting_approval` — PR created
- `agent.auto_approved` — Auto-approved success

### API Events
- `agent.task_created` — New task record
- `agent.task_updated` — Task updated

## 🔧 Configuration

```bash
# Required for metrics emission
export METRICS_URL="https://analytics.example.com/metrics"

# Optional authentication
export METRICS_KEY="your-shared-key"
```

**Note**: If `METRICS_URL` is not set, metrics emission is silently disabled (no-op).

## 🖥️ Recent Runs Panel

**Location**: Admin Overlay → Agent Orchestration → Recent runs

**Features**:
- Last 10 task runs
- Filter by agent name
- Filter by status
- Filter by time range (6h-7d)
- Auto-refresh + manual refresh button
- Direct links to PR outputs

**Test IDs**:
- `overlay-agent-input`
- `overlay-status-select`
- `overlay-since-select`
- `overlay-refresh`

## ✅ Testing

### 1. Orchestrator
```bash
export METRICS_URL="https://analytics.example.com/metrics"
npm run orchestrator:nightly
# Check analytics for events
```

### 2. API
```bash
curl -X POST "http://localhost:8001/api/agents/tasks" \
  -H "content-type: application/json" \
  -d '{"task":"test","run_id":"manual-1","status":"running"}'
# Check analytics for agent.task_created
```

### 3. UI Panel
1. Open admin overlay
2. Go to "Agent Orchestration"
3. See "Recent runs" panel
4. Test filters and refresh

## 📁 Files

**Created**:
- `scripts/analytics.mjs` — Node.js metrics emitter
- `src/components/OverlayRecentRuns.tsx` — Recent runs panel
- `OBSERVABILITY_IMPLEMENTATION.md` — Full documentation

**Modified**:
- `scripts/orchestrator.nightly.mjs` — Added metrics
- `assistant_api/metrics.py` — Added emit() function
- `assistant_api/routers/agents_tasks.py` — Added API metrics
- `src/components/AdminToolsPanel.tsx` — Mounted panel
- `assistant_api/README.md` — Added docs

## 🚀 Next Steps

1. **Set up analytics endpoint** — Configure METRICS_URL
2. **Test in dev** — Run orchestrator with metrics enabled
3. **Verify UI panel** — Check Recent runs in admin overlay
4. **Deploy to prod** — Add env vars to production environment
5. **Build dashboards** — Visualize metrics in your analytics tool

---

**Status**: ✅ Complete — Ready for production use
