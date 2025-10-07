# SiteAgent Quick Reference

## Quick Test Commands

### Setup Environment
```powershell
# Set service token credentials (one time per session)
$env:CF_ACCESS_CLIENT_ID = "bcf632e4a22f6a8007d47039038904b7.access"
$env:CF_ACCESS_CLIENT_SECRET = "1532e93c9599937c3155af61945d2c814168c6a5fa809f554d6e3257289268b6"
```

### 1. List Available Tasks
```powershell
Invoke-WebRequest `
  -Uri "https://assistant.ledger-mind.org/api/admin/agent/tasks" `
  -Headers @{
    "CF-Access-Client-Id"=$env:CF_ACCESS_CLIENT_ID
    "CF-Access-Client-Secret"=$env:CF_ACCESS_CLIENT_SECRET
  } | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json
```

**Expected Output:**
```json
{
  "tasks": ["og.generate", "projects.sync", "sitemap.media.update", "status.write"],
  "default": ["projects.sync", "sitemap.media.update", "og.generate", "status.write"]
}
```

### 2. Run Agent (Default Plan)
```powershell
Invoke-WebRequest `
  -Uri "https://assistant.ledger-mind.org/api/admin/agent/run" `
  -Method POST `
  -Headers @{
    "CF-Access-Client-Id"=$env:CF_ACCESS_CLIENT_ID
    "CF-Access-Client-Secret"=$env:CF_ACCESS_CLIENT_SECRET
    "Content-Type"="application/json"
  } `
  -Body '{}' | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json
```

**Expected Output:**
```json
{
  "run_id": "0714ffc9-439e-4d67-9de7-7be21aa6ce16",
  "tasks": ["projects.sync", "sitemap.media.update", "og.generate", "status.write"]
}
```

### 3. Run Agent (Custom Plan)
```powershell
# Run only status.write task
Invoke-WebRequest `
  -Uri "https://assistant.ledger-mind.org/api/admin/agent/run" `
  -Method POST `
  -Headers @{
    "CF-Access-Client-Id"=$env:CF_ACCESS_CLIENT_ID
    "CF-Access-Client-Secret"=$env:CF_ACCESS_CLIENT_SECRET
    "Content-Type"="application/json"
  } `
  -Body '{"plan":["status.write"]}' | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json
```

### 4. Check Agent Status
```powershell
Invoke-WebRequest `
  -Uri "https://assistant.ledger-mind.org/api/admin/agent/status" `
  -Headers @{
    "CF-Access-Client-Id"=$env:CF_ACCESS_CLIENT_ID
    "CF-Access-Client-Secret"=$env:CF_ACCESS_CLIENT_SECRET
  } | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**Expected Output:**
```json
{
  "recent": [
    {
      "run_id": "0714ffc9-439e-4d67-9de7-7be21aa6ce16",
      "started": "2025-10-07T14:27:18.523786",
      "finished": "2025-10-07T14:27:18.544827",
      "ok": 1,
      "errors": 0,
      "total": 1
    }
  ]
}
```

### 5. View Generated Files
```bash
# View agent heartbeat
docker exec portfolio-backend-1 cat /app/assets/data/siteAgent.json

# View projects data
docker exec portfolio-backend-1 cat /app/assets/data/projects.json

# View media index
docker exec portfolio-backend-1 cat /app/assets/data/media-index.json
```

### 6. Check Event Log
```bash
# Copy helper script to container
docker cp check-agent-events.py portfolio-backend-1:/tmp/check.py

# Check events for specific run
docker exec portfolio-backend-1 python /tmp/check.py <run_id>

