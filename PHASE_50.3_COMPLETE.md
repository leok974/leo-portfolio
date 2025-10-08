# Phase 50.3: Analytics Dashboard, Adaptive Autotuning, and Scheduler Extensions

**Status:** ✅ **COMPLETE**

**Date:** 2025-01-21

---

## Overview

Phase 50.3 delivers three major agent enhancements:

1. **AB Analytics Dashboard** - Visual CTR trends with Recharts, date filtering, winner display
2. **Adaptive Agentic Feedback Loop** - Autotuning weights based on AB test results with learning rate alpha
3. **Scheduler Extensions** - YAML-based policy configuration, day-type presets (weekday/weekend/holidays), manual "Run Now" trigger

All features are dev/admin-gated and integrate with existing Phase 50.2 infrastructure.

---

## Architecture

### 1. Analytics Dashboard

**Event Storage:**
- `assistant_api/services/ab_store.py`
- JSONL storage: `data/ab_events.jsonl`
- Functions:
  - `append_event(bucket, event, ts)` - Log views/clicks
  - `iter_events()` - Read all events
  - `summary(from_day, to_day)` - Aggregate daily CTR with date filtering

**API Endpoint:**
- `GET /agent/ab/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`
- Returns:
  ```json
  {
    "series": [
      {
        "day": "2025-01-15",
        "A_ctr": 0.15,
        "B_ctr": 0.12,
        "A_views": 100,
        "A_clicks": 15,
        "B_views": 98,
        "B_clicks": 12
      }
    ],
    "overall": {
      "A_ctr": 0.14,
      "B_ctr": 0.11,
      "A": {"views": 1000, "clicks": 140},
      "B": {"views": 980, "clicks": 108},
      "days": 7
    }
  }
  ```

**Frontend Component:**
- `src/components/ABAnalyticsDashboard.tsx`
- Features:
  - Recharts line chart (daily A/B CTR trends)
  - Date range filters (from/to inputs)
  - Overall stats cards (A/B CTR, winner display)
  - Refresh button
  - "No data" fallback for empty ranges

---

### 2. Adaptive Agentic Feedback Loop

**Weight Autotuning:**
- `assistant_api/services/weights_autotune.py`
- Algorithm:
  1. Read current layout weights (hero, projects, resume, etc.)
  2. Fetch AB test suggestions from `/agent/ab/suggestions`
  3. Apply hint with learning rate alpha: `new_weight = max(0, base + alpha * hint)`
  4. Normalize weights to sum to 1.0
  5. Propose and approve new weights
  6. Run layout optimization with updated weights

**API Endpoint:**
- `POST /agent/autotune?alpha=0.5`
- Default alpha: 0.5 (50% learning rate)
- Returns:
  ```json
  {
    "message": "Autotune completed: weights updated, optimization run",
    "new_weights": {"hero": 0.3, "projects": 0.3, "resume": 0.4}
  }
  ```

**Frontend Component:**
- `src/components/AutotuneButton.tsx`
- Features:
  - "🤖 Run Autotune" button
  - Loading state ("Running Autotune...")
  - Success/error feedback (green/red toast-like messages)
  - Learning rate display
  - Dispatches `siteagent:layout:updated` event to refresh admin badge

**Learning Rate (alpha):**
- `alpha=0.0` → No change (base weights preserved)
- `alpha=0.5` → Balanced (50% base + 50% hint)
- `alpha=1.0` → Full adoption (100% hint applied)

---

### 3. Scheduler Extensions

**YAML Policy Configuration:**
- `data/schedule.policy.yml`
- Settings:
  ```yaml
  schedule:
    nightly_time: "02:30"     # HH:MM format
    weekday: recruiter         # Preset for Mon-Fri
    weekend: hiring_manager    # Preset for Sat-Sun
    holidays: creative         # Preset for holidays

  holidays:
    - 2025-12-25  # Christmas
    - 2026-01-01  # New Year
    - 2025-07-04  # July 4th
    - 2025-11-28  # Thanksgiving
  ```

**Scheduler Enhancements:**
- `assistant_api/services/scheduler.py`
- New Functions:
  - `_load_policy()` - Parse YAML config (defaults to `data/schedule.policy.yml`)
  - `pick_preset_for_day(date)` - Select preset by day type (weekday/weekend/holiday)
  - `_parse_time_local(s)` - Parse HH:MM time strings
  - `_next_run()` - Calculate next run time based on policy
- Updated `scheduler_loop()`:
  - Reads policy on startup
  - Logs events to `data/agent_events.jsonl`
  - Runs at configured `nightly_time` (default: 02:30)

