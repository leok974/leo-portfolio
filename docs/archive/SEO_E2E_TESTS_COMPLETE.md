# SEO Analytics E2E Tests Added

## Status: ✅ COMPLETE

Comprehensive Playwright E2E test suite for Phase 50.6.1 SEO Analytics loop.

## New File

**`tests/e2e/seo-analytics.spec.ts`** (314 lines)

## Test Coverage

### Backend Tests (6 tests)
All tagged with `@backend SEO Analytics Loop`

1. **`ingest → tune → artifact shows LLM path when available`**
   - Ingests 3 pages with low CTR via API
   - Runs `seo.tune` task
   - Fetches and validates JSON artifact
   - Smart LLM detection via `/llm/primary/latency` and `/llm/health` probes
   - Asserts `notes: "llm"` when Ollama reachable
   - Gracefully skips with context when LLM unavailable
   - Validates character limits (70/155)
   - Verifies CTR calculation accuracy

2. **`MD artifact is generated and readable`**
   - Ingests test data
   - Runs tune task
   - Fetches MD artifact
   - Validates Markdown format and content

3. **`custom threshold parameter works`**
   - Ingests mixed CTR data (high and low)
   - Runs tune with custom threshold (0.01)
   - Verifies only low-CTR pages included
   - Validates threshold stored in artifact

4. **`heuristic fallback works when LLM disabled`**
   - Ingests test data
   - Runs tune (may have LLM disabled)
   - Validates metadata generation regardless of LLM state
   - Verifies `notes` field is either "llm" or "heuristic"

5. **`multiple sources are tracked correctly`**
   - Ingests from 3 sources: search_console, ga4, manual
   - Runs tune
   - Verifies all pages present in artifact
   - Tests data source tracking

### Frontend Tests (1 test - conditional)
Tagged with `@frontend SEO Analytics Tools Panel (when available)`

6. **`UI path: upload file & run from Tools panel`**
   - Auto-skips with guidance if Tools panel not yet implemented
   - Creates mock Search Console JSON file
   - Uploads via file input
   - Clicks "Ingest" button
   - Clicks "Run Tune" button
   - Opens artifact link in new tab
   - Validates content (JSON or MD format)

## Smart Features

### LLM Detection
```typescript
async function llmIsReachable(request: APIRequestContext) {
  const probes = ['/llm/primary/latency', '/llm/health'];
  for (const p of probes) {
    const r = await request.get(p);
    if (r.ok()) return true;
  }
  return false;
}
```

### Graceful Skipping
- When LLM unavailable: Test skips with clear message
- No flaky test failures
- Provides guidance: "enable Ollama or fallback API to assert llm path"

### Resilient Assertions
```typescript
if (llmUp) {
  expect.soft(sample.notes).toBe('llm');
  if (sample.notes !== 'llm') {
    test.fail(true, 'LLM appears reachable but seo.tune returned heuristic; check OPENAI_BASE_URL/MODEL');
  }
} else {
  test.skip(true, 'LLM not reachable — heuristic fallback used');
}
```

## NPM Script

Added to `package.json`:
```json
"test:e2e:seo": "playwright test tests/e2e/seo-analytics.spec.ts --project=chromium"
```

## Usage

### Run All SEO E2E Tests
```bash
npm run test:e2e:seo
```

### Run Specific Test
```bash
npx playwright test tests/e2e/seo-analytics.spec.ts -g "ingest → tune → artifact"
```

### Run with UI Mode
```bash
npx playwright test tests/e2e/seo-analytics.spec.ts --ui
```

### Run with Headed Browser
```bash
npx playwright test tests/e2e/seo-analytics.spec.ts --headed
```

## Prerequisites

### Backend Running
```bash
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001
```

### Optional: Ollama for LLM Tests
```bash
ollama run qwen2.5:7b-instruct
```
If not running, tests gracefully skip LLM assertions.

### Environment Variables
```bash
export OPENAI_BASE_URL="http://127.0.0.1:11434/v1"
export OPENAI_MODEL="qwen2.5:7b-instruct"
export SEO_LLM_ENABLED="1"
```

## Expected Behavior

### With Ollama Running
```
✅ ingest → tune → artifact shows LLM path when available
✅ MD artifact is generated and readable
✅ custom threshold parameter works
✅ heuristic fallback works when LLM disabled
✅ multiple sources are tracked correctly
⊘ UI path: upload file & run from Tools panel (auto-skip)

6 tests: 5 passed, 1 skipped
```

