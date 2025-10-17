# Image-Based Production Deployment Guide

## Overview

This guide covers deploying the portfolio as a Docker image to production using GHCR (GitHub Container Registry).

**Architecture:**
- ✅ Portfolio served from Docker container (nginx:alpine)
- ✅ Reverse proxy (nginx/Traefik/Caddy) handles routing
- ✅ Same-origin API proxy (no CORS)
- ✅ Auto-updates via Watchtower (optional)

---

## Quick Start

### 1. Build and Push Image

```powershell
# PowerShell (Windows)
.\deploy\build-and-push.ps1
```

```bash
# Bash (Linux/macOS)
./deploy/build-and-push.sh
```

### 2. Deploy on Server

```bash
# Pull latest image
docker compose pull portfolio

# Restart container
docker compose up -d portfolio
```

---

## Prerequisites

### Local Machine
- ✅ Docker installed and running
- ✅ Node.js 20+ and npm
- ✅ Git (for versioning tags)
- ✅ GitHub account with packages write access

### Production Server
- ✅ Docker and Docker Compose
- ✅ Reverse proxy container (nginx/Traefik/Caddy)
- ✅ Backend API container (siteagent/assistant)
- ✅ Network configured (`web` or similar)

---

## Step-by-Step Deployment

### Step 1: Configure Production Environment

The production environment is already configured in `apps/portfolio-ui/.env.production`:

```bash
VITE_SITE_ORIGIN=https://assistant.ledger-mind.org
VITE_AGENT_API_BASE=                           # Empty = same-origin
VITE_CALENDLY_URL=https://calendly.com/leoklemet-pa
VITE_LAYOUT_ENABLED=0                          # Disabled for now
```

✅ **No changes needed** - already correct for same-origin deployment.

### Step 2: Build the Docker Image

#### Option A: Automated Script (Recommended)

**PowerShell:**
```powershell
# Build and push to GHCR
.\deploy\build-and-push.ps1

# Options:
# -Tag "custom-tag"  - Use custom tag instead of git commit
# -NoPush            - Build only, don't push
# -SkipLatest        - Don't tag as :latest
```

**Bash:**
```bash
# Build and push to GHCR
./deploy/build-and-push.sh

# With custom tag
TAG=v1.0.0 ./deploy/build-and-push.sh
```

#### Option B: Manual Commands

```bash
# From repository root
export IMAGE=ghcr.io/leok974/leo-portfolio/portfolio
export TAG=prod-$(git rev-parse --short HEAD)

# Login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Build
docker build -f Dockerfile.portfolio -t $IMAGE:$TAG .
docker tag $IMAGE:$TAG $IMAGE:latest

# Push
docker push $IMAGE:$TAG
docker push $IMAGE:latest
```

#### Option C: GitHub Actions (Automatic)

Push to `main` branch - the workflow automatically:
1. Builds the portfolio
2. Creates Docker image
3. Pushes to GHCR with tags: `latest`, `prod-<commit>`, `<branch>`

File: `.github/workflows/deploy-portfolio.yml`

### Step 3: Update Server Configuration

#### A. Add Portfolio Service to Docker Compose

Create or update `docker-compose.yml` on your server:

```yaml
services:
  portfolio:
    image: ghcr.io/leok974/leo-portfolio/portfolio:latest
    container_name: portfolio
    restart: unless-stopped

    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:80/"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s

    networks:
      - web

    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # Your existing siteagent/API service
  siteagent:
    # ... existing config
    networks:
      - web

networks:
  web:
    external: true  # Or create if needed
```

#### B. Configure Reverse Proxy

**For Nginx (as reverse proxy):**

```nginx
server {
    listen 80;
    server_name assistant.ledger-mind.org;

    # Proxy to portfolio container for static files
    location / {
        proxy_pass http://portfolio:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Same-origin API proxies (BEFORE location /)
    location /chat {
        proxy_pass http://siteagent:8001/chat;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location /chat/stream {
        proxy_pass http://siteagent:8001/chat/stream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 3600s;
    }

    location /resume/ {
        proxy_pass http://siteagent:8001/resume/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location /api/ {
        proxy_pass http://siteagent:8001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

**For Traefik (labels in compose):**

```yaml
services:
  portfolio:
    image: ghcr.io/leok974/leo-portfolio/portfolio:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.portfolio.rule=Host(`assistant.ledger-mind.org`)"
      - "traefik.http.routers.portfolio.entrypoints=websecure"
      - "traefik.http.routers.portfolio.tls.certresolver=letsencrypt"
      - "traefik.http.services.portfolio.loadbalancer.server.port=80"
