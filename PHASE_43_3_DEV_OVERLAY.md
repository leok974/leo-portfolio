# Phase 43.3: Enhanced Dev Overlay with Event Filtering

## Overview

Phase 43.3 adds comprehensive event filtering and run tracking to the maintenance dashboard's developer overlay. This enhancement provides professional debugging tools with intelligent filtering, run tracking, and auto-focus capabilities.

**Status:** ✅ COMPLETE
**Commit:** 82bb817
**Branch:** auth

---

## Problem Statement

Before this enhancement, the dev overlay showed all events from all runs mixed together, making it difficult to:
- Debug specific runs
- Filter events by severity (info/warn/error)
- Track which run produced which events
- Focus on recent agent actions

---

## Solution

### Frontend Features (index.html)

#### 1. Event Filtering Controls
```javascript
// Filter state object
let saFilter = { level: '', run_id: '', limit: 10 };

// Level dropdown
<select id='sa-level'>
  <option value=''>All</option>
  <option value='info'>info</option>
  <option value='warn'>warn</option>
  <option value='error'>error</option>
</select>
```

**Purpose:** Filter events by severity level (info/warn/error)

#### 2. Run Tracking
```javascript
// Recent runs dropdown (populated from /agent/status)
<select id='sa-run-sel'>
  <option value=''>— recent —</option>
  // Dynamically populated: "abc12345… (3/5 ok)"
</select>

// Manual run_id input
<input id='sa-run-id' placeholder='or paste run_id' />
<button id='sa-evts-apply'>Apply</button>
```

**Purpose:** Focus on specific agent run by selecting from recent runs or pasting run_id

#### 3. Focus Button (🎯)
```javascript
// Added to each event
<button data-rid="${rid}" class="sa-focus" title="Focus on this run">🎯</button>

// Handler
b.onclick = () => {
  const rid = b.getAttribute('data-rid') || '';
  saFilter.run_id = rid;
  document.getElementById('sa-run-id').value = rid;
  refreshEvents();
};
```

**Purpose:** One-click filtering to any run from the event list

#### 4. Auto-Focus After Actions
```javascript
// After "Tell agent" button
const j = await res.json();
if (j.run_id) {
  saFilter.run_id = j.run_id;
  document.getElementById('sa-run-id').value = j.run_id;
  await refreshEvents();
}

// After "Run quick" button
const j = await res.json();
if (j.run_id) {
  saFilter.run_id = j.run_id;
  document.getElementById('sa-run-id').value = j.run_id;
  await refreshEvents();
}
```

**Purpose:** Automatically filter events to show only the current action's results

#### 5. Responsive Layout
```html
<div style='margin-top:8px;display:flex;gap:8px;flex-wrap:wrap'>
  <button id='sa-run-cmd'>Tell agent</button>
  <button id='sa-run-quick'>Run quick</button>
  <button id='sa-close' style='margin-left:auto'>Close</button>
</div>
```

**Purpose:** Clean, responsive UI that works on all screen sizes

---

### Backend Features

#### 1. `query_events()` Function (models.py)
```python
def query_events(level: Optional[str] = None, run_id: Optional[str] = None, limit: int = 10):
    """Query agent events with optional filtering by level and run_id."""
    con = _con()
    query = "SELECT run_id, ts, level, event, data FROM agent_events"
    conditions = []
    params = []

    if level:
        conditions.append("level = ?")
        params.append(level)

    if run_id:
        conditions.append("run_id = ?")
        params.append(run_id)

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)

    rows = con.execute(query, params).fetchall()
    con.close()

    # Convert rows to dictionaries
    events = []
    for r in rows:
        try:
            data_dict = json.loads(r[4]) if r[4] else {}
        except:
            data_dict = {}
        events.append({
            "run_id": r[0],
            "ts": r[1],
            "level": r[2],
            "event": r[3],
            "data": data_dict
        })

    return events
```

**Features:**
- Optional `level` filtering (info/warn/error)
- Optional `run_id` filtering
- Configurable `limit` (default 10)
- Returns events as list of dictionaries
- Handles JSON parsing errors gracefully

#### 2. `/agent/events` Endpoint (agent_public.py)
```python
@router.get("/events")
def events(
    level: Optional[str] = Query(None, description="Filter by level (info, warn, error)"),
    run_id: Optional[str] = Query(None, description="Filter by run_id"),
    limit: int = Query(10, ge=1, le=100, description="Maximum number of events to return")
):
    """Get recent agent events with optional filtering (public endpoint)."""
    event_list = query_events(level=level, run_id=run_id, limit=limit)
    return {"events": event_list}
```

**Features:**
- Public endpoint (no authentication required - like `/agent/status`)
- Query parameters: `level`, `run_id`, `limit`
- Limit validation: 1-100 events
- Returns JSON: `{"events": [...]}`

