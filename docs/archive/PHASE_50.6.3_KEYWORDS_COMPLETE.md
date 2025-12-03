# Phase 50.6.3 — SEO Keywords Intelligence Router ✅

## Summary
Implemented `/agent/seo/keywords` endpoint for keyword intelligence generation with:
- LLM-powered or heuristic candidate extraction
- Google Trends-like interest enrichment
- CTR underperformer bias for broader exploration
- SHA-256 integrity checksums in artifacts
- JSON and Markdown output formats

## Implementation

### 1. New Router: `assistant_api/routers/seo_keywords.py` ✅
**Features:**
- **POST `/agent/seo/keywords`**: Generate keyword intelligence artifacts
- **GET `/agent/seo/keywords`**: Fetch last generated report
- **Models**: `KeywordItem`, `PageKeywords`, `KeywordsReport` (Pydantic)
- **Heuristic Extraction**: Analyzes title bigrams/trigrams, unigrams with confidence scoring
- **Domain Boosts**: Portfolio-specific keywords (autonomous, automation, siteagent, etc.)
- **Trends Stub**: Deterministic interest scoring (ready for real Google Trends API)
- **CTR Bias**: Underperformers get +15% confidence boost for exploration
- **Integrity**: SHA-256 hash on compact JSON, embedded in both JSON and Markdown
- **Artifacts**: Writes to `agent_artifacts/seo-keywords.{json,md}`

**Key Functions:**
```python
_extract_candidates_heuristic(title, desc, extra)  # Extract keyword candidates
_trends_interest_stub(terms)                        # Trends interest (0-100)
_load_analytics_summary(backend_url)                # Fetch CTR underperformers
_rank_and_limit(candidates, trends, bias)           # Combine score + trend
_write_artifacts(report, settings)                  # Write JSON/MD with integrity
```

### 2. HTTP Utility: `assistant_api/utils/http.py` ✅
**Purpose:** Lightweight JSON GET utility for internal service calls
**Features:**
- Uses `urllib.request` (no external dependencies)
- Configurable timeout and headers
- Simple error propagation
- Type-annotated

### 3. Settings Update: `assistant_api/settings.py` ✅
**Added:**
```python
"BACKEND_URL": os.getenv("BACKEND_URL", "http://127.0.0.1:8001")
```
Enables internal service-to-service calls (e.g., fetching analytics report).

### 4. Router Registration: `assistant_api/main.py` ✅
**Wired in main.py after mock routes:**
```python
# SEO Keywords intelligence (Phase 50.6.3+)
try:
    from assistant_api.routers import seo_keywords
    app.include_router(seo_keywords.router)
except Exception as e:
    print("[warn] seo_keywords router not loaded:", e)
```

## Usage

### Generate Keywords
```bash
# Generate artifacts (POST)
curl -s -X POST http://127.0.0.1:8001/agent/seo/keywords \
  -H "Authorization: Bearer dev" | jq

# Response includes integrity
{
  "generated_at": "2025-10-08T18:30:00Z",
  "mode": "heuristic",
  "inputs": {"analytics": "underperformers", "source": "sitemap|defaults"},
  "items": [
    {
      "page": "/",
      "title": "SiteAgent — Autonomous Portfolio Agent",
      "desc": "Self-maintaining portfolio builder...",
      "keywords": [
        {"term": "AI portfolio automation", "score": 0.96, "trend": 85},
        {"term": "autonomous website builder", "score": 0.94, "trend": 92},
        ...
      ]
    }
  ],
  "integrity": {
    "algo": "sha256",
    "value": "abc123...",
    "size": "1234"
  }
}
```

### Fetch Last Report
```bash
# Read cached report (GET)
curl -s http://127.0.0.1:8001/agent/seo/keywords \
  -H "Authorization: Bearer dev" | jq

# Inspect artifacts
cat agent_artifacts/seo-keywords.json
cat agent_artifacts/seo-keywords.md
```

## Artifact Examples

### seo-keywords.json
```json
{
  "generated_at": "2025-10-08T18:30:00.123456+00:00",
  "mode": "heuristic",
  "inputs": {
    "analytics": "underperformers",
    "source": "sitemap|defaults"
  },
  "items": [
    {
      "page": "/",
      "title": "SiteAgent — Autonomous Portfolio Agent",
      "desc": "Self-maintaining portfolio builder...",
      "keywords": [
        {"term": "autonomous", "score": 0.85, "trend": 78},
        {"term": "portfolio automation", "score": 0.9, "trend": 85},
        {"term": "siteagent", "score": 0.9, "trend": 65}
      ]
    }
  ],
  "integrity": {
    "algo": "sha256",
    "value": "7f8d9e...",
    "size": "1456"
  }
}
```

### seo-keywords.md
```markdown
# SEO Keywords Report
- **Generated:** 2025-10-08T18:30:00.123456+00:00
- **Mode:** heuristic
- **Integrity:** `sha256:7f8d9e...` (1456 bytes)

## /
**Title:** SiteAgent — Autonomous Portfolio Agent
**Description:** Self-maintaining portfolio builder with agentic automation...

- `autonomous` — score **0.85**, trend **78**, effectiveness **0.663**
- `portfolio automation` — score **0.9**, trend **85**, effectiveness **0.765**
- `siteagent` — score **0.9**, trend **65**, effectiveness **0.585**
```

## Architecture

