# Phase 50.2: Sticky A/B Assignment, Nightly Scheduler & Overlay Weight Editor

**Status**: ✅ COMPLETE (b5b534a)
**Branch**: `LINKEDIN-OPTIMIZED`
**Date**: 2025-01-25
**Previous**: Phase 50.1 (be4e453) - Presets, sections, A/B testing, PR automation
**Tests**: 32 passing (22 existing + 10 new) in 0.23s

## Overview

Phase 50.2 extends layout optimization with three advanced automation features:

1. **Sticky A/B Assignment**: Deterministic bucketing ensures consistent user experience across sessions
2. **Nightly Scheduler**: Automated layout optimization with weekday/weekend presets
3. **Overlay Weight Editor**: Interactive weight tuning with safe proposal → approval workflow

These features enable:
- **Accurate A/B testing** (no cross-contamination from bucket changes)
- **Hands-free optimization** (portfolio stays fresh automatically)
- **Non-technical weight tuning** (experiment without code changes)

---

## Feature 1: Sticky A/B Assignment 🎲

### Problem
Previous implementation used `random.random()` or `hash(visitor_id)`, which:
- Changed buckets on page reload (random)
- Used Python's `hash()`, which is salted per process → non-deterministic across restarts

### Solution
SHA1-based deterministic bucketing:

```python
def assign_bucket(visitor_id: str | None = None) -> str:
    """Assign visitor to bucket A or B using SHA1 hash."""
    if visitor_id:
        h = hashlib.sha1(visitor_id.encode("utf-8")).hexdigest()
        return "A" if (int(h[:8], 16) % 2 == 0) else "B"
    # Fallback to random for anonymous visitors
    return "A" if random.random() < 0.5 else "B"
```

### API Usage

**Query Parameter:**
```bash
GET /agent/ab/assign?visitor_id=abc123
# Response: {"bucket": "A"}
```

**Header:**
```bash
GET /agent/ab/assign
X-Visitor-Id: abc123
# Response: {"bucket": "A"}
```

**Priority**: Query param > Header > Random

### Frontend Integration

```javascript
// Generate stable visitor_id
let visitorId = localStorage.getItem('visitor_id');
if (!visitorId) {
  visitorId = crypto.randomUUID();
  localStorage.setItem('visitor_id', visitorId);
  document.cookie = `visitor_id=${visitorId}; max-age=31536000; path=/`;
}

// Get bucket assignment
const response = await fetch(`/agent/ab/assign?visitor_id=${visitorId}`);
const { bucket } = await response.json();

// Track events
await fetch(`/agent/ab/event/${bucket}/view`, { method: 'POST' });
```

### Guarantees

- ✅ **Consistency**: Same `visitor_id` → Always same bucket
- ✅ **Distribution**: 50/50 split across large visitor population
- ✅ **Determinism**: SHA1 ensures cross-process consistency
- ✅ **Fallback**: Works without visitor_id (random assignment)

### Testing

```python
# tests/test_ab_sticky.py
def test_sticky_assignment():
    visitor_id = "test-visitor-123"
    bucket1 = assign_bucket(visitor_id)
    bucket2 = assign_bucket(visitor_id)
    assert bucket1 == bucket2  # Same bucket every time
```

**Tests**: 3 passing (sticky, distribution, fallback)

---

## Feature 2: Nightly Scheduler ⏰

### Problem
Layout optimization requires manual triggering via:
- Agent commands (`POST /agent/act {"command": "optimize layout"}`)
- Direct task calls (`{task: "layout.optimize", payload: {...}}`)

### Solution
Async scheduler runs automatically at 02:30 daily with context-aware presets:

```python
async def scheduler_loop():
    """Run layout optimization at 02:30 daily."""
    while True:
        next_run = _next_230_local()
        await _sleep_until(next_run)

        # Weekday/weekend preset selection
        weekday = next_run.weekday()  # 0=Mon, 6=Sun
        preset = "recruiter" if weekday < 5 else "hiring_manager"

        result = run_layout_optimize({"preset": preset})
        logger.info(f"Scheduler completed: {result.get('status')}")
```

### Preset Logic

