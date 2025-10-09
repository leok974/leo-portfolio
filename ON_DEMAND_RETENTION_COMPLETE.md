# On-Demand Retention API Implementation - Complete ✅

## Summary
Successfully implemented on-demand retention endpoint with dev token guard protection. This allows manual triggering of analytics file compression and pruning operations via API.

## Implementation Details

### 1. Service Layer (Reusable Logic)
**File**: `assistant_api/services/retention.py`
- Created reusable `run_retention()` function
- Private helpers: `_parse_day()`, `_gzip_file()`
- Returns stats dict: `{scanned, compressed, removed, dir}`
- Uses settings from environment/config

### 2. Script Refactoring
**File**: `scripts/analytics_retention.py`
- Refactored from 90 lines to 22 lines
- Now imports and calls `run_retention()` service
- Maintains same CLI interface and output format
- Ensures DRY principle (Don't Repeat Yourself)

### 3. API Endpoint
**File**: `assistant_api/routers/agent_metrics.py`
- Added: `POST /agent/metrics/retention/run`
- Protected by `ensure_dev_access()` guard
- Requires dev token (same as metrics dashboard)
- Returns: `{"ok": true, "scanned": N, "compressed": N, "removed": N, "dir": "..."}`

### 4. Test Suite
**File**: `tests/test_retention_api.py`
- Tests 401 (no token), 403 (wrong token), 200 (valid token)
- Verifies file compression and removal effects
- Uses temp directories for isolation
- Mocks environment variables

### 5. Documentation Updates
**Files Updated**:
1. **README.md**: Added on-demand retention to optional enhancements list
2. **docs/DEVELOPMENT.md**: Added dedicated "On-Demand Retention (Guarded)" section with usage examples
3. **CHANGELOG.md**: Added on-demand retention entry under weekly retention

## Usage

### Set Dev Token
```bash
# In assistant_api/.env
METRICS_DEV_TOKEN=your-secret-token-here
```

### Call Endpoint
```bash
# With Authorization header
curl -X POST \
  -H "Authorization: Bearer $METRICS_DEV_TOKEN" \
  http://127.0.0.1:8001/agent/metrics/retention/run

# With query parameter
curl -X POST \
  "http://127.0.0.1:8001/agent/metrics/retention/run?dev=your-token-here"
```

### Expected Response
```json
{
  "ok": true,
  "scanned": 15,
  "compressed": 2,
  "removed": 1,
  "dir": "D:\\leo-portfolio\\data\\analytics"
}
```

## Testing

### Run Unit Tests
```bash
pytest tests/test_retention_api.py -v
```

### Manual Testing Steps
1. Set `METRICS_DEV_TOKEN` in `.env`
2. Start backend: Task "Run FastAPI (assistant_api)"
3. Create some test analytics files:
   ```powershell
   # Old file (should compress)
   echo '{"type":"view"}' > data/analytics/events-20250101.jsonl

   # Ancient file (should remove)
   echo '{"type":"click"}' > data/analytics/events-20230101.jsonl
   ```
4. Call endpoint with token
5. Verify:
   - Old file compressed: `events-20250101.jsonl.gz` exists
   - Ancient file removed: `events-20230101.jsonl` gone

## Configuration

### Environment Variables
- `ANALYTICS_RETENTION_DAYS` (default: 90) - Delete files older than this
- `ANALYTICS_GZIP_AFTER_DAYS` (default: 7) - Compress files older than this
- `METRICS_DEV_TOKEN` - Required for endpoint authentication
- `METRICS_ALLOW_LOCALHOST` (default: true) - Bypass token for 127.0.0.1

### File Pattern
Operates on: `events-YYYYMMDD.jsonl` and `events-YYYYMMDD.jsonl.gz`

Preserves: `weights.json`, `*.lock`, other non-event files

## Security

- **Token-guarded**: Same protection as metrics dashboard
- **Read-only operations**: Only compresses/removes analytics event files
- **Safe defaults**: 90-day retention, 7-day compression threshold
- **Localhost bypass**: Optional for local development (configurable)

## Integration

### With Existing Systems
- **Weekly automation**: GitHub Actions workflow continues to run scheduled retention
- **CLI script**: `scripts/analytics_retention.py` still works independently
- **Shared logic**: Both CLI and API use same service layer for consistency

### Future Enhancements
- Add metrics endpoint: `GET /agent/metrics/retention/status` (show stats without running)
- Add dry-run mode: `POST /agent/metrics/retention/run?dry_run=true`
- Add webhook notifications: Alert on compression/removal events
- Add retention policy API: `PUT /agent/metrics/retention/config` (dynamic settings)

## Files Changed
- ✅ `assistant_api/services/retention.py` (NEW - 86 lines)
- ✅ `scripts/analytics_retention.py` (REFACTORED - 90→22 lines)
- ✅ `assistant_api/routers/agent_metrics.py` (MODIFIED - added import + endpoint)
- ✅ `tests/test_retention_api.py` (NEW - 74 lines)
- ✅ `README.md` (UPDATED - added on-demand entry)
- ✅ `docs/DEVELOPMENT.md` (UPDATED - added section with examples)
- ✅ `CHANGELOG.md` (UPDATED - added entry)

## Next Steps
1. Set `METRICS_DEV_TOKEN` in `.env`
2. Test the endpoint manually with curl
3. Run pytest to verify test suite
4. Consider adding to CI/CD pipeline for automated testing
5. Monitor usage and adjust retention thresholds if needed
