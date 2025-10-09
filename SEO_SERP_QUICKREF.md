# SEO SERP Quick Reference

## TL;DR

**What**: Daily Google Search Console monitoring with CTR anomaly detection
**Why**: Identify underperforming pages and get actionable SEO improvement suggestions
**Status**: ✅ Production ready, CI-friendly (works without GSC credentials)

---

## Quick Start (Local Development)

```bash
# 1. Start backend
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001

# 2. Populate mock data (creates 3 days of artifacts)
curl -X POST http://127.0.0.1:8001/agent/seo/serp/mock/populate \
  -H "Content-Type: application/json" \
  -d '{"days": 2}'

# 3. View latest report
curl http://127.0.0.1:8001/agent/seo/serp/report | jq .

# 4. Open Admin Tools UI
# Navigate to: http://localhost:8080/?adminTools=1
# Scroll to "Indexing & SERP" section
```

---

## API Endpoints

### Fetch GSC Data
```bash
curl -X POST http://127.0.0.1:8001/agent/seo/serp/fetch \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2025-10-07",
    "end_date": "2025-10-08",
    "limit": 200,
    "dry_run": false
  }'
```

### Analyze for Anomalies
```bash
curl -X POST http://127.0.0.1:8001/agent/seo/serp/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "rows": [/* ... SERP data ... */],
    "min_impressions": 50,
    "low_ctr_factor": 0.5
  }'
```

### Get Latest Report
```bash
curl http://127.0.0.1:8001/agent/seo/serp/report | jq .
```

### Ping Sitemaps
```bash
curl -X POST http://127.0.0.1:8001/agent/seo/serp/ping-sitemaps \
  -H "Content-Type: application/json" \
  -d '{
    "sitemap_urls": ["https://example.com/sitemap.xml"],
    "dry_run": false
  }'
```

---

## Production Setup (Optional)

### Step 1: Create Google Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create/select project
3. Enable **Google Search Console API**
4. IAM & Admin → Service Accounts → Create Service Account
5. Grant role: **Search Console Viewer**
6. Create JSON key → Download

### Step 2: Add to Search Console

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Select property
3. Settings → Users and permissions → Add user
4. Enter service account email (e.g., `serp-bot@project.iam.gserviceaccount.com`)
5. Permission level: **Full** or **Restricted** (read-only sufficient)

### Step 3: Configure Repository Secrets

GitHub repo → Settings → Secrets and variables → Actions:

```
Name: GSC_PROPERTY
Value: https://leok974.github.io/leo-portfolio/

Name: GSC_SA_JSON
Value: {
  "type": "service_account",
  "project_id": "...",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "serp-bot@project.iam.gserviceaccount.com",
  ...
}
```

### Step 4: Verify Workflow

