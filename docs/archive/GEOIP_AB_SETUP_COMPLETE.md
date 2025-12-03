# GeoIP & A/B Testing Setup - Complete ✅

## Summary

Added comprehensive GeoIP database download automation and A/B testing infrastructure to enable advanced analytics features including country-level geo enrichment and section variant tracking.

## What Was Implemented

### 1. GeoIP Download Script (`scripts/download-geoip.ps1`)

**Purpose**: Automate MaxMind GeoLite2-Country database download and setup for geo enrichment analytics.

**Features**:
- ✅ Automatic directory creation (`data/geo/`)
- ✅ MaxMind API download with license key parameter
- ✅ Automatic tar.gz extraction (uses native `tar` command on Windows 10+)
- ✅ Smart file placement (moves .mmdb to expected location)
- ✅ Cleanup of temporary files
- ✅ Clear next-steps instructions after completion
- ✅ Error handling with helpful troubleshooting tips

**Usage**:
```powershell
./scripts/download-geoip.ps1 -LicenseKey "YOUR_LICENSE_KEY_HERE"
```

**Output**:
- Database location: `data/geo/GeoLite2-Country.mmdb`
- Sets up for `GEOIP_DB_PATH=./data/geo/GeoLite2-Country.mmdb`

**Key Features**:
- **License Key Validation**: Provides clear error messages if download fails
- **Cross-Platform**: Works on Windows PowerShell and PowerShell Core (Linux/Mac)
- **Size Reporting**: Shows downloaded file size in MB
- **Auto-Extraction**: Uses native tar command (available on Windows 10+ and all Unix systems)
- **Cleanup**: Removes temporary .tar.gz and extracted directories
- **Next Steps**: Prints environment variable setup instructions

### 2. Data-Variant Attributes (`index.html`)

**Purpose**: Enable A/B testing by marking sections with baseline variant for comparison tracking.

**Changes**:
Added `data-section` and `data-variant="baseline"` attributes to all major sections:

1. **Hero Section** (line 640):
   ```html
   <section class="hero container" id="home" data-section="hero" data-variant="baseline">
   ```

2. **Projects Section** (line 716):
   ```html
   <section id="projects" data-section="projects" data-variant="baseline">
   ```

3. **About Section** (line 862):
   ```html
   <section id="about" data-section="about" data-variant="baseline">
   ```

4. **Contact Section** (line 1008):
   ```html
   <section id="contact" data-section="contact" data-variant="baseline">
   ```

**How It Works**:
- Frontend tracker (`src/lib/behavior-tracker.js`) captures `data-variant` attribute on view/click/dwell events
- Backend stores variant information in event model
- `/agent/metrics/ab?section=X` endpoint compares performance across variants
- Dashboard shows A/B comparison charts

**Example A/B Test Setup**:
```html
<!-- Create two versions of the same section -->
<section data-section="projects" data-variant="A" class="grid-layout">
  <!-- Version A: Grid layout -->
</section>

<section data-section="projects" data-variant="B" class="list-layout" style="display:none">
  <!-- Version B: List layout -->
</section>

<script>
  // Randomly show one variant
  const variant = Math.random() < 0.5 ? 'A' : 'B';
  document.querySelector(`[data-variant="${variant}"]`).style.display = '';
  document.querySelector(`[data-variant="${variant === 'A' ? 'B' : 'A'}"]`).remove();
</script>
```

### 3. Documentation Updates (`docs/DEVELOPMENT.md`)

**New Section**: "Advanced Analytics: GeoIP Setup (Optional)"

**Content Includes**:
1. **MaxMind License Key Instructions**:
   - Link to free signup page
   - Dashboard instructions for generating key

2. **Download Methods**:
   - **PowerShell Script** (recommended): `./scripts/download-geoip.ps1 -LicenseKey "..."`
   - **Manual wget** (Linux/Mac): Full command with extraction steps

3. **Environment Configuration**:
   ```bash
   GEOIP_DB_PATH=./data/geo/GeoLite2-Country.mmdb
   LOG_IP_ENABLED=true  # Optional: log anonymized IPs
   ```

4. **Backend Restart Instructions**:
   ```powershell
   ./.venv/Scripts/python.exe -m uvicorn assistant_api.main:app --reload
   ```

