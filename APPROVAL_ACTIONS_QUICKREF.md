# Approval Actions Quick Reference

**Status**: ✅ Production Ready
**Date**: 2025-01-10

## Quick Commands

### Approve a task
```bash
curl -X POST "$API_BASE/agents/tasks/{id}/approve?note=LGTM" \\
  -H "X-Admin-Key: $ADMIN_API_KEY"
```

### Reject a task
```bash
curl -X POST "$API_BASE/agents/tasks/{id}/reject?note=Needs+fixes" \\
  -H "X-Admin-Key: $ADMIN_API_KEY"
```

### Cancel a task
```bash
curl -X POST "$API_BASE/agents/tasks/{id}/cancel?note=Superseded" \\
  -H "X-Admin-Key: $ADMIN_API_KEY"
```

## Authentication Options

### Option A: API Key (Service-to-Service)
```bash
export ADMIN_API_KEY="your-secret-key"
curl -H "X-Admin-Key: $ADMIN_API_KEY" ...
```

### Option B: Role + Email (Auth Proxy)
```bash
curl -H "X-User-Role: admin" \\
     -H "X-User-Email: lead@example.com" ...
```

## Environment Variables

```bash
# Required for API key auth
ADMIN_API_KEY=secret123

# Optional email allowlist
ADMIN_USERS="lead@example.com,ops@example.com"
```

## API Endpoints

| Endpoint | Method | Auth | Action |
|----------|--------|------|--------|
| `/agents/tasks/{id}/approve` | POST | Admin | status→succeeded, approval_state→approved |
| `/agents/tasks/{id}/reject` | POST | Admin | status→failed, approval_state→rejected |
| `/agents/tasks/{id}/cancel` | POST | Admin | status→skipped, approval_state→cancelled |

## Status Mapping

| Action | status | approval_state |
|--------|--------|----------------|
| approve | succeeded | approved |
| reject | failed | rejected |
| cancel | skipped | cancelled |

## Metrics Emitted

- `agent.task_approved` - Task approved by admin
- `agent.task_rejected` - Task rejected by admin
- `agent.task_cancelled` - Task cancelled by admin

**Payload**: `{id, task, run_id, approver}`

## UI Columns

Both `/ops/agents` and admin overlay now show:
- **Approver** - Email of user who approved/rejected/cancelled
- **Note** - Approval/rejection/cancellation reason (truncated with hover tooltip)

## Database Schema

**New column**: `approval_note TEXT` (nullable)
**New index**: `idx_agents_tasks_approval_state` on `approval_state`

Migration: `003_approval_note`

## Files Modified

**Backend**:
- `assistant_api/rbac.py` (new)
- `assistant_api/migrations/versions/003_approval_note.py` (new)
- `assistant_api/models/agents_tasks.py` (+1 column)
- `assistant_api/schemas/agents_tasks.py` (+2 fields)
- `assistant_api/routers/agents_tasks.py` (+3 endpoints)

**Frontend**:
- `src/components/OpsAgents.tsx` (+2 columns)
- `src/components/OverlayRecentRuns.tsx` (+2 columns)

## Verification Checklist

- [x] Migration applied (`alembic upgrade head`)
- [x] Frontend builds successfully (`npm run build`)
- [x] RBAC helper with dual auth modes
- [x] Three endpoints with admin guards
- [x] Metrics emission on all actions
- [x] UI tables updated with new columns

## Security Notes

- Admin-only access (403 if unauthorized)
- Approver email recorded for audit trail
- API key should be rotated regularly
- Role-based auth requires trusted auth proxy

## Next Steps (Optional)

- Add frontend approve/reject/cancel buttons
- Add webhook notifications for approval actions
- Add audit log table
- Add approval deadline/timeout logic
- Add bulk approve/reject endpoints

---

**Implementation complete!** See `APPROVAL_ACTIONS_COMPLETE.md` for full details.
