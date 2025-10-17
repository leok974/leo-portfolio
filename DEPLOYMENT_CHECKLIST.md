# Portfolio Deployment Checklist

## ✅ Completed Steps

- [x] Built Docker image locally (74.1 MB)
- [x] Tested image on port 8888 (smoke tests passed)
- [x] Authenticated with GitHub (gh auth refresh with write:packages)
- [x] Pushed to GHCR:
  - ghcr.io/leok974/leo-portfolio/portfolio:prod-c02887f
  - ghcr.io/leok974/leo-portfolio/portfolio:latest
- [x] Verified image available at: https://github.com/leok974/leo-portfolio/pkgs/container/leo-portfolio%2Fportfolio

## 📋 Server Deployment Steps

### 1. Access Your Server
```bash
ssh user@your-server
```

### 2. Locate Docker Compose Directory
```bash
# Find where your current containers are running from
docker ps
# Note the working directory, typically something like:
# /opt/compose
# /home/user/docker
# /srv/docker
```

### 3. Add Portfolio Service

**Option A: Merge compose files**
```bash
cd /path/to/compose
# Download the portfolio service definition
curl -O https://raw.githubusercontent.com/leok974/leo-portfolio/portfolio-check/deploy/docker-compose.portfolio-image.yml

# Merge and start
docker compose -f docker-compose.yml -f docker-compose.portfolio-image.yml up -d portfolio
```

**Option B: Manual edit**
Add this to your existing `docker-compose.yml`:

```yaml
services:
  # ... your existing services ...

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
      - web  # Use your existing network name

    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 4. Pull and Start Container
```bash
# Authenticate with GHCR (one time)
echo $GITHUB_TOKEN | docker login ghcr.io -u leok974 --password-stdin
# Or use GitHub CLI: gh auth token | docker login ghcr.io -u leok974 --password-stdin

# Pull image
docker compose pull portfolio

# Start container
docker compose up -d portfolio

# Verify
docker compose ps portfolio
docker logs portfolio
```

Expected output:
```
✓ Portfolio container running
✓ Health check passing
✓ Nginx logs show successful startup
```

### 5. Configure Reverse Proxy

You need to route traffic from your domain to the portfolio container.

**If using Nginx as reverse proxy:**

Find your nginx config (typically one of):
- `/etc/nginx/sites-available/assistant.ledger-mind.org`
- `/etc/nginx/conf.d/assistant.conf`
- Inside nginx container: `/etc/nginx/conf.d/default.conf`

Add these routes (see `deploy/nginx.portfolio-reverse-proxy.conf` for full example):

```nginx
server {
    listen 443 ssl http2;
    server_name assistant.ledger-mind.org;

    # API routes (MUST come first)
    location /chat {
        proxy_pass http://backend:8001/chat;
        # ... proxy headers ...
    }

    location /chat/stream {
        proxy_pass http://backend:8001/chat/stream;
        proxy_buffering off;  # Critical for SSE
        # ... proxy headers ...
    }

    location /resume/ {
        proxy_pass http://backend:8001/resume/;
    }

    location /api/ {
        proxy_pass http://backend:8001/api/;
    }

    # Portfolio static files (MUST come last)
    location / {
        proxy_pass http://portfolio:80;
        # ... proxy headers ...
    }
}
```

**If using Traefik:**

The labels in `docker-compose.portfolio-image.yml` should work automatically:
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.portfolio.rule=Host(`assistant.ledger-mind.org`)"
  - "traefik.http.routers.portfolio.entrypoints=websecure"
```

**If using Caddy:**

Add to your Caddyfile:
```caddyfile
assistant.ledger-mind.org {
    reverse_proxy /chat* backend:8001
    reverse_proxy /resume/* backend:8001
    reverse_proxy /api/* backend:8001
    reverse_proxy /* portfolio:80
}
```

### 6. Reload Reverse Proxy

**Nginx:**
```bash
# Test config
docker exec nginx-container nginx -t

# Reload
docker exec nginx-container nginx -s reload
```

**Traefik:**
No action needed (auto-reloads from labels)

**Caddy:**
```bash
docker exec caddy-container caddy reload --config /etc/caddy/Caddyfile
```