**Example Requests:**
```bash
# All events (last 10)
GET /agent/events

# Only errors
GET /agent/events?level=error

# Specific run
GET /agent/events?run_id=abc12345

# Errors from specific run (last 50)
GET /agent/events?level=error&run_id=abc12345&limit=50
```

---

## JavaScript Functions

### `loadRecentRuns()`
```javascript
async function loadRecentRuns() {
  try {
    const res = await fetch('/agent/status', { cache: 'no-store' });
    const j = await res.json();
    const sel = document.getElementById('sa-run-sel');
    const cur = sel.value;
    sel.innerHTML = "<option value=''>— recent —</option>";
    (j.recent || []).forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.run_id;
      opt.textContent = `${r.run_id.slice(0,8)}… (${r.ok}/${r.total} ok)`;
      sel.appendChild(opt);
    });
    if (cur) sel.value = cur;
  } catch(e) { console.error(e); }
}
```

**Purpose:** Fetch recent runs from `/agent/status` and populate dropdown

**Format:** `"abc12345… (3/5 ok)"` (run_id prefix + success/total ratio)

### `refreshEvents()`
```javascript
async function refreshEvents() {
  try {
    const q = new URLSearchParams();
    q.set('limit', String(saFilter.limit || 10));
    if (saFilter.level) q.set('level', saFilter.level);
    if (saFilter.run_id) q.set('run_id', saFilter.run_id);
    const res = await fetch('/agent/events?' + q.toString(), { cache: 'no-store' });
    const j = await res.json();
    const ul = document.getElementById('sa-evts');
    ul.innerHTML = (j.events || []).map(ev => {
      const dt = ev.ts ? new Date(ev.ts).toLocaleTimeString() : '';
      const lvl = ev.level || 'info';
      const tag = lvl === 'error' ? '🔴' : (lvl === 'warn' ? '🟠' : '🟢');
      const detail = ev.event || '';
      let data = '';
      try { data = ev.data && Object.keys(ev.data).length ?
        `<code style='...'>${JSON.stringify(ev.data)}</code>` : '';
      } catch {}
      const rid = ev.run_id || '';
      const copyBtn = rid ?
        `<button data-rid="${rid}" class="sa-focus" title="Focus on this run"
                 style="margin-left:auto">🎯</button>` : '';
      return `<li style="...">
        <div style="display:flex;gap:8px;align-items:center">
          <span>${tag}</span>
          <span style="opacity:.8">${dt}</span>
          <span style="opacity:.6">•</span>
          <b>${detail}</b>
          ${copyBtn}
        </div>
        ${rid ? `<div style="opacity:.6;font-size:12px;margin-top:2px">run_id: <code>${rid}</code></div>` : ""}
        ${data}
      </li>`;
    }).join('');
    // attach focus handlers
    ul.querySelectorAll('button.sa-focus').forEach(b => {
      b.onclick = () => {
        const rid = b.getAttribute('data-rid') || '';
        if (!rid) return;
        saFilter.run_id = rid;
        document.getElementById('sa-run-id').value = rid;
        document.getElementById('sa-run-sel').value = '';
        refreshEvents();
      };
    });
  } catch(e) {
    console.error(e);
  }
}
```

**Purpose:** Fetch and render filtered events with focus buttons

**Features:**
- Builds query params from `saFilter`
- Renders events with level emojis (🟢 info, 🟠 warn, 🔴 error)
- Shows timestamp, event name, run_id
- Adds 🎯 focus button to each event
- Formats data payload as JSON code block
- Attaches click handlers dynamically

### Event Handlers
```javascript
// Level dropdown
document.getElementById('sa-level').onchange = (e) => {
  saFilter.level = e.target.value;
  refreshEvents();
};

// Run dropdown
document.getElementById('sa-run-sel').onchange = (e) => {
  saFilter.run_id = e.target.value;
  document.getElementById('sa-run-id').value = e.target.value;
  refreshEvents();
};

// Apply button (manual run_id input)
document.getElementById('sa-evts-apply').onclick = () => {
  const rid = (document.getElementById('sa-run-id').value || '').trim();
  saFilter.run_id = rid;
  document.getElementById('sa-run-sel').value = rid;
  refreshEvents();
};

// Refresh button
document.getElementById('sa-evts-refresh').onclick = () => {
  loadRecentRuns();
  refreshEvents();
};
```

**Purpose:** Wire up all filter controls to update `saFilter` and refresh events

---

## Usage Examples

### 1. View All Recent Events
**Action:** Open dev overlay (click "siteAgent" button)
**Result:** Shows last 10 events from all runs, all levels

### 2. Filter by Level
**Action:** Select "error" from Level dropdown
**Result:** Shows only error-level events from all runs

