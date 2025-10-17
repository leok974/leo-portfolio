# Portfolio Website Production Deployment Guide

## Overview
Deploy the **portfolio website** (not siteagent) to production with nginx, backend API, and optional Ollama LLM support.

## Architecture
```
portfolio.yourdomain.com (port 80/443)
  ↓
  nginx (portfolio-ui container, port 8081 internally)
  ↓
  dist-portfolio/ (static HTML/CSS/JS from Vite build)
  ↓
  backend API (optional, for assistant features, port 8002)
  ↓
  Ollama LLM (optional, via infra network)
```

## Prerequisites

### 1. Build the Portfolio Frontend
```powershell
# Build portfolio (not siteagent)
npm run build:portfolio

# Verify build output
ls dist-portfolio/
# Should contain: index.html, assets/, projects.json, etc.
```

### 2. Backend Configuration (Optional)
If you want the assistant chatbot features:
```powershell
# Create backend environment file
cd assistant_api
cp .env.example .env.prod

# Edit .env.prod with your settings:
# - OPENAI_API_KEY or FALLBACK_API_KEY
# - OLLAMA_HOST (if using local Ollama)
# - RAG database path
```

### 3. Secrets Setup
```powershell
# Create secrets directory
mkdir -p secrets

# Add OpenAI API key (if needed for fallback)
echo "sk-your-key-here" > secrets/openai_api_key

# Secure the secrets
chmod 600 secrets/openai_api_key  # On Linux
# On Windows, use file properties to restrict access
```

### 4. Infrastructure Network (If Using Ollama)
```powershell
# Create external infra network for Ollama
docker network create infra_net

# Start Ollama (if not already running)
cd deploy
docker compose -f docker-compose.infra.yml up -d ollama
```

## Deployment Steps

### Quick Start (Portfolio Only, No Backend)

If you just want to deploy the static portfolio website without backend/assistant features:

```powershell
# 1. Build portfolio
npm run build:portfolio

# 2. Create a simplified docker-compose for portfolio-only
cd deploy
```

Create `docker-compose.portfolio-only.yml`:
```yaml
version: "3.9"

name: portfolio

services:
  portfolio-ui:
    image: nginx:1.27-alpine
    container_name: portfolio-ui
    volumes:
      - ./nginx.portfolio.conf:/etc/nginx/conf.d/default.conf:ro
      - ../dist-portfolio:/usr/share/nginx/html:ro
    ports:
      - "80:80"
      - "443:443"  # If you add TLS certs
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1/healthz || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 5
```

```powershell
# 3. Deploy
docker compose -f docker-compose.portfolio-only.yml up -d

# 4. Test
curl http://localhost/
curl http://localhost/healthz
```

### Full Stack (Portfolio + Backend + Ollama)

For the complete experience with AI assistant:

```powershell
# 1. Build portfolio
npm run build:portfolio

# 2. Ensure backend .env.prod is configured
cat assistant_api/.env.prod

# 3. Start infrastructure (Ollama)
cd deploy
docker compose -f docker-compose.infra.yml up -d

# 4. Wait for Ollama to be ready
docker compose -f docker-compose.infra.yml ps

# 5. Start main services (backend + portfolio-ui)
docker compose up -d

# 6. Check health
curl http://localhost:8081/healthz  # Portfolio frontend
curl http://localhost:8002/ready    # Backend API
curl http://localhost:8002/status/summary
```

## Production Checklist

