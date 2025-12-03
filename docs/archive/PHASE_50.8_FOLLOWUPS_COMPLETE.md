# Phase 50.8 Follow-Ups - Complete ✅

**Status:** ✅ **COMPLETE** | **Date:** October 9, 2025 | **Components:** Rotation, Sampling, Rate Limits, Privacy, CI

## Overview

This patch adds production-ready enhancements to the Phase 50.8 Behavior Metrics system, including:
- JSONL rotation with gzip compression and retention policies
- Client and server-side sampling to reduce data volume
- Nginx rate limiting for ingestion endpoint protection
- Privacy documentation and data management policies
- Dedicated CI workflow for metrics testing

## Components Delivered

### 1. ✅ JSONL Rotation Script

**File:** `scripts/metrics_rotate.py`

**Features:**
- Daily rotation: `metrics-YYYY-MM-DD.jsonl`
- Size-based rotation: Configurable `--max-mb` threshold
- Gzip compression: Files older than `--gzip-after` days
- Retention policy: Delete files older than `--retention` days
- Loop mode: Runs continuously with `--interval` seconds
- Once mode: Single maintenance pass with `--once` flag

**Default Configuration:**
```bash
python scripts/metrics_rotate.py \
  --interval 300 \
  --gzip-after 3 \
  --retention 30 \
  --max-mb 64
```

