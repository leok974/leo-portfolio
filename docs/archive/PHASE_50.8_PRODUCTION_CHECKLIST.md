# Phase 50.8 Production Deployment Checklist

## Overview
Before deploying Phase 50.8 behavior metrics to production, verify the following configuration and operational settings.

---

## 1. CORS Configuration

**Backend**: `assistant_api/main.py`

- [ ] Verify `ALLOWED_ORIGINS` includes your production domains
  ```python
  ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
  ```
- [ ] Set environment variable:
  ```bash
  ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
  ```
- [ ] Test OPTIONS preflight request returns correct headers

---

## 2. Environment Variables

### Frontend (Vite Build)

- [ ] `VITE_API_BASE_URL` points to production edge proxy
  ```bash
  VITE_API_BASE_URL=https://api.your-domain.com
  ```
- [ ] `VITE_METRICS_SAMPLE_RATE` set to production value (recommended: 0.25 or lower)
  ```bash
  VITE_METRICS_SAMPLE_RATE=0.25  # 25% of clients send events
  ```

### Backend (FastAPI)

- [ ] `METRICS_SAMPLE_RATE` set if using server-side sampling (optional)
  ```bash
  METRICS_SAMPLE_RATE=0.5  # 50% of events persisted to disk
  ```
- [ ] Verify `.env` or docker-compose environment section includes these

---

## 3. Nginx Edge Proxy Configuration

**File**: `deploy/edge/nginx.conf`

- [ ] Rate limiting zone configured:
  ```nginx
  limit_req_zone $binary_remote_addr zone=metrics_zone:10m rate=5r/s;
  limit_req_status 429;
  ```
- [ ] Rate limiting applied to `/api/metrics/event`:
  ```nginx
  location /api/metrics/event {
      limit_req zone=metrics_zone burst=10 nodelay;
      client_max_body_size 64k;
      proxy_pass http://assistant-api:8001;
  }
  ```
- [ ] Test rate limiting: send >15 requests/second, expect 429 responses

---

## 4. JSONL Rotation Sidecar

**File**: `deploy/docker-compose.full.yml`

- [ ] `metrics-rotator` service exists and configured:
  ```yaml
  metrics-rotator:
    image: python:3.12-alpine
    volumes:
      - ./..:/app:ro
      - ../data:/data:rw
    working_dir: /app
    command: >
      sh -c "pip install --quiet --no-cache-dir --root-user-action=ignore pip setuptools &&
             python scripts/metrics_rotate.py --data-dir /data --interval 300 --gzip-after-days 3 --delete-after-days 30 --max-mb 64"
  ```
- [ ] Verify `/data` volume is mounted read-write
- [ ] Verify rotation interval suitable for production (300s = 5 minutes)
- [ ] Confirm gzip/delete retention policies meet compliance requirements

---

## 5. Privacy Documentation

- [ ] `README.md` includes privacy section (lines ~641-664)
- [ ] `/privacy.html` exists and mentions:
  - Anonymous visitor IDs
  - Event types collected (page_view, link_click, etc.)
  - Data retention period (30 days default)
  - No PII/tracking cookies
- [ ] Privacy policy links working from frontend footer

---

## 6. Version Control & Data Protection

**File**: `.gitignore`

- [ ] Patterns added to exclude metrics data files:
  ```gitignore
  data/metrics*.jsonl
  data/metrics*.jsonl.gz
  data/metrics*.jsonl.old
  ```
- [ ] Verify no sensitive data committed to repository
- [ ] Test: `git status` should not show `data/metrics*` files

---

## 7. Health Checks & Monitoring

### Pre-Deployment Smoke Tests

Run these commands against production after deployment:

- [ ] **POST event**:
  ```bash
  curl -X POST https://api.your-domain.com/api/metrics/event \
    -H 'Content-Type: application/json' \
    -d '{"visitor_id":"smoke-test","event":"page_view","metadata":{}}'
  ```
  Expected: `{"ok":true,"stored":1,"file":"..."}`

- [ ] **GET snapshot**:
  ```bash
  curl https://api.your-domain.com/api/metrics/behavior?limit=5
  ```
  Expected: `{"total":N,"by_event":[...],"last_events":[...]}`

- [ ] **Health endpoint**:
  ```bash
  curl https://api.your-domain.com/api/metrics/health
  ```
  Expected: `{"status":"healthy","ring_size":N,"file_exists":true}`

### Ongoing Monitoring

- [ ] Set up alerts for:
  - Disk space on `/data` volume (warn at 80%, critical at 90%)
  - Rotation script failures (check container logs)
  - 429 rate limit responses (monitor nginx access logs)
  - Sudden traffic spikes (unusual total counts)
- [ ] Configure log aggregation for metrics-rotator container
- [ ] Set up weekly review of `by_event` aggregations for anomalies

---

## 8. Testing Checklist

- [ ] E2E tests passing: `npm test` (metrics-behavior.spec.ts)
- [ ] Smoke tests passing (see section 7)
- [ ] Playwright tests passing: `npx playwright test`
- [ ] CI workflows green:
  - `.github/workflows/ci.yml`
  - `.github/workflows/backend-tests.yml`
  - `.github/workflows/public-smoke.yml`
  - `.github/workflows/e2e-metrics.yml`

---

## 9. Security Hardening (Optional but Recommended)

- [ ] Run backend as non-root user (`appuser` UID 1001 in Dockerfile)
- [ ] Enable `readOnlyRootFilesystem` in Docker Compose (except `/data` volume)
- [ ] Configure SELinux/AppArmor profiles if applicable
- [ ] Set up TLS/HTTPS with Let's Encrypt (Cloudflare DNS-01 or HTTP-01)
- [ ] Review secure headers in nginx:
  ```nginx
  add_header X-Frame-Options "DENY";
  add_header X-Content-Type-Options "nosniff";
  add_header X-XSS-Protection "1; mode=block";
  ```

---

## 10. Rollback Plan

In case of production issues:

1. **Disable frontend sampling**:
   ```bash
   VITE_METRICS_SAMPLE_RATE=0  # Rebuild frontend
   ```

2. **Disable backend persistence**:
   ```bash
   METRICS_SAMPLE_RATE=0  # Restart backend
   ```

3. **Nginx rate limit to zero** (emergency brake):
   ```nginx
   limit_req_zone $binary_remote_addr zone=metrics_zone:10m rate=1r/h;
   # Reload: nginx -s reload
   ```

4. **Stop rotator sidecar**:
   ```bash
   docker-compose stop metrics-rotator
   ```

---

## Post-Deployment Validation

After successful deployment:

- [ ] Run all smoke tests (section 7)
- [ ] Monitor for 15 minutes: check logs, disk usage, response times
- [ ] Verify badge appears in navbar for dev users (?dev=1)
- [ ] Verify debug panel shows live data (dev mode only)
- [ ] Test rate limiting with load testing tool (optional)

---

## Notes

- **Sampling**: Lower `VITE_METRICS_SAMPLE_RATE` reduces client load; lower `METRICS_SAMPLE_RATE` reduces disk usage
- **Retention**: Adjust `--gzip-after-days` and `--delete-after-days` based on compliance requirements
- **Rate Limiting**: Adjust `rate=5r/s` and `burst=10` based on expected traffic patterns
- **Monitoring**: Set up Prometheus/Grafana for long-term metrics (future enhancement)

---

**Phase 50.8 Complete** ✅
Backend + Frontend + Guard + Rotation + CI + Polish