| Day | Preset | Rationale |
|-----|--------|-----------|
| Mon-Fri | `recruiter` | High signal/media (45/15), 4 featured - emphasize popularity |
| Sat-Sun | `hiring_manager` | High fit/freshness (25/40), 3 featured - emphasize relevance |

### Activation

**Environment Variable:**
```bash
SCHEDULER_ENABLED=1
```

**Startup Log:**
```
[lifespan] 12:00:00 startup: scheduler task created
[scheduler] INFO: Scheduler started, running daily at 02:30
```

**Without `SCHEDULER_ENABLED`:**
```
[scheduler] INFO: Scheduler disabled (SCHEDULER_ENABLED not set)
```

### Integration

Scheduler is integrated into FastAPI lifespan context:

```python
# assistant_api/lifespan.py
@asynccontextmanager
async def lifespan(app) -> AsyncIterator[None]:
    scheduler_task = asyncio.create_task(scheduler_loop())
    try:
        yield
    finally:
        scheduler_task.cancel()
        await asyncio.gather(scheduler_task, return_exceptions=True)
```

### Error Handling

- **Exception**: Logged with full traceback
- **Retry**: 1-hour delay before next attempt
- **Shutdown**: Task cancelled gracefully on app shutdown

### Testing

```python
# tests/test_scheduler_pick.py
def test_next_230_before_target():
    now = dt.datetime(2024, 1, 15, 1, 0, 0)  # 01:00 AM
    next_run = _next_230_local(now)
    assert next_run.hour == 2 and next_run.minute == 30  # Today at 02:30
```

**Tests**: 3 passing (before/after/at 02:30)

---

## Feature 3: Overlay Weight Editor 🎛️

### Problem
Adjusting scoring weights requires:
- Code changes (`layout_opt.py`)
- Git commit + deploy
- No rollback mechanism

### Solution
Interactive weight management with approval workflow:

```
┌─────────────┐
│  Propose    │  Non-technical users adjust sliders
│  Weights    │  → data/layout_weights.proposed.json
└─────────────┘
      ↓
┌─────────────┐
│   Review    │  Check proposed weights (manual step)
│  & Approve  │  → POST /agent/layout/weights/approve
└─────────────┘
      ↓
┌─────────────┐
│  Activate   │  → data/layout_weights.active.json
│             │  → Proposed file deleted
└─────────────┘
```

### API Endpoints

**1. Get Weights:**
```bash
GET /agent/layout/weights
```
```json
{
  "active": {"freshness": 0.35, "signal": 0.35, "fit": 0.20, "media": 0.10},
  "proposed": null
}
```

**2. Propose Weights:**
```bash
POST /agent/layout/weights/propose
Content-Type: application/json

{
  "freshness": 0.40,
  "signal": 0.30,
  "fit": 0.20,
  "media": 0.10
}
```
```json
{
  "status": "proposed",
  "weights": {"freshness": 0.40, "signal": 0.30, "fit": 0.20, "media": 0.10}
}
```

**3. Approve Weights:**
```bash
POST /agent/layout/weights/approve
```
```json
{
  "status": "approved",
  "weights": {"freshness": 0.40, "signal": 0.30, "fit": 0.20, "media": 0.10}
}
```

**4. Clear Proposal:**
```bash
POST /agent/layout/weights/clear
```
```json
{"status": "cleared"}
```

### Weight Precedence

In `run_layout_optimize`, weights are selected with precedence:

```python
weights = payload.get("weights")  # 1. Explicit payload override
    or read_active()               # 2. Active overlay weights
    or preset["weights"]           # 3. Preset defaults
```

**Example Scenarios:**

| Scenario | Payload | Active | Preset | Result |
|----------|---------|--------|--------|--------|
| Fresh install | None | None | `default` | `default` preset (35/35/20/10) |
| Active weights | None | Custom | `default` | Custom active weights |
| Explicit override | Custom | Active | `default` | Custom payload weights |
| Preset call | None | Active | `recruiter` | `recruiter` preset (overrides active) |

### Frontend Integration

