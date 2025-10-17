# Quick Hardening Reference

Quick commands for the three hardening features applied to the portfolio deployment.

## 1. Docker Healthcheck ✅

**Shows container health in `docker ps`**

```bash
docker run -d --name portfolio-ui --restart unless-stopped \
  --network infra_net --network-alias portfolio.int \
  -p 8089:80 \
  --health-cmd="curl -fs http://localhost/ || exit 1" \
  --health-interval=30s --health-timeout=3s --health-retries=3 \
  ghcr.io/leok974/leo-portfolio/portfolio:latest
```

**Check:**
```bash
docker ps --filter name=portfolio-ui
# Shows: Up X minutes (healthy)
```

---

## 2. Persistent Nginx Config ✅

**Config saved at:** `deploy/nginx.assistant.conf`

**Restore after nginx rebuild:**
```powershell
.\deploy\restore-nginx-config.ps1
```

**Or manually:**
```bash
docker cp ./deploy/nginx.assistant.conf applylens-nginx-prod:/etc/nginx/conf.d/assistant.conf
docker exec applylens-nginx-prod nginx -t
docker exec applylens-nginx-prod nginx -s reload
```

---

## 3. Watchtower Auto-Updates ✅

**Deployed and checking every 5 minutes**

```bash
docker run -d --name watchtower --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower --interval 300 --cleanup portfolio-ui
```

**Check status:**
```bash
docker ps --filter name=watchtower
docker logs watchtower --tail=20
```

**Update workflow:**
1. Push new image: `docker push ghcr.io/leok974/leo-portfolio/portfolio:latest`
2. Wait ~5 minutes
3. Watchtower auto-pulls and restarts container

---

## Quick Health Check

```bash
# All containers status
docker ps --format "table {{.Names}}\t{{.Status}}"

# Expected:
# portfolio-ui          Up X minutes (healthy)
# applylens-nginx-prod  Up X hours (healthy)
# applylens-cloudflared-prod  Up X hours (healthy)
# watchtower           Up X minutes (healthy)
```

---

## Troubleshooting

### Portfolio unhealthy
```bash
docker logs portfolio-ui --tail=50
docker restart portfolio-ui
```

### Nginx config lost
```powershell
.\deploy\restore-nginx-config.ps1
```

### Watchtower not updating
```bash
docker logs watchtower --tail=50
docker restart watchtower
```

---

📖 **Full documentation:** [docs/HARDENING.md](../docs/HARDENING.md)
