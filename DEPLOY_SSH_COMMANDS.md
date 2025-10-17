# SSH Deployment Commands for leoklemet.com

**Status**: Ready to deploy portfolio-ui container
**Date**: October 17, 2025

## 🔑 Step 1: SSH to Your Server

First, you need to SSH into your production server. Try one of these:

```powershell
# Option 1: If you have direct SSH access
ssh root@<YOUR_SERVER_IP>

# Option 2: If you use a specific user
ssh <YOUR_USERNAME>@<YOUR_SERVER_IP>

# Option 3: If you use an SSH key file
ssh -i path\to\your\key.pem <USER>@<SERVER_IP>
```

**Don't know your server details?**
- Check your cloud provider dashboard (DigitalOcean, Vultr, AWS, etc.)
- Look for "Access" or "Console" in your provider's panel
- Or use the web-based console/terminal from your provider

---

## 📦 Step 2: Once Connected, Run These Commands

Copy and paste these commands **one by one** into your server terminal:

### A. Ensure Docker is installed
```bash
# Check if Docker is installed
docker --version

# If not installed, run:
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

### B. Create the shared network (if not exists)
```bash
docker network ls | grep -q infra_net || docker network create infra_net
```

### C. Deploy portfolio-ui + watchtower
```bash
mkdir -p ~/leo-portfolio && cd ~/leo-portfolio
curl -fsSLO https://raw.githubusercontent.com/leok974/leo-portfolio/portfolio-polish/deploy/docker-compose.portfolio-ui.yml
docker compose -f docker-compose.portfolio-ui.yml up -d
```

**Expected output:**
```
[+] Running 2/2
 ✔ Container portfolio-ui   Started
 ✔ Container watchtower     Started
```

### D. Verify deployment
```bash
# Check containers are running
docker ps | grep -E 'portfolio-ui|watchtower'

# Test nginx can reach portfolio-ui
docker exec applylens-nginx-prod curl -sI http://portfolio-ui | head -5
```

**Expected output:**
```
HTTP/1.1 200 OK
Server: nginx
Content-Type: text/html
```

### E. Check which JS bundle is being served
```bash
docker exec applylens-nginx-prod curl -s http://portfolio-ui | grep -oE 'main-[A-Za-z0-9_-]+\.js' | head -1
```

**Expected:** `main-D0fKNExd.js` (the new hash)

---

## 🎯 Step 3: After SSH Session (Back on Your Local Machine)

### A. Check what's live publicly
```powershell
# From your Windows PowerShell
curl.exe -s https://leoklemet.com/ | Select-String "main-.*\.js"
```

### B. If it shows old hash, purge Cloudflare cache

**Option 1: Via PowerShell (requires CF_API_TOKEN and CF_ZONE_ID)**
```powershell
$headers = @{
    "Authorization" = "Bearer $env:CF_API_TOKEN"
    "Content-Type" = "application/json"
}
$body = '{"purge_everything":true}'
Invoke-RestMethod -Method Post -Uri "https://api.cloudflare.com/client/v4/zones/$env:CF_ZONE_ID/purge_cache" -Headers $headers -Body $body
```

**Option 2: Via Cloudflare Dashboard**
1. Go to https://dash.cloudflare.com
2. Select your `leoklemet.com` zone
3. Navigate to **Caching** → **Configuration**
4. Click **Purge Everything**

### C. Verify new hash is live
```powershell
# Wait 30 seconds after cache purge, then:
curl.exe -s https://leoklemet.com/ | Select-String "main-.*\.js"
# Should show: main-D0fKNExd.js
```

### D. Test the site
Open in browser: https://leoklemet.com/

---

## 🤖 Step 4: Test Automated Deployment (Optional)

Watchtower is now running and checks every 60 seconds for new images. Test it:

### A. Make a small change locally
```powershell
cd D:\leo-portfolio
# Edit any file, like adding a comment
echo "// Test automated deployment" >> apps/portfolio-ui/src/main.tsx

git add .
git commit -m "test: verify automated deployment pipeline"
git push origin main
```

### B. Watch GitHub Actions
Go to: https://github.com/leok974/leo-portfolio/actions

Wait ~2-3 minutes for the workflow to build and push the new image.

### C. Watch Watchtower update the container (on server)
```bash
# SSH back to server
docker logs -f watchtower

# Should see (within 60 seconds of new image):
# - "Found new image"
# - "Stopping /portfolio-ui"
# - "Starting /portfolio-ui"
```

### D. Verify new version live (~3-4 minutes after push)
```powershell
# The hash should be different now
curl.exe -s https://leoklemet.com/ | Select-String "main-.*\.js"
```

---

## 📋 Quick Reference: All Commands

**On Server (via SSH):**
```bash
docker network ls | grep -q infra_net || docker network create infra_net
mkdir -p ~/leo-portfolio && cd ~/leo-portfolio
curl -fsSLO https://raw.githubusercontent.com/leok974/leo-portfolio/portfolio-polish/deploy/docker-compose.portfolio-ui.yml
docker compose -f docker-compose.portfolio-ui.yml up -d
docker ps | grep -E 'portfolio-ui|watchtower'
docker exec applylens-nginx-prod curl -sI http://portfolio-ui | head -5
```

**On Your Machine (PowerShell):**
```powershell
# Check live hash
curl.exe -s https://leoklemet.com/ | Select-String "main-.*\.js"

# Purge cache (if needed - requires CF env vars)
$headers = @{"Authorization"="Bearer $env:CF_API_TOKEN"; "Content-Type"="application/json"}
Invoke-RestMethod -Method Post -Uri "https://api.cloudflare.com/client/v4/zones/$env:CF_ZONE_ID/purge_cache" -Headers $headers -Body '{"purge_everything":true}'
```

---

## ❓ Troubleshooting

### Can't SSH?
- Try the web console from your cloud provider
- Check firewall rules (port 22 open?)
- Verify SSH key permissions: `chmod 600 ~/.ssh/id_rsa` (Linux/Mac)

### Container won't start?
```bash
docker logs portfolio-ui
docker logs watchtower
docker compose -f docker-compose.portfolio-ui.yml down
docker compose -f docker-compose.portfolio-ui.yml up -d
```

### Nginx can't reach portfolio-ui?
```bash
# Ensure both are on infra_net
docker network inspect infra_net | grep -E 'portfolio-ui|applylens-nginx-prod'

# If missing, connect:
docker network connect infra_net applylens-nginx-prod
docker network connect infra_net portfolio-ui
```

### Old hash still showing?
- Purge Cloudflare cache (see Step 3B)
- Wait 30-60 seconds for propagation
- Try in incognito/private browsing mode
- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

---

## 🎯 Success Checklist

- [ ] SSH to server successful
- [ ] Docker installed and running
- [ ] `infra_net` network created
- [ ] portfolio-ui container running and healthy
- [ ] watchtower container running
- [ ] nginx can reach portfolio-ui (curl returns 200 OK)
- [ ] Public site shows new hash (main-D0fKNExd.js)
- [ ] Site loads correctly at https://leoklemet.com/
- [ ] Watchtower automated updates working

---

**Need help?** Paste the output of any failing command and I'll help debug!