```javascript
// Fetch current weights
const { active, proposed } = await fetch('/agent/layout/weights').then(r => r.json());

// Propose new weights (from sliders)
const newWeights = {
  freshness: 0.40,
  signal: 0.30,
  fit: 0.20,
  media: 0.10
};
await fetch('/agent/layout/weights/propose', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(newWeights)
});

// Approve after review
await fetch('/agent/layout/weights/approve', { method: 'POST' });

// Run optimization with active weights
await fetch('/agent/act', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ task: "layout.optimize", payload: {} })
});
```

### Safety Features

- ✅ **Proposal Review**: Weights saved to `proposed.json`, not immediately active
- ✅ **Explicit Approval**: Manual step prevents accidental activation
- ✅ **Clear Rollback**: POST `/clear` removes proposal without side effects
- ✅ **Error Handling**: Approval fails gracefully if no proposal exists

### Testing

```python
# tests/test_weights_editor.py
def test_approve_weights():
    weights = {"freshness": 0.4, "signal": 0.3, "fit": 0.2, "media": 0.1}
    propose_weights(weights)

    result = approve_weights()
    assert result["status"] == "approved"
    assert read_active() == weights
    assert read_proposed() is None  # Cleared after approval
```

**Tests**: 4 passing (propose, approve, clear, error handling)

---

## Architecture

### New Files (6)

1. **`assistant_api/services/scheduler.py`** (82 lines)
   - `_next_230_local(now)`: Calculate next 02:30 run time
   - `_sleep_until(target)`: Async sleep with logging
   - `scheduler_loop()`: Main scheduler task

2. **`assistant_api/services/layout_weights.py`** (82 lines)
   - `read_active()`, `read_proposed()`: Load from disk
   - `propose_weights(weights)`: Save proposal
   - `approve_weights()`: Activate proposal
   - `clear_proposed()`: Remove proposal

3. **`assistant_api/routers/layout_weights.py`** (60 lines)
   - `GET /agent/layout/weights`: Get current state
   - `POST /propose`, `/approve`, `/clear`: Weight management

4. **`tests/test_ab_sticky.py`** (38 lines)
   - Test deterministic bucketing
   - Test visitor consistency
   - Test fallback to random

5. **`tests/test_scheduler_pick.py`** (47 lines)
   - Test next run calculation (before/after/at 02:30)

6. **`tests/test_weights_editor.py`** (67 lines)
   - Test propose/approve workflow
   - Test clear and error handling

### Modified Files (5)

1. **`assistant_api/services/layout_ab.py`**
   - Changed: `assign_bucket()` now uses SHA1 instead of Python's `hash()`
   - Added: `import hashlib`

2. **`assistant_api/routers/ab.py`**
   - Added: `visitor_id` query param and `X-Visitor-Id` header support
   - Changed: `ab_assign()` signature with dual parameter support

3. **`assistant_api/services/layout_opt.py`**
   - Added: `from .layout_weights import read_active`
   - Changed: Weight precedence logic in `run_layout_optimize()`

4. **`assistant_api/main.py`**
   - Added: Mount `layout_weights.router`

5. **`assistant_api/lifespan.py`**
   - Added: Scheduler task creation in startup
   - Added: Scheduler task cancellation in shutdown

---

## Testing

### Test Summary

**Total Tests**: 32 passing (22 existing + 10 new) in 0.23s

**New Tests (10)**:
- `test_ab_sticky.py`: 3 tests
- `test_scheduler_pick.py`: 3 tests
- `test_weights_editor.py`: 4 tests

**Existing Tests (22)**: All still passing
- `test_layout_optimize.py`: 4 tests
- `test_layout_sections.py`: 7 tests
- `test_layout_ab.py`: 11 tests

### Running Tests

```bash
# Run all Phase 50.x tests
pytest tests/test_layout_*.py tests/test_ab_sticky.py tests/test_scheduler_pick.py tests/test_weights_editor.py -v

# Run only Phase 50.2 tests
pytest tests/test_ab_sticky.py tests/test_scheduler_pick.py tests/test_weights_editor.py -v
```

---

## Deployment

### Environment Variables

```bash
# Enable scheduler (required for automated optimization)
SCHEDULER_ENABLED=1

# GitHub integration (inherited from Phase 50.1)
GITHUB_TOKEN=ghp_...
GITHUB_REPO=yourusername/leo-portfolio
```

