# Task Orchestration System - Implementation Complete

## Summary

Successfully implemented a complete database-backed task orchestration system for automated nightly agent coordination with webhook notifications and approval workflows.

## Components Created

### 1. Database Layer
- ✅ **Migration**: `assistant_api/migrations/versions/001_agents_tasks.py`
  - Table: `agents_tasks` (13 columns)
  - Indexes: `run_id`, `started_at`
  - Statuses: queued | running | succeeded | failed | awaiting_approval | skipped
  - Approval states: pending | approved | rejected

- ✅ **SQLAlchemy Model**: `assistant_api/models/agents_tasks.py`
  - AgentTask class with JSONB inputs field
  - Proper relationships and indexes

- ✅ **Pydantic Schemas**: `assistant_api/schemas/agents_tasks.py`
  - AgentTaskCreate (for POST requests)
  - AgentTaskUpdate (for PATCH requests)
  - AgentTaskOut (for responses with ORM mode)

### 2. API Layer
- ✅ **FastAPI Router**: `assistant_api/routers/agents_tasks.py`
  - `POST /agents/tasks/` - Create new task record
  - `PATCH /agents/tasks/{id}` - Update existing task
  - `GET /agents/tasks/` - List tasks with filters (run_id, status, limit)

- ✅ **Main App Integration**: `assistant_api/main.py`
  - Router wired into FastAPI app
  - Available at `/agents/tasks/*` endpoints

### 3. Orchestration Layer
- ✅ **Orchestrator Script**: `scripts/orchestrator.nightly.mjs` (308 lines)
  - Predefined plan: [seo.validate, code.review, dx.integrate]
  - Per-task workflow: API create → run command → capture output → API patch
  - Webhook notifications for awaiting_approval status
  - Error handling with task-level try/catch
  - Extracts outputs_uri from command output (PR links, artifacts)
  - Captures log excerpts (first/last 10 lines)

- ✅ **npm Scripts**: Added to `package.json`
  - `orchestrator:nightly` - Run full orchestration plan
  - `code:review` - Run code review with --only-changed
  - `dx:integrate` - Run DX integration with --only-changed

### 4. CI/CD Integration
- ✅ **GitHub Actions Workflow**: `.github/workflows/orchestrator-nightly.yml`
  - Schedule: Daily at 02:30 UTC
  - Permissions: contents, pull-requests, issues, actions
  - Environment variables: API_BASE, GITHUB_TOKEN, SITE_BASE_URL, SLACK_WEBHOOK, EMAIL_WEBHOOK
  - Artifact upload for orchestration logs (30-day retention)

### 5. Documentation
- ✅ **Comprehensive Guide**: `docs/ORCHESTRATION.md`
  - Architecture overview with component diagram
  - Database schema with SQL DDL
  - Setup instructions (migration, environment variables)
  - API usage examples (curl commands)
  - Extending the system (adding new tasks)
  - Monitoring and troubleshooting guides
  - Security considerations

- ✅ **README Update**: Added "Task Orchestration (Nightly Automation)" section
  - Quick commands
  - Feature highlights
  - API endpoints
  - Nightly plan overview
  - Link to detailed docs

- ✅ **CHANGELOG Update**: Added complete entry under [Unreleased]
  - All components listed
  - Key features highlighted
  - Version ready for next release

## Task Runners

**Existing Scripts** (already in repo, left as-is):
- `scripts/code-review.mjs` - Diff-aware code quality checks (55 lines)
- `scripts/dx-integrate.mjs` - DX integration stubs (38 lines)

These scripts already support `--diff` and `--out json` flags and emit proper JSON payloads.

## Setup Required (User Actions)

### 1. Run Database Migration
```bash
cd assistant_api
alembic upgrade head
```

### 2. Configure Environment Variables

**GitHub Repository Variables** (Settings > Secrets and variables > Actions > Variables):
- `API_BASE` - FastAPI URL (e.g., `https://api.leok.dev`)
- `SITE_BASE_URL` - Frontend URL (e.g., `https://leo.leok.dev`)

**GitHub Repository Secrets** (Settings > Secrets and variables > Actions > Secrets):
- `SLACK_WEBHOOK` - Slack incoming webhook URL for notifications
- `EMAIL_WEBHOOK` - Email webhook URL for notifications

### 3. Test Locally
```bash
# Start FastAPI backend (ensure PostgreSQL is running)
cd assistant_api
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001

# In another terminal, run orchestrator
npm run orchestrator:nightly
```

## API Usage Examples

### Create Task
```bash
curl -X POST http://localhost:8001/agents/tasks/ \
  -H "Content-Type: application/json" \
  -d '{
    "task": "seo.validate",
    "run_id": "nightly-2025-01-15",
    "status": "running",
    "started_at": "2025-01-15T02:30:00Z",
    "inputs": {"flags": ["--strict", "--dry-run"]}
  }'
```

