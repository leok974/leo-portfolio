# Advanced Analytics Quick Reference

## New Endpoints

### Time Series
```bash
GET /agent/metrics/timeseries?metric=ctr&days=30&section=projects
```
Returns daily aggregated data for charting.

### CSV Export
```bash
GET /agent/metrics/export.csv
```
Downloads 14-day summary as CSV file.

### PDF Export
```bash
GET /agent/metrics/export.pdf
```
Downloads 14-day summary as PDF report (requires ReportLab).

### A/B Comparison
```bash
GET /agent/metrics/ab?section=projects
```
Compares variants within a section (requires `data-variant` attributes).

## Frontend Usage

### Add A/B Variants
```html
<section data-section="projects" data-variant="A">
  <!-- Version A content -->
</section>

<section data-section="projects" data-variant="B">
  <!-- Version B content -->
</section>
```

### Dashboard Features
- **Export buttons**: Click "Download CSV" or "Download PDF" in dashboard
- **CTR chart**: Select section from dropdown to view 30-day trend
- **Auto-updates**: Chart redraws on section change

## Configuration

### Geo Enrichment
```bash
# .env or environment
GEOIP_DB_PATH=/data/GeoLite2-Country.mmdb
LOG_IP_ENABLED=true
```

### Export Limits
```bash
METRICS_EXPORT_MAX_DAYS=60  # Cap days for timeseries/exports
```

### Email Notifications
```bash
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=metrics@yourdomain.com
EMAIL_TO=team@yourdomain.com
```

## GitHub Secrets (for email workflow)
1. Go to: Settings → Secrets and variables → Actions → New repository secret
2. Add:
   - `SENDGRID_API_KEY`
   - `METRICS_EMAIL_FROM`
   - `METRICS_EMAIL_TO`

## Testing Commands

### Time Series
```powershell
curl "http://127.0.0.1:8001/agent/metrics/timeseries?metric=ctr&days=7" | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

### CSV Export
```powershell
curl "http://127.0.0.1:8001/agent/metrics/export.csv" -o metrics.csv
Get-Content metrics.csv
```

### A/B Comparison
```powershell
curl "http://127.0.0.1:8001/agent/metrics/ab?section=projects" | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

### Manual Email Test
```bash
cd scripts
python email_metrics_summary.py
```

## Optional Dependencies

### Install All
```bash
pip install geoip2 reportlab requests
```

### Download GeoIP Database
```bash
# Get free MaxMind license key from https://www.maxmind.com/en/geolite2/signup
wget "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-Country&license_key=YOUR_KEY&suffix=tar.gz" -O GeoLite2-Country.tar.gz
tar -xzf GeoLite2-Country.tar.gz
```

## Commits
- **6c52681**: feat(analytics): add advanced enhancements (geo, exports, A/B, email)
- **11c220c**: docs(changelog): add advanced analytics enhancements section
