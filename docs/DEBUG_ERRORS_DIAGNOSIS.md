# DEBUG_ERRORS Feature - Diagnosis Summary

## Overview

Implemented a development-only feature to surface detailed error messages when debugging 500 errors in the RAG admin endpoints.

## Problem

Token authentication was returning 500 errors instead of 200 on successful requests. The authentication gates were working correctly (403 without token), but the business logic was failing.

## Solution: DEBUG_ERRORS Flag

Added a `DEBUG_ERRORS` environment variable that, when set to `"1"`, returns detailed exception information in HTTP 500 responses.

### Implementation

```python
# assistant_api/routers/rag_projects.py

DEBUG_ERRORS = os.environ.get("DEBUG_ERRORS", "0") == "1"

@router.post("/ingest/projects")
def ingest_projects(user=Depends(_require_admin)):
    try:
        data = _load_projects()
        n = _ingest_projects(data)
        return {"ok": True, "ingested": n, "by": user.get("email")}
    except Exception as e:
        if DEBUG_ERRORS:
            raise HTTPException(
                status_code=500,
                detail=f"ingest failed: {type(e).__name__}: {e}"
            )
        raise
```

## Diagnosis Results

### Error Found
```json
{
  "detail": "ingest failed: IntegrityError: datatype mismatch"
}
```

### Root Cause
- **Issue**: SQLite `IntegrityError` with datatype mismatch
- **Cause**: Old database file (`rag_8023.sqlite`) had incompatible schema from previous version
- **Impact**: INSERT/UPDATE operations failed due to column type conflicts

### Fix Applied
1. Backed up old database: `rag_8023.sqlite.backup-YYYYMMDD-HHMMSS`
2. Removed old database file
3. Server created fresh database with correct schema
4. Re-ran ingest: **✅ SUCCESS** (ingested 5 projects)

## Usage

### Enable DEBUG_ERRORS (Development Only)

```powershell
# PowerShell
$env:DEBUG_ERRORS = '1'
$env:ADMIN_TOKEN = 'use-a-long-random-string'
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8023
```

### Disable for Production

```powershell
# Remove or set to 0
$env:DEBUG_ERRORS = '0'
# Or simply don't set it (defaults to "0")
```

## Error Types Surfaced

With `DEBUG_ERRORS=1`, you can diagnose:
- `FileNotFoundError` - Missing files (projects_knowledge.json, etc.)
- `sqlite3.OperationalError` - Database connection/access issues
- `sqlite3.IntegrityError` - Schema mismatches, constraint violations
- `JSONDecodeError` - Malformed JSON in data files
- `KeyError` - Missing required fields in data structures
- Any other Python exceptions in the endpoint logic

## Security Note

⚠️ **Never enable `DEBUG_ERRORS` in production!**

It exposes:
- Internal file paths
- Database error details
- Stack trace information
- Implementation details

This is for **development and testing only**.

## Test Results

After fixing the database issue:

| Test | Status |
|------|--------|
| Backend auth tests | ✅ 5/5 passing |
| E2E security tests | ✅ 3/3 passing |
| Token authentication | ✅ Working |
| Database ingestion | ✅ Working |
| Security gates | ✅ 403 without token |

## Files Modified

1. `assistant_api/routers/rag_projects.py`
   - Added `DEBUG_ERRORS` flag
   - Wrapped `ingest_projects()` endpoint
   - Wrapped `update_project()` endpoint

## Recommendation

**Keep this feature** for future debugging:
- Enable when investigating 500 errors
- Disable in production deployment
- Document in ops/troubleshooting guides