### Security
- [ ] TLS/HTTPS configured (Let's Encrypt or Cloudflare)
- [ ] Secrets properly secured (not committed to git)
- [ ] CSP headers configured in nginx.portfolio.conf
- [ ] CORS origins restricted to your domains only
- [ ] Backend API not directly exposed (only via nginx proxy)

### Performance
- [ ] Static assets cached (check nginx Cache-Control headers)
- [ ] Gzip/Brotli compression enabled in nginx
- [ ] Image optimization completed
- [ ] Lazy loading implemented for heavy content

### Monitoring
- [ ] Health checks passing (`/healthz`, `/ready`)
- [ ] Log aggregation configured (optional: Loki/Promtail)
- [ ] Metrics collection (optional: Prometheus)
- [ ] Uptime monitoring (UptimeRobot, Pingdom, etc.)

### DNS & Networking
- [ ] Domain A/AAAA records point to server
- [ ] Firewall allows ports 80/443
- [ ] If using Cloudflare Tunnel: configured and running
- [ ] SSL/TLS certificates valid and auto-renewing

## Configuration Files

### Key Files for Portfolio Deployment
- `dist-portfolio/` - Built frontend assets
- `deploy/nginx.portfolio.conf` - Portfolio nginx config
- `deploy/docker-compose.yml` - Main compose file
- `assistant_api/.env.prod` - Backend configuration
- `secrets/openai_api_key` - API key secret

### Nginx Configuration
The `nginx.portfolio.conf` includes:
- CSP headers with nonce support
- Security headers (X-Frame-Options, etc.)
- Static asset caching
- Health check endpoint
- Calendly integration support

## Troubleshooting

### Issue: "Connection refused" to backend
```powershell
# Check if backend is running
docker ps | grep backend

# Check backend logs
docker logs portfolio-backend-1

# Test backend directly
curl http://localhost:8002/ready
```

### Issue: "404 Not Found" for pages
```powershell
# Verify dist-portfolio exists and has content
ls dist-portfolio/

# Rebuild if needed
npm run build:portfolio

# Restart nginx to pick up changes
docker restart portfolio-ui
```

### Issue: Ollama not responding
```powershell
# Check Ollama status
docker ps | grep ollama

# Check Ollama logs
docker logs infra-ollama-1

# Test Ollama directly
curl http://localhost:11434/api/version
```

### Issue: Backend can't connect to Ollama
```powershell
# Verify infra network
docker network inspect infra_net

# Check if backend is on infra network
docker inspect portfolio-backend-1 | grep infra_net

# Reconnect if needed
docker network connect infra_net portfolio-backend-1
```

## Updating Deployment

### Update Frontend Only
```powershell
# 1. Build new version
npm run build:portfolio

# 2. Restart nginx container
docker restart portfolio-ui

# Nginx will serve new files immediately (bind mount)
```

### Update Backend
```powershell
# 1. Pull/build new backend
cd assistant_api
docker compose build backend

# 2. Restart backend
docker compose restart backend

# Or with zero downtime (requires load balancer)
docker compose up -d --scale backend=2
# wait for new backend to be healthy
docker compose up -d --scale backend=1 --no-recreate
```

### Update Both
```powershell
# 1. Build frontend
npm run build:portfolio

# 2. Rebuild and restart all
cd deploy
docker compose up -d --build

# Check everything is healthy
docker compose ps
curl http://localhost:8081/healthz
curl http://localhost:8002/ready
```

## Monitoring & Logs

### View Logs
```powershell
# All services
docker compose logs -f

# Specific service
docker compose logs -f portfolio-ui
docker compose logs -f backend

# Last 100 lines
docker compose logs --tail=100 portfolio-ui
```

### Health Checks
```powershell
# Frontend health
curl http://localhost:8081/healthz

# Backend readiness
curl http://localhost:8002/ready

# Backend full status
curl http://localhost:8002/status/summary

# LLM health
curl http://localhost:8002/llm/health
```

### Performance Monitoring
```powershell
# Container stats
docker stats portfolio-ui portfolio-backend-1

# Nginx access log (if enabled)
docker exec portfolio-ui tail -f /var/log/nginx/access.log

# Backend API metrics
curl http://localhost:8002/metrics
```

## Backup & Recovery

### Backup Data
```powershell
# Backup RAG database
cp data/rag.sqlite backups/rag.sqlite.$(date +%Y%m%d)

# Backup environment config
cp assistant_api/.env.prod backups/.env.prod.$(date +%Y%m%d)

# Backup secrets
cp secrets/openai_api_key backups/openai_api_key.$(date +%Y%m%d)
```

### Restore from Backup
```powershell
# Restore RAG database
cp backups/rag.sqlite.20251014 data/rag.sqlite

# Restart services
cd deploy
docker compose restart backend
```

## CI/CD Integration

### GitHub Actions (Example)
```yaml
name: Deploy Portfolio

on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'public/**'
      - 'vite.config.portfolio.ts'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build portfolio
        run: npm run build:portfolio

      - name: Deploy to server
        run: |
          # rsync, scp, or your deployment method
          rsync -avz dist-portfolio/ user@server:/path/to/portfolio/

      - name: Restart nginx
        run: |
          ssh user@server 'cd /path/to/deploy && docker restart portfolio-ui'
```

## Related Documentation
- Main README: `../README.md`
- Backend API: `../assistant_api/README.md`
- Docker Compose: `docker-compose.yml`
- Nginx Config: `nginx.portfolio.conf`
- Build Config: `../vite.config.portfolio.ts`

## Support
- GitHub Issues: https://github.com/leok974/leo-portfolio/issues
- Deployment issues: Check logs first, then create issue with logs attached