1. Push to main branch
2. GitHub Actions → SEO SERP Nightly
3. Run workflow manually (Actions → workflow → Run workflow)
4. Check artifacts are uploaded
5. Badge should show green: [![SEO SERP Nightly](https://github.com/.../badge.svg)](...)

---

## Environment Variables

```bash
# Optional - defaults shown
ARTIFACTS_ROOT="agent/artifacts"
SERP_ARTIFACTS_DIR="seo-serp"

# For production GSC integration
GSC_PROPERTY="https://your-site.com/"
GSC_SA_JSON='{"type":"service_account",...}'
# OR
GSC_SA_FILE="/path/to/service-account.json"
```

---

## Artifact Structure

```
agent/artifacts/seo-serp/
├── 2025-10-07/
│   ├── gsc.jsonl          # One row per line: {date, page, clicks, impressions, ctr, position}
│   └── summary.json       # {window: {start, end}, fetched: N, source: "gsc|mock"}
├── 2025-10-08/
│   ├── gsc.jsonl
│   └── summary.json
└── ...
```

---

## Admin Tools UI

**Access**: Bottom-right floating dock → Admin Tools → "Indexing & SERP" section

**Displays**:
- Latest report date
- Median CTR
- Top 5 anomalies with:
  - Page URL (clickable)
  - Reasons (e.g., "ctr<0.5×median")
  - Suggestions

**Fallback**: "No SERP report yet." when no artifacts exist

---

## Testing

### E2E Test
```bash
npx playwright test tests/e2e/seo-serp.api.spec.ts --project=chromium
```

### Manual Test (with backend running)
```bash
# 1. Populate mock data
curl -X POST http://127.0.0.1:8001/agent/seo/serp/mock/populate \
  -H "Content-Type: application/json" \
  -d '{"days": 2}'

# 2. Check artifacts were created
ls -la agent/artifacts/seo-serp/

# 3. View report
curl http://127.0.0.1:8001/agent/seo/serp/report | jq .

# 4. Verify anomalies are detected
curl http://127.0.0.1:8001/agent/seo/serp/report | jq '.analysis.anomalies | length'
# Should be >= 1 (mock data includes one low-CTR page)
```

---

## Anomaly Detection Logic

1. **Filter**: Only pages with >= 50 impressions (configurable via `min_impressions`)
2. **Median CTR**: Calculate across all filtered pages
3. **Flag Low CTR**: Pages with CTR < 0.5 × median (configurable via `low_ctr_factor`)
4. **Compare Previous**: Load previous day's data and detect CTR drops
5. **Suggestions**: Return actionable recommendations:
   - "Run seo.rewrite on H1/description."
   - "Validate JSON-LD types for this route."
   - "Check internal links/anchor text."
   - "Consider new thumbnail/OG image test."

**Example Anomaly**:
```json
{
  "page": "https://example.com/projects/terminality",
  "impressions": 500,
  "ctr": 0.004,
  "position": 35.0,
  "prev_ctr": 0.025,
  "delta_ctr": -0.021,
  "reasons": [
    "ctr<0.5×median (0.004 < 0.023)",
    "ctr drop vs prev (0.004 < 0.5×0.025)"
  ],
  "suggestions": [
    "Run seo.rewrite on H1/description.",
    "Validate JSON-LD types for this route.",
    "Check internal links/anchor text.",
    "Consider new thumbnail/OG image test."
  ]
}
```

---

## Nightly GitHub Actions Workflow

**File**: `.github/workflows/seo-serp-cron.yml`
**Schedule**: Daily at 07:00 UTC (03:00-04:00 ET)
**Behavior**:
- ✅ **With GSC credentials**: Fetches real data from Google Search Console
- ✅ **Without credentials**: Uses mock data (CI-friendly, tests still pass)
- 🔔 **Auto-files GitHub Issues**: Creates/updates issue when anomalies ≥ threshold (default: 2)

**GitHub Issue Automation**:
- **Threshold**: `ANOMALY_THRESHOLD=2` (configurable in workflow env)
- **Behavior**: When anomaly count ≥ threshold, workflow:
  1. Creates issue with title: `SEO: SERP anomalies YYYY-MM-DD (N)`
  2. Includes Markdown table with top 10 anomalies
  3. Shows page URL, impressions, CTR, position, reasons, suggestions
  4. Updates existing issue if one already exists for that day
  5. Auto-labels with: `seo`, `serp`, `automated`
- **Permissions**: Requires `issues: write` (already configured)

**Example Issue**:
```markdown
## SERP Anomalies — 2025-10-08

**Median CTR:** 0.147

**Total anomalies:** 3 (threshold: 2)

| Page | Impressions | CTR | Position | Reasons | Suggestions |
|---|---:|---:|---:|---|---|
| https://example.com/projects/terminality | 500 | 0.004 | 35.0 | ctr<0.5×median (0.004 < 0.074) | Run seo.rewrite on H1/description.; Validate JSON-LD types for this route.; ... |

**Artifacts:** `agent/artifacts/seo-serp/2025-10-08`

> This issue was auto-filed by the SEO SERP Nightly workflow.
```

**Manual Trigger**:
```bash
# GitHub UI: Actions → SEO SERP Nightly → Run workflow
# OR via gh CLI:
gh workflow run seo-serp-cron.yml
```

**Artifacts Downloaded**:
```
seo-serp-latest/
├── agent/artifacts/seo-serp/
│   └── YYYY-MM-DD/
│       ├── gsc.jsonl
│       └── summary.json
└── serp-latest.json        # Full report with analysis
```

---

## Troubleshooting

### "No SERP report yet" in Admin Tools
**Cause**: No artifacts exist yet
**Fix**: Run mock populate or wait for nightly workflow to execute

### "Dev routes disabled" in E2E test
**Cause**: `ALLOW_DEV_ROUTES=0` in production
**Expected**: Test gracefully skips when dev routes disabled
**Fix**: Not an error - test is working as intended

### "Service account not provided" error
**Cause**: GSC credentials not configured
**Expected**: System falls back to mock data
**Fix**: Not an error unless you want real GSC data (add `GSC_PROPERTY` + `GSC_SA_JSON`)

### GitHub Action failing
**Check**:
1. Backend health: Does `/ready` endpoint work?
2. Fetch endpoint: Does curl to `/agent/seo/serp/fetch` succeed?
3. Secrets configured: Are `GSC_PROPERTY` and `GSC_SA_JSON` set?
4. Artifact path: Does `agent/artifacts/seo-serp/` directory get created?

---

## Example Output

### Fetch Response (Mock)
```json
{
  "rows": [
    {
      "date": "2025-10-08",
      "page": "http://localhost:5173/",
      "clicks": 81,
      "impressions": 398,
      "ctr": 0.20352,
      "position": 10.84
    },
    {
      "date": "2025-10-08",
      "page": "http://localhost:5173/projects/ledgermind",
      "clicks": 46,
      "impressions": 313,
      "ctr": 0.14696,
      "position": 3.92
    },
    {
      "date": "2025-10-08",
      "page": "http://localhost:5173/projects/terminality",
      "clicks": 2,
      "impressions": 500,
      "ctr": 0.004,
      "position": 35.0
    }
  ],
  "report": {
    "source": "mock",
    "note": "GSC_PROPERTY not configured"
  },
  "artifacts": {}
}
```

### Report Response
```json
{
  "day": "2025-10-08",
  "count": 5,
  "summary": {
    "window": {"start": "2025-10-08", "end": "2025-10-08"},
    "fetched": 5,
    "source": "mock-latest"
  },
  "analysis": {
    "median_ctr": 0.147,
    "total_pages": 5,
    "anomalies": [
      {
        "page": "http://localhost:5173/projects/terminality",
        "impressions": 500,
        "ctr": 0.004,
        "position": 35.0,
        "prev_ctr": 0.0,
        "delta_ctr": null,
        "reasons": [
          "ctr<0.5×median (0.004 < 0.074)"
        ],
        "suggestions": [
          "Run seo.rewrite on H1/description.",
          "Validate JSON-LD types for this route.",
          "Check internal links/anchor text.",
          "Consider new thumbnail/OG image test."
        ]
      }
    ]
  }
}
```

---

## Documentation Links

- **API Reference**: [`docs/API.md`](../docs/API.md) → "SEO SERP / Indexing" section
- **Phase Completion**: [`SEO_SERP_PHASE_50_9_COMPLETE.md`](./SEO_SERP_PHASE_50_9_COMPLETE.md)
- **Changelog**: [`CHANGELOG.md`](../CHANGELOG.md) → v0.2.3
- **Workflow File**: [`.github/workflows/seo-serp-cron.yml`](../.github/workflows/seo-serp-cron.yml)
- **Router Source**: [`assistant_api/routers/seo_serp.py`](../assistant_api/routers/seo_serp.py)

---

## Next Actions

### Immediate
1. ✅ Commit all changes
2. ✅ Run E2E test: `npx playwright test tests/e2e/seo-serp.api.spec.ts`
3. ✅ Test locally with mock data
4. ✅ Verify Admin Tools UI displays report

### Production (Optional)
1. Create GSC service account
2. Add repository secrets
3. Run workflow manually to test
4. Monitor nightly runs and artifacts

### Future Enhancements
- Trending analysis (week-over-week CTR changes)
- Email notifications for anomalies
- Query-level analysis
- Device/country breakdown
- Integration with automated content optimization

---

**Status**: ✅ Phase 50.9 Complete - Ready for Production