**API Endpoints:**
- `POST /agent/run_now?preset=X` - Manual optimization trigger
  - Example: `POST /agent/run_now?preset=creative`
  - Logs event to audit trail
  - Returns optimization result

**Audit Trail:**
- `assistant_api/services/agent_events.py`
- JSONL storage: `data/agent_events.jsonl`
- Functions:
  - `log_event(kind, meta)` - Log scheduler runs, manual opts, autotuning
  - `recent_events(limit)` - Get recent actions (most recent first)
- Event types:
  - `scheduler_run` - Automatic nightly optimization
  - `manual_optimize` - Manual "Run Now" trigger
  - `autotune` - Adaptive weight adjustment

**API Endpoint:**
- `GET /agent/events?limit=50` - View audit log
- Returns:
  ```json
  [
    {
      "ts": 1737417600.0,
      "kind": "autotune",
      "meta": {"alpha": 0.5, "new_weights": {...}}
    },
    {
      "ts": 1737331200.0,
      "kind": "scheduler_run",
      "meta": {"preset": "recruiter", "status": "success"}
    }
  ]
  ```

---

## Implementation Summary

### Backend Files Created

1. **`assistant_api/services/ab_store.py`** (140 lines)
   - Event storage and daily CTR aggregation
   - JSONL storage: `data/ab_events.jsonl`

2. **`assistant_api/services/agent_events.py`** (60 lines)
   - Audit trail logging
   - JSONL storage: `data/agent_events.jsonl`

3. **`assistant_api/services/weights_autotune.py`** (105 lines)
   - Adaptive weight tuning with learning rate alpha
   - Functions: `_apply_hint()`, `run_autotune()`

4. **`data/schedule.policy.yml`** (25 lines)
   - Scheduler configuration
   - Weekday/weekend/holidays presets

### Backend Files Enhanced

5. **`assistant_api/services/scheduler.py`**
   - Added YAML policy parsing
   - Added `pick_preset_for_day()` (day-type selection)
   - Added `_next_run()` (policy-based scheduling)
   - Integrated event logging

6. **`assistant_api/routers/ab.py`**
   - Integrated `ab_store` for event persistence
   - Added `GET /agent/ab/summary` endpoint

7. **`assistant_api/routers/agent_public.py`**
   - Added `POST /agent/run_now` endpoint
   - Added `POST /agent/autotune` endpoint
   - Added `GET /agent/events` endpoint

### Frontend Files Created

8. **`src/components/ABAnalyticsDashboard.tsx`** (220 lines)
   - Recharts line chart (daily A/B CTR trends)
   - Date range filters (from/to inputs)
   - Overall stats cards with winner display

9. **`src/components/AutotuneButton.tsx`** (75 lines)
   - Autotune trigger button with loading state
   - Success/error feedback
   - Dispatches `siteagent:layout:updated` event

### Frontend Files Enhanced

10. **`src/components/render-admin.tsx`**
    - Imported new components
    - Added card5 (AutotuneButton) and card6 (ABAnalyticsDashboard) to admin dock

### Test Files Created

11. **`tests/test_ab_summary.py`** (80 lines)
    - 4 backend tests:
      - `test_append_and_iter_events` - Event logging/retrieval
      - `test_daily_ctr_series` - Daily aggregation (A: 50% CTR, B: 0% CTR)
      - `test_date_filtering` - Date range filters
      - `test_empty_store` - Empty state handling

12. **`tests/test_autotune.py`** (62 lines)
    - 4 backend tests:
      - `test_apply_hint_normalizes` - Weights sum to 1.0
      - `test_apply_hint_respects_alpha` - Learning rate controls magnitude
      - `test_apply_hint_nonnegative` - Weights stay >= 0
      - `test_apply_hint_zero_alpha` - alpha=0 leaves weights unchanged

13. **`tests/e2e/ab-dashboard.spec.ts`** (95 lines)
    - 4 E2E tests:
      - Renders dashboard in admin dock
      - Date filters work correctly
      - Refresh button updates data
      - Displays chart when data is available

14. **`tests/e2e/autotune.spec.ts`** (105 lines)
    - 4 E2E tests:
      - Renders autotune button in admin dock
      - Clicking button triggers request and shows feedback
      - Autotune error handling
      - Dispatches layout update event

---

## Test Results

### Backend Tests (8/8 Passing ✅)

