# Phase 51.0 Quick Start

**5-Minute Setup for Analytics Loop / RAG Insights**

## Prerequisites

✅ Python 3.11+
✅ Ollama running locally (or remote endpoint configured)
✅ Dependencies installed: `pip install -r assistant_api/requirements.txt`

## Quick Run

### 1. Run Pipeline Locally

```bash
# Using Makefile
make analytics

# Using PowerShell
.\scripts\analytics.ps1

# Using Python directly
python -m analytics.pipeline --window-days 7
```

### 2. View Generated Reports

```bash
# Markdown summary
code analytics/outputs/insight-summary.md

# JSON trends
cat analytics/outputs/trend-report.json | jq .
```

### 3. Test API Endpoints

**Start backend (if not running)**:
```bash
make dev  # or: uvicorn assistant_api.main:app --reload
```

**Query endpoints**:
```bash
# Latest insight
curl http://localhost:8010/analytics/latest | jq .

# Health check
curl http://localhost:8010/analytics/health | jq .
```

## Expected Output

### Pipeline Console
```
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

### Sample Markdown Report
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

Current metrics indicate stable system health across all monitored
dimensions. SEO coverage remains above 90% target, E2E tests show
minimal flakiness, and API latencies are within acceptable bounds.

**Root Cause Analysis:**
- No significant changes detected in recent deployments
- Test suite stability improved from previous window

**Next Actions:**
- ✅ Maintain current monitoring cadence
- Consider expanding SEO checks to cover dynamic routes
- Monitor P95 latency for /api/seo/tune endpoint (currently highest)
```

## Troubleshooting

### ❌ "ModuleNotFoundError: No module named 'analytics'"
**Fix**: Ensure you're running from repo root:
```bash
cd /path/to/leo-portfolio
python -m analytics.pipeline
```

### ❌ "No nightly data found"
**Fix**: Sample data should exist in `reports/`. If missing:
```bash
# Check for sample files
ls reports/*/sample-*.json

# Re-create if needed (they should be in git)
git checkout reports/
```

### ❌ "Connection refused to Ollama"
**Fix**: Start Ollama service:
```bash
ollama serve

# In another terminal, verify:
curl http://127.0.0.1:11434/v1/models
```

### ❌ "Insight generation failed"
**Fallback**: Pipeline still completes and provides error details in report:
```markdown
## Insight Generation Failed

**Error:** Connection refused

**Recommendation:** Review metrics manually and ensure Ollama service is running.
```

## Environment Variables

### Optional Overrides

```bash
# Use different Ollama model
export OPENAI_MODEL=llama2:13b

# Point to remote Ollama instance
export OPENAI_BASE_URL=https://ollama.example.com/v1
export OPENAI_API_KEY=your-api-key

# Disable analytics endpoints (API only)
export ANALYTICS_ENABLED=false
```

## GitHub Actions

### Manual Trigger

```bash
# Trigger nightly workflow manually
gh workflow run analytics-nightly.yml

# Check run status
gh run list --workflow=analytics-nightly.yml

# Download outputs
gh run download <run-id> --name analytics-outputs
```

### PR Comments

Sticky comments appear automatically on PRs with latest insight summary.

To test locally:
1. Push changes to feature branch
2. Create PR
3. Wait for `analytics-pr-comment.yml` to run
4. Check PR comments for "🧠 Analytics Insight"

## Next Steps

- [ ] Review `PHASE_51.0_COMPLETE.md` for full documentation
- [ ] Check `docs/API.md` for endpoint details
- [ ] See `CHANGELOG.md` for feature summary
- [ ] Run `make analytics` weekly to see trends develop

---

**Quick Reference**:
- Pipeline: `make analytics`
- Reports: `analytics/outputs/`
- API: `GET /analytics/latest`
- Workflows: `.github/workflows/analytics-*.yml`