### 7. Test Deployment

**From server:**
```bash
# Test portfolio container directly
curl -I http://localhost/  # or http://portfolio:80/ from another container

# Test through reverse proxy
curl -I http://127.0.0.1/
curl -I http://127.0.0.1/projects.json
```

**From browser:**
1. Open: https://assistant.ledger-mind.org
2. Check console (F12) - no errors expected
3. Verify:
   - [ ] Homepage loads
   - [ ] CSS/JS assets load
   - [ ] Projects section displays
   - [ ] Calendly widget shows
   - [ ] Resume buttons work
   - [ ] Assistant chat works (if layout enabled)

### 8. Verify Container Health

```bash
# Check health status
docker inspect portfolio | grep -A 10 Health

# Should show: "Status": "healthy"

# Watch logs
docker logs -f portfolio

# Check resource usage
docker stats portfolio
```

## 🔄 Future Updates

### Manual Update
```bash
# SSH to server
ssh user@server

# Pull latest
cd /path/to/compose
docker compose pull portfolio

# Restart
docker compose up -d portfolio

# Verify
docker logs portfolio
```

### Automatic Updates with Watchtower

Add to `docker-compose.yml`:
```yaml
services:
  watchtower:
    image: containrrr/watchtower:latest
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - WATCHTOWER_POLL_INTERVAL=300  # Check every 5 min
      - WATCHTOWER_CLEANUP=true
    command: portfolio
```

Now when you push to main:
1. GitHub Actions builds and pushes image
2. Watchtower detects new image
3. Watchtower pulls and restarts container
4. Zero-downtime deployment ✨

## 📊 Monitoring

### Health Checks
```bash
# Check container health
docker compose ps portfolio

# View health check logs
docker inspect portfolio --format='{{json .State.Health}}' | jq
```

### Logs
```bash
# Follow logs
docker logs -f portfolio

# Last 100 lines
docker logs --tail=100 portfolio

# With timestamps
docker logs -t portfolio
```

### Metrics
```bash
# Real-time stats
docker stats portfolio

# Disk usage
docker system df
```

## 🐛 Troubleshooting

### Container Won't Start
```bash
# Check logs
docker logs portfolio

# Check if image pulled
docker images | grep portfolio

# Check if network exists
docker network ls | grep web

# Verify compose config
docker compose config
```

### 404 Errors
```bash
# Check files in container
docker exec portfolio ls -la /usr/share/nginx/html/

# Check nginx config
docker exec portfolio cat /etc/nginx/conf.d/default.conf

# Test nginx config
docker exec portfolio nginx -t
```

### CORS Errors
```bash
# Check VITE_AGENT_API_BASE in built files
docker exec portfolio grep -r "AGENT_API_BASE" /usr/share/nginx/html/

# Should be empty or same-origin
# If not, rebuild with correct .env.production
```

### Reverse Proxy Not Working
```bash
# Check if containers can reach each other
docker exec nginx-container ping portfolio
docker exec nginx-container curl http://portfolio:80/

# Check nginx error logs
docker logs nginx-container 2>&1 | grep error

# Verify location order (/ must be last)
docker exec nginx-container cat /etc/nginx/conf.d/default.conf
```

## 📚 References

- **Full Deployment Guide**: `DEPLOY_IMAGE.md`
- **Nginx Config Example**: `deploy/nginx.portfolio-reverse-proxy.conf`
- **Docker Compose Service**: `deploy/docker-compose.portfolio-image.yml`
- **GHCR Package**: https://github.com/leok974/leo-portfolio/pkgs/container/leo-portfolio%2Fportfolio

## 🎯 Success Criteria

- [ ] Portfolio container running and healthy
- [ ] https://assistant.ledger-mind.org loads without errors
- [ ] All static assets load (CSS, JS, images)
- [ ] Projects section displays correctly
- [ ] Calendly widget works
- [ ] Resume buttons functional
- [ ] API calls work (if layout enabled)
- [ ] No CORS errors in browser console
- [ ] Container restarts on failure (restart policy)

---

**Status**: Image pushed to GHCR, ready for server deployment

**Next**: Follow steps 1-8 above to deploy on your server
