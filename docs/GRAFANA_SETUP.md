# Grafana Dashboard Setup Guide

## SiteAgent — Nightly SEO Meta Metrics Dashboard

This guide walks you through setting up the Grafana dashboard to visualize nightly SEO meta optimization metrics.

**Related Documentation:**
- **VS Code Extension Setup**: [docs/GRAFANA_VSCODE_SETUP.md](GRAFANA_VSCODE_SETUP.md)
- **grafanactl CLI Reference**: [grafana/GRAFANACTL_QUICKREF.md](../grafana/GRAFANACTL_QUICKREF.md)
- **Quick Setup**: [grafana/QUICK_SETUP.md](../grafana/QUICK_SETUP.md)

---

## Prerequisites

- **Grafana instance** (v9.0+ recommended)
- **Admin access** to install plugins
- **Metrics data**: At least 3-7 days of nightly runs (JSONL/CSV in `metrics` branch)

---

## Step 1: Install Infinity Datasource

The dashboard uses the **Infinity** datasource plugin to fetch CSV data from URLs.

### Option A: Via Grafana UI

1. Navigate to **Configuration** → **Plugins** (or `http://your-grafana/plugins`)
2. Search for: `infinity`
3. Click **Infinity** by `yesoreyeram`
4. Click **Install**
5. Wait for installation to complete

### Option B: Via Grafana CLI

```bash
grafana-cli plugins install yesoreyeram-infinity-datasource
```

Then restart Grafana:
```bash
# Docker
docker restart grafana

# systemd
sudo systemctl restart grafana-server
```

### Verify Installation

1. Go to **Configuration** → **Data sources**
2. Click **Add data source**
3. Search for "Infinity"
4. You should see **Infinity** in the list

---

## Step 2: Configure Infinity Datasource

1. Go to **Configuration** → **Data sources**
2. Click **Add data source**
3. Select **Infinity**
4. Configure:
   - **Name**: `Infinity` (must match dashboard UID)
   - **URL**: Leave empty (we use per-query URLs)
   - **Auth**: None (for public endpoints/GitHub raw)
5. Click **Save & Test**

### Optional: Add API Authentication

If your backend requires auth:

1. In datasource settings, expand **Custom HTTP Headers**
2. Add header:
   - **Header**: `Authorization`
   - **Value**: `Bearer YOUR_API_TOKEN`
3. Click **Save & Test**

---

## Step 3: Import Dashboard

### Method 1: Via Grafana UI

1. Go to **Dashboards** → **Import** (or `http://your-grafana/dashboard/import`)
2. Click **Upload JSON file**
3. Select `grafana/seo-meta-auto-dashboard.json` from your repository
4. Click **Import**

### Method 2: Via API

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_GRAFANA_API_KEY" \
  -H "Content-Type: application/json" \
  -d @grafana/seo-meta-auto-dashboard.json \
  http://your-grafana/api/dashboards/db
```

---

## Step 4: Update Panel URLs

You need to replace `YOUR_HOST` with your actual data source URL in all panels.

### Option A: Backend API Endpoint (Recommended)

**Best for**: Production, CORS-free, parameterized queries

1. Open the imported dashboard
2. Click **Dashboard settings** (gear icon)
3. Go to **JSON Model**
4. Find-and-replace:
   ```
   Find:    "url": "https://YOUR_HOST/agent/metrics/seo-meta-auto.csv
   Replace: "url": "https://your-actual-host.com/agent/metrics/seo-meta-auto.csv
   ```
   Example: `https://portfolio.example.com/agent/metrics/seo-meta-auto.csv`

5. Click **Save changes**
6. Click **Save dashboard**

### Option B: GitHub Raw URL

**Best for**: Testing, no backend, public repos

1. Open the imported dashboard
2. Click **Dashboard settings** (gear icon)
3. Go to **JSON Model**
4. Find-and-replace:
   ```
   Find:    "url": "https://YOUR_HOST/agent/metrics/seo-meta-auto.csv
   Replace: "url": "https://raw.githubusercontent.com/leok974/leo-portfolio/metrics/agent/metrics/seo-meta-auto.csv
   ```

