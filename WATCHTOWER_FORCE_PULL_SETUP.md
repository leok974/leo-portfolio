# Watchtower Force-Pull Setup

This document explains the Watchtower HTTP API setup for force-pulling backend updates without SSH access.

## Overview

The production deployment now includes a Watchtower container with HTTP API enabled. This allows triggering immediate container updates via a secure HTTP endpoint, which can be called manually or via GitHub Actions.

## Architecture

```
GitHub Actions (workflow dispatch)
    ↓
    POST https://api.leoklemet.com/ops/watchtower/update
    ↓
    nginx (proxies to localhost:8083)
    ↓
    Watchtower HTTP API
    ↓
    Docker pull + restart labeled containers
```

## Components

### 1. Watchtower Container

**Location**: `deploy/docker-compose.portfolio-prod.yml`

```yaml
watchtower:
  image: containrrr/watchtower:latest
  container_name: portfolio-watchtower
  restart: unless-stopped
  command:
    - --label-enable
    - --cleanup
    - --interval 300
    - --http-api-update
    - --http-api-metrics
  environment:
    - WATCHTOWER_HTTP_API_TOKEN=${WATCHTOWER_HTTP_API_TOKEN}
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
  ports:
    - "127.0.0.1:8083:8080"
```

**Features**:
- Monitors containers with label `com.centurylinklabs.watchtower.enable: "true"`
- Checks for updates every 300 seconds (5 minutes)
- HTTP API on port 8083 (localhost only)
- Requires Bearer token authentication
- Cleans up old images after update

### 2. Nginx Proxy Endpoint

**Location**: `deploy/nginx/nginx.prod.conf`

```nginx
location /ops/watchtower/update {
  proxy_pass http://127.0.0.1:8083/v1/update;
  proxy_set_header Authorization $http_authorization;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_http_version 1.1;
  proxy_buffering off;
}
```

**Security**:
- Only accessible via HTTPS (Cloudflare)
- Requires `Authorization: Bearer <token>` header
- Bound to localhost (not exposed to internet directly)
- Token forwarded from client to Watchtower

### 3. Environment Variables

**Location**: `deploy/.env.production`

```bash
WATCHTOWER_HTTP_API_TOKEN=dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE
```

**Note**: This token must also be set in GitHub Secrets (see below).

### 4. GitHub Action Workflow

**Location**: `.github/workflows/redeploy-backend.yml`

**Trigger**: Manual workflow dispatch

**Steps**:
1. POST to Watchtower endpoint with Bearer token
2. Wait 10 seconds for pull/restart
3. Poll `/api/ready` for up to 2.5 minutes
4. Verify routes in OpenAPI schema
5. Test `/api/dev/status` endpoint

### 5. GitHub Secrets

**Required secrets** (configured via `gh secret set`):

| Secret | Value | Purpose |
|--------|-------|---------|
| `WATCHTOWER_HTTP_API_TOKEN` | `dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE` | Authentication for Watchtower API |
| `WATCHTOWER_UPDATE_URL` | `https://api.leoklemet.com/ops/watchtower/update` | Full URL to trigger endpoint |

## Usage

### Manual Trigger via curl

```bash
curl -sS -X POST https://api.leoklemet.com/ops/watchtower/update \
  -H "Authorization: Bearer dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE"
```

**Expected response**:
```json
{"status": "success"}
```

### GitHub Actions Trigger

1. Go to: `https://github.com/leok974/leo-portfolio/actions`
2. Select: **Redeploy Backend via Watchtower**
3. Click: **Run workflow**
4. Choose branch: `main`
5. Click: **Run workflow**

**Workflow will**:
- Trigger Watchtower update
- Wait for backend to become healthy
- Verify routes are available
- Test `/api/dev/status` endpoint

## Monitoring

### Check Watchtower Logs

```bash
# On production server
docker logs portfolio-watchtower --tail=50 -f
```

### Check Backend Health

```bash
curl https://api.leoklemet.com/api/ready
```

### Verify Container Image

```bash
# On production server
docker inspect portfolio-backend | jq '.[0].Image'
```

## Troubleshooting

### Update not triggered

**Check**:
1. Watchtower container is running: `docker ps | grep watchtower`
2. Token is correct in `.env.production`
3. Nginx config includes `/ops/watchtower/update` location
4. GitHub Secrets are set correctly

**Fix**:
```bash
# Restart Watchtower
docker compose -f deploy/docker-compose.portfolio-prod.yml restart watchtower

# Check logs
docker logs portfolio-watchtower
```

### Backend not restarting

**Check**:
1. Backend has label: `com.centurylinklabs.watchtower.enable: "true"`
2. New image exists in GHCR: `ghcr.io/leok974/leo-portfolio/backend:latest`
3. Watchtower can pull image (auth configured)

**Fix**:
```bash
# Manual pull and restart
docker compose -f deploy/docker-compose.portfolio-prod.yml pull backend
docker compose -f deploy/docker-compose.portfolio-prod.yml up -d backend
```

### 401 Unauthorized

**Cause**: Token mismatch between:
- `.env.production` (Watchtower expects)
- GitHub Secrets (workflow sends)

**Fix**:
```bash
# Regenerate token
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Update .env.production
# Update GitHub Secret
gh secret set WATCHTOWER_HTTP_API_TOKEN --body "<new-token>"

# Restart Watchtower
docker compose -f deploy/docker-compose.portfolio-prod.yml restart watchtower
```

## Security Considerations

1. **Token strength**: 32-byte URL-safe random token
2. **HTTPS only**: Endpoint only accessible via HTTPS
3. **Localhost binding**: Watchtower port not exposed to internet
4. **No public access**: Only via Cloudflare reverse proxy
5. **Token rotation**: Can rotate token anytime (update both .env and GitHub Secret)

## Next Steps

After deploying this setup:

1. Deploy updated compose file to production
2. Deploy `.env.production` with token
3. Deploy updated nginx config
4. Restart stack: `docker compose up -d`
5. Test manual trigger
6. Test GitHub Action workflow
7. Monitor first automatic update

## Related Files

- `deploy/docker-compose.portfolio-prod.yml` - Watchtower service definition
- `deploy/.env.production` - Token configuration
- `deploy/nginx/nginx.prod.conf` - Nginx proxy endpoint
- `.github/workflows/redeploy-backend.yml` - GitHub Action workflow
- `.github/workflows/deploy-secrets-nightly.yml` - Nightly secret deployment
