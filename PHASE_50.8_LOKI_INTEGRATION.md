# Phase 50.8 - Loki + Promtail Logging Integration

**Date**: October 9, 2025
**Status**: ✅ Complete
**Purpose**: Structured logging and monitoring for behavior metrics system

---

## Overview

This integration adds **Loki** (log aggregation) and **Promtail** (log shipper) to the Phase 50.8 behavior metrics system, enabling:

- **Structured JSON logging** from nginx edge proxy
- **Real-time log aggregation** with Loki
- **Powerful querying** with LogQL (Loki Query Language)
- **Rate limit monitoring** (429 responses tracking)
- **Performance analysis** (request times, upstream latency)
- **Centralized logging** for nginx, backend, and maintenance scripts

---

## Architecture

```
┌─────────────────┐
│  Nginx Edge     │  → JSON logs → /var/log/nginx/access.json.log
└────────┬────────┘
         │
         ↓ scrape
┌─────────────────┐
│  Promtail       │  → parse JSON → extract labels (method, status, uri)
└────────┬────────┘
         │
         ↓ push
┌─────────────────┐
│  Loki           │  → store logs → query with LogQL
└────────┬────────┘
         │
         ↓ query
┌─────────────────┐
│  Grafana        │  → visualize → dashboards + alerts
└─────────────────┘
```

---

## Components Added

### 1. Nginx JSON Logging

**File**: `deploy/edge/nginx.conf`

**Configuration** (lines 9-30):
```nginx
# JSON structured logging for Loki + Promtail
log_format json_combined escape=json
  '{'
  '"time":"$time_iso8601",'
  '"remote_addr":"$remote_addr",'
  '"method":"$request_method",'
  '"uri":"$request_uri",'
  '"status":$status,'
  '"body_bytes_sent":$body_bytes_sent,'
  '"referrer":"$http_referer",'
  '"agent":"$http_user_agent",'
  '"request_time":$request_time,'
  '"upstream_response_time":"$upstream_response_time",'
  '"limit_req_status":"$limit_req_status"'
  '}';

access_log /var/log/nginx/access.json.log json_combined;
```

**Fields**:
- `time` - ISO 8601 timestamp
- `remote_addr` - Client IP address
- `method` - HTTP method (GET, POST, etc.)
- `uri` - Request URI
- `status` - HTTP status code (200, 429, etc.)
- `body_bytes_sent` - Response size
- `request_time` - Total request duration (seconds)
- `upstream_response_time` - Backend response time
- `limit_req_status` - Rate limit status (PASSED, REJECTED, etc.)

---

### 2. Loki Configuration

**File**: `deploy/loki/local-config.yaml`

**Key Settings**:
```yaml
# Storage
common:
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules

# Retention: 30 days (matches metrics retention)
limits_config:
  retention_period: 720h  # 30 days

# Compactor for log cleanup
compactor:
  retention_enabled: true
  retention_delete_delay: 2h
```

**Features**:
- Filesystem storage (simple, no external DB)
- 30-day retention (automatic cleanup)
- Single-binary deployment
- Port 3100 for API

---

### 3. Promtail Configuration

**File**: `deploy/promtail/promtail.yaml`

**Scrape Configs**:

#### A. Nginx JSON Logs
```yaml
- job_name: nginx_json
  static_configs:
    - targets: [localhost]
      labels:
        job: nginx
        component: edge
        __path__: /var/log/nginx/access.json.log

  pipeline_stages:
    - json:  # Parse JSON
        expressions:
          time: time
          method: method
          uri: uri
          status: status
          request_time: request_time
          limit_req_status: limit_req_status

    - labels:  # Extract for querying
        method:
        status:
        uri:
        limit_req_status:

    - timestamp:  # Use nginx timestamp
        source: time
        format: RFC3339
```

