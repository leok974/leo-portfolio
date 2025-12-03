# Deploy leoklemet.com Live - Deployment Runbook

**Date Created**: 2025-10-30
**Status**: ✅ READY TO DEPLOY (pending Cloudflare Tunnel token)

## Overview

This runbook brings **leoklemet.com** live using:

- **Frontend**: Portfolio static site (nginx container)
- **Backend**: FastAPI + Ollama (portfolio-backend container)
- **Edge**: Cloudflare Tunnel (cloudflared container)
- **Network**: Docker infra_net bridge network

## Pre-Flight Checks

### ✅ Configuration Fixed

1. **`cloudflared/config.yml`** - Updated ingress rules:

   ```yaml
   ingress:
     - hostname: www.leoklemet.com
       service: http://portfolio-nginx:80
     - hostname: leoklemet.com
       service: http://portfolio-nginx:80
     - hostname: api.leoklemet.com
       service: http://portfolio-api.int:8000 # Note: internal port is 8000
     - hostname: app.ledger-mind.org
       service: http://nginx:80 # legacy app
     - service: http_status:404
   ```

2. **`deploy/docker-compose.portfolio-prod.yml`** - Network aliases verified:

   ```yaml
   services:
     backend:
       container_name: portfolio-backend
       networks:
         infra_net:
           aliases:
             - portfolio-api.int # ✅ Correct alias
       expose:
         - "8000" # ✅ Internal port (mapped to host 8001)

     nginx:
       container_name: portfolio-nginx
       image: ghcr.io/leok974/leo-portfolio/portfolio:latest
       ports:
         - "127.0.0.1:8082:80" # ✅ Exposed on localhost:8082
       networks:
         infra_net:
           aliases:
             - portfolio.int
   ```

3. **Nginx config** (`deploy/nginx.portfolio-dev.conf`) - Already correct:
   ```nginx
   location /api/ {
     proxy_pass http://portfolio-api.int:8000/api/;  # ✅ Matches network alias + internal port
   }
   ```

### 🔑 Missing Piece: Cloudflare Tunnel Token

**REQUIRED**: Set `CLOUDFLARE_TUNNEL_TOKEN` in one of:

- `.env.cloudflare` (root directory)
- `cloudflared/.env.tunnel` (tunnel directory)

Get the token from Cloudflare Zero Trust dashboard:

1. Go to: https://one.dash.cloudflare.com/
2. Navigate to: **Access** → **Tunnels** → **leo-portfolio tunnel**
3. Click **Configure** → Copy the tunnel token

Example `.env.cloudflare`:

```bash
CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoiYWJjZGVmMTIzNDU2Nzg5MCIsInQiOiJkYjU2ODkyZC00ODc5LTQyNjMtOTliZi0yMDJkNDZiNmFmZjkiLCJzIjoiWW1GelpYWTVOV0V3TXpZIn0=
```

---

## Deployment Steps

### 1. Navigate to Deploy Directory

```powershell
cd D:\leo-portfolio\deploy
```

### 2. Stop Existing Containers (Clean Slate)

```powershell
docker compose -f docker-compose.portfolio-prod.yml down
```

Expected output: ✅ Removes `portfolio-backend`, `portfolio-nginx`, `portfolio-watchtower`

### 3. Create Shared Network (Idempotent)

```powershell
docker network create infra_net 2>$null
```

If it already exists, this command will silently succeed (exit code 0).

### 4. Start Backend Service

```powershell
docker compose -f docker-compose.portfolio-prod.yml up -d backend
```

**Health Check**:

```powershell
# Wait 10 seconds for container to initialize
Start-Sleep -Seconds 10

# Verify backend returns 200 on /ready endpoint
docker exec portfolio-backend curl -s -w "`nHTTP: %{http_code}`n" http://localhost:8000/ready
```

Expected output:

```
{"ok":true,"checks":{"rag_db":{"ok":true...}}}
HTTP: 200
```

If you get **500** or connection refused:

- Check logs: `docker logs portfolio-backend --tail=100`
- Common causes:
  - Missing Ollama host (should use `host.docker.internal:11434`)
  - Missing secrets/env vars
  - RAG database initialization failure

### 5. Start Nginx Service