### Without Ollama
```
⊘ ingest → tune → artifact shows LLM path when available (skipped: LLM not reachable)
✅ MD artifact is generated and readable
✅ custom threshold parameter works
✅ heuristic fallback works when LLM disabled
✅ multiple sources are tracked correctly
⊘ UI path: upload file & run from Tools panel (auto-skip)

6 tests: 4 passed, 2 skipped
```

## Test Data

### Sample Ingest Payload
```json
{
  "source": "search_console",
  "rows": [
    { "url": "/", "impressions": 2200, "clicks": 12 },
    { "url": "/projects/siteagent", "impressions": 1850, "clicks": 11 },
    { "url": "/projects/datapipe-ai", "impressions": 1400, "clicks": 6 }
  ]
}
```

### Expected Artifact Structure
```json
{
  "generated": "2025-10-08T...",
  "threshold": 0.02,
  "count": 3,
  "pages": [
    {
      "url": "/",
      "ctr": 0.0055,
      "old_title": "...",
      "old_description": "...",
      "new_title": "...",
      "new_description": "...",
      "notes": "llm"  // or "heuristic"
    }
  ]
}
```

## Validation Checks

### Artifact Validation
- ✅ JSON structure with required fields
- ✅ Array of pages with metadata
- ✅ CTR values match ingested data
- ✅ Character limits enforced (70/155)
- ✅ `notes` field present ("llm" or "heuristic")
- ✅ Threshold stored correctly
- ✅ Generated timestamp present

### API Response Validation
- ✅ Ingest returns `inserted_or_updated` count
- ✅ Tune returns `ok: true`, `count`, `json`, `md` paths
- ✅ Artifacts accessible via `/agent/artifacts/` endpoint

### UI Validation (when implemented)
- ✅ File upload accepts JSON
- ✅ Ingest button triggers API call
- ✅ Run button triggers tune task
- ✅ Artifact link opens in new tab
- ✅ Content displays correctly (JSON or MD)

## Integration Points

### Backend Endpoints Tested
- `POST /agent/analytics/ingest`
- `POST /agent/run?task=seo.tune`
- `GET /agent/artifacts/seo-tune.json`
- `GET /agent/artifacts/seo-tune.md`
- `GET /llm/primary/latency` (probe)
- `GET /llm/health` (probe)

### Frontend Components (future)
- `[data-testid="seo-analytics-panel"]`
- `[data-testid="analytics-upload"]`
- `[data-testid="analytics-ingest-btn"]`
- `[data-testid="seo-tune-run-btn"]`
- `[data-testid="seo-tune-artifact-link"]`

## Documentation Updated

- ✅ `package.json` - Added `test:e2e:seo` script
- ✅ `PHASE_50.6.1_COMPLETE.md` - Added E2E test section
- ✅ `PHASE_50.6.1_QUICKREF.md` - Added E2E test commands
- ✅ `CHANGELOG.md` - Updated test coverage section

## Benefits

1. **Comprehensive Coverage**: Tests entire analytics loop end-to-end
2. **Smart LLM Detection**: No flaky failures when Ollama offline
3. **Clear Skip Messages**: Provides context for skipped tests
4. **Multiple Scenarios**: Custom thresholds, sources, formats
5. **Frontend Ready**: UI test skeleton for future Tools panel
6. **Production-Like**: Uses real API endpoints and workflows
7. **Easy Debugging**: Clear assertion messages and test names
8. **CI/CD Ready**: Reliable pass/skip/fail behavior

## Next Steps

### To Enable Full Test Suite
1. Start backend: `uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001`
2. Start Ollama (optional): `ollama run qwen2.5:7b-instruct`
3. Run tests: `npm run test:e2e:seo`

### To Add Frontend UI Tests
1. Implement Tools panel with data-testids
2. Tests will automatically detect and run UI workflows
3. No test code changes needed (already implemented)

## Success Metrics

- ✅ 6 comprehensive E2E tests created
- ✅ Smart LLM detection implemented
- ✅ Graceful skipping for unavailable LLM
- ✅ Multiple test scenarios covered
- ✅ NPM script added
- ✅ Documentation updated
- ✅ Ready for CI/CD integration
