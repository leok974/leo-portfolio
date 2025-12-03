# Phase 50.3 Quick Reference

**Status:** ✅ COMPLETE | **Date:** 2025-01-21

---

## Features

### 1. AB Analytics Dashboard
- **What:** Visual CTR trends with Recharts line chart
- **Where:** Admin dock (dev/admin mode only)
- **API:** `GET /agent/ab/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`
- **Storage:** `data/ab_events.jsonl`

### 2. Adaptive Autotuning
- **What:** AI-driven weight optimization based on AB test results
- **Where:** Admin dock "🤖 Run Autotune" button
- **API:** `POST /agent/autotune?alpha=0.5`
- **Algorithm:** `new_weight = max(0, base + alpha * hint)` → normalize

### 3. Scheduler Extensions
- **What:** YAML policy, day-type presets, manual triggers
- **Config:** `data/schedule.policy.yml`
- **API:** `POST /agent/run_now?preset=X`
- **Audit:** `GET /agent/events?limit=50`

---

## API Endpoints

### Analytics
```bash
# Get all-time summary
GET /agent/ab/summary

# Filter by date range
GET /agent/ab/summary?from=2025-01-15&to=2025-01-21
```

### Autotuning
```bash
# Run with default alpha (0.5)
POST /agent/autotune

# Run with custom alpha
POST /agent/autotune?alpha=0.3  # Conservative (30% hint adoption)
POST /agent/autotune?alpha=0.7  # Aggressive (70% hint adoption)
```

### Scheduler
```bash
# Manual trigger with preset
POST /agent/run_now?preset=creative
POST /agent/run_now?preset=recruiter
POST /agent/run_now?preset=hiring_manager

# View audit log
GET /agent/events?limit=50
```

---

## Files Created

### Backend (7)
1. `assistant_api/services/ab_store.py` - Event storage, daily CTR aggregation
2. `assistant_api/services/agent_events.py` - Audit trail logging
3. `assistant_api/services/weights_autotune.py` - Adaptive tuning
4. `data/schedule.policy.yml` - Scheduler configuration

### Frontend (2)
5. `src/components/ABAnalyticsDashboard.tsx` - Recharts dashboard
6. `src/components/AutotuneButton.tsx` - Autotune trigger button

### Tests (4)
7. `tests/test_ab_summary.py` - 4 backend tests (event storage)
8. `tests/test_autotune.py` - 4 backend tests (hint application)
9. `tests/e2e/ab-dashboard.spec.ts` - 4 E2E tests (dashboard UI)
10. `tests/e2e/autotune.spec.ts` - 4 E2E tests (button UI)

---

## Files Enhanced

### Backend (3)
- `assistant_api/services/scheduler.py` - YAML parsing, day-type presets
- `assistant_api/routers/ab.py` - `/summary` endpoint
- `assistant_api/routers/agent_public.py` - 3 new endpoints

### Frontend (1)
- `src/components/render-admin.tsx` - Integrated new components

---

## Test Results

**Backend:** ✅ 8/8 passing (0.10s)
- test_ab_summary.py: 4/4
- test_autotune.py: 4/4

**Frontend:** ✅ Build successful
- E2E tests created (ready for execution)

**Total:** 48 tests (16 new + 32 existing)

---

## Configuration

### Learning Rate (alpha)
- **0.0** → No change (ignore hints)
- **0.3** → Conservative (30% adoption)
- **0.5** → Balanced (default)
- **0.7** → Aggressive (70% adoption)
- **1.0** → Full adoption (100% hint)

### Scheduler Policy
```yaml
# data/schedule.policy.yml
schedule:
  nightly_time: "02:30"
  weekday: recruiter
  weekend: hiring_manager
  holidays: creative

holidays:
  - 2025-12-25
  - 2026-01-01
```

---

## Usage Examples

### View Analytics
1. Enable dev mode (set localStorage or cookie)
2. Visit any page
3. Scroll admin dock to "A/B Test Analytics"
4. Use date filters to narrow range
5. Click refresh to update data

### Run Autotune
1. Enable dev mode
2. Scroll admin dock to "🤖 Run Autotune"
3. Click button
4. Wait for success message (green toast)
5. Admin badge auto-refreshes

### Manual Optimization
```bash
# Trigger optimization with creative preset
curl -X POST http://localhost:8001/agent/run_now?preset=creative
```

---

## Architecture

### Event Storage
- **Format:** JSONL (one JSON object per line)
- **Files:**
  - `data/ab_events.jsonl` - AB test views/clicks
  - `data/agent_events.jsonl` - Audit trail (scheduler, manual, autotune)

### Weight Flow
1. Active weights → `data/layout_weights.active.json`
2. AB test measures CTR → Generates hints
3. Autotune applies hints with alpha → New weights
4. Propose → Approve → Activate
5. Optimizer runs with new weights

### Day-Type Selection
```python
def pick_preset_for_day(date):
    if date in holidays:
        return policy["schedule"]["holidays"]  # e.g., "creative"
    elif date.weekday() >= 5:  # Sat/Sun
        return policy["schedule"]["weekend"]   # e.g., "hiring_manager"
    else:  # Mon-Fri
        return policy["schedule"]["weekday"]   # e.g., "recruiter"
```

---

## Dependencies

### New
- **recharts** (3.2.1) - Charting library for analytics dashboard

### Existing
- **PyYAML** (6.0.2) - YAML parsing for scheduler policy

---

## Security

All Phase 50.3 features are **dev/admin-gated**:
- Frontend components render only in dev mode
- Backend endpoints require dev/admin authentication
- Event logs stored locally (no public exposure)
- No sensitive data in analytics (aggregated CTR only)

---

## Next Steps (Phase 50.4 Candidates)

1. **Autotune Scheduling** - Automatic weekly autotune runs
2. **Multi-Model AB Tests** - Test different LLMs
3. **Advanced Hints** - Section-specific suggestions
4. **Historical Rollback** - Revert to previous weights
5. **Export Analytics** - CSV/JSON export
6. **Real-Time Dashboard** - WebSocket updates

---

## Documentation

- **Complete Guide:** `PHASE_50.3_COMPLETE.md` (400+ lines)
- **Changelog:** `CHANGELOG.md` (Phase 50.3 section added)
- **Commit Message:** `COMMIT_MESSAGE_PHASE_50.3.txt`
- **This Quickref:** `PHASE_50.3_QUICKREF.md`

---

**Status:** Ready for commit and deployment 🚀