### LLM vs Heuristic Mode
**Controlled by `SEO_LLM_ENABLED` setting:**
- **LLM mode (=1)**: Uses existing LLM client for high-quality keyword extraction
  - Currently stubbed with representative placeholders
  - TODO: Wire to actual LLM client (e.g., OpenAI/Ollama)
- **Heuristic mode (=0)**: Fast rule-based extraction
  - Title trigrams/bigrams (confidence 0.9-0.95)
  - Title unigrams (confidence 0.65)
  - Description unigrams (confidence 0.55)
  - Domain-specific boosts (autonomous, siteagent, etc.)

### CTR Underperformer Integration
**Fetches from Phase 50.5 analytics:**
```python
# Best-effort fetch from /agent/analytics/report
analytics = _load_analytics_summary(backend_url)
for row in analytics.get("underperformers", []):
    if float(row.get("ctr", 100)) < 2.0:
        low_ctr_pages.add(row.get("path"))

# Apply +15% bias to underperformers
bias = 0.15 if path in low_ctr_pages else 0.0
```

### Trends Enrichment
**Current: Deterministic stub (length-based scoring)**
- Multi-word phrases get 15% boost
- Scores clamped to 5-100 range
- TODO: Replace with real Google Trends API or cached dataset

### Ranking Algorithm
```python
effectiveness = confidence × (trend / 100)
```
- Combines term confidence (0-1) with trend interest (0-100)
- Sorts by effectiveness descending
- Returns top 10 per page

## Testing

### Manual Test
```bash
# 1. Start backend
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001 --reload

# 2. Generate keywords
curl -X POST http://127.0.0.1:8001/agent/seo/keywords \
  -H "Authorization: Bearer dev" | jq

# 3. Verify artifacts
cat agent_artifacts/seo-keywords.json | jq .integrity
cat agent_artifacts/seo-keywords.md | head -20

# 4. Fetch cached report
curl http://127.0.0.1:8001/agent/seo/keywords \
  -H "Authorization: Bearer dev" | jq .mode
```

### Integration Points
**Ready for:**
- Real Google Trends API integration (`_trends_interest_stub`)
- LLM client integration (`mode == "llm"` branch)
- Sitemap parser (replace hardcoded pages list)
- Agent task registration (add `@task("seo.keywords")` in `agent/tasks.py`)

## Future Enhancements

### Phase 50.7+ (Potential)
1. **Real Trends API**: Replace stub with Google Trends pytrends library
2. **LLM Integration**: Wire to existing OpenAI/Ollama client for keyword extraction
3. **Sitemap Parser**: Auto-discover pages from sitemap.xml
4. **Task Registration**: Add `seo.keywords` to agent task registry
5. **E2E Tests**: Add mock and full test suites (similar to seo-analytics)
6. **Caching Layer**: Cache trends data with TTL (avoid rate limits)
7. **Multi-Region**: Support trends for different geographic regions
8. **Competitor Analysis**: Compare keyword overlap with competing sites
9. **Seasonal Trends**: Track keyword interest over time
10. **Export Formats**: Add CSV, TSV export options

## Commits

### Suggested commit sequence:
```bash
# 1. Utility + router
git add assistant_api/utils/http.py
git add assistant_api/routers/seo_keywords.py
git commit -m "feat(seo): add /agent/seo/keywords route with trends enrichment & CTR bias

- Heuristic keyword extraction from title/desc
- Google Trends-like interest scoring (stub)
- CTR underperformer bias (+15% boost)
- Domain-specific keyword boosts (autonomous, siteagent, etc.)
- Returns top 10 keywords per page sorted by effectiveness"

# 2. Artifacts with integrity
git commit -m "feat(seo): write seo-keywords.json/.md with sha256 integrity

- Compact JSON format for consistent hashing
- Integrity field with algo, value, size
- Markdown report with effectiveness scores"

# 3. Wire router
git add assistant_api/settings.py
git add assistant_api/main.py
git commit -m "chore(api): wire seo_keywords router + add BACKEND_URL setting

- Added BACKEND_URL to settings for internal service calls
- Registered seo_keywords router in main.py
- Soft-fail on import errors for dev flexibility"

# 4. Documentation
git add PHASE_50.6.3_COMPLETE.md
git commit -m "docs: add Phase 50.6.3 SEO keywords intelligence documentation"
```

## Related Files
- **Router**: `assistant_api/routers/seo_keywords.py` (new, 360 lines)
- **Utility**: `assistant_api/utils/http.py` (new, 30 lines)
- **Settings**: `assistant_api/settings.py` (modified, +1 line)
- **Main**: `assistant_api/main.py` (modified, +6 lines)
- **Artifacts**: `agent_artifacts/seo-keywords.{json,md}` (generated at runtime)

## Success Criteria ✅
- [x] POST `/agent/seo/keywords` generates artifacts
- [x] GET `/agent/seo/keywords` returns cached report
- [x] Artifacts include SHA-256 integrity
- [x] Markdown output is human-readable
- [x] CTR underperformers receive bias boost
- [x] Heuristic mode works without LLM
- [x] Router wired in main.py with soft-fail
- [x] Settings include BACKEND_URL
- [x] HTTP utility is reusable for other routes
- [x] Code is type-annotated and documented

---

**Status**: ✅ **COMPLETE**
**Phase**: 50.6.3
**Feature**: SEO Keywords Intelligence Router
**Date**: 2025-10-08
