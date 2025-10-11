# Admin UI Quick Reference

**Status**: ✅ Production Ready
**Admin Email**: leoklemet.pa@gmail.com

## Quick Setup

### Backend (.env or server env)
```bash
ADMIN_USERS=leoklemet.pa@gmail.com
```

### Frontend (.env or hosting env)
```bash
VITE_ADMIN_EMAIL=leoklemet.pa@gmail.com
VITE_ADMIN_ROLE=admin
```

## Usage

### Full Page (`/ops/agents`)
1. Open `/ops/agents`
2. Find task with status `awaiting_approval`
3. Click **Approve** / **Reject** / **Cancel**
4. Enter note in prompt
5. Row updates inline

### Overlay (`?admin=1`)
1. Open `/?admin=1`
2. Go to "Agent Orchestration" section
3. Find `awaiting_approval` in Recent Runs
4. Click compact action button
5. Enter note
6. List refreshes automatically

## Button Colors

| Action | Color | Usage |
|--------|-------|-------|
| Approve | Green (`emerald-700`) | Task is good, mark as succeeded |
| Reject | Red (`rose-700`) | Task has issues, mark as failed |
| Cancel | Gray (`zinc-700`) | Task is obsolete, skip it |

## API Calls

All actions send these headers:
```
X-User-Role: admin
X-User-Email: leoklemet.pa@gmail.com
```

| Action | Endpoint | Query Param |
|--------|----------|-------------|
| Approve | `POST /agents/tasks/{id}/approve` | `?note=LGTM` |
| Reject | `POST /agents/tasks/{id}/reject` | `?note=Needs+fixes` |
| Cancel | `POST /agents/tasks/{id}/cancel` | `?note=Superseded` |

## Status Changes

| Action | Old Status | New Status | approval_state |
|--------|-----------|------------|----------------|
| Approve | awaiting_approval | succeeded | approved |
| Reject | awaiting_approval | failed | rejected |
| Cancel | awaiting_approval | skipped | cancelled |

## Files

| File | Purpose |
|------|---------|
| `src/lib/adminHeaders.ts` | Builds X-User-Role and X-User-Email headers |
| `src/components/OpsAgents.tsx` | Full page table with action buttons |
| `src/components/OverlayRecentRuns.tsx` | Overlay table with compact buttons |

## Verification

### Check Frontend Config
```javascript
// In browser DevTools console:
import.meta.env.VITE_ADMIN_EMAIL  // → "leoklemet.pa@gmail.com"
import.meta.env.VITE_ADMIN_ROLE   // → "admin"
```

### Check Backend Config
```bash
# In terminal where backend runs:
echo $ADMIN_USERS  # → leoklemet.pa@gmail.com
```

### Test Flow
1. Create task with `status=awaiting_approval`
2. Open `/ops/agents`
3. Click **Approve** on the task
4. Enter note: "Test approval"
5. Verify row updates:
   - Status: "succeeded · approved"
   - Approver: "leoklemet.pa@gmail.com"
   - Note: "Test approval"

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Buttons don't show | Check task.status === "awaiting_approval" |
| 403 Forbidden | Verify ADMIN_USERS matches VITE_ADMIN_EMAIL |
| Row doesn't update | Check browser console for errors |
| Alert "failed" | Check network tab for API error details |

## Security Notes

✅ **Frontend sends**: Public headers (role, email)
✅ **Backend validates**: Email must be in ADMIN_USERS
✅ **No secrets exposed**: ADMIN_API_KEY stays server-only
✅ **Single admin**: Only leoklemet.pa@gmail.com allowed

---

See `ADMIN_UI_APPROVAL_ACTIONS.md` for full documentation.
