## Phase 51.0 — Analytics Loop / RAG Insights

**Type**: Feature
**Status**: ✅ Ready for Review
**Branch**: `rag-and-telemetry`

---

### 🎯 Overview

Implements a complete **Analytics Loop** that combines nightly data collection, RAG-based insights, and AI-powered recommendations to provide actionable intelligence about application health.

**Key Components**:
- 🔄 Automated ETL pipeline (Reports → KPIs → Trends → Insights)
- 🧠 RAG integration (local embeddings + SQLite vector store)
- 🤖 AI insights (Ollama with qwen2.5:7b)
- 📊 Anomaly detection (z-score analysis, ±2σ threshold)
- 📝 Auto-generated Markdown reports
- 🔌 FastAPI endpoints (`/analytics/latest`, `/analytics/health`)
- ⚙️ GitHub Actions (nightly workflow + PR comments)

---

### 📦 What's New

#### Core Implementation
- ✨ **Analytics Pipeline** (`analytics/pipeline.py`)
  - Orchestrates data collection, analysis, and reporting
  - CLI: `python -m analytics.pipeline --window-days 7`
  - Developer-friendly output with emojis and progress indicators

- ✨ **Data Collectors** (`analytics/collectors/`)
  - `nightly_loader.py`: Merges JSON reports from SEO/Playwright/Prometheus
  - `kpi_extractor.py`: Extracts 4 core KPIs (SEO %, PW %, P95, autofix Δ)
  - `trend_detector.py`: Z-score anomaly detection over sliding window

- ✨ **RAG Components** (`analytics/rag/`)
  - `embedder_local.py`: Local embeddings via `intfloat/e5-base-v2`
  - `query_engine.py`: SQLite vector store with cosine similarity search
  - Context-aware insights from last 7 days of data

- ✨ **Summarizers** (`analytics/summarizers/`)
  - `insight_llm.py`: AI-generated recommendations using Ollama
  - `report_builder.py`: Markdown report formatting with KPIs, trends, insights

#### API Integration
- ✨ **FastAPI Router** (`assistant_api/routers/analytics_insights.py`)
  - `GET /analytics/latest`: Latest insight report (Markdown + JSON trend)
  - `GET /analytics/health`: System health check
  - Protected by existing `ANALYTICS_ENABLED` flag (defaults to enabled)

#### Automation
- ✨ **Nightly Workflow** (`.github/workflows/analytics-nightly.yml`)
  - Runs at 02:30 UTC daily
  - Uploads artifacts: `analytics-outputs` (30d), `nightly-data` (90d)

- ✨ **PR Comment Workflow** (`.github/workflows/analytics-pr-comment.yml`)
  - Posts sticky PR comments with latest insights
  - Falls back to informative message if no report available

#### Developer Tools
- ✨ **PowerShell Script** (`scripts/analytics.ps1`)
  - Local pipeline runner with colored output
  - Usage: `.\scripts\analytics.ps1 -WindowDays 7`

- ✨ **Makefile Target**
  - `make analytics`: One-command pipeline execution

#### Documentation
- 📚 **Complete Guide** (`PHASE_51.0_COMPLETE.md`)
- 🚀 **Quick Start** (`PHASE_51.0_QUICKSTART.md`)
- 📊 **Summary** (`PHASE_51.0_SUMMARY.md`)
- 📖 **API Docs** (`docs/API.md` - analytics section)
- 📝 **Changelog** (`CHANGELOG.md` - Phase 51.0 entry)

#### Sample Data
- 📄 **Seed Reports** (`reports/{seo,playwright,prometheus}/sample-2025-10-09.json`)
  - Enables first-run testing without waiting for nightly workflow

---

### 🔧 Technical Details

**Dependencies** (already in `requirements.txt`):
- `sentence-transformers==5.1.1` (embeddings)
- `faiss-cpu==1.12.0` (vector similarity)
- `numpy==2.3.3`, `pandas==2.2.2`, `scikit-learn==1.7.2`
- `openai>=1.40.0` (Ollama client)

**Environment Variables** (all optional):
```bash
ANALYTICS_ENABLED=true              # Enable endpoints (default: true)
OPENAI_BASE_URL=http://...          # Ollama endpoint (default: localhost:11434)
OPENAI_MODEL=qwen2.5:7b-instruct... # Model name
```

**Artifacts Generated** (git-ignored):
```
analytics/
├── rag/vector_store.sqlite
├── outputs/insight-summary.md
└── outputs/trend-report.json

data/nightly/*.json
```

**Idempotency**:
- ✅ Safe to re-run pipeline on same date (updates in-place)
- ✅ RAG index is additive (can re-index without data loss)
- ✅ API endpoints return cached reports (no side effects)

---

### 🧪 Testing

#### Manual Testing
```bash
# 1. Install dependencies
pip install -r assistant_api/requirements.txt

# 2. Start Ollama (if not running)
ollama serve

# 3. Run pipeline locally
make analytics

# 4. View reports
code analytics/outputs/insight-summary.md
cat analytics/outputs/trend-report.json | jq .

# 5. Test API endpoints
curl http://localhost:8010/analytics/latest | jq .status
curl http://localhost:8010/analytics/health | jq .
```

#### Expected Behavior
- ✅ Pipeline completes in <30 seconds (first run may take longer for model download)
- ✅ `insight-summary.md` contains KPIs, trends, and AI insight
- ✅ `trend-report.json` has valid JSON with series and anomalies
- ✅ API returns `status: "ok"` when reports exist
- ✅ API returns `status: "pending"` when reports not yet generated

#### Edge Cases Handled
- 🛡️ No nightly data → Uses sample data from `reports/`
- 🛡️ Ollama unavailable → Generates fallback insight with error message
- 🛡️ < 3 data points → Trend detection skips anomaly flagging
- 🛡️ RAG index fails → Pipeline continues without context retrieval