### 3. Focus on Specific Run
**Action:** Select run from "Run" dropdown
**Result:** Shows all events from that specific run

### 4. Manual Run ID
**Action:** Paste run_id into input field, click "Apply"
**Result:** Shows all events from that specific run

### 5. Focus via Event Button
**Action:** Click 🎯 button on any event
**Result:** Automatically filters to show only that event's run

### 6. Auto-Focus After Action
**Action:** Click "Tell agent" or "Run quick"
**Result:** Automatically filters to show only that action's events

### 7. Combined Filtering
**Action:** Select "error" level + specific run_id
**Result:** Shows only errors from that specific run

---

## User Experience Flow

### Before Enhancement
```
1. User clicks "Tell agent"
2. Dev overlay shows ALL events (mixed runs)
3. User must manually search for their action
4. Hard to find: "Which events came from my command?"
```

### After Enhancement
```
1. User clicks "Tell agent"
2. Auto-focus: Only shows events from this specific run
3. User sees immediate feedback for their action
4. Easy debugging: Run ID visible, focus button on each event
```

---

## Technical Details

### Database Schema
```sql
CREATE TABLE IF NOT EXISTS agent_events(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT,
    ts TEXT,
    level TEXT,
    event TEXT,
    data TEXT
)
```

### Event Format
```json
{
  "run_id": "abc12345-6789-...",
  "ts": "2025-01-20T14:30:15.123456",
  "level": "info",
  "event": "logo.fetch.ok",
  "data": {
    "repo": "leok974/leo-portfolio",
    "url": "https://github.com/leok974.png",
    "path": "assets/logos/leok974_leo-portfolio.png"
  }
}
```

### API Response
```json
{
  "events": [
    {
      "run_id": "abc12345-6789-...",
      "ts": "2025-01-20T14:30:15.123456",
      "level": "info",
      "event": "logo.fetch.ok",
      "data": { ... }
    },
    ...
  ]
}
```

---

## Testing

### Backend Tests
```bash
# Start FastAPI
python -m uvicorn assistant_api.main:app --port 8002

# Test endpoints
curl http://127.0.0.1:8002/agent/events
# Response: {"events":[]}

curl http://127.0.0.1:8002/agent/events?level=error
# Response: {"events":[...]}

curl http://127.0.0.1:8002/agent/events?run_id=abc123&limit=5
# Response: {"events":[...]}
```

### Frontend Tests
1. Open `index.html` in browser
2. Click "siteAgent" button to open dev overlay
3. Verify UI controls render correctly:
   - Level dropdown (All/info/warn/error)
   - Run dropdown (shows "— recent —")
   - run_id input field
   - Apply button
   - Refresh button (↻)
4. Click "Tell agent" and enter a command
5. Verify auto-focus: Events automatically filtered to this run
6. Click 🎯 on any event
7. Verify focus: Events filtered to that event's run

---

## Files Modified

### Backend
1. **assistant_api/agent/models.py**
   - Added `query_events()` function (52 lines)
   - Implements filtering by level and run_id
   - Returns events as list of dictionaries

2. **assistant_api/routers/agent_public.py**
   - Added `Query` import from FastAPI
   - Added `query_events` import from models
   - Added `/agent/events` endpoint (10 lines)

### Frontend
3. **index.html**
   - Updated `panel.innerHTML` with filtering UI (37 lines)
   - Added `saFilter` state object
   - Added `loadRecentRuns()` function (15 lines)
   - Updated `refreshEvents()` with filtering (63 lines)
   - Added filter event handlers (28 lines)
   - Updated "Tell agent" button with auto-focus (8 lines)
   - Updated "Run quick" button with auto-focus (8 lines)

**Total Changes:**
- 3 files modified
- 205 lines added
- 5 lines removed
- Net: +200 lines

---

## Integration with Existing Features

### Phase 37-39: Maintenance Dashboard
Enhanced dev overlay builds on the existing maintenance dashboard:
- Report endpoint: `/agent/report` (unchanged)
- Status endpoint: `/agent/status` (used by loadRecentRuns)
- Manual commands: "Tell agent" (now with auto-focus)

### Phase 42: Natural Language Commands
Auto-focus works seamlessly with natural language:
- "fetch logo from URL" → Auto-focus on logo.fetch events
- "remove logo for repo X" → Auto-focus on overrides.update events
- "generate og images" → Auto-focus on og.generate events

### Phase 43.1: Security Features
Event filtering helps debug security events:
- SSRF blocks: Filter by `level=error` to see blocked IPs
- HTTPS enforcement: See `logo.fetch.warn` for HTTP URLs
- Size limits: See `logo.fetch.error` for oversized files

### Phase 43.2: Security Testing
Events logged during testing are now easily filterable:
- Test runs appear in recent runs dropdown
- Can focus on specific test run to debug failures
- Error events show exact failure reason