```bash
$ pytest tests/test_ab_summary.py tests/test_autotune.py -v

tests\test_ab_summary.py ....                [50%]
tests\test_autotune.py ....                  [100%]

============== 8 passed in 0.10s ==============
```

**test_ab_summary.py:**
- ✅ `test_append_and_iter_events` - Event logging and retrieval
- ✅ `test_daily_ctr_series` - Daily CTR aggregation (A: 50%, B: 0%)
- ✅ `test_date_filtering` - Date range filters (2023-11-14 to 2023-11-14)
- ✅ `test_empty_store` - Empty state (0 days, 0 CTR)

**test_autotune.py:**
- ✅ `test_apply_hint_normalizes` - Weights sum to 1.0 after hint
- ✅ `test_apply_hint_respects_alpha` - alpha=0.5 applies 50% of hint
- ✅ `test_apply_hint_nonnegative` - Weights stay >= 0 (floor at 0)
- ✅ `test_apply_hint_zero_alpha` - alpha=0 leaves weights unchanged

### Frontend Tests (Pending)

E2E tests created but not yet executed (require running backend + frontend):

**ab-dashboard.spec.ts:**
- `renders AB analytics dashboard in admin dock`
- `date filters work correctly`
- `refresh button updates data`
- `displays chart when data is available`

**autotune.spec.ts:**
- `renders autotune button in admin dock`
- `clicking autotune button triggers request and shows feedback`
- `autotune error handling`
- `autotune dispatches layout update event`

---

## Dependencies

### Backend
- **PyYAML** (6.0.2) - YAML parsing for scheduler policy ✅ Already installed

### Frontend
- **recharts** (3.2.1) - Charting library for analytics dashboard ✅ Installed

---

## Usage Examples

### 1. View AB Analytics

**Dev/Admin Mode:**
1. Enable dev mode (set cookie/localStorage)
2. Visit any page
3. Admin dock appears in bottom-right
4. Scroll to "A/B Test Analytics" card
5. View daily CTR trends, overall stats, winner display

**API:**
```bash
# Get last 7 days
curl http://localhost:8001/agent/ab/summary

# Filter by date range
curl "http://localhost:8001/agent/ab/summary?from=2025-01-15&to=2025-01-21"
```

### 2. Run Adaptive Autotune

**Dev/Admin Mode:**
1. Enable dev mode
2. Visit any page
3. Scroll to "🤖 Run Autotune" button
4. Click to trigger adaptive tuning
5. See toast notification with result
6. Admin badge refreshes automatically

**API:**
```bash
# Run with default alpha (0.5)
curl -X POST http://localhost:8001/agent/autotune

# Run with custom alpha (0.3 = conservative)
curl -X POST "http://localhost:8001/agent/autotune?alpha=0.3"
```

### 3. Manual Scheduler Trigger

**API:**
```bash
# Run with creative preset
curl -X POST "http://localhost:8001/agent/run_now?preset=creative"

# Run with recruiter preset
curl -X POST "http://localhost:8001/agent/run_now?preset=recruiter"
```

### 4. View Audit Trail

**API:**
```bash
# Get last 50 events
curl http://localhost:8001/agent/events

# Get last 10 events
curl "http://localhost:8001/agent/events?limit=10"
```

---

## Configuration

### Scheduler Policy (`data/schedule.policy.yml`)

```yaml
schedule:
  nightly_time: "02:30"     # Run optimization at 2:30 AM local time
  weekday: recruiter         # Mon-Fri preset
  weekend: hiring_manager    # Sat-Sun preset
  holidays: creative         # Holiday preset

holidays:
  - 2025-12-25  # Christmas
  - 2026-01-01  # New Year
  - 2025-07-04  # July 4th
  - 2025-11-28  # Thanksgiving
```

**Preset Selection Logic:**
1. If `date` in `holidays` list → use `holidays` preset
2. Else if weekend (Sat/Sun) → use `weekend` preset
3. Else (Mon-Fri) → use `weekday` preset

---

## Key Features

### 1. Analytics Dashboard

**Visual Insights:**
- Daily CTR trends (line chart with A vs B)
- Overall stats (total views, clicks, CTR per bucket)
- Winner display (bold, highlighted)

**Interactivity:**
- Date range filtering (from/to inputs)
- Refresh button (re-fetch data)
- Clear filters button

**Responsive Design:**
- Grid layout for stats cards
- Responsive Recharts container (100% width)
- Mobile-friendly inputs

### 2. Adaptive Autotuning

**Learning Rate Control:**
- `alpha=0.0` → No change (ignore AB hints)
- `alpha=0.5` → Balanced (default, 50% adoption)
- `alpha=1.0` → Full adoption (100% hint applied)

