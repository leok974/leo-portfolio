# Orchestration System

## Overview

The orchestration system provides automated tracking and coordination of nightly agent tasks through a database-backed workflow with webhook notifications for approval processes.

## Architecture

### Components

1. **Database Layer** (PostgreSQL)
   - Table: `agents_tasks`
   - Migration: `assistant_api/migrations/versions/001_agents_tasks.py`
   - Model: `assistant_api/models/agents_tasks.py`

2. **API Layer** (FastAPI)
   - Router: `assistant_api/routers/agents_tasks.py`
   - Endpoints:
     - `POST /agents/tasks/` - Create new task record
     - `PATCH /agents/tasks/{id}` - Update existing task
     - `GET /agents/tasks/` - List tasks with filters (legacy)
     - `GET /agents/tasks/paged` - Keyset pagination with filters (status, task, since)
     - `GET /agents/tasks/paged.csv` - CSV export with filters (up to 10,000 rows)

3. **Orchestrator** (Node.js)
   - Script: `scripts/orchestrator.nightly.mjs`
   - Runs predefined plan of tasks
   - Logs to database via API
   - Sends webhook notifications

4. **Task Runners**
   - `scripts/code-review.mjs` - Code quality checks
   - `scripts/dx-integrate.mjs` - Developer experience validation
   - SEO validation (existing `seo.tune.mjs`)

5. **CI Workflow**
   - `.github/workflows/orchestrator-nightly.yml`
   - Runs daily at 02:30 UTC
   - Uploads logs as artifacts

### Task Statuses

- `queued` - Task scheduled but not started
- `running` - Task currently executing
- `succeeded` - Task completed successfully
- `failed` - Task failed with error
- `awaiting_approval` - Task created PR, needs human review
- `skipped` - Task skipped due to conditions

### Approval States

- `pending` - Awaiting human review
- `approved` - Approved by user
- `rejected` - Rejected by user

## Database Schema

```sql
CREATE TABLE agents_tasks (
    id SERIAL PRIMARY KEY,
    task VARCHAR(64) NOT NULL,              -- e.g., "seo.validate"
    run_id VARCHAR(64) NOT NULL,             -- e.g., "nightly-2025-01-15"
    status VARCHAR(32) NOT NULL,             -- queued|running|succeeded|failed|awaiting_approval|skipped
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    duration_ms INTEGER,
    inputs JSONB,                            -- Task-specific inputs (flags, config)
    outputs_uri VARCHAR(512),                -- Link to PR, artifact, report
    log_excerpt TEXT,                        -- First/last N lines of stdout/stderr
    approval_state VARCHAR(32),              -- pending|approved|rejected
    approver VARCHAR(128),                   -- User who approved/rejected
    webhook_notified_at TIMESTAMP            -- When Slack/Email sent
);

CREATE INDEX idx_agents_tasks_run_id ON agents_tasks(run_id);
CREATE INDEX idx_agents_tasks_started_at ON agents_tasks(started_at);
CREATE INDEX idx_agents_tasks_started_id_desc ON agents_tasks(started_at, id); -- Keyset pagination
```

## Setup

### 1. Run Database Migration

```bash
# From project root
cd assistant_api
alembic upgrade head
```

### 2. Configure Environment Variables

Set the following in GitHub repository settings:

**Variables** (Settings > Secrets and variables > Actions > Variables):
- `API_BASE` - FastAPI URL (default: `https://api.assistant.ledger-mind.org`)
- `SITE_BASE_URL` - Frontend URL (default: `https://assistant.ledger-mind.org`)

**Secrets** (Settings > Secrets and variables > Actions > Secrets):
- `SLACK_WEBHOOK` - Slack webhook URL for notifications
- `EMAIL_WEBHOOK` - Email webhook URL for notifications

**Note**: The workflow files have production defaults configured. You only need to set these variables if you want to override the defaults.

### 3. Test Locally

```bash
# Start FastAPI backend (ensure DB is running)
npm run fastapi

# Run orchestrator manually
npm run orchestrator:nightly
```

## Usage

### API Examples

**Create Task**:
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

**Update Task**:
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

