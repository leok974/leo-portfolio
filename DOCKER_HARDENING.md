# Docker Compose Hardening - Exact Edits Summary

## Date: October 5, 2025

## Objective
Harden Docker Compose configuration to prevent accidentally removing containers from other projects when running `docker compose down --remove-orphans`.

---

## 🔧 Edit 1: Added explicit project name to docker-compose.yml

**File:** `d:\leo-portfolio\deploy\docker-compose.yml`

**Location:** Top of file, after version declaration

**Before:**
```yaml
version: "3.9"
services:
  ollama:
    image: ollama/ollama:latest
```

**After:**
```yaml
version: "3.9"

name: portfolio

services:
  ollama:
    image: ollama/ollama:latest
```

**Impact:** All containers now have `portfolio-*` prefix instead of `deploy-*`

---

## 🔧 Edit 2: Added infra_net network to backend service

**File:** `d:\leo-portfolio\deploy\docker-compose.yml`

**Location:** Backend service definition

**Before:**
```yaml
backend:
  build:
    context: ../assistant_api
  env_file:
    - ../assistant_api/.env.prod
  environment:
    - OLLAMA_HOST=ollama
    - OLLAMA_PORT=11434
    - OPENAI_BASE_URL=http://ollama:11434/v1
    - OPENAI_MODEL=gpt-oss:20b
    # Secret files (optional): set either *_API_KEY or *_API_KEY_FILE to use mounted secrets
    - FALLBACK_API_KEY_FILE=/run/secrets/openai_api_key
    - OPENAI_API_KEY_FILE=/run/secrets/openai_api_key
  volumes:
    - ../data:/app/data
  depends_on:
    - ollama
  ports:
    - "127.0.0.1:8000:8000"
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/ready"]
    interval: 30s
    timeout: 5s
    retries: 3
  secrets:
    - openai_api_key
```

**After:**
```yaml
backend:
  build:
    context: ../assistant_api
  env_file:
    - ../assistant_api/.env.prod
  environment:
    - OLLAMA_HOST=ollama
    - OLLAMA_PORT=11434
    - OPENAI_BASE_URL=http://ollama:11434/v1
    - OPENAI_MODEL=gpt-oss:20b
    # Secret files (optional): set either *_API_KEY or *_API_KEY_FILE to use mounted secrets
    - FALLBACK_API_KEY_FILE=/run/secrets/openai_api_key
    - OPENAI_API_KEY_FILE=/run/secrets/openai_api_key
  volumes:
    - ../data:/app/data
  depends_on:
    - ollama
  ports:
    - "127.0.0.1:8000:8000"
  restart: unless-stopped
  networks:
    - default
    - infra_net
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/ready"]
    interval: 30s
    timeout: 5s
    retries: 3
  secrets:
    - openai_api_key
```

**Added lines:**
```yaml
networks:
  - default
  - infra_net
```

**Impact:** Backend can access shared infrastructure services on infra_net while maintaining internal connectivity on default network

---

## 🔧 Edit 3: Added infra_net network to nginx service

**File:** `d:\leo-portfolio\deploy\docker-compose.yml`

**Location:** Nginx service definition

**Before:**
```yaml
nginx:
  image: nginx:1.27-alpine
  volumes:
    - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    - ../dist:/usr/share/nginx/html:ro
  depends_on:
    - backend
  ports:
    - "127.0.0.1:8080:80"
    - "127.0.0.1:8443:443"
  restart: unless-stopped
```

**After:**
```yaml
nginx:
  image: nginx:1.27-alpine
  volumes:
    - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    - ../dist:/usr/share/nginx/html:ro
  depends_on:
    - backend
  ports:
    - "127.0.0.1:8080:80"
    - "127.0.0.1:8443:443"
  restart: unless-stopped
  networks:
    - default
    - infra_net
```

**Added lines:**
```yaml
networks:
  - default
  - infra_net
```

**Impact:** Nginx accessible from Cloudflare Tunnel (running on infra_net) while maintaining internal connectivity

---

## 🔧 Edit 4: Added infra_net external network definition

**File:** `d:\leo-portfolio\deploy\docker-compose.yml`

**Location:** After volumes section, before secrets