**Safety:**
- Non-negative weights (floor at 0)
- Normalization (weights sum to 1.0)
- Gradual updates (controlled by alpha)

**Feedback Loop:**
1. AB test measures CTR per bucket
2. Backend generates "hints" (suggested adjustments)
3. Autotune applies hints with learning rate alpha
4. Optimizer runs with new weights
5. Results feed back into AB test

### 3. Scheduler Extensions

**Flexible Configuration:**
- YAML-based policy (easy to edit)
- Day-type presets (weekday/weekend/holidays)
- Custom holiday list

**Manual Override:**
- "Run Now" endpoint (`/agent/run_now`)
- Override preset for immediate optimization
- Useful for testing or urgent updates

**Audit Trail:**
- All scheduler runs logged
- All manual triggers logged
- All autotune runs logged
- Queryable event log (`/agent/events`)

---

## Files Modified (This Phase)

### Created (14 files):
1. `assistant_api/services/ab_store.py`
2. `assistant_api/services/agent_events.py`
3. `assistant_api/services/weights_autotune.py`
4. `data/schedule.policy.yml`
5. `src/components/ABAnalyticsDashboard.tsx`
6. `src/components/AutotuneButton.tsx`
7. `tests/test_ab_summary.py`
8. `tests/test_autotune.py`
9. `tests/e2e/ab-dashboard.spec.ts`
10. `tests/e2e/autotune.spec.ts`

### Enhanced (3 files):
11. `assistant_api/services/scheduler.py` (YAML policy, day-type presets, event logging)
12. `assistant_api/routers/ab.py` (ab_store integration, /summary endpoint)
13. `assistant_api/routers/agent_public.py` (3 new endpoints: /run_now, /autotune, /events)
14. `src/components/render-admin.tsx` (integrated new components)

---

## Next Steps (Phase 50.4 Candidates)

1. **Autotune Scheduling** - Automatic weekly autotune runs (e.g., Sundays)
2. **Multi-Model AB Tests** - Test different LLMs (GPT-4, Claude, Gemini)
3. **Advanced Hints** - Section-specific hints (e.g., "boost projects CTR")
4. **Historical Rollback** - Revert to previous weights via audit trail
5. **Export Analytics** - CSV/JSON export of AB test data
6. **Real-Time Dashboard** - WebSocket updates for live CTR trends

---

## Security Notes

All Phase 50.3 features are **dev/admin-gated**:

- Frontend components render only when dev mode enabled
- Backend endpoints require dev/admin authentication
- Event logs stored locally (`data/ab_events.jsonl`, `data/agent_events.jsonl`)
- No sensitive data exposed in analytics (aggregated CTR only)

---

## Performance Notes

- **Event Storage:** JSONL (append-only, no database required)
- **Summary Endpoint:** O(n) scan of events (acceptable for <100k events)
- **Autotune:** Synchronous optimization (may take 5-15 seconds)
- **Chart Rendering:** Client-side with Recharts (300px height, responsive)

**Optimization Opportunities (Future):**
- Database migration (SQLite → PostgreSQL) for faster aggregations
- Background autotune (Celery task) for async execution
- Cached summaries (Redis) for repeated date ranges

---

## Commit Checklist

- [x] Backend services created (ab_store, agent_events, weights_autotune)
- [x] Scheduler enhanced (YAML policy, day-type presets, event logging)
- [x] Routers updated (ab.py, agent_public.py - 4 new endpoints)
- [x] Frontend components created (ABAnalyticsDashboard, AutotuneButton)
- [x] Admin dock integration (render-admin.tsx)
- [x] Backend tests created and passing (8/8)
- [x] E2E tests created (ab-dashboard.spec.ts, autotune.spec.ts)
- [x] Dependencies installed (recharts)
- [x] Frontend build successful
- [x] Documentation complete (PHASE_50.3_COMPLETE.md)

---

## Conclusion

Phase 50.3 successfully delivers:

1. ✅ **Analytics Dashboard** - Visual AB test insights with Recharts
2. ✅ **Adaptive Autotuning** - AI-driven weight optimization based on CTR
3. ✅ **Scheduler Extensions** - YAML policy, day-type presets, manual triggers

All features integrate seamlessly with Phase 50.2 infrastructure (dev-gated UI, badge refresh, toast notifications). Backend tests 100% passing, frontend builds successfully, E2E tests ready for execution.

**Status:** Ready for commit and deployment 🚀