#### B. Backend Logs (Optional)
```yaml
- job_name: backend_logs
  static_configs:
    - targets: [localhost]
      labels:
        job: backend
        component: api
        __path__: /var/log/assistant_api/*.log
```

#### C. Metrics Rotator Logs
```yaml
- job_name: metrics_rotator
  static_configs:
    - targets: [localhost]
      labels:
        job: metrics_rotator
        component: maintenance
        __path__: /var/log/metrics_rotator/*.log
```

---

### 4. Docker Compose Integration

**File**: `deploy/docker-compose.full.yml`

**New Services**:

```yaml
loki:
  image: grafana/loki:2.9.4
  command: -config.file=/etc/loki/local-config.yaml
  ports:
    - "127.0.0.1:3100:3100"
  volumes:
    - ./loki/local-config.yaml:/etc/loki/local-config.yaml:ro
    - loki-data:/loki
  restart: unless-stopped

promtail:
  image: grafana/promtail:2.9.4
  command: -config.file=/etc/promtail/config.yml
  volumes:
    - ./promtail/promtail.yaml:/etc/promtail/config.yml:ro
    - /var/log/nginx:/var/log/nginx:ro
    - ../data/logs:/var/log/assistant_api:ro
  depends_on:
    - loki
  restart: unless-stopped
```

**Volumes**:
- `loki-data` - Persistent log storage
- `promtail-positions` - Track scrape positions

---

## LogQL Queries

### 1. Rate Limit Monitoring (429 Responses)

**Count 429s over 5 minutes**:
```logql
sum by (status) (
  count_over_time({job="nginx"} | json | status="429" [5m])
)
```

**429 rate per minute**:
```logql
rate({job="nginx"} | json | status="429" [5m])
```

**Percentage of rate-limited requests**:
```logql
sum(rate({job="nginx"} | json | status="429" [5m])) /
sum(rate({job="nginx"} | json [5m])) * 100
```

---

### 2. Performance Monitoring

**Request duration histogram**:
```logql
histogram_quantile(0.95,
  sum(rate({job="nginx"} | json | unwrap request_time [5m])) by (le)
)
```

**Slow requests (>1 second)**:
```logql
{job="nginx"} | json | request_time > 1.0
```

**Average request time by endpoint**:
```logql
avg by (uri) (
  rate({job="nginx"} | json | unwrap request_time [5m])
)
```

---

### 3. Traffic Analysis

**Top endpoints by volume**:
```logql
topk(10, sum by (uri) (
  count_over_time({job="nginx"} | json | uri!="" [15m])
))
```

**Status code distribution**:
```logql
sum by (status) (
  rate({job="nginx"} | json [5m])
)
```

**Metrics endpoint traffic**:
```logql
{job="nginx"} | json | uri =~ "/api/metrics/.*"
```

---

### 4. Error Tracking

**All 4xx/5xx errors**:
```logql
{job="nginx"} | json | status=~"4..|5.."
```

**Error rate over time**:
```logql
sum by (status) (
  count_over_time({job="nginx"} | json | status=~"4..|5.." [5m])
)
```

**Backend errors (5xx from upstream)**:
```logql
{job="nginx"} | json | status=~"5.." | upstream_response_time != ""
```

---

### 5. Rate Limit Analysis

**Rate limit status breakdown**:
```logql
sum by (limit_req_status) (
  count_over_time({job="nginx"} | json | limit_req_status!="" [10m])
)
```

**Rate-limited IPs (top offenders)**:
```logql
topk(10, sum by (remote_addr) (
  count_over_time({job="nginx"} | json | status="429" [1h])
))
```

**Rate limit triggered per endpoint**:
```logql
sum by (uri) (
  count_over_time({job="nginx"} | json | limit_req_status="REJECTED" [15m])
)
```

---

## Grafana Integration

### Setup Steps

1. **Add Loki as data source**:
   - URL: `http://loki:3100`
   - Access: Server (default)
   - Save & Test