```powershell
docker compose -f docker-compose.portfolio-prod.yml up -d nginx
```

**Health Check #1: Internal Backend Connectivity**

```powershell
docker exec portfolio-nginx curl -s -w "`nHTTP: %{http_code}`n" http://portfolio-api.int:8000/ready
```

Expected: `HTTP: 200`

**Health Check #2: Static Content**

```powershell
docker exec portfolio-nginx curl -s -H "Host: www.leoklemet.com" http://localhost:80/ | Select-String "<title"
```

Expected: `<title>Leo Klemet — AI Engineer · Portfolio</title>`

### 6. Test from Host Machine

```powershell
# Test nginx serves content on localhost:8082
Invoke-WebRequest -Uri http://localhost:8082 -Headers @{Host="www.leoklemet.com"} -UseBasicParsing
```

Expected: `StatusCode: 200`

### 7. Start Cloudflare Tunnel

```powershell
# Go back to project root
cd D:\leo-portfolio

# Start tunnel (requires CLOUDFLARE_TUNNEL_TOKEN in .env.cloudflare)
docker compose -f docker-compose.cloudflared.yml up -d
```

**Verify Tunnel Connection**:

```powershell
docker logs cloudflared --tail=50 | Select-String "Registered|Connection"
```

Expected output:

```
INF Registered tunnel connection ... connIndex=0
INF Registered tunnel connection ... connIndex=1
INF Registered tunnel connection ... connIndex=2
INF Registered tunnel connection ... connIndex=3
```

Also look for:

```
INF +-- www.leoklemet.com
INF +-- leoklemet.com
INF +-- api.leoklemet.com
INF +-- app.ledger-mind.org
```

### 8. Final Verification

Open in browser:

- **https://www.leoklemet.com** → Should load portfolio (NOT 502)
- **https://leoklemet.com** → Should redirect to www
- **https://api.leoklemet.com/ready** → Should return JSON health status

If you get **502 Bad Gateway**:

1. Check tunnel logs: `docker logs cloudflared --tail=100`
2. Verify tunnel is connected (see step 7)
3. Check Cloudflare dashboard for tunnel status
4. Verify DNS records point to tunnel UUID

---

## Success Criteria

- [x] Backend container running and healthy (`/ready` returns 200)
- [x] Nginx container running and can reach backend internally
- [x] Nginx serves static HTML with correct title
- [x] Nginx accessible from host on localhost:8082
- [ ] Cloudflare tunnel connected (4 connections registered)
- [ ] Cloudflare tunnel routes all hostnames (www, apex, api, app)
- [ ] **Browser test**: https://www.leoklemet.com loads WITHOUT 502

---

## Troubleshooting

### Issue: 502 Bad Gateway from Cloudflare

**Symptom**: Browser shows Cloudflare 502 error page

**Diagnosis**:

1. Check tunnel connection:

   ```powershell
   docker logs cloudflared --tail=100
   ```

   Look for "Registered tunnel connection" (should see 4 instances)

2. Check nginx can reach backend:

   ```powershell
   docker exec portfolio-nginx curl -I http://portfolio-api.int:8000/ready
   ```

   Should return: `HTTP/1.1 200 OK`

3. Check localhost works:
   ```powershell
   curl -H "Host: www.leoklemet.com" http://localhost:8082/
   ```
   Should return HTML with `<title>`

**Fix A**: Tunnel routing mismatch

- Verify `cloudflared/config.yml` uses exact service names: `portfolio-nginx`, `portfolio-api.int`
- Restart tunnel: `docker restart cloudflared`

**Fix B**: Backend not healthy

- Check backend logs: `docker logs portfolio-backend --tail=100`
- Verify Ollama is accessible: `curl http://host.docker.internal:11434/api/tags`
- Restart backend: `docker restart portfolio-backend`

**Fix C**: Network isolation

- Ensure all containers share `infra_net`:
  ```powershell
  docker network inspect infra_net | Select-String "portfolio"
  ```
  Should show: `portfolio-backend`, `portfolio-nginx`, `cloudflared`

### Issue: "host not found in upstream portfolio-api.int"

**Symptom**: Nginx logs show DNS resolution failure

**Fix**: Docker network alias mismatch