**Before:**
```yaml
volumes:
  ollama:

secrets:
  openai_api_key:
    file: ../secrets/openai_api_key
```

**After:**
```yaml
volumes:
  ollama:

networks:
  infra_net:
    external: true

secrets:
  openai_api_key:
    file: ../secrets/openai_api_key
```

**Added lines:**
```yaml
networks:
  infra_net:
    external: true
```

**Impact:** Declares infra_net as external network (created outside this compose file)

---

## 📝 New File: scripts/safe-down.ps1

**File:** `d:\leo-portfolio\scripts\safe-down.ps1` (NEW)

**Full content:**
```powershell
# Safe Docker Compose Down Script
# Explicitly uses -p portfolio to avoid affecting other projects

Write-Host "`n🛑 Safely stopping portfolio services`n" -ForegroundColor Yellow

$env:DOCKER_CONTEXT = "desktop-linux"
Set-Location D:\leo-portfolio\deploy

Write-Host "Running: docker compose -p portfolio down --remove-orphans`n" -ForegroundColor Gray

docker compose -p portfolio down --remove-orphans

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Portfolio services stopped successfully" -ForegroundColor Green
    Write-Host "   Only portfolio-* containers were affected" -ForegroundColor Gray
    Write-Host "   Shared infrastructure (infra-*) remains running`n" -ForegroundColor Gray
} else {
    Write-Host "`n❌ Error stopping services (exit code: $LASTEXITCODE)`n" -ForegroundColor Red
}
```

**Purpose:** Safely stop portfolio services without affecting other projects

**Usage:**
```powershell
.\scripts\safe-down.ps1
```

---

## ✅ Verification Results

### Container Naming
- **Before:** `deploy-backend-1`, `deploy-nginx-1`, `deploy-ollama-1`
- **After:** `portfolio-backend-1`, `portfolio-nginx-1`, `portfolio-ollama-1`

### Network Connectivity
```
$ docker inspect portfolio-backend-1 --format '{{range $net, $config := .NetworkSettings.Networks}}{{$net}} {{end}}'
infra_net portfolio_default
```
✅ Backend connected to both networks

### Service Status
```
NAME                  IMAGE                  STATUS
portfolio-backend-1   portfolio-backend      Up (health: starting)
portfolio-nginx-1     nginx:1.27-alpine      Up
portfolio-ollama-1    ollama/ollama:latest   Up (healthy)
```
✅ All services running

---

## 🎯 Benefits

1. **Explicit Project Name:** Containers clearly identified as `portfolio-*`
2. **Isolated Operations:** `docker compose down` only affects portfolio services
3. **Shared Infrastructure:** Can access infra_net for shared Ollama, PostgreSQL, Cloudflare Tunnel
4. **Safe Cleanup:** `scripts/safe-down.ps1` ensures only portfolio containers are removed
5. **No Accidental Impact:** Other projects (like ai-finance-agent) won't be affected by portfolio operations

---

## 🚀 Deployment Commands

### Start services:
```powershell
$env:DOCKER_CONTEXT="desktop-linux"
cd D:\leo-portfolio\deploy
docker compose up -d
```

### Stop services (safe):
```powershell
.\scripts\safe-down.ps1
```

### Check status:
```powershell
docker compose ps
```

### View logs:
```powershell
docker compose logs -f backend
```

---

## 📋 Prerequisites Created

The `infra_net` network was created manually:
```powershell
docker network create infra_net
```

This network should exist before starting the portfolio services. It will be shared with the D:\infra infrastructure stack when that's deployed.

---

## 🔒 Architecture

```
Internet → Cloudflare Tunnel (on infra_net)
  ↓
  infra_net (external bridge network)
    ├─ portfolio-nginx-1 (web server)
    ├─ portfolio-backend-1 (API)
    └─ [future: infra-ollama-1, infra-pg-1, infra-cloudflared-1]
  ↓
  portfolio_default (internal network)
    ├─ portfolio-nginx-1 ↔ portfolio-backend-1
    └─ portfolio-backend-1 ↔ portfolio-ollama-1
```

---

## ⚠️ Note

The `version: "3.9"` line in docker-compose.yml is now obsolete in Docker Compose v2. Consider removing it in a future update, but it currently works with a warning.
