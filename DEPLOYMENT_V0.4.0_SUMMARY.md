# Deployment v0.4.0 Summary

**Date**: October 16, 2025
**Tag**: v0.4.0
**Deployment**: Local Docker Compose Stack

## Deployment Steps Completed

### 1. ✅ Release Preparation
- Updated CHANGELOG.md with v0.4.0 entry (Preact migration details)
- Created git tag v0.4.0 with comprehensive annotation
- Pushed tag to origin: `git push origin main --tags`

### 2. ✅ Backend Docker Image Build
- **Image**: `ghcr.io/leok974/leo-portfolio/backend:main`
- **Context**: `assistant_api` directory
- **Build Command**: `docker build -t ghcr.io/leok974/leo-portfolio/backend:main -f assistant_api/Dockerfile assistant_api`
- **Build Time**: ~351 seconds
- **Status**: ✅ Successfully built

### 3. ✅ Dockerfile Fixes Applied
Fixed critical path issues in `assistant_api/Dockerfile`:
- Changed `COPY . ./assistant_api` → `COPY . ./` (avoid nested structure)
- Changed healthcheck path from `assistant_api/healthcheck.py` → `healthcheck.py`
- **Reason**: Build context is already `assistant_api`, so copying creates double nesting

### 4. ✅ Docker Compose Port Conflicts Resolved
Updated `deploy/docker-compose.portfolio-prod.yml`:
- **Ollama port**: `11434` → `11435` (avoided conflict with host Docker service)
- **Nginx port**: `80` → `8082` (avoided conflicts with ports 80, 8080)
- **Backend port**: `8001` (kept as-is, bound to 127.0.0.1)

### 5. ✅ Nginx Configuration Fix
- Switched from `nginx.portfolio.conf` (requires SSL) → `nginx.portfolio-dev.conf` (HTTP-only)
- **Reason**: Production config expects SSL certificates which aren't present in local deployment
- **Result**: Nginx now starts successfully on port 8082

### 6. ✅ Services Started
```powershell
docker compose -f deploy/docker-compose.portfolio-prod.yml up -d
```
**Running containers**:
- ✅ `portfolio-ollama` - Ollama service on 127.0.0.1:11435
- ✅ `portfolio-backend` - FastAPI backend on 127.0.0.1:8001 (waiting for Ollama model)
- ✅ `portfolio-nginx` - Nginx reverse proxy on 127.0.0.1:8082

### 7. 🔄 Ollama Model Pull (In Progress)
**Model**: `qwen2.5:7b-instruct-q4_K_M`
**Size**: 4.7 GB
**Command**: `docker exec portfolio-ollama ollama pull qwen2.5:7b-instruct-q4_K_M`
**Status**: Downloading (27% complete as of last check)
**ETA**: ~1-2 minutes

## Health Check Status

### Nginx (Edge Proxy)
✅ **HEALTHY**
```powershell
curl.exe -s http://127.0.0.1:8082/healthz
# Response: ok
```

### Backend (FastAPI)
⏳ **WAITING** (for Ollama model to complete loading)
```powershell
curl.exe -s http://127.0.0.1:8001/ready
# Expected: {"status":"ready"} (once model loaded)
```

### Ollama (LLM Service)
✅ **RUNNING** (API responding, model downloading)
```powershell
curl.exe -s http://127.0.0.1:11435/api/tags
# Response: {"models":[]} (will include qwen2.5 once pull completes)
```

## Next Steps

### After Model Download Completes:
1. **Verify backend readiness**:
   ```powershell
   curl.exe -s http://127.0.0.1:8001/ready
   ```

2. **Test chat endpoint**:
   ```powershell
   curl.exe -N -X POST http://127.0.0.1:8082/chat/stream `
     -H 'Content-Type: application/json' `
     -d '{"messages":[{"role":"user","content":"Ping"}]}'
   ```

