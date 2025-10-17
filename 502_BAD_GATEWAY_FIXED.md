# 502 Bad Gateway - Fixed ✅

**Date**: October 14, 2025
**Issue**: 502 Bad Gateway when accessing portfolio assistant features
**Status**: ✅ RESOLVED

## Problem

The portfolio running on http://localhost:8090/ was returning **502 Bad Gateway** errors when the assistant panel tried to connect to the backend API (`/api/*`, `/agent/events`, `/chat/stream`).

### Root Cause

The `nginx.portfolio.conf` configuration was proxying API requests to `backend:8001`, expecting a Docker container named `backend`. However, in the **portfolio-only** deployment mode:

1. No `backend` service defined in `docker-compose.portfolio-only.yml`
2. Backend actually running on **host machine** at `127.0.0.1:8001` (not in Docker)
3. Nginx container couldn't reach `backend:8001` → 502 errors

## Solution

### 1. Created Development Nginx Config

Created `nginx.portfolio-dev.conf` with:
- Proxy target: `http://host.docker.internal:8001` (reaches host machine)
- Updated CSP to allow `http://127.0.0.1:8001` in connect-src
- All API routes (`/api/*`, `/agent/events`, `/chat`, `/chat/stream`) proxy to host

**Key change**:
```nginx
# Before (didn't work)
proxy_pass http://backend:8001;

# After (works!)
proxy_pass http://host.docker.internal:8001;
```

### 2. Updated Docker Compose

Modified `docker-compose.portfolio-only.yml`:
```yaml
portfolio-ui:
  volumes:
    - ./nginx.portfolio-dev.conf:/etc/nginx/conf.d/default.conf:ro  # Changed config
  extra_hosts:
    - "host.docker.internal:host-gateway"  # Added host access
```

The `extra_hosts` directive makes `host.docker.internal` resolve to the Windows host machine's IP.

### 3. Restarted Container

```powershell
docker compose -f docker-compose.portfolio-only.yml down portfolio-ui
docker compose -f docker-compose.portfolio-only.yml up -d portfolio-ui
```

## Verification

### Before Fix
```bash
curl http://localhost:8090/api/ready
# HTTP/1.1 502 Bad Gateway
```

### After Fix
```bash
curl http://localhost:8090/api/ready
# HTTP/1.1 200 OK
# {"ok":true,"rag":{"db":null,...},"metrics":{...}}
```

### Frontend Test
- ✅ Portfolio loads: http://localhost:8090/
- ✅ Assistant panel opens
- ✅ SSE connects to `/agent/events` (no 502)
- ✅ Chat endpoint `/chat` accessible (no 502)
- ✅ No console error spam

## Files Modified

```
deploy/
├── nginx.portfolio-dev.conf          (NEW - dev config with host proxy)
└── docker-compose.portfolio-only.yml (MODIFIED - added extra_hosts)
```

## Architecture

### Development Mode (Current)
```
Browser → http://localhost:8090/
  ↓
  nginx (Docker container)
    ↓ (for /api/*, /agent/*, /chat/*)
    http://host.docker.internal:8001
      ↓
      Backend (FastAPI on Windows host)
        ↓
        Ollama (local or Docker)
```

### Production Mode (Future)
```
Browser → https://assistant.ledger-mind.org/
  ↓
  nginx (Docker container)
    ↓ (for /api/*, /agent/*, /chat/*)
    http://backend:8001 (Docker backend container)
      ↓
      Ollama (Docker container on infra network)
```

## Configuration Files

### nginx.portfolio-dev.conf (Development)
- Proxies to `host.docker.internal:8001`
- CSP allows `http://127.0.0.1:8001`
- Used by `docker-compose.portfolio-only.yml`

### nginx.portfolio.conf (Production)
- Proxies to `backend:8001` (Docker service name)
- CSP allows `https://assistant.ledger-mind.org`
- Used by `docker-compose.portfolio-prod.yml`

## Testing Checklist

- [x] Portfolio homepage loads (200 OK)
- [x] Health endpoint works: `/healthz` → "ok"
- [x] API health check: `/api/ready` → JSON response
- [x] SSE endpoint reachable: `/agent/events` (no 502)
- [x] Chat endpoint accessible: `/chat` (no 405/502 for POST)
- [x] Assistant panel opens without errors
- [x] No console 502 spam
- [x] Offline badge doesn't show (API online)

## Common Issues & Fixes

### Issue: Still getting 502
**Check**:
```powershell
# Is backend running?
netstat -ano | findstr :8001
# Should show: TCP    127.0.0.1:8001    LISTENING

# Is nginx using correct config?
docker exec portfolio-ui cat /etc/nginx/conf.d/default.conf | Select-String "host.docker.internal"
```

### Issue: Container can't reach host
**Fix**:
```yaml
# Add to docker-compose.portfolio-only.yml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

### Issue: CSP blocking connections
**Check browser console**:
```
Refused to connect to 'http://127.0.0.1:8001' because it violates CSP
```

**Fix**: Ensure CSP includes correct URL in `connect-src`:
```nginx
connect-src 'self' http://127.0.0.1:8001 https://assistant.ledger-mind.org;
```

## Environment-Specific Notes

### Windows Docker Desktop
- `host.docker.internal` → automatically resolves to host
- `extra_hosts` + `host-gateway` required in compose file

### Linux Docker
- Use `host.docker.internal` or `172.17.0.1` (Docker bridge IP)
- May need `--add-host=host.docker.internal:host-gateway`

### macOS Docker Desktop
- `host.docker.internal` → works natively
- No extra configuration needed

## Rollback (if needed)

```bash
cd deploy
git checkout HEAD -- nginx.portfolio-dev.conf docker-compose.portfolio-only.yml
docker compose -f docker-compose.portfolio-only.yml down
docker compose -f docker-compose.portfolio-only.yml up -d
```

## Related Issues

- Assistant offline handling: Already implemented (shows offline badge if API down)
- CORS: Not an issue (same origin via proxy)
- CSP: Updated to allow host machine backend URL

## Next Steps

- [x] Fix 502 Bad Gateway
- [ ] Test all assistant features (chat, events, streaming)
- [ ] Verify no memory leaks from SSE connections
- [ ] Test with backend stopped (should show offline badge)
- [ ] Document production deployment (uses different nginx config)

---

**Status**: ✅ Working
**Backend**: Running on 127.0.0.1:8001
**Frontend**: http://localhost:8090/
**Proxy**: nginx → host.docker.internal:8001 → backend
**Errors**: None
