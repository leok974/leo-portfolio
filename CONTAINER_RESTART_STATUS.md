# 🔄 Container Restart - Auto-Recovery in Progress

**Date:** October 20, 2025 16:21 UTC
**Method:** Automated via GitHub Actions + Watchtower
**Workflow:** 18658298687 (in_progress)

---

## ✅ What Was Done

Since you cannot SSH to the production server from your local machine, we triggered an **automated recovery** through your existing CI/CD pipeline:

1. ✅ **Dispatched workflow** via Cloudflare Worker API
   - Endpoint: `https://api.leoklemet.com/agent/refresh`
   - Reason: `refresh-portfolio`
   - Time: 16:21:08 UTC

2. ⏳ **GitHub Actions building** new Docker image
   - Workflow ID: `18658298687`
   - Status: `in_progress`
   - Includes: Latest nginx config with `/api/` proxy fix

3. ⏳ **Watchtower will auto-deploy**
   - Watches: `ghcr.io/leok974/leo-portfolio/portfolio:latest`
   - Action: Auto-pull and restart container
   - ETA: ~5-10 minutes total

---

## 📊 Recovery Timeline

```
16:14 UTC - Site down detected (HTTP 530)
16:21 UTC - Workflow dispatched ✅
16:21 UTC - Workflow started ✅
16:24 UTC - Build completes (est.) ⏳
16:25 UTC - Image pushed to GHCR (est.) ⏳
16:27 UTC - Watchtower pulls image (est.) ⏳
16:28 UTC - Container restarted (est.) ⏳
16:29 UTC - Site back online (est.) ⏳
```

---

## 🔍 Monitor Progress

### Check Workflow Status
```powershell
# Watch workflow in real-time
gh run watch 18658298687

# Check latest status
gh run list --workflow=refresh-content.yml --limit 1
```

### Test Site Recovery
```powershell
# Test site every 30 seconds
while ($true) {
    $response = try {
        Invoke-WebRequest -Uri "https://www.leoklemet.com" -Method Head -TimeoutSec 5
    } catch { $null }

    if ($response.StatusCode -eq 200) {
        Write-Host "✅ SITE IS BACK ONLINE!" -ForegroundColor Green
        break
    } else {
        Write-Host "⏳ Still down... (checking again in 30s)" -ForegroundColor Yellow
        Start-Sleep -Seconds 30
    }
}
```

---

## 🎯 Expected Outcome

Once workflow completes:

1. ✅ New Docker image tagged as `latest`
2. ✅ Watchtower detects update (checks every 5 minutes)
3. ✅ Container auto-restarts with new image
4. ✅ Nginx starts with corrected `/api/` proxy
5. ✅ Site returns HTTP 200 (not 530)
6. ✅ Health check passes: `docker exec portfolio wget -q -O- http://localhost:80/`

---

## 🔴 If Site Still Down After 15 Minutes

If site is still showing HTTP 530 after workflow completes + 10 minutes:

### Option 1: Manual SSH Restart (Recommended)
```bash
ssh your-user@your-server

# Check container status
docker ps -a | grep portfolio

# Check Watchtower logs
docker logs watchtower --tail 50

# Manual restart if needed
docker restart portfolio

# Or force pull latest
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest
docker restart portfolio
```

### Option 2: Check Cloudflare Tunnel
```bash
# Check tunnel status
docker ps | grep cloudflared
docker logs cloudflared --tail 50

# Or if running as systemd service
systemctl status cloudflared
journalctl -u cloudflared -n 50
```

### Option 3: Check Watchtower Configuration
```bash
# Verify Watchtower is watching portfolio
docker inspect portfolio | jq '.[0].Config.Labels'

# Should see:
# "com.centurylinklabs.watchtower.enable": "true"
```

---

## 📝 Root Cause Analysis (Post-Recovery)

Once site is back online, investigate what caused the 530:

### Check Container Logs
```bash
ssh your-server
docker logs portfolio --since 2h | grep -i error
```

### Common Causes:
1. **Out of Memory** - Container OOM killed
2. **Nginx Config Error** - Syntax error in config
3. **Health Check Failed** - Container marked unhealthy, stopped
4. **Port Conflict** - Another process using port 80
5. **Watchtower Update Failed** - Bad image pulled

### Check System Resources
```bash
# Memory usage
docker stats --no-stream

# Disk space
df -h
docker system df

# Recent container deaths
docker ps -a --filter "status=exited" --filter "name=portfolio"
```

---

## ✅ Prevention for Future

### Add Monitoring
1. **Uptime Robot** - Ping https://www.leoklemet.com every 5 min
2. **Discord/Slack Webhook** - Alert on downtime
3. **Watchtower Notifications** - Email on updates

### Add Auto-Restart
```yaml
# In docker-compose.yml
services:
  portfolio:
    restart: unless-stopped  # Already configured ✅
```

### Add Better Health Checks
```yaml
healthcheck:
  test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:80/"]
  interval: 30s
  timeout: 3s
  retries: 3
  start_period: 10s  # Increased for slow starts
```

---

## 📞 Emergency Contacts

- **Cloudflare Status**: https://www.cloudflarestatus.com/
- **GitHub Status**: https://www.githubstatus.com/
- **Docker Hub Status**: https://status.docker.com/

---

**Status:** 🟡 **RECOVERY IN PROGRESS**
**ETA:** ~5-10 minutes (16:29 UTC estimated)

**Next Check:** Run site test at 16:25 UTC (after workflow completes)

---

## 🔗 Related Documents
- `SITE_DOWN_DIAGNOSIS.md` - Full troubleshooting guide
- `BACKEND_CONFIG_VERIFICATION.md` - Configuration details
- `BACKEND_DEPLOYMENT_STATUS.md` - Deployment checklist