### Startup Verification

**Expected Logs:**
```
[lifespan] 12:00:00 startup: begin
[lifespan] 12:00:00 startup: scheduler task created
[lifespan] 12:00:00 startup: ready (loop held)
[scheduler] INFO: Scheduler started, running daily at 02:30
```

**Without `SCHEDULER_ENABLED`:**
```
[scheduler] INFO: Scheduler disabled (SCHEDULER_ENABLED not set)
```

### Data Files

- `data/layout_ab_state.json`: A/B testing metrics (Phase 50.1)
- `data/layout_weights.active.json`: Active overlay weights (Phase 50.2)
- `data/layout_weights.proposed.json`: Proposed weights awaiting approval (Phase 50.2)

---

## Usage Examples

### Example 1: Sticky A/B Test
```bash
# Visitor 1 (first visit)
curl -X GET "http://localhost:8001/agent/ab/assign?visitor_id=visitor-1"
# {"bucket": "A"}

# Visitor 1 (returns next day)
curl -X GET "http://localhost:8001/agent/ab/assign?visitor_id=visitor-1"
# {"bucket": "A"}  ← Same bucket!

# Visitor 2
curl -X GET "http://localhost:8001/agent/ab/assign?visitor_id=visitor-2"
# {"bucket": "B"}  ← Different visitor, different bucket
```

### Example 2: Nightly Scheduler
```bash
# Enable scheduler
export SCHEDULER_ENABLED=1

# Start backend
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001

# Scheduler will run at 02:30 daily:
# - Mon-Fri: Run layout.optimize with recruiter preset
# - Sat-Sun: Run layout.optimize with hiring_manager preset
```

### Example 3: Interactive Weight Tuning
```bash
# 1. Get current weights
curl -X GET http://localhost:8001/agent/layout/weights
# {"active": null, "proposed": null}

# 2. Propose new weights
curl -X POST http://localhost:8001/agent/layout/weights/propose \
  -H "Content-Type: application/json" \
  -d '{"freshness": 0.40, "signal": 0.30, "fit": 0.20, "media": 0.10}'
# {"status": "proposed", "weights": {...}}

# 3. Review (manual step)
curl -X GET http://localhost:8001/agent/layout/weights
# {"active": null, "proposed": {"freshness": 0.40, ...}}

# 4. Approve
curl -X POST http://localhost:8001/agent/layout/weights/approve
# {"status": "approved", "weights": {...}}

# 5. Run optimization (uses active weights)
curl -X POST http://localhost:8001/agent/act \
  -H "Content-Type: application/json" \
  -d '{"task": "layout.optimize", "payload": {}}'
# Uses active weights (0.40/0.30/0.20/0.10)
```

---

## Future Enhancements

### Phase 50.3 (Potential)
- **Frontend Weight Editor UI**: React component with sliders + live preview
- **A/B Test Analytics Dashboard**: CTR graphs, confidence intervals
- **Scheduler Configuration**: Customizable times and preset mappings
- **Weight History**: Track changes over time with rollback
- **Multi-Armed Bandit**: Explore/exploit for automated weight optimization

---

## References

- **Phase 50**: Base optimization (625dd07)
- **Phase 50.1**: Presets, sections, A/B, PR (be4e453)
- **Phase 50.2**: Sticky A/B, scheduler, weights (b5b534a) ← **Current**
- **Branch**: `LINKEDIN-OPTIMIZED`
- **Commit History**: `git log --oneline --grep="feat(layout)"`

---

## Summary

Phase 50.2 completes the layout optimization system with automation and interactivity:

✅ **Sticky A/B Assignment**: SHA1-based deterministic bucketing ensures consistent user experience
✅ **Nightly Scheduler**: Automated optimization with weekday/weekend presets
✅ **Overlay Weight Editor**: Safe proposal → approval workflow for interactive tuning
✅ **32 Tests Passing**: Full regression coverage + 10 new tests
✅ **Production Ready**: Error handling, logging, graceful shutdown

**Next Steps**: Frontend integration (weight editor UI, A/B test dashboard), analytics improvements.