3. **Verify frontend serving**:
   ```powershell
   curl.exe -s http://127.0.0.1:8082/ | Select-String -Pattern "<title>"
   ```

4. **Check service logs** (if issues):
   ```powershell
   docker compose -f deploy/docker-compose.portfolio-prod.yml logs --tail=50 backend
   docker compose -f deploy/docker-compose.portfolio-prod.yml logs --tail=50 ollama
   docker compose -f deploy/docker-compose.portfolio-prod.yml logs --tail=50 nginx
   ```

## Issues Encountered & Resolutions

### Issue 1: Docker Build Context Error
**Error**: `"/requirements.txt": not found`
**Cause**: Build command used workspace root as context, but Dockerfile expected `assistant_api` context
**Fix**: Changed build command to use `assistant_api` as context directory
**Command**: `docker build -t [...] -f assistant_api/Dockerfile assistant_api`

### Issue 2: Module Import Error in Backend
**Error**: `ModuleNotFoundError: No module named 'assistant_api.models'`
**Cause**: `COPY . ./assistant_api` created double-nested structure `/app/assistant_api/assistant_api/`
**Fix**: Changed to `COPY . ./` since build context is already `assistant_api`
**Files Modified**: `assistant_api/Dockerfile` (lines 42, 56)

### Issue 3: Port Conflicts (11434, 80, 8080)
**Error**: `Bind for 0.0.0.0:11434 failed: port is already allocated`
**Cause**: Docker Desktop and other compose stacks using standard ports
**Fix**: Remapped to available ports:
- Ollama: 11434 → 11435
- Nginx: 80 → 8082

### Issue 4: Nginx SSL Configuration Error
**Error**: `no "ssl_certificate" is defined for the "listen ... ssl" directive`
**Cause**: `nginx.portfolio.conf` requires SSL certificates for production HTTPS
**Fix**: Switched to `nginx.portfolio-dev.conf` which uses HTTP-only for local dev
**File Modified**: `deploy/docker-compose.portfolio-prod.yml` (line 53)

## Service Access URLs

- **Frontend (Nginx)**: http://127.0.0.1:8082/
- **Backend API**: http://127.0.0.1:8001/
- **Backend Health**: http://127.0.0.1:8001/ready
- **Ollama API**: http://127.0.0.1:11435/
- **Ollama Models**: http://127.0.0.1:11435/api/tags

## Rollback Plan

If deployment fails:

### Option 1: Stop compose stack
```powershell
docker compose -f deploy/docker-compose.portfolio-prod.yml down
```

### Option 2: Revert git changes
```powershell
# Revert merge commit (if needed)
git revert -m 1 437c197

# OR use saved branch
git checkout -b hotfix portfolio-check
```

### Option 3: Use previous Docker image
```powershell
# Pull previous stable image tag
docker pull ghcr.io/leok974/leo-portfolio/backend:v0.3.0
# Update compose file to use :v0.3.0 tag
# Restart: docker compose up -d
```

## Files Modified During Deployment

1. `CHANGELOG.md` - Added v0.4.0 release entry
2. `assistant_api/Dockerfile` - Fixed COPY paths and healthcheck
3. `deploy/docker-compose.portfolio-prod.yml` - Port mappings and nginx config

## Performance Metrics (from v0.4.0 Release)

- **Build Time**: 753ms → 379ms (50% improvement)
- **Bundle Size**: 45KB → 3KB (93% reduction)
- **TypeScript Errors**: 210 → 0 (100% resolved)
- **Runtime**: Preact (3KB) vs React (45KB)

## Deployment Environment

- **OS**: Windows (Docker Desktop)
- **Docker**: desktop-linux
- **Compose Version**: 3.9
- **Python**: 3.11-slim (runtime)
- **Node/Frontend**: Preact 10.27.2
- **LLM Model**: qwen2.5:7b-instruct-q4_K_M (4.7GB)

---

**Status as of 2025-10-16 21:40 EDT**: Services running, waiting for Ollama model download to complete (~70% remaining).
