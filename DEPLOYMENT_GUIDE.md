# Portfolio Deployment Guide

## Quick Deploy (Recommended)

### Option 1: Automated Script

```powershell
# Navigate to deploy directory
cd deploy

# Pull and deploy latest image
.\deploy-portfolio-latest.ps1

# Purge Cloudflare cache
.\cf-cache-purge.ps1
```

### Option 2: Manual Docker Commands

```powershell
# 1. Pull latest image
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest

# 2. Stop and remove old container
docker stop portfolio-frontend
docker rm portfolio-frontend

# 3. Start new container
docker run -d `
    --name portfolio-frontend `
    -p 8082:80 `
    --restart unless-stopped `
    ghcr.io/leok974/leo-portfolio/portfolio:latest

# 4. Verify deployment
docker logs portfolio-frontend
curl http://localhost:8082/
```

---

## Full Production Deployment

### Prerequisites

1. **Docker** installed and running
2. **GHCR Authentication**:
   ```powershell
   gh auth login
   # or
   docker login ghcr.io -u YOUR_GITHUB_USERNAME
   ```
3. **Cloudflare API Token** (for cache purge):
   - Get from: https://dash.cloudflare.com/profile/api-tokens
   - Permission: Zone:Edit for leoklemet.com
   - Set environment variable:
     ```powershell
     $env:CF_API_TOKEN = "your-token-here"
     $env:CF_ZONE_ID = "your-zone-id"  # Optional, will auto-fetch
     ```

---

## Step-by-Step Deployment

### 1. Verify CI Build

```powershell
# Check latest workflow run
gh run list --limit 3 --workflow=portfolio-ci.yml

# Verify image exists
docker manifest inspect ghcr.io/leok974/leo-portfolio/portfolio:latest
```

**Expected**: Content build job completed successfully, Docker image pushed.

---

### 2. Deploy to Production

#### Using Deployment Script (Recommended)

```powershell
cd deploy
.\deploy-portfolio-latest.ps1
```

**What it does**:
- ✅ Authenticates with GHCR
- ✅ Pulls latest image
- ✅ Stops old container
- ✅ Starts new container with health checks
- ✅ Verifies deployment
- ✅ Shows next steps

#### Manual Deployment

```powershell
# Pull latest
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest

# Stop old container
docker stop portfolio-frontend 2>$null
docker rm portfolio-frontend 2>$null

# Start new container
docker run -d `
    --name portfolio-frontend `
    -p 8082:80 `
    --restart unless-stopped `
    --health-cmd="wget --quiet --tries=1 --spider http://localhost:80/ || exit 1" `
    --health-interval=30s `
    --health-timeout=3s `
    --health-retries=3 `
    ghcr.io/leok974/leo-portfolio/portfolio:latest

# Check status
docker ps -a | Select-String "portfolio"
docker logs --tail 50 portfolio-frontend
```

---

### 3. Purge Cloudflare Cache

**Why**: Ensure visitors get the new OG images and content immediately.

#### Using Script (Recommended)

```powershell
cd deploy
.\cf-cache-purge.ps1
```

**Options**:
```powershell
# Selective purge (OG images + homepage)
.\cf-cache-purge.ps1

# Purge everything (use with caution)
.\cf-cache-purge.ps1 -PurgeEverything

# Dry run (test without making changes)
.\cf-cache-purge.ps1 -DryRun
```

#### Manual Cache Purge

```powershell
$zoneId = "your-zone-id"
$token = $env:CF_API_TOKEN

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json"
}

$body = @{
    files = @(
        "https://www.leoklemet.com/",
        "https://www.leoklemet.com/og/og.png",
        "https://www.leoklemet.com/og/applylens.png"
    )
} | ConvertTo-Json

Invoke-RestMethod `
    -Method Post `
    -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/purge_cache" `
    -Headers $headers `
    -Body $body
```

---

### 4. Verify Deployment

#### Check OG Images

```powershell
# Test each OG image
curl -I https://www.leoklemet.com/og/og.png
curl -I https://www.leoklemet.com/og/leo-portfolio.png
curl -I https://www.leoklemet.com/og/applylens.png
```

**Expected**:
```
HTTP/2 200 OK
Content-Type: image/png
Content-Length: [size]
```

#### Check Homepage

```powershell
# Test homepage loads
curl -s https://www.leoklemet.com/ | Select-String "Leo Klemet"

# Check OG meta tags
curl -s https://www.leoklemet.com/ | Select-String "og:image"
```

**Expected**: Should contain `og:image` with `www.leoklemet.com/og/og.png`

#### Visual Test

```powershell
# Open in browser
Start-Process "https://www.leoklemet.com"

# Test OG preview (use in browser dev tools or online validator)
Start-Process "https://www.opengraph.xyz/url/https%3A%2F%2Fwww.leoklemet.com%2F"
```

---

## What's Included in This Deployment

### Content Updates
- ✅ 6 projects synced from GitHub (leo-portfolio, ApplyLens, ai-finance-agent-oss, etc.)
- ✅ 7 OG images generated (1200×630 PNG)
- ✅ Latest portfolio build with all assets

### New Features
- ✅ Dynamic project listing
- ✅ Social media preview images
- ✅ Automated content sync
- ✅ Improved SEO

### Infrastructure
- ✅ Docker image: `ghcr.io/leok974/leo-portfolio/portfolio:latest`
- ✅ Nightly CI/CD automation (3:17 AM)
- ✅ Health checks and auto-restart
- ✅ Production-ready nginx configuration

---

## Troubleshooting

### Issue: Docker pull fails

**Symptom**: `Error response from daemon: unauthorized`

