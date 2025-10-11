# Agent Task History Pruning

This document describes the automated pruning system for agent orchestration task history.

## Overview

The agent orchestration system records all task executions in the `agents_tasks` table. To prevent unbounded growth, we provide:

1. **Admin API endpoint** - Secure DELETE endpoint for pruning old records
2. **PostgreSQL function** (optional) - Direct SQL function for manual operations
3. **GitHub Actions workflow** - Automated weekly pruning (90 days retention)

## Security Model

The prune endpoint requires authentication via HTTP header:

```bash
curl -X DELETE "$API_BASE/agents/tasks/before?date=2025-07-12T00:00:00Z" \
  -H "X-Admin-Key: $ADMIN_API_KEY"
```

**Access Control:**
- Endpoint returns `403 Forbidden` if `X-Admin-Key` doesn't match server's `ADMIN_API_KEY` env var
- Must set `ADMIN_API_KEY` environment variable on backend server
- Key must be cryptographically strong (minimum 32 bytes)

**Key Generation:**
```bash
# Generate a secure random key
openssl rand -hex 32
# Example output: a3f9d8c2b1e4f6a7d9c8b2e1f4a6d8c9b1e3f5a7d9c8b2e1f4a6d8c9b1e3f5a7
```

## Setup

### 1. Configure Server

Add to backend environment (`.env.prod`, Docker secrets, or deployment platform):

```bash
ADMIN_API_KEY=a3f9d8c2b1e4f6a7d9c8b2e1f4a6d8c9b1e3f5a7d9c8b2e1f4a6d8c9b1e3f5a7
```

**Important:** Never commit this key to the repository!

### 2. Run Database Migration (Optional for PostgreSQL)

If using PostgreSQL and want a SQL function for manual operations:

```bash
alembic upgrade head
```

This creates the `agents_tasks_prune(before_ts)` function.

### 3. Configure GitHub Actions

Set repository Variables and Secrets:

**Variable:**
- `API_BASE` = `https://api.yourdomain.com` (or your backend URL)

**Secret:**
- `ADMIN_API_KEY` = (same key as server `ADMIN_API_KEY`)

**Steps:**
1. Go to repository → Settings → Secrets and variables → Actions
2. Under "Variables" tab, click "New repository variable"
   - Name: `API_BASE`
   - Value: `https://api.yourdomain.com`
3. Under "Secrets" tab, click "New repository secret"
   - Name: `ADMIN_API_KEY`
   - Value: (paste your generated key)

## Usage

### Automated Pruning (Recommended)

The workflow runs automatically:
- **Schedule:** Every Monday at 03:15 UTC
- **Retention:** Deletes records older than 90 days
- **Location:** `.github/workflows/agents-prune.yml`

**Manual Trigger:**
1. Go to Actions tab in GitHub
2. Select "agents-prune" workflow
3. Click "Run workflow" → "Run workflow"

### Manual Pruning via API

**Delete records older than 90 days:**
```bash
CUTOFF=$(date -u -d '90 days ago' +%FT%TZ)
curl -X DELETE "https://api.yourdomain.com/agents/tasks/before?date=$CUTOFF" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -H "Accept: application/json"
```

**Response:**
```json
{
  "deleted": 42,
  "cutoff": "2025-07-12T00:00:00Z"
}
```

**PowerShell:**
```powershell
$cutoff = (Get-Date).AddDays(-90).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$headers = @{
    "X-Admin-Key" = $env:ADMIN_API_KEY
    "Accept" = "application/json"
}
Invoke-RestMethod -Method Delete `
  -Uri "https://api.yourdomain.com/agents/tasks/before?date=$cutoff" `
  -Headers $headers
```

### Manual Pruning via PostgreSQL Function (Optional)

If you ran the migration and have direct database access:

```sql
-- Delete records older than 90 days
SELECT agents_tasks_prune((NOW() - INTERVAL '90 days')::timestamptz);
-- Returns: count of deleted rows

-- Delete records before specific date
SELECT agents_tasks_prune('2025-07-12 00:00:00+00'::timestamptz);
```

### Manual Pruning via Direct SQL

**PostgreSQL:**
```sql
-- Preview count before deleting
SELECT COUNT(*) FROM agents_tasks WHERE started_at < '2025-07-12 00:00:00+00';

-- Delete
DELETE FROM agents_tasks WHERE started_at < '2025-07-12 00:00:00+00';
```

**SQLite:**
```sql
-- Preview count
SELECT COUNT(*) FROM agents_tasks WHERE started_at < '2025-07-12 00:00:00';

-- Delete
DELETE FROM agents_tasks WHERE started_at < '2025-07-12 00:00:00';
```

## Retention Policies

**Default Policy (GitHub Actions):**
- **Retention:** 90 days
- **Frequency:** Weekly (Monday 03:15 UTC)

**Custom Policies:**

Adjust retention in `.github/workflows/agents-prune.yml`:

```yaml
# Change from 90 to 30 days
CUTOFF=$(date -u -d '30 days ago' +%FT%TZ)
```

Adjust frequency via cron schedule:

```yaml
schedule:
  - cron: "0 2 * * *"   # Daily at 02:00 UTC
  - cron: "0 3 1 * *"   # Monthly on the 1st at 03:00 UTC
```

## Monitoring

### Check Last Prune Result

View workflow run logs:
1. Go to repository → Actions tab
2. Select "agents-prune" workflow
3. Click latest run to view logs

### Count Historical Records