2. **Import dashboard**:
   - Dashboard ID: `13639` (Nginx Loki dashboard)
   - Or create custom dashboard with queries above

3. **Create alerts**:
   - High 429 rate
   - Slow requests
   - Error spike

---

### Example Dashboard Panels

#### Panel 1: Request Rate by Status
```logql
sum by (status) (rate({job="nginx"} | json [5m]))
```
**Visualization**: Time series (stacked area)

#### Panel 2: 429 Rate Limit Percentage
```logql
(sum(rate({job="nginx"} | json | status="429" [5m])) /
 sum(rate({job="nginx"} | json [5m]))) * 100
```
**Visualization**: Gauge (threshold at 5%)

#### Panel 3: Top Endpoints
```logql
topk(10, sum by (uri) (count_over_time({job="nginx"} | json [5m])))
```
**Visualization**: Bar chart

#### Panel 4: Request Duration P95
```logql
histogram_quantile(0.95,
  sum(rate({job="nginx"} | json | unwrap request_time [5m])) by (le)
)
```
**Visualization**: Time series (line)

#### Panel 5: Rate-Limited IPs
```logql
topk(5, sum by (remote_addr) (
  count_over_time({job="nginx"} | json | status="429" [10m])
))
```
**Visualization**: Table

---

## Alerting Rules

### Alert 1: High Rate Limit Rate

```yaml
# Grafana alert rule
name: High Metrics Rate Limit Rate
expr: |
  (sum(rate({job="nginx"} | json | status="429" | uri=~"/api/metrics/.*" [5m])) /
   sum(rate({job="nginx"} | json | uri=~"/api/metrics/.*" [5m]))) > 0.1
for: 10m
annotations:
  summary: "High rate of 429 responses on metrics endpoint (>10%)"
  description: "{{ $value | humanizePercentage }} of metrics requests are being rate-limited"
```

### Alert 2: Slow Requests

```yaml
name: Slow Metrics Requests
expr: |
  histogram_quantile(0.95,
    sum(rate({job="nginx"} | json | uri=~"/api/metrics/.*" | unwrap request_time [5m])) by (le)
  ) > 2.0
for: 5m
annotations:
  summary: "P95 request time for metrics endpoint >2 seconds"
```

### Alert 3: Backend Errors

```yaml
name: Metrics Backend Errors
expr: |
  sum(rate({job="nginx"} | json | uri=~"/api/metrics/.*" | status=~"5.." [5m])) > 0
for: 5m
annotations:
  summary: "Backend errors on metrics endpoints"
```

---

## Deployment

### 1. Start Services

```bash
# Start full stack with logging
cd deploy
docker-compose -f docker-compose.full.yml up -d

# Verify Loki
curl http://localhost:3100/ready
# Should return: "ready"

# Verify Promtail
curl http://localhost:9080/targets
# Should show nginx_json job
```

### 2. Verify Log Ingestion

```bash
# Query Loki directly
curl -G -s "http://localhost:3100/loki/api/v1/query" \
  --data-urlencode 'query={job="nginx"}' \
  | jq .

# Should return recent nginx logs
```

### 3. Generate Test Traffic

```bash
# Generate some events
for i in {1..50}; do
  curl -X POST http://localhost:8080/api/metrics/event \
    -H 'Content-Type: application/json' \
    -d "{\"visitor_id\":\"test-$i\",\"event\":\"page_view\",\"metadata\":{}}"
done

# Trigger rate limiting (send >15 req/s)
for i in {1..100}; do
  curl -s -o /dev/null http://localhost:8080/api/metrics/event \
    -H 'Content-Type: application/json' \
    -d '{"visitor_id":"test","event":"page_view","metadata":{}}' &
done
wait
```

### 4. Query Logs

