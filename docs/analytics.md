# Analytics & Privacy

- Honor DNT (Do Not Track) via `ANALYTICS_RESPECT_DNT=1` (default on).
- No cookies; anonymous session stored in `localStorage` (random UUID, client-only).
- No IP stored; coarse region only via `CF-IPCountry` header when behind Cloudflare.
- Optional raw events table when `ANALYTICS_PERSIST=1`.

## PromQL examples

- Page views (24h):
```
sum by (path) (increase(page_view_total[24h]))
```
- Dwell time p95 (5m window):
```
histogram_quantile(0.95, sum(rate(dwell_time_seconds_bucket[5m])) by (le))
```
- Top project clicks (7d):
```
topk(10, sum(increase(project_click_total[7d])) by (project_id))
```
- Agent intents (24h):
```
sum by (intent) (increase(agent_request_total[24h]))
```
- LCP p90 by path (10m rate):
```
histogram_quantile(0.9, sum by (le,path) (rate(web_vitals_lcp_seconds_bucket[10m])))
```

- Outbound link clicks (top kinds, 7d):
```
sum(increase(link_click_total[7d])) by (kind)
```
- Top outbound domains (30d):
```
topk(10, sum(increase(link_click_total[30d])) by (href_domain))
```
- Link clicks time series by kind (1h):
```
sum by (kind) (increase(link_click_total[1h]))
```

- Resume downloads (30d, server-side counter):
```
increase(resume_download_total[30d])
```

### Day-of-Week / Hour-of-Day (last 30 days)

Visitors by day of week:

```
sum by (dow) (increase(page_view_by_dow_hour_total[30d]))
```

Visitors by hour of day:

```
sum by (hour) (increase(page_view_by_dow_hour_total[30d]))
```

Stacked series by day of week (hourly bins):

```
sum by (dow) (increase(page_view_by_dow_hour_total[1h]))
```

> Note: We use Python’s weekday numbering: 0=Mon … 6=Sun (Eastern Time by default). Override with `ANALYTICS_TZ`, e.g., `ANALYTICS_TZ=Europe/London`.

### Day/Hour + Path Group

Top path groups (last 30d):

```
sum by (path_group) (increase(page_view_by_dow_hour_path_total[30d]))
```

Hourly visitors stacked by path group (last 24h):

```
sum by (path_group) (increase(page_view_by_dow_hour_path_total[1h]))
```

Device split variant (last 24h):

```
sum by (device) (increase(page_view_by_dow_hour_path_device_total[24h]))
```

By path group and device (30d):

```
sum by (path_group, device) (increase(page_view_by_dow_hour_path_device_total[30d]))
```

Device values are normalized to: mobile, tablet, desktop, or unknown.

## Quick checks (PowerShell)

```powershell
# 1) Run unit tests
D:/leo-portfolio/.venv/Scripts/python.exe -m pytest -q tests/test_analytics_collect.py

# Link clicks test
D:/leo-portfolio/.venv/Scripts/python.exe -m pytest -q tests/test_analytics_links.py

# Resume download server metric
D:/leo-portfolio/.venv/Scripts/python.exe -m pytest -q tests/test_resume_download_metric.py

# 2) Local smoke: load home, click a project card, then:
Invoke-WebRequest http://127.0.0.1:8023/metrics | Select-String "page_view_total"
Invoke-WebRequest http://127.0.0.1:8023/metrics | Select-String "project_click_total"
# Verify outbound link clicks metric appears after posting a sample event
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8023/analytics/collect -ContentType application/json -Body '{"type":"link_click","kind":"github","href":"https://github.com/leok974"}' | Out-Null
Invoke-WebRequest http://127.0.0.1:8023/metrics | Select-String "link_click_total"
```