5. **Remove query parameters** (GitHub raw doesn't support `?limit_days=N`):
   - Panel 1 (Timeseries): Keep as-is, CSV will have all data
   - Panel 2 (Last Run): Use Grafana transforms to filter
   - Panel 3 (Recent Runs): Already uses transforms

6. Click **Save changes**
7. Click **Save dashboard**

---

## Step 5: Verify Dashboard

### Check Each Panel

1. **Timeseries: Pages vs Over-limit**
   - Should show line graph with 2 series
   - X-axis: Time (dates)
   - Y-axis: Count (numbers)
   - Legend: `pages_count` (blue), `over_count` (orange/red)

2. **Stat: Last Run**
   - Should show 3 large numbers
   - Pages / Over-limit / Skipped
   - Based on most recent run

3. **Table: Recent Runs**
   - Should show last 20 runs
   - Columns: ts, pages_count, over_count, skipped, pr_url
   - Sorted by timestamp (newest first)

### Troubleshooting

**Panel shows "No data"**:
- Verify CSV URL is accessible (open in browser)
- Check datasource is configured correctly
- Ensure metrics branch has data (`agent/metrics/seo-meta-auto.csv` exists)

**Panel shows "Error"**:
- Check browser console for CORS errors
- If using GitHub raw, ensure repo/branch is public
- If using API, verify endpoint is accessible

**Wrong data range**:
- API endpoint: Check `?limit_days=N` parameter
- GitHub raw: Adjust Grafana time picker or use transforms

---

## Complete URL Examples

### Backend API Endpoint URLs

```
# Panel 1: Timeseries (180 days)
https://portfolio.example.com/agent/metrics/seo-meta-auto.csv?limit_days=180

# Panel 2: Last Run (1 day)
https://portfolio.example.com/agent/metrics/seo-meta-auto.csv?limit_days=1

# Panel 3: Recent Runs (all data)
https://portfolio.example.com/agent/metrics/seo-meta-auto.csv?limit_days=3650
```

### GitHub Raw URLs

```
# All panels (no query params)
https://raw.githubusercontent.com/leok974/leo-portfolio/metrics/agent/metrics/seo-meta-auto.csv
```

---

## Advanced Configuration

### Add Variable for Date Range

1. Dashboard settings → **Variables** → **Add variable**
2. Configure:
   - **Name**: `days`
   - **Type**: Custom
   - **Values**: `7,30,90,180,365`
   - **Current**: `180`
3. Update panel queries to use: `?limit_days=$days`

### Set Up Alerts

Example: Alert when over-limit pages exceed threshold

1. Edit Panel 1 (Timeseries)
2. Go to **Alert** tab
3. Create alert rule:
   - **Condition**: `WHEN avg() OF query(A, 5m, now) IS ABOVE 5`
   - **For**: `5m`
   - **Annotations**: "High number of over-limit pages detected"
4. Configure notification channel (Slack, email, etc.)

### Add Annotations

Show PR events on timeline:

1. Dashboard settings → **Annotations**
2. Add annotation query:
   - **Datasource**: Infinity
   - **Query**: Same CSV URL
   - **Filter**: `skipped == false`
   - **Time field**: `ts`
   - **Text**: `pr_url`

---

## Maintenance

### Update Dashboard

When dashboard JSON is updated:

1. Export current dashboard (save customizations)
2. Import new `seo-meta-auto-dashboard.json`
3. Re-apply URL changes (Step 4)
4. Restore any custom variables/alerts

### Monitor Data Freshness

- CSV updates daily at 04:12 UTC (via workflow)
- JSONL appends nightly at 03:28 UTC
- Check `metrics` branch for latest timestamps

---

## Quick Reference

| Item | Value |
|------|-------|
| **Plugin** | yesoreyeram-infinity-datasource |
| **Datasource Name** | Infinity |
| **Dashboard File** | `grafana/seo-meta-auto-dashboard.json` |
| **API Endpoint** | `https://your-host.com/agent/metrics/seo-meta-auto.csv` |
| **GitHub Raw** | `https://raw.githubusercontent.com/leok974/leo-portfolio/metrics/agent/metrics/seo-meta-auto.csv` |
| **Default Range** | Last 180 days |
| **CSV Columns** | ts, repo, run_id, run_number, pages_count, over_count, skipped, reason, pr_number, pr_url |

---

## Support

**Dashboard Issues**: Check panel edit → Query inspector → Response

**Datasource Issues**: Configuration → Data sources → Infinity → Save & Test

**Data Issues**: Verify metrics branch has populated CSV/JSONL files

**Plugin Issues**: Check Grafana logs, reinstall plugin if needed
