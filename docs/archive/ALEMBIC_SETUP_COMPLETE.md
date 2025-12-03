# Alembic Setup Complete - Quick Guide

## ✅ Completed Steps

### 1. Alembic Configuration Created
- **alembic.ini**: Created in repo root with SQLite/PostgreSQL support
- **env.py**: Created in `assistant_api/migrations/` with automatic DB URL detection
- **Migration**: SQLite/PostgreSQL compatible migration (uses JSON/JSONB appropriately)

### 2. Database Migration Applied
- ✅ Table `agents_tasks` migrated from old schema to new schema
- ✅ 11 existing rows preserved and migrated
- ✅ All 3 indexes created successfully:
  - `idx_agents_tasks_run_id` - For run filtering
  - `idx_agents_tasks_started_at` - For time-based queries
  - `idx_agents_tasks_started_id_desc` - **Composite index for keyset pagination**
- ✅ Alembic revision stamped as `head`

### 3. Schema Verification
```
Schema (13 columns):
  id                   INTEGER
  task                 VARCHAR(64)
  run_id               VARCHAR(64)
  status               VARCHAR(32)
  started_at           DATETIME
  finished_at          DATETIME
  duration_ms          INTEGER
  inputs               JSON
  outputs_uri          VARCHAR(512)
  log_excerpt          TEXT
  approval_state       VARCHAR(32)
  approver             VARCHAR(128)
  webhook_notified_at  DATETIME
```

## 🔄 Next Steps

### Step 1: Restart FastAPI Server

The server is currently running but needs restart to load the new `/agents/tasks/paged` endpoints.

**Option A: Stop current process and restart**
```powershell
# Find the process ID
Get-Process | Where-Object {$_.ProcessName -eq "python"}

# Stop it
Stop-Process -Id <PID>

# Restart
D:\leo-portfolio\.venv\Scripts\python.exe -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001 --reload
```

**Option B: Use VS Code Task**
- Command Palette (Ctrl+Shift+P)
- Tasks: Run Task
- Select "Run FastAPI (assistant_api)"

### Step 2: Test API Endpoints

After restarting, run the test script:

```powershell
.\test-orchestration-api.ps1
```

Or manual tests:

```powershell
# Basic pagination
curl "http://localhost:8001/agents/tasks/paged?limit=10"

# With status filter
curl "http://localhost:8001/agents/tasks/paged?status=awaiting_approval&limit=10"

# With task filter
curl "http://localhost:8001/agents/tasks/paged?task=validate&limit=10"

# CSV export
curl "http://localhost:8001/agents/tasks/paged.csv?limit=100" -o tasks.csv
```

### Step 3: Test UI

```powershell
# If frontend isn't running, start it
npm run dev

# Visit admin panel
# Open: http://localhost:8080/?admin=1
# Navigate to: Agent Orchestration → Task History
```

### Step 4: Seed Test Data (Optional)

If you want more test data:

```powershell
curl -X POST "http://localhost:8001/agents/tasks/" `
  -H "Content-Type: application/json" `
  -d '{
    "task": "seo.validate",
    "run_id": "test-2025-10-10-01",
    "status": "succeeded",
    "started_at": "2025-10-10T10:00:00Z",
    "finished_at": "2025-10-10T10:05:00Z",
    "duration_ms": 300000,
    "outputs_uri": "https://github.com/org/repo/pull/123",
    "log_excerpt": "Task completed successfully",
    "inputs": {"repo": "org/repo"}
  }'
```

## 📝 Running Alembic Commands

For future migrations:

```powershell
# Run migrations
$env:DB_URL = "sqlite:///./data/rag.sqlite"  # or PostgreSQL URL
python -m alembic upgrade head

# Create new migration
python -m alembic revision -m "description"

# Check current revision
python -m alembic current

# Show migration history
python -m alembic history
```

## 🔍 Troubleshooting

### Issue: "table agents_tasks already exists"
✅ **Fixed**: Migrated old schema to new schema with data preservation

### Issue: Endpoint returns 404
➡️ **Solution**: Restart FastAPI server to load new router

### Issue: Import errors for fastapi/sqlalchemy
➡️ **Solution**: These are Pylance false positives - packages are installed in venv

### Issue: No data in UI
➡️ **Solution**: 11 rows preserved from old schema, ready to query

## 📊 Current State

- **Database**: SQLite at `./data/rag.sqlite`
- **Table**: `agents_tasks` with correct schema
- **Indexes**: All 3 created (including composite for pagination)
- **Data**: 11 migrated rows from old schema
- **Alembic**: Stamped at revision `001_agents_tasks`
- **Server**: Running but needs restart for new endpoints

## 🚀 PostgreSQL Setup (Optional)

To use PostgreSQL instead of SQLite:

```powershell
# Set environment variable
$env:DATABASE_URL = "postgresql://user:pass@localhost:5432/dbname"

# Run migrations
python -m alembic upgrade head
```

The code is already PostgreSQL-compatible (JSONB support, proper indexing).