**List Tasks (Legacy)**:
```bash
# All tasks (basic endpoint, backward compatible)
curl http://localhost:8001/agents/tasks/

# Filter by run_id
curl http://localhost:8001/agents/tasks/?run_id=nightly-2025-01-15

# Filter by status
curl http://localhost:8001/agents/tasks/?status=awaiting_approval
```

**List Tasks with Pagination (Recommended)**:
```bash
# First page (last 7 days)
curl http://localhost:8001/agents/tasks/paged?limit=50&since=2025-10-03T00:00:00Z

# Next page (use cursor from previous response)
curl http://localhost:8001/agents/tasks/paged?limit=50&since=2025-10-03T00:00:00Z&cursor=eyJ...

# Response format:
{
  "items": [
    {
      "id": 123,
      "task": "seo.validate",
      "run_id": "nightly-2025-10-10",
      "status": "succeeded",
      "started_at": "2025-10-10T02:30:00Z",
      "duration_ms": 300000
    }
  ],
  "next_cursor": "eyJzdGFydGVkX2F0IjogIjIwMjUtMTAtMDlUMDI6MzA6MDBaIiwgImlkIjogMTIwfQ=="
}
```

### Orchestration Plan

Current nightly plan (configurable in `scripts/orchestrator.nightly.mjs`):

1. **seo.validate**
   - Runs `npm run seo:tune -- --dry-run --strict`
   - Validates SEO metadata across all pages
   - Creates PR if changes needed

2. **code.review**
   - Runs `node scripts/code-review.mjs --only-changed`
   - ESLint + tests on changed files
   - Reports issues

3. **dx.integrate**
   - Runs `node scripts/dx-integrate.mjs --only-changed`
   - Formatting + dependency validation
   - Reports issues

### Webhook Notifications

When a task reaches `awaiting_approval` status:

**Slack Message**:
```json
{
  "text": "Task seo.validate awaiting approval: https://github.com/user/repo/pull/123"
}
```

**Email Payload**:
```json
{
  "run_id": "nightly-2025-01-15",
  "task": "seo.validate",
  "status": "awaiting_approval",
  "outputs_uri": "https://github.com/user/repo/pull/123",
  "log_excerpt": "..."
}
```

## Extending

### Adding New Tasks

1. Create task runner script in `scripts/`:
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

### Custom Approval Logic

Modify `scripts/orchestrator.nightly.mjs` to detect approval conditions:

```javascript
// Check if output indicates approval needed
const outputs_uri = extractOutputsUri(result.stdout, result.stderr);
if (outputs_uri && outputs_uri.includes('/pull/')) {
  status = 'awaiting_approval';
}
```

## Monitoring

### View Task History

Query the database directly:

```sql
-- Recent runs
SELECT run_id, COUNT(*) as task_count,
       SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) as succeeded,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
FROM agents_tasks
GROUP BY run_id
ORDER BY run_id DESC
LIMIT 10;

-- Tasks awaiting approval
SELECT id, task, run_id, outputs_uri, webhook_notified_at
FROM agents_tasks
WHERE status = 'awaiting_approval'
ORDER BY started_at DESC;
```

### GitHub Actions Logs

- Navigate to Actions tab in GitHub
- Select "Orchestrator Nightly" workflow
- View run logs and download artifacts

## Troubleshooting

### Migration Not Applied

```bash
# Check current migration status
cd assistant_api
alembic current

# Apply pending migrations
alembic upgrade head
```

### API Connection Failed

- Verify `API_BASE` environment variable
- Check FastAPI is running: `curl http://localhost:8001/ready`
- Review CORS settings if calling from different origin

### Webhooks Not Sent

- Verify `SLACK_WEBHOOK` and `EMAIL_WEBHOOK` secrets are set
- Check orchestrator logs for webhook errors
- Test webhook endpoints manually

### Task Runner Errors

- Review task-specific logs in orchestration output
- Check task runner script has execute permissions
- Verify required dependencies are installed

## Security

- API endpoints should be protected in production (add auth middleware)
- Webhook URLs should be kept secret
- Database connection uses environment variables
- CI workflow uses GitHub secrets for sensitive data

## Future Enhancements

- [ ] Add authentication to API endpoints
- [ ] Build web UI for task history and approval
- [ ] Add retry logic for failed tasks
- [ ] Implement task dependencies (run B only if A succeeds)
- [ ] Add metrics and alerting for task failures
- [ ] Support manual task triggering via API
