# Deployment Automation Complete ✅

**Date**: October 17, 2025  
**Status**: Ready for deployment with one command  
**Branch**: `portfolio-polish`

## 🎯 What Was Done

### 1. Optimized Docker Compose Configuration

**File**: `deploy/docker-compose.portfolio-ui.yml`

**Changes**:
- ✅ Improved healthcheck: 15s interval, 10 retries, 5s start period
- ✅ Simplified network configuration (removed redundant settings)
- ✅ Port binding changed to `80:80` (direct port 80 binding)
- ✅ Network alias: `portfolio-ui` for nginx routing
- ✅ Watchtower: 60-second update interval
- ✅ Clean, minimal configuration

**Before**:
```yaml
ports:
  - "8089:80"
healthcheck:
  interval: 30s
  retries: 3
```

**After**:
```yaml
ports:
  - "80:80"
healthcheck:
  test: ["CMD-SHELL", "wget -qO- http://localhost || exit 1"]
  interval: 15s
  timeout: 5s
  retries: 10
  start_period: 5s
```

### 2. Created Server Bootstrap Script

**File**: `scripts/deploy/server_bootstrap.sh`

**Purpose**: Generate one-liner command for server deployment

**Usage**:
```bash
pnpm run deploy:server:print
# or
make deploy-server-print
```

**Output**:
```bash
docker network ls | grep -q infra_net || docker network create infra_net && \
mkdir -p ~/leo-portfolio && cd ~/leo-portfolio && \
curl -fsSLO 'https://raw.githubusercontent.com/leok974/leo-portfolio/portfolio-polish/deploy/docker-compose.portfolio-ui.yml' && \
docker compose -f docker-compose.portfolio-ui.yml up -d && \
docker compose -f docker-compose.portfolio-ui.yml ps && \
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep -E 'portfolio-ui|watchtower' && \
docker exec applylens-nginx-prod curl -sI http://portfolio-ui | head -5
```

### 3. Added Package Script

**File**: `package.json`

**Added**:
```json
{
  "scripts": {
    "deploy:server:print": "bash scripts/deploy/server_bootstrap.sh"
  }
}
```

### 4. Added Makefile Target

**File**: `Makefile`

**Added**:
```makefile
deploy-server-print:
	bash scripts/deploy/server_bootstrap.sh
```

### 5. Updated Deployment Documentation

**Files**:
- `DEPLOY_LEOKLEMET_NOW.md` - Quick start guide with one-liner
- `DEPLOY_SSH_COMMANDS.md` - Complete SSH deployment guide
- `DEPLOY_NOW.md` - Updated with new instructions

**Key Sections**:
- Quick start (one-liner)
- Manual deployment steps
- Verification commands
- Cloudflare cache purge
- Automated deployment testing

### 6. CI/CD Already Configured

**File**: `.github/workflows/deploy-docker.yml`

**Already includes**:
- ✅ Build with `VITE_LAYOUT_ENABLED=1`
- ✅ Push to GHCR: `:latest`, `:v{version}`, `:{sha}`
- ✅ Optional Cloudflare cache purge (if secrets present)

**Conditional purge**:
```yaml
- name: Purge Cloudflare cache (optional)
  if: env.CF_API_TOKEN != '' && env.CF_ZONE_ID != ''
  run: |
    curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
      -H "Authorization: Bearer $CF_API_TOKEN" \
      -H "Content-Type: application/json" \
      --data '{"purge_everything":true}'
```

## 🚀 How to Deploy

### Step 1: Get the Command

```bash
cd D:\leo-portfolio
pnpm run deploy:server:print
```

**Output** (copy this):
```bash
docker network ls | grep -q infra_net || docker network create infra_net && \
mkdir -p ~/leo-portfolio && cd ~/leo-portfolio && \
curl -fsSLO 'https://raw.githubusercontent.com/leok974/leo-portfolio/portfolio-polish/deploy/docker-compose.portfolio-ui.yml' && \
docker compose -f docker-compose.portfolio-ui.yml up -d && \
docker compose -f docker-compose.portfolio-ui.yml ps && \
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep -E 'portfolio-ui|watchtower' && \
docker exec applylens-nginx-prod curl -sI http://portfolio-ui | head -5
```

### Step 2: SSH to Your Server

```bash
ssh <your-user>@<your-server-ip>
```

### Step 3: Paste and Run

Paste the one-liner command from Step 1 and press Enter.

**Expected output**:
```
[+] Running 2/2
 ✔ Container portfolio-ui   Started
 ✔ Container watchtower     Started

NAME            IMAGE                                        STATUS
portfolio-ui    ghcr.io/leok974/leo-portfolio/portfolio:...  Up (healthy)
watchtower      containrrr/watchtower                         Up

HTTP/1.1 200 OK
Server: nginx
Content-Type: text/html
```

### Step 4: Verify Live Site

From your local machine:

```powershell
curl.exe -s https://leoklemet.com/ | Select-String "main-.*\.js"
```

Expected: `main-D0fKNExd.js` (or newer)

### Step 5: Purge Cloudflare Cache (Optional)

**Via Dashboard**:
1. Go to https://dash.cloudflare.com
2. Select `leoklemet.com` zone
3. **Caching** → **Configuration** → **Purge Everything**

**Via API** (requires CF_API_TOKEN and CF_ZONE_ID):
```powershell
$headers = @{
    "Authorization" = "Bearer $env:CF_API_TOKEN"
    "Content-Type" = "application/json"
}
Invoke-RestMethod -Method Post `
  -Uri "https://api.cloudflare.com/client/v4/zones/$env:CF_ZONE_ID/purge_cache" `
  -Headers $headers `
  -Body '{"purge_everything":true}'