1. Stop all services:

   ```powershell
   docker compose -f deploy/docker-compose.portfolio-prod.yml down
   cd ..
   docker compose -f docker-compose.cloudflared.yml down
   ```

2. Verify `deploy/docker-compose.portfolio-prod.yml` has:

   ```yaml
   backend:
     networks:
       infra_net:
         aliases:
           - portfolio-api.int
   ```

3. Restart services (steps 4-7 above)

### Issue: Cloudflared won't start (missing token)

**Symptom**: `required variable CLOUDFLARE_TUNNEL_TOKEN is missing a value`

**Fix**:

1. Get token from Cloudflare dashboard (see **Missing Piece** section above)
2. Create `.env.cloudflare` in project root:
   ```bash
   CLOUDFLARE_TUNNEL_TOKEN=<your_actual_token_here>
   ```
3. Restart tunnel: `docker compose -f docker-compose.cloudflared.yml up -d`

---

## Rollback

If deployment fails and site is broken:

```powershell
# Stop all new services
cd D:\leo-portfolio
docker compose -f docker-compose.cloudflared.yml down
docker compose -f deploy/docker-compose.portfolio-prod.yml down

# Restart previous stable deployment
docker compose -f deploy/docker-compose.portfolio-only.yml up -d
```

---

## Post-Deployment

### Start Watchtower (Auto-Updates)

```powershell
cd deploy
docker compose -f docker-compose.portfolio-prod.yml up -d watchtower
```

Watchtower will automatically pull and update containers labeled with `com.centurylinklabs.watchtower.enable=true` every 5 minutes.

### Monitor Logs

```powershell
# Backend logs
docker logs -f portfolio-backend

# Nginx access logs
docker logs -f portfolio-nginx

# Tunnel logs
docker logs -f cloudflared
```

### Health Monitoring

Set up periodic checks (e.g., GitHub Actions or cron):

```powershell
# Check backend health
Invoke-WebRequest -Uri https://api.leoklemet.com/ready -UseBasicParsing

# Check frontend loads
Invoke-WebRequest -Uri https://www.leoklemet.com -UseBasicParsing
```

---

## Architecture Diagram

```
Internet (user browser)
    ↓
Cloudflare Edge (TLS termination)
    ↓
Cloudflare Tunnel (cloudflared container)
    ↓
    ├── www.leoklemet.com → portfolio-nginx:80 → Static HTML
    ├── leoklemet.com     → portfolio-nginx:80 → 301 redirect to www
    └── api.leoklemet.com → portfolio-api.int:8000 → FastAPI backend
                                    ↓
                            Ollama (host.docker.internal:11434)
```

**Key Points**:

- All containers share `infra_net` bridge network
- Backend uses internal DNS alias `portfolio-api.int` (NOT container name)
- Nginx config references `portfolio-api.int:8000` for API proxy
- Cloudflare Tunnel token required for external access
- Backend exposed on host `127.0.0.1:8001` (internal port 8000)
- Nginx exposed on host `127.0.0.1:8082` (internal port 80)

---

## Next Steps

1. **Set Cloudflare Tunnel Token**: Update `.env.cloudflare` with real token
2. **Run Steps 1-8**: Execute deployment sequence
3. **Verify in Browser**: Confirm leoklemet.com loads without 502
4. **Enable Watchtower**: Auto-update containers on new pushes
5. **Update DNS**: Ensure leoklemet.com/www CNAME points to tunnel UUID
6. **Documentation**: Update main README.md with production URLs

---

## Files Changed in This Deployment

1. **`cloudflared/config.yml`**
   - Added `www.leoklemet.com` and `leoklemet.com` ingress rules
   - Fixed `api.leoklemet.com` to use port 8000 (was 8001)

2. **`deploy/docker-compose.portfolio-prod.yml`**
   - Verified network alias: `portfolio-api.int`
   - Confirmed internal port: 8000 (host mapping: 8001)

3. **`deploy/nginx.portfolio-dev.conf`**
   - Already correct: Uses `portfolio-api.int:8000` for proxying

---

**Deployment Status**: ✅ Configuration validated, services tested locally
**Blocker**: Missing `CLOUDFLARE_TUNNEL_TOKEN` environment variable
**Once token is set**: Execute steps 1-8 above to go live
