# Phase 50.6.1 Quick Reference

## 🎯 What Was Built
LLM-based SEO metadata rewriting with graceful fallback (Primary LLM → Fallback LLM → Heuristic)

## 📦 New Files
```
assistant_api/llm/
  __init__.py
  seo_rewriter.py          # LLM adapter with 3-tier fallback

tests/
  test_seo_llm_fallback.py # Graceful degradation tests

test-seo-llm.ps1           # Manual smoke test script

PHASE_50.6.1_COMPLETE.md   # Full implementation docs
```

## ⚙️ Configuration

### Environment Variables
```bash
# LLM Control
SEO_LLM_ENABLED=1          # Enable LLM rewriting (default: true)
SEO_LLM_TIMEOUT=9.0        # Timeout in seconds (default: 9.0)

# Primary Endpoint (Ollama)
OPENAI_BASE_URL="http://127.0.0.1:11434/v1"
OPENAI_MODEL="qwen2.5:7b-instruct"
OPENAI_API_KEY=""          # Optional for Ollama

# Fallback Endpoint (OpenAI)
FALLBACK_BASE_URL="https://api.openai.com/v1"
FALLBACK_MODEL="gpt-4o-mini"
FALLBACK_API_KEY="sk-..."
```

## 🚀 Quick Start

### 1. With Ollama (Recommended)
```powershell
# Start Ollama
ollama run qwen2.5:7b-instruct

# Configure
$env:OPENAI_BASE_URL = "http://127.0.0.1:11434/v1"
$env:OPENAI_MODEL = "qwen2.5:7b-instruct"
$env:SEO_LLM_ENABLED = "1"

# Start backend
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001

# Run smoke test
.\test-seo-llm.ps1
```

### 2. Without LLM (Heuristic Only)
```powershell
$env:SEO_LLM_ENABLED = "0"
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001
```

### 3. With OpenAI Fallback
```powershell
$env:OPENAI_BASE_URL = "http://127.0.0.1:11434/v1"
$env:FALLBACK_BASE_URL = "https://api.openai.com/v1"
$env:FALLBACK_API_KEY = "sk-..."
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001
```

## 📝 Testing

### Automated Tests
```bash
# Backend unit tests
python -m pytest tests/test_seo_llm_fallback.py -v

# Direct Python test (no HTTP)
python test_analytics_direct.py

# E2E Playwright tests (6 comprehensive tests)
npm run test:e2e:seo
# OR
npx playwright test tests/e2e/seo-analytics.spec.ts --project=chromium
```

### E2E Test Coverage
- ✅ Full ingestion → tune → artifact flow
- ✅ LLM path verification (when reachable)
- ✅ Heuristic fallback verification
- ✅ Custom threshold parameters
- ✅ Multiple data sources (search_console, ga4, manual)
- ✅ MD artifact generation and format
- ✅ Character limit enforcement (70/155)
- ✅ CTR calculation accuracy
- ✅ Frontend UI upload/run workflow (when available)

### Manual Smoke Test
```powershell
.\test-seo-llm.ps1
```

Expected output:
- ✅ Backend health check
- ✅ Ingest 2 sample pages
- ✅ Run seo.tune task
- ✅ Show LLM vs heuristic counts
- ✅ Display example transformations

## 🔄 Workflow

```
User ingests CTR data
    ↓
POST /agent/analytics/ingest
    ↓
Backend stores in SQLite
    ↓
User runs seo.tune task
    ↓
POST /agent/run?task=seo.tune
    ↓
For each low-CTR page:
    1. Try PRIMARY LLM ──→ Success → Use result
           ↓ Fail
    2. Try FALLBACK LLM ─→ Success → Use result
           ↓ Fail
    3. Use HEURISTIC ────→ Always succeeds
    ↓
Generate artifacts with "notes" field
    ↓
artifacts/seo-tune.json
artifacts/seo-tune.md
```

## 📊 Artifact Format

### With LLM
```json
{
  "url": "/projects/datapipe-ai",
  "ctr": 0.008,
  "old_title": "DataPipe AI",
  "new_title": "DataPipe AI — Transform Data with Intelligent Automation",
  "old_description": "Data pipeline automation",
  "new_description": "Automate complex ETL workflows with AI-powered pipeline orchestration...",
  "notes": "llm"  ← Indicates LLM was used
}
```

### Fallback to Heuristic
```json
{
  "url": "/projects/clarity",
  "ctr": 0.009,
  "old_title": "Clarity",
  "new_title": "Boost Results with Clarity — AI Automation",
  "old_description": "Mental health tracking",
  "new_description": "Mental health tracking. Leverage AI-powered insights...",
  "notes": "heuristic"  ← LLM unavailable
}
```

## 🎛️ API Endpoints

### Ingest CTR Data
```bash
POST http://127.0.0.1:8001/agent/analytics/ingest
Content-Type: application/json
Authorization: Bearer dev

{
  "source": "search_console",
  "rows": [
    {"url": "/test", "impressions": 1000, "clicks": 10}
  ]
}
```

### Run SEO Tune
```bash
POST http://127.0.0.1:8001/agent/run?task=seo.tune
Content-Type: application/json
Authorization: Bearer dev

{"threshold": 0.02}
```

## 🐛 Troubleshooting

### LLM Not Being Used
```bash
# Check logs for connection errors
# Verify Ollama is running: ollama list
# Check environment: echo $env:OPENAI_BASE_URL
# Check artifacts: look for "notes": "heuristic"
```

### Timeouts
```bash
# Increase timeout for slower models
$env:SEO_LLM_TIMEOUT = "15.0"
```

### Disable LLM Temporarily
```bash
$env:SEO_LLM_ENABLED = "0"
```

## 📚 Documentation

- **Full Docs**: `PHASE_50.6.1_COMPLETE.md`
- **API Docs**: `docs/API.md` (Analytics & SEO section)
- **Dev Guide**: `docs/DEVELOPMENT.md` (SEO LLM Smoke Test section)
- **Changelog**: `CHANGELOG.md` (Phase 50.6.1 entry)

## ✅ Success Checklist

- [x] LLM adapter module created
- [x] Settings configured
- [x] SEO tune task integrated
- [x] Tests passing (2/2)
- [x] Smoke test script working
- [x] Documentation updated
- [x] Zero breaking changes
- [x] Graceful fallback verified

## 🎉 Benefits

**With LLM:**
- Natural, engaging metadata
- Context-aware phrasing
- Specific value propositions
- Better SEO performance expected

**Without LLM:**
- Instant results
- No external dependencies
- Predictable output
- Proven heuristic patterns

**Best of Both:**
- Use LLM when available
- Fall back automatically when not
- Never fails (heuristic always works)
- Track which method was used
