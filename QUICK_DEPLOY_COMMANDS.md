# Quick Deploy Commands - Copy & Paste Ready

## 🚀 Docker Deployment (Recommended)

### 1. Run Diagnostics First

```bash
# Copy script to server
scp deploy/diagnose-server.sh user@your-server:/tmp/

# SSH and run
ssh user@your-server
chmod +x /tmp/diagnose-server.sh
bash /tmp/diagnose-server.sh
```

### 2. Deploy Portfolio Container

```bash
# Pull latest image
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest

# Stop old container (if exists)
docker stop portfolio-ui 2>/dev/null || true
docker rm portfolio-ui 2>/dev/null || true

# Deploy new container
docker run -d \
  --name portfolio-ui \
  --restart unless-stopped \
  --network infra_net \
  --network-alias portfolio.int \
  -p 8089:80 \
  ghcr.io/leok974/leo-portfolio/portfolio:latest

# Verify
docker ps | grep portfolio
docker logs portfolio-ui --tail=20
```

### 3. Update Nginx Config

```bash
# Find nginx container
docker ps | grep nginx

# Test connectivity to portfolio
docker exec <nginx-container-name> curl -I http://portfolio.int:80/

# If 200 OK, nginx config should have this:
# location / {
#     proxy_pass http://portfolio.int:80;
#     proxy_http_version 1.1;
#     proxy_set_header Host $host;
#     proxy_set_header X-Real-IP $remote_addr;
#     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#     proxy_set_header X-Forwarded-Proto $scheme;
# }

# Reload nginx
docker exec <nginx-container-name> nginx -t
docker exec <nginx-container-name> nginx -s reload
```

### 4. Configure Watchtower (Auto-Updates)

```bash
# Check if Watchtower exists
docker ps | grep watchtower

# If not, deploy it
docker run -d \
  --name watchtower \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  --interval 300 \
  --cleanup \
  portfolio-ui

# Check logs
docker logs watchtower --tail=50
```

### 5. Test Production

```bash
# From server
curl -I https://assistant.ledger-mind.org

# Should return: HTTP/2 200
```

**From browser:**
- Open: https://assistant.ledger-mind.org
- Check F12 console - no errors
- Verify all assets load

---

## 📁 Static File Deployment (Alternative)

### 1. Build Portfolio (Windows)

```powershell
npm run build:portfolio
```

### 2. Deploy to Server

```powershell
# Automated
.\deploy\deploy-to-server.ps1 -ServerHost your-server.com -ServerUser root

# Or manual
scp -r dist-portfolio/* user@your-server:/var/www/portfolio/
```

### 3. Configure Nginx

```bash
# Upload config
scp deploy/nginx.assistant-server.conf user@your-server:/etc/nginx/sites-available/assistant.conf

# Enable site
sudo ln -sf /etc/nginx/sites-available/assistant.conf /etc/nginx/sites-enabled/

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Test

```bash
curl -I http://127.0.0.1:8080/
```

---

## 🔧 Troubleshooting Commands

### Check Container Status

```bash
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
```

### Fix Network Issues

```bash
# Connect to same network as nginx
docker network connect infra_net portfolio-ui
docker restart portfolio-ui

# Verify
docker inspect portfolio-ui --format='{{range $net, $config := .NetworkSettings.Networks}}{{$net}} {{end}}'
```

### Check Logs

```bash
# Portfolio logs
docker logs portfolio-ui --tail=100 -f

# Nginx logs
docker logs <nginx-container> --tail=100 -f

# Cloudflare Tunnel logs
docker logs infra-cloudflared-1 --tail=100 -f

# Watchtower logs
docker logs watchtower --tail=100 -f
```

### Test Connectivity

```bash
# From nginx to portfolio
docker exec <nginx-container> curl -I http://portfolio.int:80/

# From host to portfolio
curl -I http://127.0.0.1:8089/

# From internet (via tunnel)
curl -I https://assistant.ledger-mind.org
```

### Force Update Container

```bash
# Pull latest
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest

# Recreate
docker stop portfolio-ui
docker rm portfolio-ui

# Redeploy (copy from step 2 above)
docker run -d --name portfolio-ui --restart unless-stopped \
  --network infra_net --network-alias portfolio.int -p 8089:80 \
  ghcr.io/leok974/leo-portfolio/portfolio:latest
```

### Verify Image Digest

```bash
# Check running container
docker inspect portfolio-ui --format='{{.Image}}'

# Expected: sha256:6725055310e66c163c8de146c72d9d33aa7d9c4f00b259537b47091e7e77bc9e
```

### Restart All Components

```bash
docker restart portfolio-ui
docker restart <nginx-container>
docker restart infra-cloudflared-1
docker restart watchtower
```

---

## 📊 Health Checks

### Quick Status Check

```bash
# All critical containers
docker ps --filter name=portfolio-ui --filter name=nginx --filter name=cloudflared --format "table {{.Names}}\t{{.Status}}"

# Test full chain
curl -I https://assistant.ledger-mind.org | head -n1
```

### Run Full Diagnostics

```bash
bash /tmp/diagnose-server.sh
```

**Expected output:** All 10 checks passing ✅

---

## 🔄 Update Workflow

### Automatic (via Watchtower)

1. Push changes to `main` branch
2. GitHub Actions builds & pushes to GHCR
3. Watchtower detects new digest (within 5 minutes)
4. Automatically pulls and restarts container
5. Done! ✨

**Monitor updates:**
```bash
docker logs watchtower -f
```

### Manual

```bash
# Pull latest
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest

# Restart (preserves configuration)
docker restart portfolio-ui
```

---

## 🎯 Quick Validation

After deployment, verify:

```bash
# 1. Container running
docker ps | grep portfolio-ui

# 2. Health check (if configured)
docker inspect portfolio-ui --format='{{.State.Health.Status}}'

# 3. Logs look normal
docker logs portfolio-ui --tail=20

# 4. Nginx can reach it
docker exec <nginx-container> curl -I http://portfolio.int:80/

# 5. Production URL works
curl -I https://assistant.ledger-mind.org

# All should return: 200 OK
```

---

## 📝 Server Info Reference

Update these with your actual values:

- **Server Host**: `your-server.com` or IP
- **Server User**: `root` or your username
- **Nginx Container**: Check with `docker ps | grep nginx`
- **Network Name**: `infra_net` (or your network name)
- **Cloudflare Tunnel Container**: `infra-cloudflared-1`
- **Portfolio Port**: `8089` (host) → `80` (container)
- **Production URL**: `https://assistant.ledger-mind.org`

---

## 🚨 Emergency Rollback

If something breaks:

```bash
# Stop new container
docker stop portfolio-ui

# If you have old backup/image
docker run -d --name portfolio-ui-old --restart unless-stopped \
  --network infra_net --network-alias portfolio.int -p 8089:80 \
  <old-image-name>

# Or pull specific digest
docker pull ghcr.io/leok974/leo-portfolio/portfolio@sha256:<old-digest>
```

---

## ✅ Success Criteria

Deployment is complete when:

1. ✅ `diagnose-server.sh` shows all checks passing
2. ✅ `curl -I https://assistant.ledger-mind.org` returns `HTTP/2 200`
3. ✅ Browser loads site without console errors
4. ✅ All assets load (check Network tab)
5. ✅ Watchtower monitoring container (if using auto-updates)

🎉 **Done! Your portfolio is live!**