```bash
# Count 429 responses in last 5 minutes
curl -G -s "http://localhost:3100/loki/api/v1/query" \
  --data-urlencode 'query=sum(count_over_time({job="nginx"} | json | status="429" [5m]))' \
  | jq .

# Top endpoints
curl -G -s "http://localhost:3100/loki/api/v1/query" \
  --data-urlencode 'query=topk(5, sum by (uri) (count_over_time({job="nginx"} | json [5m])))' \
  | jq .
```

---

## Troubleshooting

### Issue 1: No logs in Loki

**Check Promtail targets**:
```bash
curl http://localhost:9080/targets | jq .
```

**Verify log file paths**:
```bash
docker-compose exec promtail ls -la /var/log/nginx/
docker-compose exec edge ls -la /var/log/nginx/
```

**Check Promtail logs**:
```bash
docker-compose logs promtail | tail -n 50
```

### Issue 2: JSON parsing errors

**Test JSON format**:
```bash
docker-compose exec edge tail -n 1 /var/log/nginx/access.json.log | jq .
```

**Verify log_format**:
```bash
docker-compose exec edge nginx -T | grep -A 20 "log_format json_combined"
```

### Issue 3: Loki storage growing

**Check retention settings**:
```bash
curl http://localhost:3100/config | jq '.limits_config.retention_period'
```

**Manually trigger compaction**:
```bash
curl -X POST http://localhost:3100/loki/api/v1/delete?query={job="nginx"}&start=0&end=$(date -d '31 days ago' +%s)
```

---

## Performance Considerations

### Log Volume Estimation

**Assumptions**:
- 100 requests/minute average
- ~200 bytes per JSON log line
- Retention: 30 days

**Calculation**:
```
100 req/min × 60 min × 24 hr × 30 days = 4,320,000 requests
4,320,000 × 200 bytes = ~864 MB raw logs
Compressed (gzip ~10:1): ~86 MB
```

**Recommendation**: 1-2 GB disk space for Loki data volume

### Tuning Tips

**High traffic** (>1000 req/min):
- Reduce retention: `retention_period: 168h` (7 days)
- Sample logs: Only log errors + rate limits
- Increase compaction: `compaction_interval: 5m`

**Low traffic** (<100 req/min):
- Keep default settings
- Enable all logs
- Consider longer retention: `retention_period: 2160h` (90 days)

---

## Integration with Phase 50.8

### Metrics Flow with Logging

```
Client → POST /api/metrics/event
    ↓
Nginx (JSON log: method, uri, status, request_time, limit_req_status)
    ↓
Backend (202 Accepted)
    ↓
Promtail (scrape + parse)
    ↓
Loki (store + query)
    ↓
Grafana (visualize + alert)
```

### Unified Monitoring

**Before** (Phase 50.8):
- Metrics: JSONL files + rotation
- Monitoring: Manual log inspection

**After** (Phase 50.8 + Loki):
- Metrics: JSONL files + rotation (unchanged)
- Monitoring: Real-time LogQL queries
- Alerting: Grafana alerts on 429 rate, errors, slow requests
- Analysis: Historical trends, top endpoints, rate limit patterns

---

## Summary

### Components Added ✅

- ✅ Nginx JSON structured logging
- ✅ Loki log aggregation server
- ✅ Promtail log shipper
- ✅ Docker Compose integration
- ✅ LogQL query examples
- ✅ Grafana dashboard templates
- ✅ Alert rule examples

### Benefits

- **Real-time monitoring** of rate limiting effectiveness
- **Performance analysis** with request duration tracking
- **Error tracking** with status code aggregations
- **Traffic patterns** with endpoint volume analysis
- **Abuse detection** with top IP analysis
- **Centralized logging** for all Phase 50.8 components

### Next Steps

1. Deploy services: `docker-compose up -d`
2. Configure Grafana data source
3. Import or create dashboards
4. Set up alert rules
5. Monitor for 1 week and adjust thresholds

---

**Phase 50.8 + Loki Integration**: ✅ **COMPLETE**

Structured logging and monitoring now fully integrated with behavior metrics system.
