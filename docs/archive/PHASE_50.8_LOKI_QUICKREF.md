# Loki + Promtail Quick Reference

## 🚀 Quick Start

```bash
# Start services
cd deploy
docker-compose -f docker-compose.full.yml up -d loki promtail

# Verify Loki
curl http://localhost:3100/ready

# Verify Promtail
curl http://localhost:9080/targets
```

---

## 📊 Essential LogQL Queries

### Rate Limiting (429s)

```logql
# Count 429s in last 5 minutes
sum(count_over_time({job="nginx"} | json | status="429" [5m]))

# 429 rate per second
rate({job="nginx"} | json | status="429" [5m])

# Percentage rate-limited
(sum(rate({job="nginx"} | json | status="429" [5m])) /
 sum(rate({job="nginx"} | json [5m]))) * 100

# Top rate-limited IPs
topk(10, sum by (remote_addr) (
  count_over_time({job="nginx"} | json | status="429" [1h])
))
```

### Performance

```logql
# P95 request time
histogram_quantile(0.95,
  sum(rate({job="nginx"} | json | unwrap request_time [5m])) by (le)
)

# Slow requests (>1s)
{job="nginx"} | json | request_time > 1.0

# Average by endpoint
avg by (uri) (rate({job="nginx"} | json | unwrap request_time [5m]))
```

### Traffic Analysis

```logql
# Top 10 endpoints
topk(10, sum by (uri) (count_over_time({job="nginx"} | json [15m])))

# Status distribution
sum by (status) (rate({job="nginx"} | json [5m]))

# Metrics endpoint only
{job="nginx"} | json | uri =~ "/api/metrics/.*"
```

### Errors

```logql
# All errors (4xx/5xx)
{job="nginx"} | json | status=~"4..|5.."

# Error rate
sum by (status) (count_over_time({job="nginx"} | json | status=~"4..|5.." [5m]))

# Backend errors
{job="nginx"} | json | status=~"5.." | upstream_response_time != ""
```

---

## 🎯 Grafana Dashboard Panels

### Panel 1: Request Rate (Stacked)
```logql
sum by (status) (rate({job="nginx"} | json [5m]))
```
**Type**: Time series (stacked area)

### Panel 2: Rate Limit Gauge
```logql
(sum(rate({job="nginx"} | json | status="429" [5m])) /
 sum(rate({job="nginx"} | json [5m]))) * 100
```
**Type**: Gauge | **Threshold**: 5% warn, 10% critical

### Panel 3: P95 Latency
```logql
histogram_quantile(0.95,
  sum(rate({job="nginx"} | json | unwrap request_time [5m])) by (le)
)
```
**Type**: Time series (line)

### Panel 4: Top Endpoints
```logql
topk(10, sum by (uri) (count_over_time({job="nginx"} | json [5m])))
```
**Type**: Bar chart (horizontal)

### Panel 5: Error Log Stream
```logql
{job="nginx"} | json | status=~"4..|5.."
```
**Type**: Logs panel

---

## 🔔 Alert Rules

### High Rate Limit Rate
```yaml
expr: |
  (sum(rate({job="nginx"} | json | status="429" [5m])) /
   sum(rate({job="nginx"} | json [5m]))) > 0.1
for: 10m
message: "{{ $value | humanizePercentage }} of requests rate-limited"
```

### Slow Requests
```yaml
expr: |
  histogram_quantile(0.95,
    sum(rate({job="nginx"} | json | unwrap request_time [5m])) by (le)
  ) > 2.0
for: 5m
message: "P95 request time: {{ $value }}s"
```

### Backend Errors
```yaml
expr: |
  sum(rate({job="nginx"} | json | status=~"5.." [5m])) > 0
for: 5m
message: "Backend error rate: {{ $value }}/s"
```

---

## 🔧 Troubleshooting Commands

```bash
# Check Promtail targets
curl http://localhost:9080/targets | jq .

# View Loki config
curl http://localhost:3100/config | jq .limits_config

# Check log ingestion rate
curl -G "http://localhost:3100/loki/api/v1/query" \
  --data-urlencode 'query=rate({job="nginx"}[1m])' | jq .

# View Promtail logs
docker-compose logs promtail --tail=50

# View Loki logs
docker-compose logs loki --tail=50

# Test nginx JSON format
docker-compose exec edge tail -n 1 /var/log/nginx/access.json.log | jq .

# Check disk usage
docker-compose exec loki du -sh /loki/chunks
```

---

## 📦 Files Created

```
deploy/
├── loki/
│   └── local-config.yaml        # Loki server config (30-day retention)
├── promtail/
│   └── promtail.yaml            # Log scraping config
├── edge/
│   └── nginx.conf               # Updated with JSON logging
└── docker-compose.full.yml      # Added loki + promtail services
```

---

## 🎨 JSON Log Format

```json
{
  "time": "2025-10-09T12:34:56+00:00",
  "remote_addr": "192.168.1.100",
  "method": "POST",
  "uri": "/api/metrics/event",
  "status": 429,
  "body_bytes_sent": 169,
  "referrer": "https://example.com/",
  "agent": "Mozilla/5.0...",
  "request_time": 0.023,
  "upstream_response_time": "0.021",
  "limit_req_status": "REJECTED"
}
```

---

## 💡 Tips

- **Query performance**: Add `| line_format "{{.message}}"` to limit output
- **Exact matching**: Use `uri="/api/metrics/event"` (no regex)
- **Regex matching**: Use `uri=~"/api/metrics/.*"`
- **Time ranges**: `[5m]` = 5 minutes, `[1h]` = 1 hour, `[1d]` = 1 day
- **Aggregation**: Always use `by (label)` for grouping

---

## 🚦 Health Checks

```bash
# Loki ready
curl http://localhost:3100/ready
# Response: "ready"

# Loki metrics
curl http://localhost:3100/metrics | grep loki_ingester_streams

# Promtail ready
curl http://localhost:9080/ready
# Response: "Ready"

# Promtail metrics
curl http://localhost:9080/metrics | grep promtail_sent
```

---

## 📈 Capacity Planning

| Traffic Level | Retention | Est. Storage |
|--------------|-----------|--------------|
| 100 req/min  | 30 days   | ~100 MB      |
| 1,000 req/min| 30 days   | ~1 GB        |
| 10,000 req/min| 7 days   | ~2 GB        |

**Formula**: `(req/min × 60 × 24 × days × 200 bytes) / compression_ratio(10)`

---

## 🔄 Maintenance

```bash
# Restart services
docker-compose restart loki promtail

# View retention cleanup logs
docker-compose logs loki | grep compactor

# Manually delete old logs
curl -X POST "http://localhost:3100/loki/api/v1/delete?query={job=\"nginx\"}&start=0&end=1633046400"

# Backup Loki data
docker-compose exec loki tar czf /tmp/loki-backup.tar.gz /loki/chunks
docker cp $(docker-compose ps -q loki):/tmp/loki-backup.tar.gz ./

# Restore Loki data
docker cp ./loki-backup.tar.gz $(docker-compose ps -q loki):/tmp/
docker-compose exec loki tar xzf /tmp/loki-backup.tar.gz -C /
docker-compose restart loki
```

---

**Quick Reference for Phase 50.8 Loki Integration**
See `PHASE_50.8_LOKI_INTEGRATION.md` for full documentation.
