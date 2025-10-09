# Grafana Dashboard Quick Setup

## 🚀 5-Minute Setup

### 1. Install Infinity Plugin

```bash
grafana-cli plugins install yesoreyeram-infinity-datasource
sudo systemctl restart grafana-server
```

Or via UI: **Configuration** → **Plugins** → Search "Infinity" → Install

### 2. Add Datasource

1. **Configuration** → **Data sources** → **Add data source**
2. Select **Infinity**
3. Name: `Infinity`
4. **Save & Test**

### 3. Import Dashboard

1. **Dashboards** → **Import**
2. Upload: `grafana/seo-meta-auto-dashboard.json`
3. Click **Import**

### 4. Update URLs

**Dashboard settings** → **JSON Model** → Find & Replace:

#### Option A: API Endpoint (Recommended)
```
Find:    https://YOUR_HOST
Replace: https://your-host.com
```

#### Option B: GitHub Raw
```
Find:    https://YOUR_HOST/agent/metrics/seo-meta-auto.csv?limit_days=180
Replace: https://raw.githubusercontent.com/leok974/leo-portfolio/metrics/agent/metrics/seo-meta-auto.csv

Find:    https://YOUR_HOST/agent/metrics/seo-meta-auto.csv?limit_days=1
Replace: https://raw.githubusercontent.com/leok974/leo-portfolio/metrics/agent/metrics/seo-meta-auto.csv

Find:    https://YOUR_HOST/agent/metrics/seo-meta-auto.csv?limit_days=3650
Replace: https://raw.githubusercontent.com/leok974/leo-portfolio/metrics/agent/metrics/seo-meta-auto.csv
```

**Save** → Done! ✅

---

## 🔍 Verification

- **Panel 1**: Line graph showing pages vs over-limit trend
- **Panel 2**: 3 stat boxes with latest run numbers
- **Panel 3**: Table with last 20 runs

**No data?**
- Check CSV URL in browser
- Verify metrics branch exists
- Ensure datasource is configured

---

## 📚 Full Documentation

See `docs/GRAFANA_SETUP.md` for detailed setup, troubleshooting, and advanced configuration.