5. **Enrichment Details**:
   - **IP Anonymization**: IPv4 → /24 subnet, IPv6 → /48 prefix
   - **Country Detection**: Optional GeoIP lookup adds country code
   - **Privacy-First**: No raw IPs stored, only anonymized prefixes

6. **Update Frequency**: Monthly refresh reminder for MaxMind database

## Architecture

### GeoIP Enrichment Flow

```
User Request → Backend Ingest Endpoint
              ↓
Extract Client IP (X-Forwarded-For or direct)
              ↓
Anonymize IP (IPv4 /24, IPv6 /48)
              ↓
GeoIP Lookup (if GEOIP_DB_PATH set)
              ↓
Add to Event: {anon_ip_prefix, country}
              ↓
Store in JSONL (events-YYYYMMDD.jsonl)
```

### A/B Testing Flow

```
Frontend Renders Section with data-variant
              ↓
behavior-tracker.js captures attribute on events
              ↓
Backend stores variant in MetricEvent model
              ↓
/agent/metrics/ab?section=X aggregates by variant
              ↓
Dashboard shows comparison (CTR, dwell, clicks)
```

## Privacy & Security

### IP Anonymization
- **IPv4**: Masks last octet → `192.168.1.123` becomes `192.168.1.0/24`
- **IPv6**: Masks last 80 bits → `2001:db8:abc:def::1` becomes `2001:db8:abc::/48`
- **GDPR Compliant**: No personal identifiers stored
- **Optional Logging**: Set `LOG_IP_ENABLED=true` to store anonymized prefixes in events

### GeoIP Database
- **License**: Free MaxMind GeoLite2 (requires account signup)
- **Accuracy**: Country-level only (no city/precise location)
- **Updates**: Monthly from MaxMind (re-run script to refresh)
- **Optional**: Backend works without database (skips country enrichment)

### Data Retention
- **Event Storage**: JSONL files in `data/analytics/events-YYYYMMDD.jsonl`
- **No PII**: Only anonymized IP prefixes and country codes
- **Aggregation**: Dashboard shows aggregate metrics, not individual events

## Testing

### Manual Testing

1. **Test GeoIP Download**:
   ```powershell
   # Get license key from https://www.maxmind.com/en/geolite2/signup
   ./scripts/download-geoip.ps1 -LicenseKey "YOUR_KEY"

   # Verify file exists
   Test-Path data/geo/GeoLite2-Country.mmdb  # Should return True
   ```

2. **Test Backend Enrichment**:
   ```powershell
   # Set env vars
   $env:GEOIP_DB_PATH = "./data/geo/GeoLite2-Country.mmdb"
   $env:LOG_IP_ENABLED = "true"

   # Restart backend
   ./.venv/Scripts/python.exe -m uvicorn assistant_api.main:app --reload

   # Send test event
   curl -X POST http://127.0.0.1:8001/agent/metrics/ingest -H "Content-Type: application/json" -H "X-Forwarded-For: 8.8.8.8" -d '{"section":"hero","event_type":"view","variant":"baseline"}'

   # Check JSONL file for country field
   Get-Content data/analytics/events-$(Get-Date -Format "yyyyMMdd").jsonl | Select-String "country"
   ```

3. **Test A/B Tracking**:
   ```powershell
   # Visit site with browser
   # Open DevTools → Network → Send events with different variants

   # Check aggregation
   curl "http://127.0.0.1:8001/agent/metrics/ab?section=projects"
   # Should show baseline variant stats
   ```

### E2E Tests

Existing tests in `tests/e2e/behavior-analytics.spec.ts` already validate:
- ✅ Event ingestion with section tracking
- ✅ Variant capture in events
- ✅ Dashboard rendering with metrics

No new E2E tests needed for this change (infrastructure already validated).

## Configuration Summary

### Environment Variables

```bash
# Required for geo enrichment
GEOIP_DB_PATH=./data/geo/GeoLite2-Country.mmdb

# Optional: log anonymized IPs
LOG_IP_ENABLED=true

# Already configured (from previous implementation)
ANALYTICS_ENABLED=true
ANALYTICS_DIR=./data/analytics
METRICS_EXPORT_MAX_DAYS=60
```

### Frontend Requirements

All sections must have:
- `data-section="<name>"` attribute (for tracking)
- `data-variant="<variant>"` attribute (for A/B testing)

Default variant: `"baseline"` (as implemented)

## Usage Examples

### Example 1: Test Hero Layout Variants