**Solution**:
```powershell
# Re-authenticate with GitHub
gh auth login

# Login to GHCR
gh auth token | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

---

### Issue: Container won't start

**Symptom**: Container exits immediately

**Diagnosis**:
```powershell
# Check logs
docker logs portfolio-frontend

# Check if port is already in use
netstat -ano | Select-String ":8082"
```

**Solution**:
```powershell
# Use different port
docker run -d --name portfolio-frontend -p 8083:80 ghcr.io/leok974/leo-portfolio/portfolio:latest

# Or kill process using port 8082
Stop-Process -Id [PID]
```

---

### Issue: OG images still 404

**Symptom**: `curl -I https://www.leoklemet.com/og/og.png` returns 404

**Possible Causes**:
1. **Cache not purged** - Run `.\cf-cache-purge.ps1`
2. **Wrong nginx config** - Check if nginx is proxying to correct container
3. **Images not in build** - Verify with:
   ```powershell
   docker run --rm --entrypoint ls ghcr.io/leok974/leo-portfolio/portfolio:latest -la /usr/share/nginx/html/og/
   ```

**Solution**:
```powershell
# 1. Verify images in container
docker exec portfolio-frontend ls -la /usr/share/nginx/html/og/

# 2. Purge Cloudflare cache
.\cf-cache-purge.ps1

# 3. Wait 60 seconds and test again
Start-Sleep -Seconds 60
curl -I https://www.leoklemet.com/og/og.png
```

---

### Issue: Cloudflare cache purge fails

**Symptom**: `401 Unauthorized` or `403 Forbidden`

**Solution**:
```powershell
# Verify token has correct permissions
# Token needs: Zone:Edit permission for leoklemet.com

# Test token validity
$token = $env:CF_API_TOKEN
Invoke-RestMethod -Headers @{ Authorization="Bearer $token" } `
    -Uri "https://api.cloudflare.com/client/v4/user/tokens/verify"

# Generate new token if needed:
# https://dash.cloudflare.com/profile/api-tokens
```

---

## Rollback Procedure

### Option 1: Rollback to Previous Image

```powershell
# List recent images
gh run list --limit 10 --workflow=portfolio-ci.yml

# Find commit SHA from successful run
$SHA = "abc1234"  # Short SHA from workflow

# Pull specific version
docker pull ghcr.io/leok974/leo-portfolio/portfolio:$SHA

# Deploy specific version
docker stop portfolio-frontend
docker rm portfolio-frontend
docker run -d --name portfolio-frontend -p 8082:80 `
    ghcr.io/leok974/leo-portfolio/portfolio:$SHA
```

### Option 2: Rebuild from Local

```powershell
# Checkout previous commit
git checkout HEAD~1

# Rebuild locally
pnpm projects:sync
pnpm og:gen
pnpm build:portfolio

# Deploy local build
docker build -f Dockerfile.portfolio -t portfolio:local .
docker stop portfolio-frontend
docker rm portfolio-frontend
docker run -d --name portfolio-frontend -p 8082:80 portfolio:local
```

---

## Post-Deployment Checklist

- [ ] Docker container running: `docker ps | Select-String portfolio`
- [ ] Health check passing: `docker inspect portfolio-frontend | Select-String Health`
- [ ] Local endpoint responding: `curl http://localhost:8082/`
- [ ] Production site updated: `curl https://www.leoklemet.com/`
- [ ] OG images accessible: `curl -I https://www.leoklemet.com/og/og.png`
- [ ] OG image content-type correct: Should be `image/png`
- [ ] Cloudflare cache purged: `.\cf-cache-purge.ps1` completed
- [ ] Browser test: Open https://www.leoklemet.com in incognito
- [ ] OG preview test: Check with https://www.opengraph.xyz/

---

## Monitoring

### Container Logs

```powershell
# Follow logs in real-time
docker logs -f portfolio-frontend

# Last 100 lines
docker logs --tail 100 portfolio-frontend

# Logs from last hour
docker logs --since 1h portfolio-frontend
```

### Container Stats

```powershell
# Resource usage
docker stats portfolio-frontend

# Container details
docker inspect portfolio-frontend
```

### Access Logs

If using nginx with custom logging:
```powershell
docker exec portfolio-frontend tail -f /var/log/nginx/access.log
```

---

## Automated Deployments

### Nightly Updates

The CI/CD workflow runs automatically at 3:17 AM daily:
- Syncs projects from GitHub
- Regenerates OG images
- Builds and pushes new Docker image

**To auto-deploy nightly builds** (optional):
1. Set up a cron job or scheduled task
2. Run `deploy-portfolio-latest.ps1` and `cf-cache-purge.ps1`
3. Configure notifications for failures

Example Windows Task Scheduler:
```powershell
$action = New-ScheduledTaskAction -Execute "pwsh.exe" `
    -Argument "-File D:\leo-portfolio\deploy\deploy-portfolio-latest.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 4:00AM
Register-ScheduledTask -TaskName "Portfolio Auto Deploy" `
    -Action $action -Trigger $trigger
```

---

## Support

**Documentation**:
- `PORTFOLIO_CI_COMPLETE.md` - CI/CD implementation details
- `PORTFOLIO_CI_FIXES_COMPLETE.md` - Recent fixes and test skip rationale
- `PORTFOLIO_COMMANDS.md` - Quick reference commands

**Logs**:
- CI/CD: https://github.com/leok974/leo-portfolio/actions
- Container: `docker logs portfolio-frontend`

**Common Commands**:
```powershell
# Quick status check
docker ps -a | Select-String portfolio

# Restart container
docker restart portfolio-frontend

# View recent deployments
gh run list --workflow=portfolio-ci.yml

# Check current image hash
docker inspect ghcr.io/leok974/leo-portfolio/portfolio:latest | Select-String Digest
```
