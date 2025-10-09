# Phase 51.0 — Analytics Loop / RAG Insights

**Status**: ✅ Complete
**Date**: October 9, 2025
**Branch**: rag-and-telemetry

## Overview

Phase 51.0 introduces an **Analytics Loop** that combines nightly data collection, RAG-based context retrieval, and AI-powered insights to provide actionable intelligence about your application's health.

### Key Features

- 🔄 **Automated Pipeline**: Nightly collection and analysis of SEO, Playwright, and Prometheus metrics
- 🧠 **RAG Integration**: Context-aware insights using local embeddings (`intfloat/e5-base-v2`)
- 📊 **Anomaly Detection**: Z-score analysis to flag significant metric changes
- 🤖 **AI Insights**: LLM-generated recommendations using local Ollama (gpt-oss-20b compatible)
- 📝 **Auto-Reports**: Markdown summaries with KPIs, trends, and actionable next steps
- 🔌 **FastAPI Endpoints**: `/analytics/latest` and `/analytics/health` for programmatic access

## Architecture

```
reports/
  ├── seo/*.json          → SEO intelligence data
  ├── playwright/*.json   → E2E test results
  └── prometheus/*.json   → Performance metrics

          ↓ Nightly Loader

data/nightly/YYYY-MM-DD.json  (merged daily snapshot)

          ↓ Pipeline Components

┌─────────────────┬──────────────┬──────────────────┐
│ KPI Extractor   │ Trend Detect │ RAG Embeddings  │
│  - SEO cov %    │  - Z-score   │  - E5 model     │
│  - PW pass %    │  - Anomalies │  - SQLite store │
│  - P95 latency  │  - μ/σ calc  │  - Cosine sim   │
│  - Autofix Δ    │              │                 │
└─────────────────┴──────────────┴──────────────────┘

          ↓ Insight LLM (Ollama)

analytics/outputs/
  ├── insight-summary.md  (Human-readable report)
  └── trend-report.json   (Machine-readable data)
```

## Components

### 1. Data Collectors

#### `analytics/collectors/nightly_loader.py`
- Merges JSON reports from `reports/seo/`, `reports/playwright/`, `reports/prometheus/`
- Auto-discovers files by date pattern or falls back to latest
- Outputs to `data/nightly/YYYY-MM-DD.json`

#### `analytics/collectors/kpi_extractor.py`
Extracts 4 core KPIs:
- **SEO Coverage %**: Percentage of pages passing SEO checks
- **Playwright Pass Rate %**: E2E test success rate
- **Avg P95 Latency (ms)**: Average 95th percentile response time
- **Autofix Delta Count**: Number of autofix changes needed

#### `analytics/collectors/trend_detector.py`
- Analyzes last N days (default: 7)
- Calculates mean (μ) and standard deviation (σ) for each KPI
- Flags anomalies where |z-score| ≥ 2.0
- Returns `Trend` dataclass with series and anomalies

### 2. RAG Components

#### `analytics/rag/embedder_local.py`
- Uses SentenceTransformers with `intfloat/e5-base-v2` model
- Generates normalized embeddings for text snippets
- Cached with `@lru_cache` for efficiency

#### `analytics/rag/query_engine.py`
- **VectorStore**: SQLite-based vector database
- **Indexing**: Converts daily KPI snippets into embeddings
- **Search**: Cosine similarity retrieval (top-K results)
- **Schema**: `vectors(id, d DATE, text TEXT, embedding BLOB)`

### 3. Summarizers

#### `analytics/summarizers/insight_llm.py`
- Generates AI insights using local Ollama endpoint
- **Model**: `qwen2.5:7b-instruct-q4_K_M` (configurable via `OPENAI_MODEL`)
- **Prompt Engineering**: KPIs + trends + RAG context → concise Markdown
- **Temperature**: 0.2 (factual, deterministic)
- **Fallback**: Returns structured error message if LLM unavailable

#### `analytics/summarizers/report_builder.py`
- Combines KPIs, trends, and LLM insights into Markdown report
- **Format**: `insight-summary.md` (human-readable)
- **Trend Emojis**: 🔴 (z ≥ 3.0), 🟡 (2.0 ≤ z < 3.0), ✅ (normal)
- **Metadata**: Timestamp, date, field formatting

### 4. Pipeline Orchestrator

#### `analytics/pipeline.py`
Main entry point that ties all components together:

```bash
python -m analytics.pipeline --window-days 7
```

**Execution Flow**:
1. Load nightly data for target date
2. Extract KPIs
3. Detect trends across window
4. Initialize RAG embedder and vector store
5. Index recent daily snippets
6. Generate LLM insight with RAG context
7. Write Markdown and JSON reports

**Options**:
- `--date YYYY-MM-DD`: Process specific date (defaults to today UTC)
- `--window-days N`: Trend analysis window (default: 7)

## FastAPI Integration

### Endpoints

#### `GET /analytics/latest`
Returns the most recent analytics report.

