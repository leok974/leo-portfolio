# 🎯 Execute Deployment Now

**Status**: ✅ Everything ready
**Current production**: `main-QESHvkic.js` (old)
**Target**: `main-D0fKNExd.js` (new, in GHCR)

---

## Copy-Paste This On Your Production Server

```bash
# One command to deploy everything:
mkdir -p ~/leo-portfolio && cd ~/leo-portfolio && \
curl -fsSLO https://raw.githubusercontent.com/leok974/leo-portfolio/portfolio-polish/deploy/docker-compose.portfolio-ui.yml && \
docker compose -f docker-compose.portfolio-ui.yml up -d
```

---

## What Happens

1. Creates `~/leo-portfolio` directory
2. Downloads `docker-compose.portfolio-ui.yml` with Watchtower config
3. Starts:
   - `portfolio-ui` container (your site on port 8089)
   - `watchtower` container (auto-updates every 60s)

---

## Verify It Worked

```bash
# Check containers are running
docker ps | grep -E 'portfolio-ui|watchtower'

# Check what's being served
curl -s http://localhost:8089/ | grep -oE 'main-[A-Za-z0-9_-]+\.js'
# Should show: main-D0fKNExd.js

# Check watchtower is watching
docker logs watchtower --tail 5
# Should show: "Using a 60 second interval" and "Watching portfolio-ui"
```

---

## Update Nginx (if needed)

If nginx isn't already pointing to `portfolio-ui`:

```bash
# Check current config
docker exec applylens-nginx-prod cat /etc/nginx/conf.d/default.conf | grep -A3 "location /"

# If it doesn't proxy to portfolio-ui, you need to:
# 1. Edit nginx config to proxy_pass http://portfolio.int:80
# 2. Reload: docker exec applylens-nginx-prod nginx -s reload
```

---

## Purge Cloudflare Cache

**Option 1 - From your local machine (PowerShell)**:

```powershell
$headers = @{ Authorization = "Bearer $env:CF_API_TOKEN" }
Invoke-RestMethod -Method Post -Headers $headers `
  -Uri "https://api.cloudflare.com/client/v4/zones/$env:CF_ZONE_ID/purge_cache" `
  -Body '{"purge_everything":true}' -ContentType "application/json"
```

**Option 2 - Cloudflare Dashboard**:
1. https://dash.cloudflare.com/
2. Select leoklemet.com
3. Caching → Purge Everything

---

## Verify Live

```powershell
# From local machine (wait 2-3 min after cache purge)
curl.exe -s https://leoklemet.com/ | Select-String 'main-[A-Za-z0-9_-]+\.js'
# Should show: main-D0fKNExd.js
```

Or open https://leoklemet.com/ in browser and check DevTools Network tab.

---

## After This: No SSH Needed!

Future deploys:

```bash
git add .
git commit -m "feat: update portfolio"
git push origin main
# Wait 3-4 minutes... done! ✅
```

**Flow**: Push → GitHub Actions builds → GHCR pushes :latest → Watchtower pulls → Site updates

---

## Optional: Enable Auto Cache Purge

Add these to GitHub repo secrets:
- `CF_API_TOKEN` - Cloudflare API token
- `CF_ZONE_ID` - Zone ID for leoklemet.com

Go to: https://github.com/leok974/leo-portfolio/settings/secrets/actions

Then the workflow will auto-purge cache on every deploy.

---

## Rollback (if needed, no SSH)

```bash
docker pull ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0
docker tag ghcr.io/leok974/leo-portfolio/portfolio:v0.4.0 \
           ghcr.io/leok974/leo-portfolio/portfolio:latest
docker push ghcr.io/leok974/leo-portfolio/portfolio:latest
```

Watchtower will auto-deploy the old version in ~60 seconds.

---

## Documentation Index

- **DEPLOYMENT_FINAL.md** ← Quick reference (this file's basis)
- **DEPLOY_NOW.md** ← Detailed 12-step guide
- **RUN_THESE_COMMANDS.md** ← Command reference
- **DEPLOYMENT_QUICKSTART.md** ← Quick deploy guide
- **WATCHTOWER_SETUP.md** ← Comprehensive guide (500+ lines)

---

**Ready? SSH to production and run the one-liner at the top!** 🚀
