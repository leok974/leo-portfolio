# Orchestration System - Migration & Testing Guide

## Status

✅ **UI Component Integrated** - `OpsAgents` component added to Admin Tools Panel
⚠️ **Migration Pending** - Alembic configuration needed
⚠️ **API Testing Pending** - Server restart required to load new endpoints

## Completed Steps

### 1. UI Integration ✅

The `OpsAgents` component has been successfully integrated into the Admin Tools Panel:

**File**: `src/components/AdminToolsPanel.tsx`
- Added import: `import OpsAgents from "./OpsAgents"`
- Added component in "Agent Orchestration" section under a new "Task History" subsection
- Component will be visible at `/admin` page (or wherever AdminToolsPanel is rendered)

**Access the UI**:
1. Open your site with `?admin=1` or `?dev=1` query parameter
2. Navigate to the Admin Tools section
3. Scroll to "Agent Orchestration" → "Task History"

## Pending Steps

### 2. Database Migration ⚠️

The migration file exists but Alembic needs proper configuration.

**Migration File**: `assistant_api/migrations/versions/001_agents_tasks.py`

**What the migration does**:
- Creates `agents_tasks` table with 13 columns
- Adds 3 indexes:
  - `idx_agents_tasks_run_id` - For filtering by run_id
  - `idx_agents_tasks_started_at` - For time-based queries
  - `idx_agents_tasks_started_id_desc` - **NEW** Composite index for keyset pagination

#### Option A: Run Migration (Requires Alembic Setup)

1. **Create Alembic configuration** (`assistant_api/alembic.ini`):
```ini
[alembic]
script_location = migrations
sqlalchemy.url = postgresql://user:pass@localhost/dbname

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

2. **Run migration**:
```bash
# PowerShell
Set-Location assistant_api
python -m alembic upgrade head
Set-Location ..

# Or use virtual environment explicitly
.venv\Scripts\python.exe -m alembic upgrade head
```

#### Option B: Manual Index Creation (Quick Alternative)

If Alembic setup is complex, create the composite index manually:

```sql
-- Connect to your PostgreSQL database
psql -U your_user -d your_database

-- Create the composite index
CREATE INDEX IF NOT EXISTS idx_agents_tasks_started_id_desc
ON agents_tasks(started_at, id);

-- Verify indexes
\d agents_tasks
```

Or via Python:

```python
# In your assistant_api directory
from sqlalchemy import create_engine, text