# Example:
docker exec portfolio-backend-1 python /tmp/check.py 0714ffc9-439e-4d67-9de7-7be21aa6ce16
```

**Expected Output:**
```
Events for run 0714ffc9-439e-4d67-9de7-7be21aa6ce16:
--------------------------------------------------------------------------------
2025-10-07T14:27:18.503446 [info ] run.start: {"tasks": ["status.write"]}
2025-10-07T14:27:18.566256 [info ] task.ok: {"task": "status.write", "result": {"file": "./assets/data/siteAgent.json"}}
2025-10-07T14:27:18.586286 [info ] run.end: {}
```

## Available Tasks

| Task | Description | Output |
|------|-------------|--------|
| `projects.sync` | Pull GitHub repo metadata and update projects.json | `./assets/data/projects.json` |
| `sitemap.media.update` | Scan media assets and generate index | `./assets/data/media-index.json` |
| `og.generate` | Generate Open Graph images | `./assets/og/*.png` |
| `status.write` | Write agent heartbeat status | `./assets/data/siteAgent.json` ✅ |

## Endpoints

### GET `/api/admin/agent/tasks`
**Purpose:** List all available tasks and default execution plan
**Authentication:** Service token or SSO required
**Response:**
```json
{
  "tasks": ["og.generate", "projects.sync", "sitemap.media.update", "status.write"],
  "default": ["projects.sync", "sitemap.media.update", "og.generate", "status.write"]
}
```

### POST `/api/admin/agent/run`
**Purpose:** Execute agent with optional custom plan
**Authentication:** Service token or SSO required
**Request Body:**
```json
{
  "plan": ["status.write"],  // Optional, defaults to all tasks
  "params": {}               // Optional, task-specific parameters
}
```
**Response:**
```json
{
  "run_id": "0714ffc9-439e-4d67-9de7-7be21aa6ce16",
  "tasks": ["status.write"]
}
```

### GET `/api/admin/agent/status`
**Purpose:** View recent agent run history
**Authentication:** Service token or SSO required
**Response:**
```json
{
  "recent": [
    {
      "run_id": "0714ffc9-439e-4d67-9de7-7be21aa6ce16",
      "started": "2025-10-07T14:27:18.523786",
      "finished": "2025-10-07T14:27:18.544827",
      "ok": 1,
      "errors": 0,
      "total": 1
    }
  ]
}
```

## cURL Examples

### List Tasks
```bash
curl -X GET "https://assistant.ledger-mind.org/api/admin/agent/tasks" \
  -H "CF-Access-Client-Id: bcf632e4a22f6a8007d47039038904b7.access" \
  -H "CF-Access-Client-Secret: 1532e93c9599937c3155af61945d2c814168c6a5fa809f554d6e3257289268b6"
```

### Run Agent
```bash
curl -X POST "https://assistant.ledger-mind.org/api/admin/agent/run" \
  -H "CF-Access-Client-Id: bcf632e4a22f6a8007d47039038904b7.access" \
  -H "CF-Access-Client-Secret: 1532e93c9599937c3155af61945d2c814168c6a5fa809f554d6e3257289268b6" \
  -H "Content-Type: application/json" \
  -d '{"plan":["status.write"]}'
```

### Check Status
```bash
curl -X GET "https://assistant.ledger-mind.org/api/admin/agent/status" \
  -H "CF-Access-Client-Id: bcf632e4a22f6a8007d47039038904b7.access" \
  -H "CF-Access-Client-Secret: 1532e93c9599937c3155af61945d2c814168c6a5fa809f554d6e3257289268b6"
```

## GitHub Actions Example

Create `.github/workflows/agent-update.yml`:

```yaml
name: Portfolio Update

on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday at midnight UTC
  workflow_dispatch:      # Allow manual trigger

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - name: Run Agent
        run: |
          curl -X POST "https://assistant.ledger-mind.org/api/admin/agent/run" \
            -H "CF-Access-Client-Id: ${{ secrets.CF_ACCESS_CLIENT_ID }}" \
            -H "CF-Access-Client-Secret: ${{ secrets.CF_ACCESS_CLIENT_SECRET }}" \
            -H "Content-Type: application/json" \
            -d '{}'

      - name: Check Status
        run: |
          sleep 5
          curl -X GET "https://assistant.ledger-mind.org/api/admin/agent/status" \
            -H "CF-Access-Client-Id: ${{ secrets.CF_ACCESS_CLIENT_ID }}" \
            -H "CF-Access-Client-Secret: ${{ secrets.CF_ACCESS_CLIENT_SECRET }}"
```

**Required Secrets:**
- `CF_ACCESS_CLIENT_ID`: `bcf632e4a22f6a8007d47039038904b7.access`
- `CF_ACCESS_CLIENT_SECRET`: `1532e93c9599937c3155af61945d2c814168c6a5fa809f554d6e3257289268b6`

## Troubleshooting

### 401 Unauthorized
**Problem:** Service token credentials invalid or expired
**Solution:** Verify `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` values

### 403 Forbidden
**Problem:** Service token not in allowlist
**Solution:** Check `.env.prod` has `ACCESS_ALLOWED_SERVICE_SUBS=bcf632e4a22f6a8007d47039038904b7.access`

### Task Failed
**Problem:** Task execution error
**Solution:** Check event log with `docker exec portfolio-backend-1 python /tmp/check.py <run_id>`

### No Output File
**Problem:** Task completed but file not found
**Solution:** Files are generated inside container at `/app/assets/data/`, not in local workspace

## Database Schema

### `agent_jobs` Table
```sql
CREATE TABLE agent_jobs (
  id INTEGER PRIMARY KEY,
  run_id TEXT NOT NULL,
  task TEXT NOT NULL,
  status TEXT NOT NULL,
  started TEXT NOT NULL,
  finished TEXT,
  error TEXT,
  meta TEXT
);
```

### `agent_events` Table
```sql
CREATE TABLE agent_events (
  id INTEGER PRIMARY KEY,
  run_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  level TEXT NOT NULL,
  event TEXT NOT NULL,
  data TEXT
);
```

## Next Steps

1. **Frontend Widget** - Display agent status in footer
2. **CI/CD Integration** - Set up GitHub Actions workflow
3. **Enhanced Tasks** - Complete implementation of remaining tasks
4. **Monitoring** - Add alerts for failed runs

---

**Production Status:** ✅ **LIVE**
**Last Tested:** 2025-10-07
**Authentication:** Service Token ✅
**Endpoint:** `https://assistant.ledger-mind.org/api/admin/agent/*`