---

### 📊 Files Changed

#### Added (30 files)
```
analytics/
  __init__.py
  pipeline.py                              (170 lines)
  collectors/
    __init__.py
    nightly_loader.py                      (100 lines)
    kpi_extractor.py                       (90 lines)
    trend_detector.py                      (120 lines)
  rag/
    __init__.py
    embedder_local.py                      (45 lines)
    query_engine.py                        (180 lines)
  summarizers/
    __init__.py
    insight_llm.py                         (110 lines)
    report_builder.py                      (95 lines)
  outputs/.gitkeep

assistant_api/routers/analytics_insights.py  (100 lines)

.github/workflows/
  analytics-nightly.yml                    (60 lines)
  analytics-pr-comment.yml                 (55 lines)

scripts/analytics.ps1                      (45 lines)

reports/
  seo/sample-2025-10-09.json
  playwright/sample-2025-10-09.json
  prometheus/sample-2025-10-09.json

data/nightly/.gitkeep

docs/
  PHASE_51.0_COMPLETE.md                   (650 lines - comprehensive guide)
  PHASE_51.0_QUICKSTART.md                 (200 lines - 5-min setup)
  PHASE_51.0_SUMMARY.md                    (450 lines - implementation summary)
```

#### Modified (4 files)
```
assistant_api/main.py                      (+7 lines - router registration)
.gitignore                                 (+6 lines - analytics patterns)
Makefile                                   (+7 lines - analytics target)
CHANGELOG.md                               (+25 lines - Phase 51.0 entry)
docs/API.md                                (+85 lines - analytics endpoints)
```

**Total**: ~2,500+ lines of production code + documentation

---

### 🎬 Demo

**Run Pipeline**:
```bash
$ make analytics

🚀 Phase 51.0 — Analytics Pipeline Starting...
📅 Processing date: 2025-10-09
📦 Loading nightly reports...
   ✓ Loaded 3 source files
📊 Extracting KPIs...
   ✓ Extracted 4 KPIs
      - seo_coverage_pct: 91.67
      - playwright_pass_pct: 95.56
      - avg_p95_ms: 687.43
      - autofix_delta_count: 0
📈 Detecting trends (window: 7 days)...
   ✓ Analyzed 1 data points
   ✓ No anomalies detected
🧠 Initializing RAG embeddings...
   ✓ RAG index updated
💡 Generating AI insight...
   ✓ Insight generated
📝 Writing reports...
   ✓ Wrote analytics/outputs/insight-summary.md
   ✓ Wrote analytics/outputs/trend-report.json
✅ Analytics pipeline completed successfully!
```

**Sample Insight** (excerpt):
```markdown
# Nightly Analytics — 2025-10-09

## 📊 KPIs
- **SEO Coverage %**: `91.67`
- **Playwright Pass Rate %**: `95.56`
- **Avg P95 Latency (ms)**: `687.4`
- **Autofix Changes**: `0`

## 📈 Trends
✅ No significant anomalies detected (all metrics within 2σ).

## 🧠 AI Insight
Current metrics indicate healthy system stability. SEO coverage
remains above the 90% target...

**Next Actions:**
- Fix title length on /public/metrics.html
- Investigate popover timeout
- Profile /api/seo/tune for optimization
```

---

### ✅ Checklist

#### Pre-Merge
- [x] All files created and tested locally
- [x] Pipeline runs end-to-end successfully
- [x] Sample data produces valid reports
- [x] API endpoints return expected responses
- [x] PowerShell script works on Windows
- [x] Makefile target works
- [x] Documentation is comprehensive
- [x] .gitignore excludes generated artifacts
- [x] Changelog updated
- [x] API docs updated

#### Post-Merge
- [ ] Verify nightly workflow runs successfully
- [ ] Check PR comment workflow on first PR
- [ ] Configure GitHub Actions secrets (if using remote Ollama)
- [ ] Monitor first week of trend data accumulation
- [ ] Review first AI-generated insights for quality
- [ ] Add unit tests for collectors
- [ ] Add E2E tests for API endpoints

---

### 🚀 Deployment Notes

**Production Setup**:
1. Install Ollama on server: `curl -fsSL https://ollama.com/install.sh | sh`
2. Pull model: `ollama pull qwen2.5:7b-instruct-q4_K_M`
3. Start service: `ollama serve` (or systemd unit)
4. Merge this PR
5. Nightly workflow runs automatically at 02:30 UTC

**Optional GitHub Secrets**:
- `OPENAI_BASE_URL`: Remote Ollama endpoint (if not local)
- `OPENAI_API_KEY`: API key (if using OpenAI instead of Ollama)

---

### 📚 Further Reading

- **Architecture**: See `PHASE_51.0_COMPLETE.md` § Architecture
- **RAG Deep Dive**: See `PHASE_51.0_COMPLETE.md` § RAG Components
- **API Reference**: See `docs/API.md` § Analytics Insights
- **Troubleshooting**: See `PHASE_51.0_QUICKSTART.md` § Troubleshooting

---

### 🔗 Related Issues

- Closes #XXX (Analytics Loop feature request)
- Related to Phase 50.9 (SEO Intelligence)
- Builds on Phase 50.8 (Behavior Metrics)

---

**Ready for review!** 🎉

cc @reviewers Please focus on:
- [ ] Pipeline orchestration logic (`analytics/pipeline.py`)
- [ ] FastAPI endpoint security (guard by flag)
- [ ] GitHub Actions workflow syntax
- [ ] Documentation clarity

---

*Generated with Phase 51.0 Analytics Loop / RAG Insights*