### Update Task
```bash
curl -X PATCH http://localhost:8001/agents/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "succeeded",
    "finished_at": "2025-01-15T02:35:00Z",
    "duration_ms": 300000,
    "outputs_uri": "https://github.com/user/repo/pull/123"
  }'
```

### List Tasks
```bash
# Filter by run_id
curl http://localhost:8001/agents/tasks/?run_id=nightly-2025-01-15

# Filter by status
curl http://localhost:8001/agents/tasks/?status=awaiting_approval
```

## Orchestration Flow

```
1. Schedule: GitHub Actions triggers at 02:30 UTC
2. Orchestrator starts: Creates run_id (e.g., "nightly-2025-01-15")
3. For each task in plan:
   a. Create task record (status: running)
   b. Execute command (npm run, node scripts)
   c. Capture output (stdout/stderr, exit code)
   d. Extract outputs_uri (PR links, artifacts)
   e. Determine final status (succeeded/failed/awaiting_approval)
   f. Update task record with results
   g. Send webhooks if awaiting approval
4. Continue to next task (even if previous failed)
5. Upload orchestration logs as artifacts
```

## Webhook Notification Format

### Slack
```json
{
  "text": "Task seo.validate awaiting approval: https://github.com/user/repo/pull/123"
}
```

### Email
```json
{
  "run_id": "nightly-2025-01-15",
  "task": "seo.validate",
  "status": "awaiting_approval",
  "outputs_uri": "https://github.com/user/repo/pull/123",
  "log_excerpt": "..."
}
```

## Extending the System

### Add New Task

1. Create task runner script:
```javascript
#!/usr/bin/env node
// scripts/my-task.mjs
console.log('Running my task...');
process.exit(0);
```

2. Add to orchestration plan in `scripts/orchestrator.nightly.mjs`:
```javascript
const PLAN = [
  // ... existing tasks
  {
    task: 'my.task',
    cmd: ['node', ['scripts/my-task.mjs', '--flag']],
    env: { MY_VAR: 'value' }
  }
];
```

3. Add npm script to `package.json`:
```json
{
  "scripts": {
    "my:task": "node scripts/my-task.mjs"
  }
}
```

## Files Modified/Created

### New Files (8)
1. `assistant_api/migrations/versions/001_agents_tasks.py` (48 lines)
2. `assistant_api/models/agents_tasks.py` (47 lines)
3. `assistant_api/schemas/agents_tasks.py` (52 lines)
4. `assistant_api/routers/agents_tasks.py` (83 lines)
5. `scripts/orchestrator.nightly.mjs` (308 lines)
6. `.github/workflows/orchestrator-nightly.yml` (53 lines)
7. `docs/ORCHESTRATION.md` (403 lines)
8. `ORCHESTRATION_COMPLETE.md` (this file)

### Modified Files (3)
1. `assistant_api/main.py` (added router import and registration)
2. `package.json` (added 3 npm scripts)
3. `README.md` (added Task Orchestration section)
4. `CHANGELOG.md` (added [Unreleased] entry)

## Total Lines of Code
- **Database layer**: ~147 lines (migration + model + schemas)
- **API layer**: ~83 lines (router)
- **Orchestration**: ~308 lines (orchestrator script)
- **CI/CD**: ~53 lines (workflow)
- **Documentation**: ~403 lines (guide)
- **Total**: ~994 lines of new code

## Testing Checklist

- [ ] Run database migration: `alembic upgrade head`
- [ ] Verify table created: `SELECT * FROM agents_tasks LIMIT 1;`
- [ ] Test API endpoints:
  - [ ] POST /agents/tasks/ (create)
  - [ ] PATCH /agents/tasks/{id} (update)
  - [ ] GET /agents/tasks/ (list)
- [ ] Run orchestrator locally: `npm run orchestrator:nightly`
- [ ] Verify tasks logged to database
- [ ] Test webhook notifications (if configured)
- [ ] Trigger GitHub Actions workflow manually
- [ ] Verify artifacts uploaded

## Next Steps

1. **Immediate**:
   - Run migration to create database table
   - Configure environment variables in GitHub
   - Test orchestrator locally

2. **Short-term**:
   - Monitor nightly runs in GitHub Actions
   - Review task history in database
   - Tune orchestration plan as needed

3. **Future Enhancements**:
   - Add authentication to API endpoints
   - Build web UI for task history and approval
   - Implement task dependencies (conditional execution)
   - Add retry logic for failed tasks
   - Add metrics and alerting

## Status
✅ **COMPLETE** - All implementation tasks finished. System ready for testing and deployment.