**Response (success)**:
```json
{
  "status": "ok",
  "markdown": "# Nightly Analytics — 2025-10-09\n\n...",
  "trend": {
    "window_days": 7,
    "series": [...],
    "anomalies": [...]
  }
}
```

**Response (pending)**:
```json
{
  "status": "pending",
  "message": "No analytics report available yet. Run: python -m analytics.pipeline"
}
```

#### `GET /analytics/health`
System health check.

**Response**:
```json
{
  "status": "healthy",
  "reports": {
    "insight_available": true,
    "trend_available": true
  },
  "rag": {
    "index_exists": true
  },
  "data": {
    "daily_files_count": 7,
    "latest_date": "2025-10-09"
  }
}
```

### Router Registration

```python
# assistant_api/main.py
if ANALYTICS_ENABLED:
    from assistant_api.routers import analytics_insights
    app.include_router(analytics_insights.router)
```

Protected by existing `ANALYTICS_ENABLED` flag (defaults to `true`).

## GitHub Actions

### Nightly Workflow

**File**: `.github/workflows/analytics-nightly.yml`

**Trigger**: Cron at 02:30 UTC daily (+ manual dispatch)

**Steps**:
1. Checkout repository
2. Setup Python 3.11
3. Install dependencies from `assistant_api/requirements.txt`
4. Download previous reports (if available)
5. Run pipeline: `python -m analytics.pipeline --window-days 7`
6. Upload artifacts: `analytics/outputs/`, `data/nightly/`

**Artifacts**:
- `analytics-outputs`: Insight reports (retention: 30 days)
- `nightly-data`: Daily snapshots (retention: 90 days)

### PR Comment Workflow

**File**: `.github/workflows/analytics-pr-comment.yml`

**Trigger**: Pull request events (opened, synchronize, reopened)

**Behavior**:
- Downloads latest analytics outputs from nightly workflow
- Posts sticky PR comment with insight summary
- Falls back to informative message if no report available yet

**Example Comment**:
```markdown
### 🧠 Analytics Insight

# Nightly Analytics — 2025-10-09

## 📊 KPIs

- **SEO Coverage %**: `91.67`
- **Playwright Pass Rate %**: `95.56`
- **Avg P95 Latency (ms)**: `687.4`
- **Autofix Changes**: `0`

## 📈 Trends

✅ No significant anomalies detected (all metrics within 2σ).

## 🧠 AI Insight

Current metrics show healthy stability across all dimensions...

---
*Auto-generated by [Analytics Nightly](...)*
```

## Environment Variables

### Required
- `ANALYTICS_ENABLED`: Enable analytics endpoints (default: `true`)

### Optional (LLM Configuration)
- `OPENAI_BASE_URL`: Ollama endpoint (default: `http://127.0.0.1:11434/v1`)
- `OPENAI_API_KEY`: API key (default: `not-needed` for local Ollama)
- `OPENAI_MODEL`: Model name (default: `qwen2.5:7b-instruct-q4_K_M`)

## Developer Workflows

### Local Pipeline Run

**PowerShell**:
```powershell
.\scripts\analytics.ps1
.\scripts\analytics.ps1 -WindowDays 14
.\scripts\analytics.ps1 -Date "2025-10-09" -WindowDays 7
```

**Makefile**:
```bash
make analytics
```

**Direct Python**:
```bash
python -m analytics.pipeline --window-days 7
python -m analytics.pipeline --date 2025-10-09 --window-days 14
```

### View Reports

**Markdown Summary**:
```bash
code analytics/outputs/insight-summary.md
cat analytics/outputs/insight-summary.md
```

**JSON Trends**:
```bash
jq . analytics/outputs/trend-report.json
```

### Test API Endpoints

**Latest Insight**:
```bash
curl http://localhost:8001/analytics/latest | jq .
```

**Health Check**:
```bash
curl http://localhost:8001/analytics/health | jq .
```

## Sample Data

For first-run testing, seed data is provided in `reports/`:
- `seo/sample-2025-10-09.json`: 12 pages, 91.67% coverage
- `playwright/sample-2025-10-09.json`: 45 tests, 95.56% pass rate
- `prometheus/sample-2025-10-09.json`: 7 route metrics

**Generate Initial Report**:
```bash
python -m analytics.pipeline
```

This will:
1. Merge sample reports into `data/nightly/2025-10-09.json`
2. Extract KPIs
3. Attempt trend detection (may have insufficient data for first run)
4. Generate `analytics/outputs/insight-summary.md`

## Files Added

### Core Implementation
- `analytics/__init__.py`
- `analytics/pipeline.py`
- `analytics/collectors/__init__.py`
- `analytics/collectors/nightly_loader.py`
- `analytics/collectors/kpi_extractor.py`
- `analytics/collectors/trend_detector.py`
- `analytics/rag/__init__.py`
- `analytics/rag/embedder_local.py`
- `analytics/rag/query_engine.py`
- `analytics/summarizers/__init__.py`
- `analytics/summarizers/insight_llm.py`
- `analytics/summarizers/report_builder.py`

