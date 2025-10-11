# Task Orchestration - Quick Reference

## Commands

### Local Development
```bash
# Run full orchestration
npm run orchestrator:nightly

# Run individual tasks
npm run code:review
npm run dx:integrate
npm run seo:tune -- --dry-run --strict
```

### Database
```bash
# Run migration
cd assistant_api && alembic upgrade head

# Check current version
alembic current

# Rollback
alembic downgrade -1
```

## API Endpoints

### Create Task
```bash
POST /agents/tasks/
{
  "task": "seo.validate",
  "run_id": "nightly-2025-01-15",
  "status": "running",
  "started_at": "2025-01-15T02:30:00Z",
  "inputs": {"flags": ["--strict"]}
}
```

### Update Task
```bash
PATCH /agents/tasks/{id}
{
  "status": "succeeded",
  "finished_at": "2025-01-15T02:35:00Z",
  "duration_ms": 300000,
  "outputs_uri": "https://github.com/user/repo/pull/123"
}
```

### List Tasks
```bash
GET /agents/tasks/                              # All tasks
GET /agents/tasks/?run_id=nightly-2025-01-15   # By run
GET /agents/tasks/?status=awaiting_approval     # By status
GET /agents/tasks/?limit=50                     # Limit results
```

## Task Statuses

| Status | Description |
|--------|-------------|
| `queued` | Scheduled but not started |
| `running` | Currently executing |
| `succeeded` | Completed successfully |
| `failed` | Failed with error |
| `awaiting_approval` | Created PR, needs review |
| `skipped` | Skipped due to conditions |

## Approval States

| State | Description |
|-------|-------------|
| `pending` | Awaiting human review |
| `approved` | Approved by user |
| `rejected` | Rejected by user |

## Environment Variables

### Required
- `API_BASE` - FastAPI URL (e.g., `http://localhost:8001`)
- `GITHUB_TOKEN` - GitHub token for API access

### Optional
- `SITE_BASE_URL` - Site base URL (default: `https://leo.leok.dev`)
- `SLACK_WEBHOOK` - Slack webhook URL for notifications
- `EMAIL_WEBHOOK` - Email webhook URL for notifications

## Database Schema

```sql
CREATE TABLE agents_tasks (
    id SERIAL PRIMARY KEY,
    task VARCHAR(64) NOT NULL,
    run_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    duration_ms INTEGER,
    inputs JSONB,
    outputs_uri VARCHAR(512),
    log_excerpt TEXT,
    approval_state VARCHAR(32),
    approver VARCHAR(128),
    webhook_notified_at TIMESTAMP
);
```

## Orchestration Plan

1. **seo.validate** → `npm run seo:tune -- --dry-run --strict`
2. **code.review** → `node scripts/code-review.mjs --only-changed`
3. **dx.integrate** → `node scripts/dx-integrate.mjs --only-changed`

## Files

| File | Purpose |
|------|---------|
| `assistant_api/migrations/versions/001_agents_tasks.py` | Database migration |
| `assistant_api/models/agents_tasks.py` | SQLAlchemy model |
| `assistant_api/schemas/agents_tasks.py` | Pydantic schemas |
| `assistant_api/routers/agents_tasks.py` | FastAPI router |
| `scripts/orchestrator.nightly.mjs` | Orchestrator script |
| `.github/workflows/orchestrator-nightly.yml` | CI workflow |

## Troubleshooting

### Migration Failed
```bash
# Check current state
cd assistant_api && alembic current

# Retry upgrade
alembic upgrade head

# Check database manually
psql -d your_db -c "SELECT * FROM alembic_version;"
```

### API Connection Failed
```bash
# Check FastAPI is running
curl http://localhost:8001/ready

# Check CORS settings
curl -H "Origin: http://localhost:8080" http://localhost:8001/agents/tasks/
```

### Webhooks Not Sent
- Verify `SLACK_WEBHOOK` and `EMAIL_WEBHOOK` are set
- Check orchestrator logs for webhook errors
- Test webhooks manually with curl

## Next Steps

1. Run migration: `cd assistant_api && alembic upgrade head`
2. Configure environment variables in GitHub settings
3. Test locally: `npm run orchestrator:nightly`
4. Monitor nightly runs in GitHub Actions

## Full Documentation

📖 See [`docs/ORCHESTRATION.md`](docs/ORCHESTRATION.md) for complete setup guide and advanced usage.
