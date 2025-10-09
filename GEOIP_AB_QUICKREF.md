# GeoIP & A/B Testing - Quick Reference

## Quick Setup (3 Steps)

### 1. Get MaxMind License Key
```
https://www.maxmind.com/en/geolite2/signup
```

### 2. Download Database
```powershell
./scripts/download-geoip.ps1 -LicenseKey "YOUR_LICENSE_KEY_HERE"
```

### 3. Configure & Restart
```bash
# .env or environment
GEOIP_DB_PATH=./data/geo/GeoLite2-Country.mmdb
LOG_IP_ENABLED=true

# Restart backend
./.venv/Scripts/python.exe -m uvicorn assistant_api.main:app --reload
```

## Testing

### Test Geo Enrichment
```powershell
# Send event with external IP
curl -X POST http://127.0.0.1:8001/agent/metrics/ingest -H "X-Forwarded-For: 8.8.8.8" -H "Content-Type: application/json" -d '{"section":"hero","event_type":"view"}'

# Check for country field in JSONL
Get-Content "data/analytics/events-$(Get-Date -Format 'yyyyMMdd').jsonl" | Select-String "country"
```

### Test A/B Tracking
```bash
# View A/B comparison
curl "http://127.0.0.1:8001/agent/metrics/ab?section=projects"
```

## Data-Variant Attributes

All sections now have:
```html
<section data-section="hero" data-variant="baseline">
<section data-section="projects" data-variant="baseline">
<section data-section="about" data-variant="baseline">
<section data-section="contact" data-variant="baseline">
```

## Create A/B Variants

```html
<!-- Variant A -->
<section data-section="projects" data-variant="grid">
  <!-- Grid layout -->
</section>

<!-- Variant B -->
<section data-section="projects" data-variant="list">
  <!-- List layout -->
</section>
```

## Key Files

- **Download Script**: `scripts/download-geoip.ps1`
- **Database Location**: `data/geo/GeoLite2-Country.mmdb`
- **Documentation**: `docs/DEVELOPMENT.md` (search "GeoIP")
- **Backend Code**: `assistant_api/routers/agent_metrics.py`
- **Event Model**: `assistant_api/models/metrics.py`

## Environment Variables

```bash
# Geo enrichment
GEOIP_DB_PATH=./data/geo/GeoLite2-Country.mmdb
LOG_IP_ENABLED=true

# Already configured
ANALYTICS_ENABLED=true
ANALYTICS_DIR=./data/analytics
METRICS_EXPORT_MAX_DAYS=60
```

## Privacy Features

- **IPv4 Anonymization**: `192.168.1.123` → `192.168.1.0/24`
- **IPv6 Anonymization**: `2001:db8:abc:def::1` → `2001:db8:abc::/48`
- **Country Only**: No city or precise location
- **No Raw IPs**: Only anonymized prefixes stored

## Update Database (Monthly)

```powershell
# Re-run download script to refresh
./scripts/download-geoip.ps1 -LicenseKey "YOUR_LICENSE_KEY"
```

## Commit

**Hash**: `c0dc47f`
**Files**: scripts/download-geoip.ps1 (new), index.html (+4), docs/DEVELOPMENT.md (+42)

## Related Docs

- `GEOIP_AB_SETUP_COMPLETE.md` - Full implementation guide
- `ADVANCED_ANALYTICS_COMPLETE.md` - Original analytics implementation
- `METRICS_DASHBOARD_SECURITY_COMPLETE.md` - Dashboard access control