engine = create_engine("postgresql://user:pass@localhost/dbname")
with engine.connect() as conn:
    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_agents_tasks_started_id_desc
        ON agents_tasks(started_at, id)
    """))
    conn.commit()
```

### 3. Restart FastAPI Server ⚠️

The new `/agents/tasks/paged` endpoint needs server restart to be loaded.

**Current server status**: ✅ Running (http://localhost:8001/ready returns OK)

**Restart steps**:

```powershell
# Find and stop current process
Get-Process | Where-Object {$_.Name -like "*python*" -or $_.Name -like "*uvicorn*"}

# Stop the server (Ctrl+C in its terminal, or kill by PID)

# Restart server
cd assistant_api
..\\.venv\\Scripts\\python.exe -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001
```

Or use your existing start script:
```powershell
.\\start-backend.ps1
```

### 4. Test API Endpoints 🧪

Once server is restarted, test the new endpoints:

#### Test 1: Legacy Endpoint (Should Still Work)
```powershell
curl http://localhost:8001/agents/tasks/?limit=10
```

**Expected**: Returns list of tasks (or empty array if no tasks yet)

#### Test 2: New Paged Endpoint
```powershell
curl http://localhost:8001/agents/tasks/paged?limit=10
```

**Expected Response**:
```json
{
  "items": [],
  "next_cursor": null
}
```

#### Test 3: With Since Filter
```powershell
curl "http://localhost:8001/agents/tasks/paged?limit=10&since=2025-10-01T00:00:00Z"
```

**Expected**: Same structure, filtered by date

#### Test 4: Create Test Task (Optional)
```powershell
curl -X POST http://localhost:8001/agents/tasks/ `
  -H "Content-Type: application/json" `
  -d '{
    "task": "test.task",
    "run_id": "test-2025-10-10",
    "status": "running",
    "started_at": "2025-10-10T12:00:00Z",
    "inputs": {"test": true}
  }'
```

Then verify it appears in paged endpoint:
```powershell
curl http://localhost:8001/agents/tasks/paged?limit=10
```

### 5. Test UI Component 🎨

1. **Open Admin Panel**:
   ```
   http://localhost:8080/?admin=1
   ```
   (Or your local dev URL with admin access)

2. **Navigate to Agent Orchestration section**

3. **Find "Task History" subsection** below the approval panel

4. **Verify UI elements**:
   - ✅ "Since (UTC)" datetime input (defaults to last 7 days)
   - ✅ "Apply" button to refresh with new filter
   - ✅ Table with columns: Task, Run ID, Status, Started, Duration, Output
   - ✅ "Load more" button (if more than 50 results)
   - ✅ Status badges with colors

5. **Test interactions**:
   - Change the "Since" date and click "Apply"
   - If there are tasks, click "Load more" to fetch next page
   - Click output links (should open in new tab)

## Troubleshooting

### Issue: 404 on `/agents/tasks/paged`

**Cause**: Server hasn't loaded new router
**Fix**: Restart FastAPI server

### Issue: Migration fails with "No script_location"

**Cause**: Missing `alembic.ini`
**Fix**: Use Option B (manual index creation) or create proper Alembic config

### Issue: UI component doesn't appear

**Cause**: Frontend not rebuilt after adding component
**Fix**:
```powershell
npm run build
# Or if using dev server
npm run dev
```

### Issue: API returns "detail": "Not Found"

**Possible causes**:
1. Server not restarted → Restart server
2. Router not imported → Check `assistant_api/main.py` line 152-153
3. Wrong URL → Ensure using `/agents/tasks/paged` (not `/agents/tasks/`)

### Issue: Empty table in UI

**This is normal if**:
- No tasks have been created yet
- Since filter is too restrictive (try "last 30 days")

**To populate test data**: Use Test 4 above to create sample tasks

## Quick Validation Checklist

- [ ] Migration applied (composite index exists)
- [ ] FastAPI server restarted
- [ ] Legacy endpoint works: `GET /agents/tasks/`
- [ ] New paged endpoint works: `GET /agents/tasks/paged`
- [ ] Frontend rebuilt (if needed)
- [ ] Admin panel accessible
- [ ] OpsAgents component visible in "Agent Orchestration" section
- [ ] UI controls work (Since filter, Apply button)
- [ ] Table displays correctly (even if empty)

## Next Steps

Once all tests pass:

1. ✅ **Commit changes** to your branch
2. 🔄 **Run orchestrator** to populate real task data:
   ```powershell
   $env:API_BASE = "http://localhost:8001"
   $env:SITE_BASE_URL = "https://assistant.ledger-mind.org"
   npm run orchestrator:nightly
   ```
3. 📊 **Verify task history** appears in UI
4. 🚀 **Deploy to production** with confidence

## Files Changed Summary

### Backend
- ✅ `assistant_api/schemas/agents_tasks.py` - Added `AgentTaskListOut`
- ✅ `assistant_api/routers/agents_tasks.py` - Added `/paged` endpoint
- ✅ `assistant_api/migrations/versions/001_agents_tasks.py` - Added composite index
- ✅ `assistant_api/main.py` - Router already registered

### Frontend
- ✅ `src/components/OpsAgents.tsx` - New component created
- ✅ `src/components/AdminToolsPanel.tsx` - Component integrated

### Documentation
- ✅ `docs/ORCHESTRATION.md` - Updated with pagination examples
- ✅ `ORCHESTRATION_PAGINATION.md` - Complete implementation guide
- ✅ `ORCHESTRATION_MIGRATION_TESTING.md` - This file

## Contact/Support

If you encounter issues:
1. Check FastAPI logs for errors
2. Check browser console for frontend errors
3. Verify database connection is working
4. Ensure all environment variables are set correctly
