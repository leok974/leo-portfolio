# Production Hardening Guide

This document describes the security and reliability hardening measures applied to the portfolio deployment.

## Overview

The following hardening measures have been implemented:

1. **Docker Healthchecks** - Container health monitoring
2. **Persistent Nginx Configuration** - Config survives container rebuilds
3. **Automatic Updates** - Watchtower auto-deploys new images
4. **Network Isolation** - Proper network segmentation with infra_net

---

## 1. Docker Healthcheck

### Why?
- Shows container health status in `docker ps`
- Enables orchestrators to detect and restart unhealthy containers
- Provides visibility into application status

### Implementation

**Command:**
```bash
docker run -d --name portfolio-ui --restart unless-stopped \
  --network infra_net --network-alias portfolio.int \
  -p 8089:80 \
  --health-cmd="curl -fs http://localhost/ || exit 1" \
  --health-interval=30s --health-timeout=3s --health-retries=3 \
  ghcr.io/leok974/leo-portfolio/portfolio:latest
```

**Verification:**
```bash
docker ps --filter name=portfolio-ui
# Should show: Up X minutes (healthy)
```

**Parameters Explained:**
- `--health-cmd`: Command to run inside container (must exit 0 for healthy)
- `--health-interval=30s`: Check every 30 seconds
- `--health-timeout=3s`: Mark unhealthy if check takes >3s
- `--health-retries=3`: Retry 3 times before marking unhealthy

---

## 2. Persistent Nginx Configuration

### Why?
- Config survives nginx container rebuilds
- Version controlled in git
- Easy to restore or replicate across environments

### Files

**Location:** `deploy/nginx.assistant.conf`

This file contains the nginx server block for `assistant.ledger-mind.org`:

```nginx
server {
    listen 80;
    server_name assistant.ledger-mind.org;

    location / {
        proxy_pass http://portfolio.int:80;
        # ... proxy headers ...
    }
}
```

### Restore Process

**Manual:**
```bash
# Copy config to nginx container
docker cp ./deploy/nginx.assistant.conf applylens-nginx-prod:/etc/nginx/conf.d/assistant.conf

# Test and reload
docker exec applylens-nginx-prod nginx -t
docker exec applylens-nginx-prod nginx -s reload
```

**Automated (PowerShell):**
```powershell
.\deploy\restore-nginx-config.ps1
```

### Best Practices

**After making changes:**
1. Edit `deploy/nginx.assistant.conf` locally
2. Run restore script to apply changes
3. Test: `curl -I https://assistant.ledger-mind.org`
4. Commit changes to git

**For production safety:**
- Always test config before reload: `nginx -t`
- Keep backup: `default.conf.bak` exists in container
- Version control all changes

---

## 3. Automatic Updates with Watchtower

### Why?
- Zero-touch deployments
- Auto-pulls new images from GHCR within 5 minutes
- Minimal downtime (rolling restart)

### Deployment

**Command:**
```bash
docker run -d --name watchtower --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower --interval 300 --cleanup portfolio-ui
```

**Parameters:**
- `--interval 300`: Check every 300 seconds (5 minutes)
- `--cleanup`: Remove old images after update
- `portfolio-ui`: Only watch this container (not all containers)

### Verification

**Check status:**
```bash
docker ps --filter name=watchtower
# Should show: Up X minutes (healthy)
```

**View logs:**
```bash
docker logs watchtower --tail=20
```

**Expected log output:**
```
time="..." level=info msg="Watchtower 1.7.1"
time="..." level=info msg="Only checking containers which name matches \"portfolio-ui\""
time="..." level=info msg="Scheduling first run: ..."
```

### Update Workflow

1. **Make changes** to frontend code locally
2. **Build and push** new image:
   ```bash
   docker build -f Dockerfile.portfolio -t ghcr.io/leok974/leo-portfolio/portfolio:latest .
   docker push ghcr.io/leok974/leo-portfolio/portfolio:latest
   ```
3. **Wait ~5 minutes** - Watchtower auto-detects and updates
4. **Verify** deployment:
   ```bash
   docker ps --filter name=portfolio-ui
   curl -I https://assistant.ledger-mind.org
   ```

### Manual Update (if needed)

If you don't want to wait for Watchtower:

```bash
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest
docker stop portfolio-ui
docker rm portfolio-ui
# Then re-run with --health-cmd (see section 1)
```

---

## 4. Network Architecture

### Current Setup

```
┌─────────────────────────────────────────┐
│ Cloudflare Tunnel                       │
│ (applylens-cloudflared-prod)            │
│ Networks: applylens_applylens-prod +    │
│           infra_net                     │
└─────────────────┬───────────────────────┘
                  │ HTTP
                  ↓
┌─────────────────────────────────────────┐
│ Nginx Reverse Proxy                     │
│ (applylens-nginx-prod)                  │
│ Network: infra_net                      │
│ Config: /etc/nginx/conf.d/assistant.conf│
└─────────────────┬───────────────────────┘
                  │ HTTP
                  ↓
┌─────────────────────────────────────────┐
│ Portfolio Container                     │
│ (portfolio-ui)                          │
│ Network: infra_net (alias: portfolio.int)│
│ Port: 8089:80                           │
│ Healthcheck: ✅ Enabled                 │
└─────────────────────────────────────────┘
```

### Security Notes

