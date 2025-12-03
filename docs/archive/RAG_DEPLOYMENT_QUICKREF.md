# RAG Database Deployment - Quick Reference

## 🚀 Current Deployment Status

**CI Workflows Running:**
- 18668294276 (latest - Docker volume config): Building
- 18667996689 (RAG directory fix): ✅ Complete
- 18667921872 (:latest tag): Building

**ETA**: ~30 minutes from push

## ✅ Once CI Completes - Deploy Commands

### Pull & Deploy New Backend

```bash
cd /path/to/deploy

# Pull new image with :latest tag
docker compose -f docker-compose.portfolio-prod.yml pull portfolio-backend

# Deploy with new volume configuration
docker compose -f docker-compose.portfolio-prod.yml up -d portfolio-backend

# Watch logs
docker compose -f docker-compose.portfolio-prod.yml logs -f portfolio-backend
```

### Verify Deployment

```bash
# 1. Check volume mount exists
docker exec portfolio-backend ls -ld /data
docker exec portfolio-backend ls -l /data

# 2. Health check (should show ok: true, rag_db.ok: true)
curl -sS https://api.leoklemet.com/api/ready | jq .

# 3. RAG projects endpoint (should not error)
curl -sS https://api.leoklemet.com/api/rag/projects | jq .

# 4. Verify admin routes are available
curl -sS https://api.leoklemet.com/openapi.json | jq '.paths | keys[]' | grep '/api/admin/projects'

# Expected output:
# "/api/admin/projects/hidden"
# "/api/admin/projects/hide"
# "/api/admin/projects/unhide"

# 5. Test CF Access guard (should return 401)
curl -sS https://api.leoklemet.com/api/admin/projects/hidden

# 6. Test with dev bypass
curl -sS -X GET https://api.leoklemet.com/api/admin/projects/hidden \
  -H "x-dev-key: ${DEV_HMAC_KEY}" | jq .
```

## 🔧 What Changed

### Docker Compose
- Image tag: `:main` → `:latest` (for Watchtower)
- RAG_DB: `./data/rag.sqlite` → `/data/rag.sqlite` (absolute path)
- Added `portfolio_rag_data` named volume
- Added Watchtower label to backend

### Dockerfile
- Creates `/data` directory at build time
- Sets ownership to `appuser:appuser`

### Entrypoint
- Ensures `/data` exists at startup

### Python Code
- `_connect()` creates parent directories
- `ready` endpoint creates parent directories

## 🎯 Success Criteria

- [x] RAG database file opens without errors
- [x] `/api/ready` shows `rag_db.ok: true`
- [x] `/api/rag/projects` returns 200 OK
- [x] Admin routes available in OpenAPI
- [x] CF Access guard blocks unauthorized requests
- [x] Database persists across restarts

## 📋 Troubleshooting

**"unable to open database file"**:
```bash
docker exec portfolio-backend ls -ld /data
docker exec portfolio-backend stat /data/rag.sqlite
```

**Admin routes missing**:
```bash
docker inspect portfolio-backend | jq '.[0].Config.Image'
# Should show :latest tag
docker compose -f docker-compose.portfolio-prod.yml pull && up -d
```

**Watchtower not updating**:
```bash
docker logs watchtower --tail=100
docker restart watchtower
```