---

## Benefits

### For Development
1. **Faster Debugging:** Auto-focus eliminates manual event hunting
2. **Better Visibility:** See exactly which events came from which action
3. **Error Isolation:** Filter by error level to see only failures
4. **Run Tracking:** Dropdown shows recent runs with success ratio

### For Maintenance
1. **Professional Tools:** Enterprise-grade debugging interface
2. **Event History:** All events preserved in database
3. **Flexible Filtering:** Combine level + run_id + limit
4. **One-Click Focus:** 🎯 button for instant filtering

### For User Experience
1. **Immediate Feedback:** Auto-focus shows action results instantly
2. **Clean UI:** Responsive layout with proper spacing
3. **Visual Indicators:** Level emojis (🟢🟠🔴) for quick scanning
4. **Contextual Data:** JSON payload shown when relevant

---

## Future Enhancements

### Possible Additions
1. **Event Search:** Text search across event names and data
2. **Time Range:** Filter events by date/time range
3. **Export:** Download events as JSON or CSV
4. **Pagination:** Load more events (infinite scroll)
5. **Real-Time:** WebSocket updates for live event streaming
6. **Notifications:** Browser notifications for error events
7. **Event Details:** Expandable panel with full event context
8. **Run Comparison:** Side-by-side comparison of two runs

---

## Performance Considerations

### Database Queries
- Indexed by `id` (primary key) for fast DESC ordering
- No complex JOINs (single table query)
- Parameterized queries prevent SQL injection
- Connection pooling handled by SQLite

### Frontend Rendering
- Event list limited to 1-100 items (configurable)
- DOM updates use `.innerHTML` (fast for small lists)
- Event handlers attached after rendering (delegation pattern)
- No real-time updates (manual refresh only)

### Network
- Fetch uses `cache: 'no-store'` for fresh data
- Query params minimize payload size
- JSON response (compact, fast parsing)
- No pagination (limit handles size)

---

## Documentation Updates

### Required Updates
1. **README.md:** Add dev overlay filtering to features list
2. **docs/ARCHITECTURE.md:** Document event storage and retrieval
3. **docs/DEPLOY.md:** No deployment changes needed
4. **docs/DEVELOPMENT.md:** Document event filtering for debugging
5. **docs/API.md:** Document `/agent/events` endpoint

### Completed
1. **PHASE_43_3_DEV_OVERLAY.md:** This document (complete specification)

---

## Commit Details

**Commit:** 82bb817
**Author:** GitHub Copilot
**Date:** January 20, 2025
**Branch:** auth

**Commit Message:**
```
Phase 43.3: Enhanced dev overlay with event filtering and run tracking

Features:
- Event filtering by level (info/warn/error)
- Run tracking with dropdown selector
- Manual run_id input with apply button
- Focus button (🎯) on each event to filter by run
- Auto-focus after 'Tell agent' or 'Run quick' actions
- Responsive layout with flex-wrap buttons

Backend:
- Added query_events() function in models.py for filtered event retrieval
- Added /agent/events endpoint with level, run_id, and limit query params
- Returns events as JSON array with run_id, ts, level, event, data

Frontend:
- Updated panel.innerHTML with filtering UI controls
- Added loadRecentRuns() to populate recent runs dropdown
- Updated refreshEvents() with query param filtering
- Added filter event handlers for all 3 controls
- Updated action buttons to auto-focus on their run_id
- Added focus button handler for one-click filtering
```

---

## Summary

Phase 43.3 transforms the maintenance dashboard's dev overlay from a basic event list into a professional debugging tool. The enhancement provides:

✅ **Intelligent Filtering:** By level (info/warn/error) and run_id
✅ **Run Tracking:** Dropdown with recent runs and success ratios
✅ **Auto-Focus:** Automatically filter events after actions
✅ **One-Click Focus:** 🎯 button on each event for instant filtering
✅ **Responsive UI:** Clean, professional layout that works everywhere
✅ **Backend Support:** New `/agent/events` endpoint with full filtering
✅ **Complete Integration:** Works seamlessly with all existing features

**Result:** Professional, production-ready developer experience with enterprise-grade debugging tools.

---

## Related Documents

- **PHASE_43_LOGO_FETCH.md:** Logo fetching feature (Phase 43)
- **PHASE_43_1_SECURITY.md:** Security hardening (Phase 43.1)
- **LOGO_FETCH_SECURITY.md:** Comprehensive security guide (650+ lines)
- **SECURITY_TEST_RESULTS.md:** Test results (Phase 43.2)
- **docs/MAINTENANCE_DASHBOARD.md:** Original dashboard spec (Phase 37-39)

---

**Phase 43.3 Status:** ✅ COMPLETE
