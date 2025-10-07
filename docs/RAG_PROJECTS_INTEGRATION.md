# RAG Projects Knowledge Integration

This implementation adds project knowledge management to the RAG system, enabling the agent to:
1. Ingest project metadata into the RAG database
2. Update projects via structured JSON API
3. Update projects using natural language commands

## Files Added/Modified

### New Files
- **`assistant_api/routers/rag_projects.py`** - Router with ingest and update endpoints
- **`scripts/rag-ingest-projects.ps1`** - PowerShell script for manual ingestion
- **`data/projects_knowledge.json`** - Structured project knowledge base
- **`tests/test_rag_projects.py`** - Smoke tests for new endpoints (appended)

### Modified Files
- **`assistant_api/main.py`** - Added rag_projects router import and registration

## API Endpoints

### POST `/api/rag/ingest/projects`
Ingests all projects from `data/projects_knowledge.json` into the RAG `chunks` table.

**Response:**
```json
{
  "ok": true,
  "ingested": 5
}
```

### POST `/api/rag/projects/update`
Updates a project via structured JSON and re-ingests.

**Request:**
```json
{
  "slug": "clarity-companion",
  "status": "completed",
  "summary": "Updated summary text"
}
```

**Response:**
```json
{
  "ok": true,
  "updated": "clarity-companion",
  "reingested": 5
}
```

### POST `/api/rag/projects/update_nl`
Updates a project using natural language commands.

**Supported Commands:**
- `"mark clarity-companion completed"`
- `"set pixo-banana-suite as in-progress"`
- `"update summary for ledgermind to \"New summary text\""`
- `"add tag \"Accessibility\" to clarity-companion"`

**Request:**
```json
{
  "instruction": "mark clarity-companion completed"
}
```

## Usage Examples

### Manual Ingestion
```powershell
# Set environment variable (if needed)
$env:RAG_DB = 'D:/leo-portfolio/data/rag_8023.sqlite'

# Run ingestion script
pwsh scripts/rag-ingest-projects.ps1 -Base http://127.0.0.1:8023
```

### Structured Update (curl)
```bash
curl -X POST http://127.0.0.1:8023/api/rag/projects/update \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "clarity-companion",
    "status": "in-progress",
    "summary": "Chrome extension with on-device AI"
  }'
```

### Natural Language Update (curl)
```bash
curl -X POST http://127.0.0.1:8023/api/rag/projects/update_nl \
  -H "Content-Type: application/json" \
  -d '{"instruction": "mark pixo-banana-suite in progress"}'
```

### PowerShell Examples
```powershell
# Structured update
Invoke-RestMethod -Uri "http://127.0.0.1:8023/api/rag/projects/update" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"slug":"clarity-companion","status":"completed"}'

# Natural language update
Invoke-RestMethod -Uri "http://127.0.0.1:8023/api/rag/projects/update_nl" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"instruction":"add tag \"RAG\" to datapipe-ai"}'
```

## Database Schema

The router creates/uses a `chunks` table:

```sql
CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  text TEXT NOT NULL,
  meta TEXT
);
```

Each project is stored as:
- **id**: `project:{slug}` (e.g., `project:ledgermind`)
- **project_id**: The project slug
- **text**: Rich formatted text with all project details
- **meta**: JSON metadata with tags, tech_stack, links, etc.

## Projects Knowledge Structure

The `data/projects_knowledge.json` file contains:
- **slug**: Unique identifier (kebab-case)
- **title**: Display name
- **status**: `"in-progress"` or `"completed"`
- **summary**: Brief description
- **value**: Detailed value proposition
- **tags**: Array of category tags
- **tech_stack**: Array of technologies used
- **key_features**: Array of main features/outcomes
- **links**: Object with demo/repo/site URLs

## Integration with Agent

The agent can now:
1. **Query projects** via existing `/api/rag/query` endpoint (projects are in the corpus)
2. **Update projects** when you say: *"mark Clarity Companion completed"*
3. **Ingest fresh data** on startup or on-demand

## Security Notes

✅ **Token Authentication Implemented!**

All mutation endpoints are now protected with two-path authentication:
- `POST /api/rag/ingest/projects`
- `POST /api/rag/projects/update`
- `POST /api/rag/projects/update_nl`

### Authentication System

**Two Authentication Modes:**

1. **Development Mode** (`ALLOW_TOOLS=1`)
   - Set `ALLOW_TOOLS=1` environment variable
   - No authentication headers needed
   - User logged as `local@dev`
   - **Use only for local development**

2. **Production Mode** (`X-Admin-Token` header)
   - Set `ADMIN_TOKEN` environment variable with secret token
   - Include `X-Admin-Token` header in requests with matching token
   - User logged as `token@admin`
   - **Required for production deployments**

### Usage Examples

#### Development (Local)
```powershell
# Set dev override
$env:ALLOW_TOOLS = "1"

# Start backend
python -m uvicorn assistant_api.main:app --port 8023

# Make request (no auth header needed)
curl -X POST http://localhost:8023/api/rag/ingest/projects
```

#### Production (Token-Based)
```powershell
# Set admin token
$env:ADMIN_TOKEN = "your-secret-token-here"

# Start backend (ALLOW_TOOLS not set)
python -m uvicorn assistant_api.main:app --port 8023

# Make request with token header
curl -X POST http://localhost:8023/api/rag/ingest/projects `
  -H "X-Admin-Token: your-secret-token-here"
```

### Security Behavior
- **Default**: 403 "Admin required" (secure by default)
- **Dev Mode**: Auto-approve with `ALLOW_TOOLS=1`
- **Production**: Validate `X-Admin-Token` against `ADMIN_TOKEN` env
- **No Token**: If `ADMIN_TOKEN` not set, all requests denied (except with dev override)
- **Response Tracking**: All endpoints return `{"by": "user@email"}` to audit who performed action
    return True
```

**See:** `docs/RAG_AUTH_TESTS.md` for complete authentication testing guide.

## Testing

### Functional Tests
Run the smoke test:
```bash
pytest tests/test_rag_projects.py::test_projects_ingest_and_update -v
```

The test verifies:
- ✅ Project ingestion works
- ✅ Structured updates work
- ✅ Natural language updates work
- ✅ Temporary DB isolation works

### Security Tests
Run authentication tests:
```bash
# Backend auth tests
pytest tests/test_rag_projects_auth.py -v

# E2E API tests
npx playwright test tests/e2e/api-rag-admin-gate.spec.ts
```

Security tests verify:
- ✅ Endpoints return 403 without admin access
- ✅ `ALLOW_TOOLS=1` bypasses auth in dev mode
- ✅ `X-Admin-Token` header with `ADMIN_TOKEN` env allows production access
- ✅ Proper error messages returned
- ✅ Read-only endpoints remain accessible
- ✅ Response tracking with user email (`by` field)

**Complete testing guide:** `docs/RAG_AUTH_TESTS.md`

## Current Projects

The knowledge base includes 5 projects:
1. **LedgerMind** (in-progress) - AI finance agent
2. **DataPipe AI** (in-progress) - RAG pipelines
3. **Clarity Companion** (in-progress) - Chrome extension
4. **DermaAI** (completed) - Health UI/UX
5. **Pixo Banana Suite** (in-progress) - Game art toolkit

## Next Steps

1. Test ingestion with running backend
2. Verify queries return project data
3. Try natural language updates via chat interface
4. Add authentication guards for production
5. Monitor RAG query performance with project corpus
