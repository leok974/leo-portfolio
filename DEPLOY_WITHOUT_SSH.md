# Local Docker Compose Deployment (No SSH Needed)

## 🎯 Your Setup

Based on your repository configuration:
- **Domain**: `assistant.ledger-mind.org`
- **Infrastructure**: Docker Compose with `infra_net` network
- **Containers**: nginx, cloudflared (Cloudflare Tunnel), backend
- **Image**: `ghcr.io/leok974/leo-portfolio/portfolio:latest` ✅ Already pushed

## 🚀 Deployment Option: Docker Compose

### Option A: Deploy Using Docker Compose File

**Step 1: Copy the compose file to your server**

If you have file access to your server (not SSH), copy this file:
```
deploy/docker-compose.portfolio-ui.yml
```

**Step 2: Deploy on server**

Run this on your server (via your hosting provider's console/terminal):

```bash
cd /path/to/your/deployment

# Pull latest image
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest

# Deploy portfolio service
docker compose -f docker-compose.portfolio-ui.yml up -d

# Verify it's running
docker ps | grep portfolio-ui
docker logs portfolio-ui --tail=20
```

### Option B: Manual Docker Commands (No compose file needed)

Run these commands on your server:

```bash
# Pull latest image
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest

# Stop and remove old container (if exists)
docker stop portfolio-ui 2>/dev/null || true
docker rm portfolio-ui 2>/dev/null || true

# Run new container
docker run -d \
  --name portfolio-ui \
  --restart unless-stopped \
  --network infra_net \
  --network-alias portfolio.int \
  -p 8089:80 \
  ghcr.io/leok974/leo-portfolio/portfolio:latest

# Verify
docker ps | grep portfolio-ui
docker logs portfolio-ui --tail=20
```

### Option C: Update Existing docker-compose.yml

If your server already has a `docker-compose.yml`, add this service:

```yaml
services:
  portfolio-ui:
    image: ghcr.io/leok974/leo-portfolio/portfolio:latest
    container_name: portfolio-ui
    restart: unless-stopped
    networks:
      - infra_net
    aliases:
      infra_net:
        - portfolio.int
    ports:
      - "8089:80"

networks:
  infra_net:
    external: true
```

Then run:
```bash
docker compose pull portfolio-ui
docker compose up -d portfolio-ui
```

---

## 🔍 Verification Commands

After deployment, verify everything works:

### 1. Check container status
```bash
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" | grep portfolio
```

**Expected**: `portfolio-ui` showing "Up X minutes"

### 2. Check container logs
```bash
docker logs portfolio-ui --tail=50
```

**Expected**: Nginx startup logs, no errors

### 3. Test from inside nginx (if nginx exists)
```bash
# Find nginx container name
docker ps | grep nginx

# Test DNS resolution
docker exec <nginx-container> getent hosts portfolio.int

# Test HTTP connectivity
docker exec <nginx-container> curl -I http://portfolio.int/
```

**Expected**:
- DNS shows IP address
- HTTP returns `HTTP/1.1 200 OK`

### 4. Test from host
```bash
curl -I http://localhost:8089/
```

**Expected**: `HTTP/1.1 200 OK`

### 5. Test public URL
```bash
curl -I https://assistant.ledger-mind.org
```

**Expected**: `HTTP/2 200` (if tunnel and nginx configured)

---

## ⚙️ Nginx Configuration Needed

Your nginx container needs to proxy to `portfolio.int:80`. Add this to nginx config:

```nginx
location / {
    proxy_pass http://portfolio.int:80;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

**Reload nginx after config change:**
```bash
docker exec <nginx-container> nginx -t
docker exec <nginx-container> nginx -s reload
```

---

## 🔧 Troubleshooting

### Issue: Container won't start

**Check logs:**
```bash
docker logs portfolio-ui
```

**Check if port is in use:**
```bash
docker ps | grep 8089
```

### Issue: nginx can't reach portfolio

**Verify both on same network:**
```bash
docker inspect portfolio-ui --format='{{range $net, $config := .NetworkSettings.Networks}}{{$net}} {{end}}'
docker inspect <nginx-container> --format='{{range $net, $config := .NetworkSettings.Networks}}{{$net}} {{end}}'
```

**Both should show `infra_net`**

**Fix if not on same network:**
```bash
docker network connect infra_net portfolio-ui
docker restart portfolio-ui
```

### Issue: 502 Bad Gateway on public URL

**This means nginx can't reach portfolio. Check:**

1. Both containers on `infra_net`? (see above)
2. Nginx config has `proxy_pass http://portfolio.int:80;`?
3. DNS resolves inside nginx?
   ```bash
   docker exec <nginx-container> getent hosts portfolio.int
   ```

### Issue: Wrong image version

**Check running image:**
```bash
docker inspect portfolio-ui --format='{{.Config.Image}}'
docker inspect portfolio-ui --format='{{.Image}}'
```

**Expected digest:** `sha256:6725055310e66c163c8de146c72d9d33aa7d9c4f00b259537b47091e7e77bc9e`

**Update if wrong:**
```bash
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest
docker stop portfolio-ui && docker rm portfolio-ui
# Re-run docker run command from Option B
```

---

## 🔄 Auto-Updates with Watchtower

To automatically pull new images when you push to GHCR:

```bash
docker run -d \
  --name watchtower \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  --interval 300 \
  --cleanup \
  portfolio-ui
```

**What this does:**
- Checks GHCR every 5 minutes (300 seconds)
- Pulls new `:latest` tag if digest changed
- Automatically restarts `portfolio-ui` with new image
- Cleans up old images

**Monitor Watchtower:**
```bash
docker logs watchtower -f
```

---

## 📋 Quick Deployment Checklist

- [ ] Image pushed to GHCR ✅ (Already done!)
- [ ] Copy `docker-compose.portfolio-ui.yml` to server (or use manual commands)
- [ ] Run deployment commands on server
- [ ] Verify container running: `docker ps | grep portfolio`
- [ ] Check logs: `docker logs portfolio-ui`
- [ ] Test from host: `curl http://localhost:8089/`
- [ ] Verify nginx can reach: `docker exec <nginx> curl -I http://portfolio.int/`
- [ ] Update nginx config (if needed)
- [ ] Test public URL: `curl https://assistant.ledger-mind.org`
- [ ] Open in browser and verify
- [ ] (Optional) Deploy Watchtower for auto-updates

---

## 🎯 Next Actions (Without SSH)

Since you don't have SSH access, you'll need to:

1. **Access your server console** (via hosting provider dashboard/web console)
2. **Run the deployment commands** from Option A or Option B above
3. **Verify with the verification commands**

**OR**

If you manage your server via a control panel (Portainer, Kubernetes dashboard, etc.):
- Use the UI to deploy the `ghcr.io/leok974/leo-portfolio/portfolio:latest` image
- Configure it with:
  - Network: `infra_net`
  - Network alias: `portfolio.int`
  - Port: `8089:80`
  - Restart policy: `unless-stopped`

---

## 📚 Related Documentation

- **docker-compose.portfolio-ui.yml** - Compose file ready to deploy
- **COMMAND_SHEET.md** - All commands reference
- **EXECUTE_DEPLOYMENT.md** - Detailed deployment guide
- **deploy/diagnose-server.sh** - Diagnostics script (run on server)

---

## ✅ Success Criteria

Deployment succeeds when:

1. ✅ `docker ps | grep portfolio-ui` shows container running
2. ✅ `curl http://localhost:8089/` returns HTTP 200
3. ✅ `docker exec <nginx> curl -I http://portfolio.int/` returns HTTP 200
4. ✅ `curl https://assistant.ledger-mind.org` returns HTTP 200
5. ✅ Browser loads `https://assistant.ledger-mind.org` without errors
6. ✅ All assets load (check Network tab in F12)
7. ✅ Calendly widget displays correctly

🎉 **You're done!**
