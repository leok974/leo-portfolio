# Phase 50.8 Commit & PR Messages

## Git Commit Message

```
feat(analytics): privilege guard + navbar badge + docs

- Add PrivilegedOnly wrapper and MetricsBadge (live counts)
- Enhance devGuard with query/localStorage methods
- Wire badge mount and query sync at app entry
- Docs: privileged UI usage; CHANGELOG update
- Phase 50.8 complete (backend + frontend + guard)
```

## Pull Request

### Title

```
Phase 50.8 — Behavior Analytics: frontend + guard + badge
```

### Body

```markdown
## Overview

Completes Phase 50.8 behavior analytics implementation with:

- **Frontend integration**: Metrics library, debug panel, auto-beacons hook
- **Privilege guard system**: Dev-only UI controls with query string support
- **Live navbar badge**: Shows total events + top event type (5-second polling)
- **Polish improvements**: Accessibility (aria-live), performance (pause on hidden tab, jitter), event tracking for dev mode toggles

## Components Added

### Frontend (`src/`)

- `src/lib/metrics.ts` - Core utilities: `getVisitorId()`, `sendEvent()`, `fetchSnapshot()`
- `src/lib/useAutoBeacons.ts` - React hook for automatic page_view/link_click tracking
- `src/lib/devGuard.ts` - Dual privilege system (cookie + localStorage) with event tracking
- `src/components/BehaviorMetricsDebugPanel.tsx` - Live snapshot viewer
- `src/components/PrivilegedOnly.tsx` - Conditional rendering wrapper
- `src/components/MetricsBadge.tsx` - Navbar badge with live metrics (dev-only)

### Backend (`assistant_api/`)

- `assistant_api/routers/metrics_behavior.py` - Three endpoints:
  - `POST /api/metrics/event` - Event ingestion (202)
  - `GET /api/metrics/behavior` - Snapshot query (200)
  - `GET /api/metrics/behavior/health` - Health check (200)
- Ring buffer (500 events) + JSONL sink (`data/metrics.jsonl`)
- Server-side sampling: `METRICS_SAMPLE_RATE` environment variable

### Operations

- `scripts/metrics_rotate.py` - JSONL rotation with gzip + retention
- Docker Compose sidecar: `metrics-rotator` service
- Nginx rate limiting: 5 req/s, burst 10 for `/api/metrics/event`
- Client-side sampling: `VITE_METRICS_SAMPLE_RATE`

### CI/CD

- `.github/workflows/e2e-metrics.yml` - Dedicated metrics workflow
- Added metrics tests to `ci.yml`, `backend-tests.yml`, `public-smoke.yml`
- Health checks for staging and production

### Documentation

- `PHASE_50.8_PRODUCTION_CHECKLIST.md` - Deployment verification steps
- Updated `README.md` with privacy section
- Updated `docs/API.md` with metrics endpoints
- Updated `CHANGELOG.md` with v0.2.1 release notes

## Key Features

1. **Anonymous Tracking**: Persistent visitor IDs in localStorage, no PII/cookies
2. **Dev-Only Access**: Badge and debug panel visible only with `?dev=1` query string
3. **Live Updates**: Badge polls every 5 seconds (pauses when tab hidden)
4. **Accessibility**: Screen reader support with `aria-live="polite"` and `aria-atomic="true"`
5. **Performance**: Client + server sampling, rate limiting, automatic rotation
6. **Audit Trail**: Tracks dev mode enable/disable events for security review

## Testing

- ✅ Backend E2E: 2/2 Playwright tests passing
- ✅ Smoke tests: POST event + GET snapshot validated
- ✅ TypeScript compilation clean
- ✅ CI workflows green (4 workflows)

## Configuration

### Environment Variables

```bash
# Frontend (Vite)
VITE_API_BASE_URL=https://api.your-domain.com
VITE_METRICS_SAMPLE_RATE=0.25  # 25% client sampling

# Backend (FastAPI)
ALLOWED_ORIGINS=https://your-domain.com
METRICS_SAMPLE_RATE=0.5         # 50% server sampling
METRICS_RING_CAPACITY=500       # Ring buffer size
METRICS_JSONL=./data/metrics.jsonl
```

### Nginx Rate Limiting

```nginx
limit_req_zone $binary_remote_addr zone=metrics_zone:10m rate=5r/s;
location /api/metrics/event {
    limit_req zone=metrics_zone burst=10 nodelay;
}
```

### Rotation Sidecar

```yaml
# docker-compose.full.yml
metrics-rotator:
  image: python:3.12-alpine
  volumes:
    - ../data:/data:rw
  command: python scripts/metrics_rotate.py --interval 300 --gzip-after-days 3 --delete-after-days 30 --max-mb 64
```

## Privacy & Compliance

- ✅ Privacy section added to README.md
- ✅ `/privacy.html` includes data retention policy (30 days)
- ✅ Anonymous visitor IDs (no tracking cookies)
- ✅ `.gitignore` patterns for metrics data files
- ✅ Configurable retention policies

## Next Steps

1. Run smoke tests against production after deployment
2. Monitor disk usage and rotation logs
3. Review `by_event` aggregations weekly for anomalies
4. Set up alerts for rate limit 429 responses
5. Tag release: `git tag v0.2.1 && git push --tags`

## Related Documentation

- `PHASE_50.8_BEHAVIOR_METRICS_COMPLETE.md` - Backend implementation
- `PHASE_50.8_FRONTEND_COMPLETE.md` - Frontend integration
- `PHASE_50.8_PRIVILEGE_GUARD_COMPLETE.md` - Guard system
- `PHASE_50.8_CI_TOUCHUPS.md` - CI integration
- `PHASE_50.8_FOLLOWUPS_COMPLETE.md` - Operations (rotation/sampling)
- `PHASE_50.8_PRODUCTION_CHECKLIST.md` - Deployment checklist

---

**Phase 50.8 Complete** ✅
Behavior Analytics: Backend + Frontend + Guard + CI + Operations + Polish
```

## Additional Commands

### Build Frontend

```bash
npm run build
```

### Run Backend Locally

```bash
# PowerShell
.\.venv\Scripts\Activate.ps1
python -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001

# Or use VS Code task: "Run FastAPI (assistant_api)"
```

### Run Smoke Tests

```bash
# POST event
curl -X POST http://127.0.0.1:8001/api/metrics/event `
  -H 'Content-Type: application/json' `
  -d '{"visitor_id":"smoke-test","event":"page_view","metadata":{}}'

# GET snapshot
curl "http://127.0.0.1:8001/api/metrics/behavior?limit=5"

# GET health
curl "http://127.0.0.1:8001/api/metrics/behavior/health"
```

### Run E2E Tests

```bash
npm test  # Runs Playwright tests including metrics-behavior.spec.ts
```

### Manual Rotation Test

```bash
python scripts/metrics_rotate.py --data-dir ./data --gzip-after-days 0 --delete-after-days 7 --max-mb 1
```

### Enable Dev Mode

```
# Via query string
https://your-domain.com/?dev=1

# Via localStorage (browser console)
localStorage.setItem('dev_unlocked', '1')
```

---

**Author**: Leo K. (GitHub Copilot assisted)
**Date**: January 9, 2025
**Version**: v0.2.1
**Phase**: 50.8 (Complete)