```

**For Caddy (Caddyfile):**

```caddyfile
assistant.ledger-mind.org {
    reverse_proxy /chat* siteagent:8001
    reverse_proxy /resume/* siteagent:8001
    reverse_proxy /api/* siteagent:8001
    reverse_proxy /* portfolio:80
}
```

### Step 4: Deploy to Server

```bash
# SSH to server
ssh user@your-server

# Navigate to compose directory
cd /path/to/compose

# Pull latest image
docker compose pull portfolio

# Start/restart portfolio
docker compose up -d portfolio

# Verify it's running
docker compose ps portfolio
docker logs portfolio
```

### Step 5: Reload Reverse Proxy

If you updated proxy configuration:

```bash
# For Nginx
docker exec nginx-container nginx -t
docker exec nginx-container nginx -s reload

# For Caddy
docker exec caddy-container caddy reload --config /etc/caddy/Caddyfile

# For Traefik (auto-reloads from labels)
# No action needed
```

### Step 6: Smoke Tests

```bash
# Homepage
curl -I http://localhost/ | head -n 5

# Assets
curl -I http://localhost/assets/ | head -n 5

# Projects JSON
curl -I http://localhost/projects.json | head -n 5

# Chat API (same-origin)
curl -s -X POST http://localhost/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hello"}]}' | head -c 200

# Resume PDF
curl -I http://localhost/resume/generate.pdf | head -n 5
```

### Step 7: Browser Tests

Open: **https://assistant.ledger-mind.org**

- [ ] Page loads without errors
- [ ] Console shows no CORS errors (F12)
- [ ] All assets load (CSS, JS, images)
- [ ] Calendly widget displays
- [ ] Resume buttons work
- [ ] Assistant chat opens and works
- [ ] Navigation works

---

## Auto-Updates with Watchtower

For automatic updates when you push new images:

### Add Watchtower Service

```yaml
services:
  watchtower:
    image: containrrr/watchtower:latest
    container_name: watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - WATCHTOWER_POLL_INTERVAL=300  # Check every 5 minutes
      - WATCHTOWER_CLEANUP=true       # Remove old images
      - WATCHTOWER_INCLUDE_RESTARTING=true
    command: portfolio  # Only watch portfolio container
```

### Or Monitor All Containers

```yaml
services:
  watchtower:
    image: containrrr/watchtower:latest
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - WATCHTOWER_POLL_INTERVAL=3600  # Check every hour
      - WATCHTOWER_CLEANUP=true
```

---

## CI/CD Integration

The GitHub Actions workflow (`.github/workflows/deploy-portfolio.yml`) automatically:

1. **Triggers on:**
   - Push to `main` branch
   - Changes to `apps/portfolio-ui/**`
   - Changes to `Dockerfile.portfolio`
   - Manual workflow dispatch

2. **Process:**
   - Installs dependencies
   - Builds portfolio (`npm run build:portfolio`)
   - Builds Docker image
   - Pushes to GHCR with tags:
     - `latest` (always)
     - `prod-<git-sha>` (for rollback)
     - `<branch-name>` (for branch deploys)

3. **Authentication:**
   - Uses `GITHUB_TOKEN` (automatic)
   - No secrets needed

---

## Troubleshooting

### Build Issues

**Error:** `COPY failed: no such file or directory`

**Solution:** Ensure you build from repository root:
```bash
cd /path/to/leo-portfolio
docker build -f Dockerfile.portfolio -t portfolio:test .
```

**Error:** `npm run build:portfolio` fails

**Solution:** Build locally first to debug:
```bash
npm ci
npm run build:portfolio
# Check dist-portfolio/ exists
ls dist-portfolio/
```

### Push Issues

**Error:** `unauthorized: authentication required`

**Solution:** Login to GHCR:
```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

Create token at: https://github.com/settings/tokens
- Scopes needed: `write:packages`, `read:packages`, `delete:packages`

**Error:** `denied: permission_denied`

**Solution:** Make repository package public or authenticate on server:
```bash
# On server
docker login ghcr.io -u YOUR_USERNAME
# Enter token when prompted
```

### Runtime Issues

**Error:** Container starts but immediately exits

**Diagnosis:**
```bash
docker logs portfolio
```

**Common causes:**
- Nginx config syntax error
- Missing files in /usr/share/nginx/html

**Solution:** Check build:
```bash
docker run --rm -it ghcr.io/leok974/leo-portfolio/portfolio:latest ls -la /usr/share/nginx/html
```

**Error:** 404 on all routes

**Solution:** Check nginx config in container:
```bash
docker exec portfolio nginx -t
docker exec portfolio cat /etc/nginx/conf.d/default.conf
```

**Error:** API calls fail with CORS

**Solution:** Verify `VITE_AGENT_API_BASE` is empty:
```bash
# Check built index.html for base URL
docker exec portfolio grep -i "agent.*base" /usr/share/nginx/html/index.html
```

If not empty, rebuild with correct `.env.production`.

---

## Rollback Procedure

### Quick Rollback to Previous Version

```bash
# SSH to server
ssh user@server

# Find previous image tag
docker images | grep portfolio

# Update compose to use specific tag
# Edit docker-compose.yml:
# image: ghcr.io/leok974/leo-portfolio/portfolio:prod-abc1234

# Restart
docker compose up -d portfolio
```

### Or Use Git SHA Tag

```bash
# Pull specific commit image
docker pull ghcr.io/leok974/leo-portfolio/portfolio:prod-abc1234

# Tag as latest locally
docker tag ghcr.io/leok974/leo-portfolio/portfolio:prod-abc1234 \
  ghcr.io/leok974/leo-portfolio/portfolio:latest

# Restart
docker compose up -d portfolio
```

---

## Monitoring

### Health Checks

```bash
# Check container health
docker inspect portfolio | jq '.[0].State.Health'

# Expected: "Status": "healthy"
```

### Logs

```bash
# View logs
docker logs portfolio

# Follow logs
docker logs -f portfolio

# Last 100 lines
docker logs --tail=100 portfolio

# With timestamps
docker logs -t portfolio
```

### Resource Usage

```bash
# Real-time stats
docker stats portfolio

# Container info
docker inspect portfolio | jq '.[0].State'
```

---

## Security Best Practices

### 1. Use Non-Root User in Container

Add to `Dockerfile.portfolio` (already included):
```dockerfile
USER nginx
```

### 2. Read-Only Filesystem

In `docker-compose.yml`:
```yaml
services:
  portfolio:
    read_only: true
    tmpfs:
      - /var/cache/nginx
      - /var/run
```

### 3. Resource Limits

```yaml
services:
  portfolio:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 128M
        reservations:
          memory: 64M
```

### 4. Scan Images

```bash
# Scan for vulnerabilities
docker scan ghcr.io/leok974/leo-portfolio/portfolio:latest

# Or use Trivy
trivy image ghcr.io/leok974/leo-portfolio/portfolio:latest
```

---

## Advanced: Multi-Stage Optimization

The Dockerfile already uses multi-stage builds:

**Stage 1 (Builder):**
- Full Node.js image
- Installs dependencies
- Builds production bundle
- Discarded after build

**Stage 2 (Production):**
- Minimal nginx:alpine (~40MB)
- Only contains built files
- No source code or dev dependencies
- Result: Compact, secure image

**Image size:** ~50MB (vs ~1GB if built files were copied from host)

---

## Quick Reference

### Build Commands
```powershell
# PowerShell
.\deploy\build-and-push.ps1

# Options
.\deploy\build-and-push.ps1 -NoPush           # Build only
.\deploy\build-and-push.ps1 -Tag "v1.0.0"    # Custom tag
.\deploy\build-and-push.ps1 -SkipLatest       # Don't tag latest
```

### Deploy Commands
```bash
# Pull and restart
docker compose pull portfolio && docker compose up -d portfolio

# Force recreate
docker compose up -d --force-recreate portfolio

# View logs
docker logs -f portfolio
```

### URLs
- **GHCR Package:** https://github.com/leok974/leo-portfolio/pkgs/container/leo-portfolio%2Fportfolio
- **Production Site:** https://assistant.ledger-mind.org
- **Workflow Runs:** https://github.com/leok974/leo-portfolio/actions

---

**Ready to deploy!** 🚀

Build your image and deploy to production in minutes.
