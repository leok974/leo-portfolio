# Production Deployment: Portfolio to assistant.ledger-mind.org

## Overview
Deploy the **portfolio website** (not siteagent) to production at `https://assistant.ledger-mind.org`.

## Architecture

```
https://assistant.ledger-mind.org
├── Frontend: Portfolio Build (dist-portfolio/)
├── Backend: FastAPI (for API, auth, agent tools)
└── Nginx: Reverse proxy + static serving
```

## Prerequisites

1. **Server access** with Docker and Docker Compose
2. **Domain configured**: `assistant.ledger-mind.org` pointing to your server
3. **Cloudflare Tunnel** (if using) or direct DNS A/AAAA records
4. **Backend image**: `ghcr.io/leok974/leo-portfolio/backend:main`

## Quick Deploy (3 Commands)

```bash
# 1. Build portfolio frontend locally
npm run build:portfolio

# 2. Deploy to server (from project root)
scp -r dist-portfolio/* user@server:/opt/leo-portfolio/dist-portfolio/

# 3. Restart services on server
ssh user@server "cd /opt/leo-portfolio/deploy && docker compose -f docker-compose.yml -f docker-compose.portfolio-prod.yml up -d"
```

## Detailed Steps

### 1. Build Portfolio Frontend

```powershell
# On local machine
cd D:\leo-portfolio

# Build portfolio (NOT siteagent)
npm run build:portfolio

# Verify output
ls dist-portfolio/
# Should contain: index.html, assets/, projects.json, etc.
```

### 2. Create Production Compose Override

Create `deploy/docker-compose.portfolio-prod.yml`:

```yaml
version: "3.9"

services:
  backend:
    image: ghcr.io/leok974/leo-portfolio/backend:main
    environment:
      - ALLOWED_ORIGINS=https://assistant.ledger-mind.org
      - BACKEND_URL=https://assistant.ledger-mind.org
      # Add other production env vars
    restart: unless-stopped

  nginx:
    image: nginx:1.27-alpine
    container_name: portfolio-nginx
    volumes:
      - ./nginx.portfolio.conf:/etc/nginx/conf.d/default.conf:ro
      - ../dist-portfolio:/usr/share/nginx/html:ro
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1/healthz || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 5

  ollama:
    # If needed, include ollama service
    image: ollama/ollama:latest
    # ... GPU config ...
```

### 3. Deploy to Server

#### Option A: Automated Script

```powershell
# Create deployment script
./scripts/deploy-portfolio-prod.ps1
```

#### Option B: Manual Steps

```bash
# SSH to production server
ssh user@your-server

# Navigate to project directory
cd /opt/leo-portfolio

# Pull latest code (if backend changed)
git pull origin main

# Pull latest backend image
cd deploy
docker compose pull backend

# Stop existing services
docker compose down nginx portfolio-ui

# Start with portfolio config
docker compose -f docker-compose.yml \
               -f docker-compose.portfolio-prod.yml \
               up -d

# Wait for services
sleep 10

# Check health
curl -s http://localhost/healthz
curl -s http://localhost/api/ready
```

### 4. Upload Frontend Build

From your **local machine**:

```powershell
# Upload portfolio dist
scp -r dist-portfolio/* user@server:/opt/leo-portfolio/dist-portfolio/

# Or use rsync for incremental updates
rsync -avz --delete dist-portfolio/ user@server:/opt/leo-portfolio/dist-portfolio/
```

### 5. Verify Deployment

```bash
# On server
curl -s http://localhost/healthz
# Should return: ok

curl -s http://localhost/api/ready
# Should return: {"status":"ok"}

# Check nginx is serving portfolio
curl -s http://localhost/ | head -20
# Should contain: <title>Leo's Portfolio</title> or similar

# Check logs
docker compose logs nginx --tail=50
docker compose logs backend --tail=50
```

### 6. Configure Cloudflare Tunnel

If using Cloudflare Tunnel, update the tunnel config to point to the nginx container:

```yaml
# In cloudflared config
ingress:
  - hostname: assistant.ledger-mind.org
    service: http://portfolio-nginx:80
  - service: http_status:404
```

Then restart cloudflared:

```bash
docker compose restart cloudflared
```

## Verification Checklist

Test these endpoints:

```bash
# Frontend
curl -I https://assistant.ledger-mind.org/
# Should return 200, Content-Type: text/html

# Health check
curl -s https://assistant.ledger-mind.org/healthz
# Should return: ok

# Backend API
curl -s https://assistant.ledger-mind.org/api/ready
# Should return: {"status":"ok"}

# Projects data
curl -s https://assistant.ledger-mind.org/projects.json
# Should return JSON array

# Static assets
curl -I https://assistant.ledger-mind.org/assets/index-xyz.js
# Should return 200 with long Cache-Control
```

## Environment Variables

Ensure these are set on the server for the backend:

```bash
# Required
ALLOWED_ORIGINS=https://assistant.ledger-mind.org
BACKEND_URL=https://assistant.ledger-mind.org
RAG_DB=./data/rag.sqlite

# OpenAI/Ollama
OPENAI_BASE_URL=http://ollama:11434/v1
OPENAI_MODEL=qwen2.5:7b-instruct-q4_K_M
OPENAI_API_KEY_OLLAMA=ollama

# Fallback
FALLBACK_BASE_URL=https://api.openai.com/v1
FALLBACK_MODEL=gpt-4o-mini
FALLBACK_API_KEY=<your-openai-key>

# Optional: Auth
CF_ACCESS_TEAM_DOMAIN=ledgermind.cloudflareaccess.com
CF_ACCESS_AUD=f34cb2b8f9a670c4f4df57f5c90b2cf45f31e27c1ec3ce83b5f75e2ce774f35c
ACCESS_ALLOWED_EMAILS=leoklemet.pa@gmail.com
```

## Rollback

If something breaks:

```bash
# On server
cd /opt/leo-portfolio/deploy

# Restore previous frontend
mv dist-portfolio dist-portfolio-broken
mv dist-portfolio-backup-YYYYMMDD dist-portfolio

# Restart nginx
docker compose restart nginx

# Or rollback backend image
docker tag ghcr.io/leok974/leo-portfolio/backend:sha-abc123 \
           ghcr.io/leok974/leo-portfolio/backend:main
docker compose up -d backend
```

## Monitoring

```bash
# Check logs
docker compose logs -f nginx --tail=100
docker compose logs -f backend --tail=100

# Check resource usage
docker stats portfolio-nginx backend

# Monitor metrics
curl -s https://assistant.ledger-mind.org/metrics
```

## Troubleshooting

### Portfolio not loading (shows siteagent instead)

```bash
# Verify correct dist is mounted
docker exec portfolio-nginx ls -la /usr/share/nginx/html/
# Should show: index.html, assets/, projects.json

# Check index.html content
docker exec portfolio-nginx head -50 /usr/share/nginx/html/index.html
# Should contain portfolio-specific content, NOT siteagent

# Verify nginx config
docker exec portfolio-nginx cat /etc/nginx/conf.d/default.conf
# Should be nginx.portfolio.conf, not nginx.assistant.conf
```

### CORS errors

```bash
# Check backend ALLOWED_ORIGINS
docker exec backend printenv ALLOWED_ORIGINS
# Should include: https://assistant.ledger-mind.org

# Test CORS headers
curl -H "Origin: https://assistant.ledger-mind.org" \
     -i https://assistant.ledger-mind.org/api/ready
```

### CSP blocking scripts

```bash
# Check CSP header
curl -I https://assistant.ledger-mind.org/
# Look for: Content-Security-Policy header

# Verify nonce is being injected
curl -s https://assistant.ledger-mind.org/ | grep -o 'nonce-[a-zA-Z0-9-]*' | head -5
# Should show nonces in script tags
```

## Security Notes

- ✅ Backend runs as non-root (UID 1001)
- ✅ CORS restricted to production domain
- ✅ CSP with nonce for scripts
- ✅ TLS via Cloudflare
- ✅ Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- ✅ Health check endpoint at /healthz

## Next Steps

1. ✅ Deploy portfolio build to production
2. ⏳ Set up automated CI/CD for frontend
3. ⏳ Add monitoring/alerting
4. ⏳ Set up backup/restore procedures
5. ⏳ Document admin procedures

---

**Production URL**: https://assistant.ledger-mind.org
**Last Updated**: October 14, 2025
**Maintainer**: leok974