```html
<!-- Version A: Centered layout -->
<section class="hero container" id="home" data-section="hero" data-variant="centered">
  <h1>Centered Headline</h1>
</section>

<!-- Version B: Left-aligned layout -->
<section class="hero container" id="home" data-section="hero" data-variant="left-aligned">
  <h1>Left Headline</h1>
</section>
```

**Backend Query**:
```bash
curl "http://127.0.0.1:8001/agent/metrics/ab?section=hero"
```

**Response**:
```json
{
  "section": "hero",
  "variants": {
    "centered": {"views": 150, "clicks": 45, "ctr": 0.30, "avg_dwell": 12.5},
    "left-aligned": {"views": 148, "clicks": 52, "ctr": 0.35, "avg_dwell": 15.2}
  },
  "winner": "left-aligned",
  "confidence": 0.85
}
```

### Example 2: Monitor Country Distribution

```bash
# After setting up GeoIP
curl "http://127.0.0.1:8001/agent/metrics/summary"
```

**Response** (with country field):
```json
{
  "sections": {
    "hero": {
      "views": 1250,
      "clicks": 423,
      "ctr": 0.338,
      "countries": {
        "US": 450,
        "GB": 230,
        "CA": 180,
        "DE": 120,
        "other": 270
      }
    }
  }
}
```

## Deployment Checklist

- [x] Create GeoIP download script
- [x] Add data-variant attributes to all sections
- [x] Update documentation with setup instructions
- [ ] Get MaxMind license key (user action required)
- [ ] Run download script to populate database
- [ ] Set GEOIP_DB_PATH in production environment
- [ ] Test geo enrichment with sample events
- [ ] Create A/B variant HTML for sections to test (optional)
- [ ] Monitor dashboard for variant performance (optional)

## Next Steps (Optional)

1. **Create A/B Test Variants**:
   - Design alternative layouts for hero/projects/about
   - Implement variant switching logic (random or user-based)
   - Set display rules (feature flags, cookies, URL params)

2. **Advanced Geo Analysis**:
   - Add country-based dashboard charts
   - Implement geo-based personalization (e.g., show local projects)
   - Track conversion rates by country

3. **Automated Variant Optimization**:
   - Implement multi-armed bandit algorithm
   - Auto-switch to winning variant after confidence threshold
   - Add CI/CD integration to deploy variants

4. **Enhanced Privacy**:
   - Add opt-out cookie for tracking
   - Implement data retention policies (auto-delete old events)
   - Add GDPR consent banner

## Commit

**Commit Hash**: `c0dc47f`

**Message**:
```
feat(analytics): Add GeoIP download script and data-variant attributes for A/B testing

- Created PowerShell script to download MaxMind GeoLite2-Country database
- Added comprehensive setup instructions with license key guidance
- Added data-section and data-variant='baseline' attributes to all sections:
  - hero, projects, about, contact
- Updated DEVELOPMENT.md with GeoIP setup section including:
  - Step-by-step download instructions
  - Environment variable configuration
  - Privacy-first IP anonymization explanation
  - Monthly update reminder

Enables:
- Country-level geo enrichment with IP anonymization (IPv4 /24, IPv6 /48)
- A/B testing capability via data-variant attributes
- Privacy-compliant analytics with no raw IP storage
```

## Files Changed

1. **scripts/download-geoip.ps1** - NEW
   - 135 lines
   - PowerShell script with MaxMind API integration
   - Automatic extraction and file placement
   - Error handling and next-steps guidance

2. **index.html** - MODIFIED
   - +4 lines (4 sections updated)
   - Added `data-section` and `data-variant="baseline"` to:
     - hero, projects, about, contact sections

3. **docs/DEVELOPMENT.md** - MODIFIED
   - +42 lines
   - New "Advanced Analytics: GeoIP Setup" section
   - Download instructions (PowerShell + manual)
   - Environment configuration examples
   - Privacy explanation (IP anonymization)

## References

- **MaxMind GeoLite2**: https://www.maxmind.com/en/geolite2/signup
- **Original Implementation**: ADVANCED_ANALYTICS_COMPLETE.md
- **Security Docs**: METRICS_DASHBOARD_SECURITY_COMPLETE.md
- **Backend Code**: `assistant_api/routers/agent_metrics.py` (geo enrichment in ingest endpoint)
- **Event Model**: `assistant_api/models/metrics.py` (MetricEvent with variant, anon_ip_prefix, country)