```

## 🤖 Automated Deployment Flow

### Current Setup

```
Developer Push to main
    ↓
GitHub Actions (deploy-docker.yml)
    ├─ Build portfolio with VITE_LAYOUT_ENABLED=1
    ├─ Push :latest, :v{version}, :{sha} to GHCR
    └─ (Optional) Purge Cloudflare cache
    ↓
Watchtower (on server, checks every 60s)
    ├─ Detect new :latest image
    ├─ Pull new image
    ├─ Stop old portfolio-ui container
    ├─ Start new container
    └─ Clean up old images
    ↓
Live on https://leoklemet.com/ (within 3-4 minutes)
```

### Testing Automation

1. **Make a small change**:
   ```bash
   echo "// Test" >> apps/portfolio-ui/src/main.tsx
   git add .
   git commit -m "test: verify automated deployment"
   git push origin main
   ```

2. **Watch GitHub Actions**:
   - Go to: https://github.com/leok974/leo-portfolio/actions
   - Wait ~2-3 minutes for build + push

3. **Watch Watchtower** (on server):
   ```bash
   docker logs -f watchtower
   # Should see:
   # - "Found new image"
   # - "Stopping /portfolio-ui"
   # - "Starting /portfolio-ui"
   ```

4. **Verify new version** (~3-4 min after push):
   ```bash
   curl -s https://leoklemet.com/ | grep -oE 'main-[A-Za-z0-9_-]+\.js'
   # Hash should be different
   ```

## 📋 Infrastructure Overview

```
Cloudflare Tunnel (db56892d-4879-4263-99bf-202d46b6aff9)
    ↓
applylens-nginx-prod (port 80, in infra_net)
    ├─ leoklemet.com → 301 → www.leoklemet.com
    ├─ www.leoklemet.com/       → portfolio-ui:80 ⭐
    ├─ www.leoklemet.com/agent/* → ai-finance-backend-1:8000
    ├─ www.leoklemet.com/api/*   → ai-finance-backend-1:8000
    └─ assistant.ledger-mind.org → (other services)

Docker Containers in infra_net:
├─ applylens-nginx-prod (routing)
├─ ai-finance-backend-1 (backend API)
├─ portfolio-ui (portfolio site) ⭐ NEW
├─ watchtower (auto-updater) ⭐ NEW
├─ cloudflared (tunnel connector)
└─ infra-ollama-1 (AI model)
```

## ✅ Deployment Checklist

- [ ] Run `pnpm run deploy:server:print` to get command
- [ ] SSH to production server
- [ ] Paste and run the one-liner
- [ ] Verify containers are running and healthy
- [ ] Check nginx can reach portfolio-ui (200 OK)
- [ ] Verify live site shows new hash
- [ ] Purge Cloudflare cache (optional, for instant update)
- [ ] Test automated deployment with small change
- [ ] Watch Watchtower update container automatically

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `DEPLOY_LEOKLEMET_NOW.md` | Quick start guide with one-liner |
| `DEPLOY_SSH_COMMANDS.md` | Complete SSH deployment guide |
| `DEPLOY_NOW.md` | Original deployment guide |
| `DEPLOYMENT_AUTOMATION_COMPLETE.md` | This summary |
| `scripts/deploy/server_bootstrap.sh` | One-liner generator script |

## 🎯 Success Criteria

### Deployment Success
- ✅ `portfolio-ui` container running and healthy
- ✅ `watchtower` container running
- ✅ Nginx returns 200 OK for `http://portfolio-ui/`
- ✅ Public site serves new hash at `https://leoklemet.com/`

### Automation Success
- ✅ Push to `main` triggers GitHub Actions
- ✅ New image pushed to GHCR within 2-3 minutes
- ✅ Watchtower detects and pulls new image within 60 seconds
- ✅ New version live within 3-4 minutes total

## 🔧 Troubleshooting

### Container won't start
```bash
docker logs portfolio-ui
docker logs watchtower
docker compose -f docker-compose.portfolio-ui.yml down
docker compose -f docker-compose.portfolio-ui.yml up -d
```

### Nginx can't reach portfolio-ui
```bash
# Check both are on infra_net
docker network inspect infra_net | grep -E 'portfolio-ui|applylens-nginx-prod'

# If missing, connect:
docker network connect infra_net applylens-nginx-prod
docker network connect infra_net portfolio-ui
```

### Old hash still showing
- Purge Cloudflare cache
- Wait 30-60 seconds for propagation
- Try incognito/private browsing
- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

### Watchtower not updating
```bash
# Check watchtower logs
docker logs watchtower --tail 50

# Verify label is present
docker inspect portfolio-ui | grep -A5 Labels

# Force manual update
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest
docker compose -f docker-compose.portfolio-ui.yml up -d --force-recreate
```

## 🎉 Summary

**Status**: ✅ **READY FOR DEPLOYMENT**

All improvements implemented:
1. ✅ Optimized docker-compose with healthcheck
2. ✅ Server bootstrap one-liner script
3. ✅ Package script: `deploy:server:print`
4. ✅ Makefile target: `deploy-server-print`
5. ✅ Updated deployment documentation
6. ✅ CI/CD already configured with optional CF purge

**Next action**: Run the one-liner on your production server!

```bash
# Get the command:
pnpm run deploy:server:print

# SSH to server and paste it:
ssh <user>@<server>
```

---

**Questions?** See `DEPLOY_SSH_COMMANDS.md` for complete troubleshooting guide.