**Features:**
- Symlink support: `metrics.jsonl` → `metrics-YYYY-MM-DD.jsonl`
- Graceful handling: Continues on OSError (file write failures don't break ring buffer)
- Multi-file support: Numbered shards when size limit exceeded (e.g., `metrics-2025-10-09.1.jsonl`)

---

### 2. ✅ Docker Compose Metrics Rotator Sidecar

**File:** `deploy/docker-compose.full.yml`

**Added Service:**
```yaml
metrics-rotator:
  image: python:3.12-alpine
  working_dir: /app
  command: ["python", "scripts/metrics_rotate.py", "--interval", "300", "--gzip-after", "3", "--retention", "30", "--max-mb", "64"]
  volumes:
    - ../:/app:ro
    - ../data:/app/data
  restart: unless-stopped
```

**Configuration:**
- **Image:** Lightweight Alpine-based Python 3.12
- **Volumes:** Read-only repo mount, writable data directory
- **Restart Policy:** Always restart unless explicitly stopped
- **Interval:** 5 minutes (300 seconds)
- **Gzip After:** 3 days
- **Retention:** 30 days
- **Max Size:** 64 MB per file

---

### 3. ✅ Frontend Sampling Support

**File:** `src/lib/metrics.ts`

**Changes:**
```typescript
const SAMPLE = Number(import.meta.env.VITE_METRICS_SAMPLE_RATE ?? "1");

function sampled(): boolean {
  return Math.random() < SAMPLE;
}

export async function sendEvent(evt: EventPayload, signal?: AbortSignal) {
  if (!sampled()) return { ok: true, sampledOut: true } as any;
  // ... rest of implementation
}
```

**Configuration:**
```bash
# .env
VITE_METRICS_SAMPLE_RATE=0.25  # 25% sampling (75% dropped)
VITE_METRICS_SAMPLE_RATE=1     # 100% (no sampling)
VITE_METRICS_SAMPLE_RATE=0.1   # 10% sampling (90% dropped)
```

**Benefits:**
- Reduces client-side network requests
- Lower backend load
- Enhanced privacy (fewer events sent)
- Configurable per environment (dev vs prod)

---

### 4. ✅ Server-Side Sampling

**File:** `assistant_api/routers/metrics_behavior.py`

**Changes:**
```python
_SAMPLE = float(os.getenv("METRICS_SAMPLE_RATE", "1.0"))

@router.post("/event", response_model=EventIngestResult, status_code=202)
async def ingest_event(...):
    import random

    # Server-side sampling
    if random.random() >= _SAMPLE:
        _ring.append(payload)  # still show in-memory occasionally
        return EventIngestResult(ok=True, stored=0, file=str(_SINK_PATH))

    # Normal write path ...
```

**Configuration:**
```bash
# .env or docker-compose env
METRICS_SAMPLE_RATE=0.5   # 50% sampling (50% to disk)
METRICS_SAMPLE_RATE=1.0   # 100% (no sampling)
METRICS_SAMPLE_RATE=0.1   # 10% sampling (90% dropped)
```

**Behavior:**
- **Sampled out events:** Still appear in ring buffer (for debug panel)
- **Disk writes:** Only sampled-in events written to JSONL
- **Response:** Returns 202 with `stored=0` for sampled-out events

---

### 5. ✅ Nginx Rate Limiting

**File:** `deploy/edge/nginx.conf`

**Changes:**
```nginx
# Top-level (http) context
limit_req_zone $binary_remote_addr zone=metrics_zone:10m rate=5r/s;
limit_req_status 429;

# Server context
location /api/metrics/event {
    proxy_pass http://backend:8000/api/metrics/event;
    limit_req zone=metrics_zone burst=10 nodelay;
    client_max_body_size 64k;
    # ... proxy headers
}
```

**Configuration:**
- **Rate:** 5 requests/second per IP address
- **Burst:** 10 additional requests allowed (queue)
- **Nodelay:** Requests processed immediately if within burst
- **Status:** Returns 429 (Too Many Requests) when exceeded
- **Body Limit:** 64 KB maximum request size
- **Zone Size:** 10 MB (stores ~160,000 IP addresses)

**Protection:**
- Prevents DoS attacks on metrics endpoint
- Limits abusive clients
- Fair resource allocation per IP
- Configurable thresholds

---

### 6. ✅ Privacy Documentation

**File:** `README.md` (added section)

**Privacy (Behavior Analytics):**
- **What We Collect:** Anonymous visitor_id, event names, timestamps, coarse metadata
- **What We Don't Collect:** No PII, no cookies, no IP storage
- **Data Management:** JSONL rotation, gzip after 3 days, delete after 30 days
- **Sampling:** Client (`VITE_METRICS_SAMPLE_RATE`) and server (`METRICS_SAMPLE_RATE`)
- **Rate Limiting:** 5 req/s with burst of 10
- **Full Policy:** Link to existing `/privacy.html`

**Existing File:** `privacy.html`
- Already contains comprehensive privacy policy
- Covers consent banner, tracking preferences, data practices
- No changes needed (already production-ready)

---

### 7. ✅ Dedicated E2E Metrics CI Workflow

**File:** `.github/workflows/e2e-metrics.yml`

**Jobs:**

#### Job 1: API Health and Tests
```yaml
api-health-and-tests:
  runs-on: ubuntu-latest
  steps:
    - Setup Python 3.11
    - Install dependencies
    - Start backend (uvicorn)
    - Wait for backend ready
    - Health check: POST event + GET snapshot
    - Health check: 200 response validation
    - Setup Node.js 20
    - Install Playwright
    - Run metrics E2E tests
    - Upload artifacts on failure
```

**Features:**
- Background uvicorn process with PID tracking
- 40 retry attempts with 3-second intervals (2 minutes total wait)
- Health check: POST sample event, GET snapshot
- Validates HTTP 200 response
- Runs `tests/e2e/metrics-behavior.spec.ts`
- Uploads backend logs and Playwright reports on failure

#### Job 2: Lint and Audit
```yaml
lint-and-audit:
  runs-on: ubuntu-latest
  steps:
    - Setup Python 3.11
    - Install ruff and pip-audit
    - Run ruff check on assistant_api/
    - Run pip-audit (continue-on-error)
```

**Features:**
- Fast Python linting with ruff
- Security scanning with pip-audit
- Non-blocking audit (warnings only)

**Triggers:**
- Push to `main` or `LINKEDIN-OPTIMIZED` branches (path-filtered)
- Pull requests (path-filtered)
- Manual dispatch
- Paths: `assistant_api/routers/metrics_behavior.py`, `models/metrics.py`, `tests/e2e/metrics-behavior.spec.ts`

---

### 8. ✅ .gitignore & CHANGELOG Updates

**File:** `.gitignore`

**Added Patterns:**
```gitignore
# Metrics sink & archives (specific patterns)
/data/metrics.jsonl
/data/metrics-*.jsonl
/data/metrics-*.jsonl.gz
```

**Rationale:**
- Exclude raw metrics files from version control
- Keep data directory structure tracked
- Protect sensitive analytics data
- Prevent large file commits

**File:** `CHANGELOG.md`

**Added Section:**
```markdown
- **Operations & Scaling (Phase 50.8 Follow-ups):**
  - JSONL Rotation script with gzip + retention
  - Docker Compose sidecar for automated maintenance
  - Client and server sampling (env-driven)
  - Nginx rate limiting for ingestion endpoint
  - Privacy documentation in README
  - Dedicated E2E metrics CI workflow
```

---

## Configuration Summary

### Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `VITE_METRICS_SAMPLE_RATE` | Frontend | `1` | Client-side sampling (0.0 to 1.0) |
| `METRICS_SAMPLE_RATE` | Backend | `1.0` | Server-side sampling (0.0 to 1.0) |
| `METRICS_RING_CAPACITY` | Backend | `500` | In-memory ring buffer size |
| `METRICS_JSONL` | Backend | `./data/metrics.jsonl` | JSONL sink file path |
| `METRICS_DIR` | Rotator | `./data` | Directory for rotation script |

### Rotation Script Arguments

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--max-mb` | float | None | Rotate when file size >= MB |
| `--gzip-after` | int | 3 | Gzip files older than N days |
| `--retention` | int | 30 | Delete files older than N days |
| `--interval` | int | 300 | Loop sleep seconds |
| `--once` | flag | False | Run single pass and exit |

### Nginx Rate Limiting

| Parameter | Value | Description |
|-----------|-------|-------------|
| Rate | 5r/s | Requests per second per IP |
| Burst | 10 | Additional queued requests |
| Zone Size | 10m | Memory for IP tracking |
| Body Limit | 64k | Max request size |
| Status Code | 429 | Too Many Requests |

---

## Usage Examples

### Manual Rotation (Once)
```bash
python scripts/metrics_rotate.py --once --gzip-after 3 --retention 30 --max-mb 64
```

### Loop Mode (Continuous)
```bash
python scripts/metrics_rotate.py --interval 300 --gzip-after 3 --retention 30 --max-mb 64
```

### Production Sampling Configuration
```bash
# Frontend (25% sampling)
VITE_METRICS_SAMPLE_RATE=0.25

# Backend (50% sampling)
METRICS_SAMPLE_RATE=0.5

# Combined: 12.5% of all events reach disk (0.25 * 0.5)
```

### Development (Full Tracking)
```bash
# Frontend (no sampling)
VITE_METRICS_SAMPLE_RATE=1

# Backend (no sampling)
METRICS_SAMPLE_RATE=1.0
```

---

## Testing & Validation

### Rotation Script Testing
```bash
# Create test events
for i in {1..1000}; do
  curl -X POST http://127.0.0.1:8001/api/metrics/event \
    -H 'Content-Type: application/json' \
    -d "{\"visitor_id\":\"test-$i\",\"event\":\"page_view\",\"metadata\":{}}"
done

# Run rotation once
python scripts/metrics_rotate.py --once --max-mb 1

# Verify files
ls -lh data/metrics*.jsonl*
```

### Sampling Validation
```bash
# Set 10% client sampling
VITE_METRICS_SAMPLE_RATE=0.1 npm run dev

# Monitor backend logs for stored=0 vs stored=1 responses
tail -f backend.log | grep "stored"
```

### Rate Limit Testing
```bash
# Burst test (should see 429 after 15 requests)
for i in {1..20}; do
  curl -w "\n%{http_code}\n" -X POST http://localhost:8080/api/metrics/event \
    -H 'Content-Type: application/json' \
    -d "{\"visitor_id\":\"burst-$i\",\"event\":\"test\",\"metadata\":{}}"
done
```

---

## CI/CD Integration

### Workflow Triggers

| Workflow | Triggers | Tests Metrics |
|----------|----------|---------------|
| `ci.yml` | Push/PR (main, polish) | ✅ metrics-behavior.spec.ts |
| `backend-tests.yml` | Push/PR (main) | ✅ Health check (staging) |
| `public-smoke.yml` | Schedule (30m), PR | ✅ Health check (prod) |
| `e2e-metrics.yml` | Push/PR (path-filtered), dispatch | ✅ Dedicated metrics tests + lint |

### Path Filters
```yaml
paths:
  - 'assistant_api/routers/metrics_behavior.py'
  - 'assistant_api/models/metrics.py'
  - 'tests/e2e/metrics-behavior.spec.ts'
  - '.github/workflows/e2e-metrics.yml'
```

---

## Architecture Notes

### Data Flow with Sampling

```
Browser (25% sampling)
    ↓ (25% sent)
Nginx (rate limiting: 5 req/s)
    ↓
Backend (50% sampling)
    ↓ (12.5% total to disk)
Ring Buffer (all sampled-in)
    ↓
JSONL Sink (sampled-in only)
    ↓
Rotation Script (daily + size-based)
    ↓
Gzip (after 3 days)
    ↓
Deletion (after 30 days)
```

### Sampling Math

| Client Rate | Server Rate | Effective Rate | Example (10k events) |
|-------------|-------------|----------------|----------------------|
| 100% (1.0) | 100% (1.0) | 100% | 10,000 to disk |
| 50% (0.5) | 100% (1.0) | 50% | 5,000 to disk |
| 100% (1.0) | 50% (0.5) | 50% | 5,000 to disk |
| 50% (0.5) | 50% (0.5) | 25% | 2,500 to disk |
| 25% (0.25) | 50% (0.5) | 12.5% | 1,250 to disk |

### Retention Timeline

```
Day 0: Event created → metrics-2025-10-09.jsonl
Day 1: Still readable as .jsonl
Day 2: Still readable as .jsonl
Day 3: Gzipped → metrics-2025-10-09.jsonl.gz
...
Day 30: Deleted automatically
```

---

## Security & Privacy

### Data Minimization
- Client sampling reduces data sent over network
- Server sampling reduces data stored on disk
- Rate limiting prevents abuse and excessive collection
- Retention policy ensures old data is deleted

### Anonymization
- No PII collected (visitor_id is random hash)
- No IP address storage (beyond standard nginx logs)
- No cookies (localStorage only for visitor_id)
- No third-party tracking

### Access Control
- Data files in `/data/` directory (excluded from version control)
- Docker volumes with restricted permissions
- Nginx rate limiting per IP address
- Backend sampling adds additional control layer

---

## Performance Impact

### Frontend (with 25% sampling)
- **Network Requests:** Reduced by 75%
- **CPU Usage:** Minimal (random number generation)
- **Memory:** No impact
- **Latency:** No blocking (async + sampling happens before network call)

### Backend (with 50% sampling)
- **Disk I/O:** Reduced by 50%
- **CPU Usage:** Minimal (random number generation per request)
- **Memory:** Ring buffer always full (sampling doesn't affect)
- **Latency:** No impact on response time

### Nginx Rate Limiting
- **CPU Usage:** Minimal (efficient zone lookup)
- **Memory:** 10 MB for IP tracking
- **Latency:** No impact under normal load
- **Protection:** Prevents resource exhaustion

---

## Troubleshooting

### Rotation Script Issues

**Problem:** Files not rotating
```bash
# Check if symlink exists
ls -la data/metrics.jsonl

# Verify permissions
ls -ld data/

# Run with debug output
python scripts/metrics_rotate.py --once
```

**Problem:** Gzip failing
```bash
# Check disk space
df -h

# Verify gzip installed (Alpine)
apk add gzip

# Test manual gzip
gzip -c data/metrics-2025-10-09.jsonl > test.gz
```

### Sampling Issues

**Problem:** Too many events reaching disk
```bash
# Check environment variables
echo $VITE_METRICS_SAMPLE_RATE
echo $METRICS_SAMPLE_RATE

# Verify backend logs
grep "stored=0" backend.log | wc -l  # Sampled out
grep "stored=1" backend.log | wc -l  # Sampled in
```

### Rate Limiting Issues

**Problem:** Legitimate requests being blocked
```bash
# Check nginx zone size
# Increase rate in nginx.conf:
limit_req_zone $binary_remote_addr zone=metrics_zone:10m rate=10r/s;

# Increase burst:
limit_req zone=metrics_zone burst=20 nodelay;

# Reload nginx
docker compose -f deploy/docker-compose.full.yml exec edge nginx -s reload
```

---

## Future Enhancements

### Potential Improvements

1. **Aggregation Pipeline:**
   - Pre-aggregate events before disk write
   - Reduce storage by storing counts instead of individual events
   - Daily/hourly rollups

2. **Rotation Enhancements:**
   - S3/cloud storage upload
   - Automatic backup before deletion
   - Configurable compression levels

3. **Sampling Strategies:**
   - Importance-based sampling (prioritize certain events)
   - Dynamic sampling based on load
   - Per-event sampling rates

4. **Monitoring:**
   - Prometheus metrics export
   - Grafana dashboard for rotation stats
   - Alerting on disk space, rotation failures

5. **Privacy Features:**
   - Event TTL per type
   - User-triggered data deletion API
   - Differential privacy techniques

---

## Summary

**Phase 50.8 Follow-Ups Delivered:**
1. ✅ JSONL rotation script with gzip + retention
2. ✅ Docker Compose metrics-rotator sidecar
3. ✅ Frontend sampling (`VITE_METRICS_SAMPLE_RATE`)
4. ✅ Server-side sampling (`METRICS_SAMPLE_RATE`)
5. ✅ Nginx rate limiting (5 req/s, burst 10)
6. ✅ Privacy documentation (README + existing privacy.html)
7. ✅ Dedicated E2E metrics CI workflow
8. ✅ .gitignore patterns + CHANGELOG updates

**Total Files Modified:** 6
- `scripts/metrics_rotate.py` (created)
- `deploy/docker-compose.full.yml` (added service)
- `src/lib/metrics.ts` (added sampling)
- `assistant_api/routers/metrics_behavior.py` (added sampling)
- `deploy/edge/nginx.conf` (added rate limiting)
- `README.md` (added privacy section)
- `.github/workflows/e2e-metrics.yml` (created)
- `.gitignore` (added patterns)
- `CHANGELOG.md` (updated)

**Configuration Variables:** 5 environment variables
**CI Workflows:** 4 workflows now test metrics
**Documentation:** Comprehensive privacy and operations docs

All production-ready enhancements complete! The metrics system now includes robust data management, privacy controls, and operational tooling. 🚀