```bash
# Via API (paged endpoint shows total)
curl "https://api.yourdomain.com/agents/tasks/paged?limit=1" | jq '.items | length'

# Via database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM agents_tasks;"
```

### Age Distribution

```sql
-- PostgreSQL
SELECT
  CASE
    WHEN started_at >= NOW() - INTERVAL '7 days' THEN '0-7 days'
    WHEN started_at >= NOW() - INTERVAL '30 days' THEN '7-30 days'
    WHEN started_at >= NOW() - INTERVAL '90 days' THEN '30-90 days'
    ELSE '90+ days'
  END AS age_bracket,
  COUNT(*) AS count
FROM agents_tasks
GROUP BY age_bracket
ORDER BY age_bracket;

-- SQLite
SELECT
  CASE
    WHEN started_at >= datetime('now', '-7 days') THEN '0-7 days'
    WHEN started_at >= datetime('now', '-30 days') THEN '7-30 days'
    WHEN started_at >= datetime('now', '-90 days') THEN '30-90 days'
    ELSE '90+ days'
  END AS age_bracket,
  COUNT(*) AS count
FROM agents_tasks
GROUP BY age_bracket
ORDER BY age_bracket;
```

## Troubleshooting

### 403 Forbidden Error

**Symptom:** Prune request returns `{"detail": "Forbidden"}`

**Causes:**
1. `ADMIN_API_KEY` not set on server
2. `X-Admin-Key` header doesn't match server key
3. Key contains extra whitespace/newlines

**Fix:**
```bash
# Verify server has key set
docker exec backend env | grep ADMIN_API_KEY

# Test with explicit key
curl -X DELETE "$API_BASE/agents/tasks/before?date=2025-01-01T00:00:00Z" \
  -H "X-Admin-Key: a3f9d8c2b1e4f6a7d9c8b2e1f4a6d8c9b1e3f5a7d9c8b2e1f4a6d8c9b1e3f5a7" \
  -v
```

### GitHub Actions Workflow Fails

**Symptom:** Workflow exits with error

**Common causes:**
1. `API_BASE` variable not set in repository settings
2. `ADMIN_API_KEY` secret not set in repository settings
3. Backend server not reachable from GitHub runners
4. Server `ADMIN_API_KEY` doesn't match workflow secret

**Debugging:**
```bash
# Check workflow environment
echo "API_BASE: $API_BASE"
echo "ADMIN_API_KEY length: ${#ADMIN_API_KEY}"

# Test API connectivity
curl -I "$API_BASE/ready"

# Test with verbose output
curl -v -X DELETE "$API_BASE/agents/tasks/before?date=2025-01-01T00:00:00Z" \
  -H "X-Admin-Key: $ADMIN_API_KEY"
```

### Database Lock Errors (SQLite)

**Symptom:** `sqlite3.OperationalError: database is locked`

**Cause:** Long-running DELETE conflicting with read queries

**Fix:**
1. Enable WAL mode (already configured in backend)
2. Reduce batch size by pruning more frequently
3. Consider migrating to PostgreSQL for production

## Performance

### SQLite

- **Small datasets** (<10,000 rows): Fast, completes in <1 second
- **Large datasets** (>100,000 rows): May take several seconds, can lock database
- **Recommendation:** Prune frequently (weekly) to keep dataset small

### PostgreSQL

- **Optimized:** Uses indexes, minimal locking
- **Large datasets:** Handles millions of rows efficiently
- **Concurrent-safe:** Doesn't block read queries

### Optimization Tips

1. **Prune frequently** - Smaller batches are faster and less disruptive
2. **Run during low-traffic** - Schedule during off-peak hours
3. **Add index** - Ensure `idx_agents_tasks_started_at` exists (created by migration)
4. **Use VACUUM** (SQLite) - Reclaim disk space after large deletes:
   ```bash
   sqlite3 data/rag.sqlite "VACUUM;"
   ```

## API Reference

### DELETE /agents/tasks/before

**Authentication:** `X-Admin-Key` header (required)

**Query Parameters:**
- `date` (datetime, required) - ISO 8601 UTC timestamp (e.g., `2025-07-12T00:00:00Z`)

**Response 200 OK:**
```json
{
  "deleted": 42,
  "cutoff": "2025-07-12T00:00:00Z"
}
```

**Response 403 Forbidden:**
```json
{
  "detail": "Forbidden"
}
```

**Response 422 Unprocessable Entity:**
```json
{
  "detail": [
    {
      "loc": ["query", "date"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

## Migration Reference

### 002_agents_tasks_prune_fn.py

Creates PostgreSQL function `agents_tasks_prune(before_ts timestamptz)`.

**Apply:**
```bash
alembic upgrade head
```

**Rollback:**
```bash
alembic downgrade -1
```

**Note:** SQLite skips this migration (function not supported).

## Security Best Practices

1. **Key Strength:** Use minimum 32 bytes (64 hex chars)
2. **Key Storage:** Store in secrets management (GitHub Secrets, Vault, AWS Secrets Manager)
3. **Key Rotation:** Rotate periodically (quarterly recommended)
4. **Audit Logging:** Monitor prune endpoint access via application logs
5. **Network Security:** Restrict endpoint to internal networks or VPN
6. **HTTPS Only:** Always use HTTPS in production for API calls

## See Also

- [API Reference](API.md#agent-orchestration) - Full agents/tasks API documentation
- [Deploy Guide](DEPLOY.md) - Environment variable configuration
- [Alembic Setup](ALEMBIC_SETUP_COMPLETE.md) - Database migration system
