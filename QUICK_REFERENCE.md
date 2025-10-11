# Quick Reference - Orchestration System

## Server Status
✅ **Running**: http://localhost:8001
✅ **Tests**: 10/10 passing
✅ **Database**: 11 rows migrated, 3 indexes created

## Quick Commands

### Check Server Health
```powershell
curl http://localhost:8001/ready
```

### Basic Pagination
```powershell
curl "http://localhost:8001/agents/tasks/paged?limit=10"
```

### Filter by Status
```powershell
# Single status
curl "http://localhost:8001/agents/tasks/paged?status=awaiting_approval"

# Multiple statuses
curl "http://localhost:8001/agents/tasks/paged?status=awaiting_approval&status=succeeded"
```

### Filter by Task
```powershell
curl "http://localhost:8001/agents/tasks/paged?task=validate"
```

### Time Range Query
```powershell
# Last 7 days
$since = (Get-Date).AddDays(-7).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
curl "http://localhost:8001/agents/tasks/paged?since=$since"
```

### Combined Filters
```powershell
curl "http://localhost:8001/agents/tasks/paged?status=succeeded&task=validate&since=2025-10-01T00:00:00Z"
```

### CSV Export
```powershell
# Basic export
curl "http://localhost:8001/agents/tasks/paged.csv?limit=100" -o tasks.csv

# Filtered export
curl "http://localhost:8001/agents/tasks/paged.csv?status=awaiting_approval" -o awaiting.csv
```

### Run All Tests
```powershell
.\test-orchestration-api.ps1
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/agents/tasks/` | Create new task |
| PATCH | `/agents/tasks/{id}` | Update task |
| GET | `/agents/tasks/` | List tasks (legacy) |
| GET | `/agents/tasks/paged` | Keyset pagination with filters |
| GET | `/agents/tasks/paged.csv` | CSV export with filters |
| DELETE | `/agents/tasks/before` | Prune old records (admin only) |

## Query Parameters

### `/agents/tasks/paged`
- `limit` (1-200, default 50) - Items per page
- `since` (ISO-8601) - Filter by started_at >= since
- `cursor` (string) - Pagination cursor from previous response
- `status` (array) - Filter by status (can specify multiple)
- `task` (array) - Filter by task name (can specify multiple)

### `/agents/tasks/paged.csv`
- `limit` (1-10000, default 1000) - Max rows to export
- Same filter params as `/paged` endpoint

### `/agents/tasks/before` (Admin Only)
- `date` (ISO-8601, required) - Delete rows with started_at < date
- **Header required:** `X-Admin-Key` must match server's `ADMIN_API_KEY` env var
- `since` (ISO-8601) - Filter by started_at >= since
- `status` (array) - Filter by status
- `task` (array) - Filter by task name

## Status Values
- `queued` - Scheduled but not started
- `running` - Currently executing
- `succeeded` - Completed successfully
- `failed` - Failed with error
- `awaiting_approval` - Needs human review
- `skipped` - Skipped due to conditions

## Database Info

**Location**: `./data/rag.sqlite`
**Table**: `agents_tasks` (13 columns)
**Rows**: 11 tasks
**Indexes**:
- `idx_agents_tasks_run_id` - Run filtering
- `idx_agents_tasks_started_at` - Time queries
- `idx_agents_tasks_started_id_desc` - Keyset pagination

## Frontend Testing

1. Start frontend: `npm run dev`
2. Visit: `http://localhost:8080/?admin=1`
3. Navigate: Agent Orchestration → Task History
4. Test filters, pagination, and CSV download

## Alembic Commands

```powershell
# Run migrations
python -m alembic upgrade head

# Check current revision
python -m alembic current

# Show history
python -m alembic history

# Create new migration
python -m alembic revision -m "description"
```

## Troubleshooting

### Server not responding
```powershell
# Check if running
Get-Process | Where-Object {$_.ProcessName -eq "python"}

# Restart server
Stop-Process -Name python -Force
D:\leo-portfolio\.venv\Scripts\python.exe -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001 --reload
```

### Test failures
```powershell
# Re-run tests
.\test-orchestration-api.ps1

# Check server logs in the PowerShell window running uvicorn
```

### Database issues
```powershell
# Verify database
python -c "import sqlite3; conn = sqlite3.connect('./data/rag.sqlite'); print(conn.execute('SELECT COUNT(*) FROM agents_tasks').fetchone()[0], 'rows')"

# Check indexes
python -c "import sqlite3; conn = sqlite3.connect('./data/rag.sqlite'); print([r[0] for r in conn.execute('SELECT name FROM sqlite_master WHERE type=\"index\" AND tbl_name=\"agents_tasks\"').fetchall()])"
```

## Files Reference

- `test-orchestration-api.ps1` - Automated test suite
- `TEST_RESULTS.md` - Latest test results
- `ALEMBIC_SETUP_COMPLETE.md` - Migration setup guide
- `ORCHESTRATION_SETUP_SUMMARY.md` - Complete overview
- `docs/ORCHESTRATION.md` - Full documentation
- `docs/AGENTS_PRUNING.md` - Pruning system guide
- `.github/workflows/agents-prune.yml` - Weekly pruning automation

## Admin Operations

### Prune Old Records (Requires ADMIN_API_KEY)
```powershell
# Delete records older than 90 days
$cutoff = (Get-Date).AddDays(-90).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$headers = @{
    "X-Admin-Key" = $env:ADMIN_API_KEY
    "Accept" = "application/json"
}
Invoke-RestMethod -Method Delete `
  -Uri "http://localhost:8001/agents/tasks/before?date=$cutoff" `
  -Headers $headers
```

**Setup:**
1. Generate key: `openssl rand -hex 32`
2. Set on server: `$env:ADMIN_API_KEY = "your-key-here"`
3. Configure GitHub Actions secrets for automated pruning

See `docs/AGENTS_PRUNING.md` for full guide.

## Success Criteria ✅

- [x] Alembic setup complete
- [x] Database migrated with indexes
- [x] Server running with new endpoints
- [x] All 10 tests passing
- [x] CSV export working
- [x] Multi-filter support verified
- [x] Admin prune endpoint secured
- [x] Weekly pruning automation configured
- [ ] Frontend UI tested (optional)
- [ ] End-to-end orchestrator run (optional)

---

**Last Updated**: October 10, 2025
**Status**: All systems operational ✅