1. **No direct internet exposure** - Portfolio only accessible via Cloudflare Tunnel
2. **Network isolation** - Uses dedicated `infra_net` network
3. **Internal DNS** - `portfolio.int` only resolvable within infra_net
4. **TLS termination** - Cloudflare handles HTTPS, internal traffic is HTTP

---

## Security Checklist

- [x] Container healthchecks enabled
- [x] Nginx config backed up and version controlled
- [x] Auto-updates configured (Watchtower)
- [x] Network segmentation (infra_net)
- [x] No direct internet exposure (Cloudflare Tunnel)
- [x] Reverse proxy with security headers
- [x] Container restart policies (`unless-stopped`)
- [ ] Optional: Rate limiting in nginx
- [ ] Optional: WAF rules in Cloudflare
- [ ] Optional: Container resource limits (CPU/memory)

---

## Monitoring

### Health Checks

**Container status:**
```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

**Expected output:**
```
NAMES                        STATUS
portfolio-ui                 Up X minutes (healthy)
applylens-nginx-prod         Up X hours (healthy)
applylens-cloudflared-prod   Up X hours (healthy)
watchtower                   Up X minutes (healthy)
```

### Logs

**Portfolio logs:**
```bash
docker logs portfolio-ui --tail=50 -f
```

**Nginx access logs:**
```bash
docker exec applylens-nginx-prod tail -f /var/log/nginx/access.log
```

**Nginx error logs:**
```bash
docker exec applylens-nginx-prod tail -f /var/log/nginx/error.log
```

**Watchtower logs:**
```bash
docker logs watchtower --tail=20 -f
```

### Alerts (Future Enhancement)

Consider adding:
- **Uptime monitoring** - External service (UptimeRobot, Pingdom)
- **Log aggregation** - ELK stack or similar
- **Metrics** - Prometheus + Grafana
- **Notifications** - Slack/email on container failures

---

## Troubleshooting

### Portfolio shows unhealthy

**Symptoms:**
```bash
docker ps --filter name=portfolio-ui
# Shows: Up X minutes (unhealthy)
```

**Fix:**
```bash
# Check logs
docker logs portfolio-ui --tail=50

# Test healthcheck manually
docker exec portfolio-ui curl -fs http://localhost/

# If nginx is down inside container, restart
docker restart portfolio-ui
```

### Nginx config lost after restart

**Symptoms:**
- 502 Bad Gateway on assistant.ledger-mind.org
- `assistant.conf` missing from nginx container

**Fix:**
```bash
# Restore from backup
.\deploy\restore-nginx-config.ps1

# Or manually
docker cp ./deploy/nginx.assistant.conf applylens-nginx-prod:/etc/nginx/conf.d/assistant.conf
docker exec applylens-nginx-prod nginx -s reload
```

### Watchtower not updating

**Symptoms:**
- New image pushed to GHCR
- Container still running old version after >5 minutes

**Diagnosis:**
```bash
# Check Watchtower logs
docker logs watchtower --tail=50

# Verify image digest
docker inspect portfolio-ui | jq '.[0].Image'
docker manifest inspect ghcr.io/leok974/leo-portfolio/portfolio:latest | jq '.config.digest'
```

**Fix:**
```bash
# Manual update
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest
docker stop portfolio-ui && docker rm portfolio-ui
# Re-run with healthcheck (see section 1)

# Restart Watchtower
docker restart watchtower
```

---

## Rollback Procedure

If deployment fails:

1. **Check logs:**
   ```bash
   docker logs portfolio-ui --tail=100
   docker logs applylens-nginx-prod --tail=50
   ```

2. **Stop Watchtower** (prevent further updates):
   ```bash
   docker stop watchtower
   ```

3. **Rollback to previous image:**
   ```bash
   # List available tags
   gh api /users/leok974/packages/container/leo-portfolio%2Fportfolio/versions | jq -r '.[].metadata.container.tags[]'

   # Pull specific version
   docker pull ghcr.io/leok974/leo-portfolio/portfolio:prod-<commit>

   # Redeploy
   docker stop portfolio-ui && docker rm portfolio-ui
   docker run -d --name portfolio-ui --restart unless-stopped \
     --network infra_net --network-alias portfolio.int \
     -p 8089:80 \
     --health-cmd="curl -fs http://localhost/ || exit 1" \
     --health-interval=30s --health-timeout=3s --health-retries=3 \
     ghcr.io/leok974/leo-portfolio/portfolio:prod-<commit>
   ```

4. **Verify:**
   ```bash
   curl -I https://assistant.ledger-mind.org
   # Should return HTTP 200 OK
   ```

5. **Re-enable Watchtower** (after fixing issue):
   ```bash
   docker start watchtower
   ```

---

## Future Improvements

### Short-term
- [ ] Add container resource limits (CPU: 0.5, Memory: 256MB)
- [ ] Set up external uptime monitoring
- [ ] Add nginx rate limiting for DoS protection

### Medium-term
- [ ] Implement log rotation in containers
- [ ] Add Prometheus metrics exporter
- [ ] Set up Grafana dashboard
- [ ] Configure Cloudflare WAF rules

### Long-term
- [ ] Migrate to Docker Compose for easier management
- [ ] Add staging environment
- [ ] Implement blue-green deployments
- [ ] Set up CI/CD pipeline with automated testing

---

## References

- [Docker Health Checks](https://docs.docker.com/engine/reference/builder/#healthcheck)
- [Watchtower Documentation](https://containrrr.dev/watchtower/)
- [Nginx Reverse Proxy Best Practices](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/)
- [Cloudflare Tunnel Guide](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