### API Integration
- `assistant_api/routers/analytics_insights.py`

### Automation
- `.github/workflows/analytics-nightly.yml`
- `.github/workflows/analytics-pr-comment.yml`

### Developer Tools
- `scripts/analytics.ps1`
- `Makefile` (added `analytics` target)

### Sample Data
- `reports/seo/sample-2025-10-09.json`
- `reports/playwright/sample-2025-10-09.json`
- `reports/prometheus/sample-2025-10-09.json`

### Documentation
- `CHANGELOG.md` (Phase 51.0 entry)
- `docs/API.md` (Analytics endpoints section)

### Configuration
- `.gitignore` (analytics artifacts patterns)

## Testing Strategy

### Unit Tests
Create `tests/test_analytics_pipeline.py`:
```python
from analytics.collectors.kpi_extractor import extract_kpis

def test_kpi_extraction():
    merged = {
        "seo": {"totals": {"total": 10, "passed": 9}},
        "playwright": {"totals": {"total": 50, "passed": 48}},
    }
    kpis = extract_kpis(merged)
    assert kpis["seo_coverage_pct"] == 90.0
    assert kpis["playwright_pass_pct"] == 96.0
```

### Integration Tests
```python
def test_pipeline_end_to_end(tmp_path):
    from analytics.pipeline import run
    # Use tmp_path for isolated test run
    # Verify outputs created
```

### E2E Tests
Add to `tests/e2e/analytics.spec.ts`:
```typescript
test("GET /analytics/latest returns report", async ({ request }) => {
  const resp = await request.get("/analytics/latest");
  const json = await resp.json();
  expect(json.status).toMatch(/ok|pending/);
});
```

## Production Deployment

### Ollama Setup (Recommended)

1. **Install Ollama**:
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```

2. **Pull Model**:
   ```bash
   ollama pull qwen2.5:7b-instruct-q4_K_M
   ```

3. **Run Service**:
   ```bash
   ollama serve
   ```

4. **Configure Environment**:
   ```bash
   export OPENAI_BASE_URL=http://127.0.0.1:11434/v1
   export OPENAI_MODEL=qwen2.5:7b-instruct-q4_K_M
   ```

### GitHub Actions Setup

1. **Configure Secrets** (if using remote Ollama):
   - `OPENAI_BASE_URL`: Remote Ollama endpoint
   - `OPENAI_API_KEY`: API key (if required)

2. **Configure Variables**:
   - `OPENAI_MODEL`: Model name override

3. **Enable Workflows**:
   - Both workflows are enabled by default on merge to main

### Monitoring

Check workflow runs:
```bash
gh run list --workflow=analytics-nightly.yml
gh run view <run-id>
```

Download artifacts:
```bash
gh run download <run-id> --name analytics-outputs
```

## Troubleshooting

### Pipeline Fails: "No reports found"
- **Cause**: `reports/` directory empty
- **Fix**: Run SEO nightly workflow first, or use sample data
- **Verify**: `ls reports/*/sample-*.json`

### LLM Connection Error
- **Cause**: Ollama service not running
- **Fix**: `ollama serve` in separate terminal
- **Test**: `curl http://127.0.0.1:11434/v1/models`

### RAG Indexing Slow
- **Cause**: Large embedding model download on first run
- **Fix**: Pre-download with `huggingface-cli download intfloat/e5-base-v2`
- **Cache**: Models cached in `~/.cache/huggingface/`

### Anomaly Detection False Positives
- **Cause**: Insufficient historical data (< 3 days)
- **Fix**: Wait for more daily files to accumulate
- **Adjust**: Increase z-score threshold in `trend_detector.py`

### GitHub Actions Artifact Not Found
- **Cause**: Nightly workflow hasn't run yet
- **Fix**: Manually trigger: `gh workflow run analytics-nightly.yml`
- **Verify**: Check workflow status in Actions tab

## Next Steps

### Enhancements
1. **Custom KPIs**: Add domain-specific metrics (e.g., conversion rate, error rate)
2. **Alert Thresholds**: Slack/email notifications for critical anomalies
3. **Interactive Dashboards**: Grafana integration for time-series visualization
4. **Multi-Model Support**: Compare insights from different LLMs
5. **Feedback Loop**: Track which recommendations were acted upon

### Integration Points
- **Behavior Metrics**: Incorporate user engagement KPIs
- **CI/CD Gates**: Block merges if KPIs regress significantly
- **Status Page**: Public-facing health snapshot

## References

- [SentenceTransformers Documentation](https://www.sbert.net/)
- [Ollama Model Library](https://ollama.com/library)
- [E5 Embeddings Paper](https://arxiv.org/abs/2212.03533)
- [FastAPI Router Docs](https://fastapi.tiangolo.com/tutorial/bigger-applications/)

---

**Phase 51.0 Complete** ✅
*Nightly analytics with RAG-powered insights*
