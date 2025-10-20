# Backend Production Deployment - Manual Steps Required

## ✅ Completed Steps

1. ✅ **Production flag enabled** - `VITE_BACKEND_ENABLED=1` committed
2. ✅ **Frontend built** - Local build successful with new flag
3. ✅ **Workflow dispatched** - Triggered `refresh-content.yml` 
4. ✅ **Docker image built & pushed** - `ghcr.io/leok974/leo-portfolio/portfolio:latest`
   - Digest: `sha256:1e300ed3bba2ae7c6741661d09554f5baa5893e679a434c9d447ac51858f6014`
   - Workflow run: `18657370053`
   - Timestamp: Oct 20, 2025 15:45 UTC

---

## 🔧 Remaining Manual Steps (On Production Server)

### Step 1: SSH to Production Server

```bash
ssh your-server-host
# Or use your SSH config alias
```

---

### Step 2: Verify Backend CORS Configuration

**Check current ALLOWED_ORIGINS:**

```bash
# If using Docker Compose:
docker compose exec backend printenv ALLOWED_ORIGINS

# If using systemd:
systemctl show assistant-api --property=Environment | grep ALLOWED_ORIGINS
```

**Expected value:**
```
ALLOWED_ORIGINS=https://assistant.ledger-mind.org,https://www.leoklemet.com
```

**If not set correctly, update it:**

For Docker Compose - edit `assistant_api/.env.prod`:
```bash
nano assistant_api/.env.prod
# Add or update:
ALLOWED_ORIGINS=https://assistant.ledger-mind.org,https://www.leoklemet.com
```

Then restart backend:
```bash
docker compose restart backend
```

**Verify via API:**
```bash
curl -s https://assistant.ledger-mind.org/status/cors | jq '.allowed_origins'
# Should include: "https://assistant.ledger-mind.org"
```

---

### Step 3: Pull Latest Docker Image

Watchtower should auto-update, but you can force it:

```bash
# Check if Watchtower is running
docker ps | grep watchtower

# If Watchtower is NOT running, manually pull:
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest

# Restart portfolio container
docker compose restart portfolio
# Or if using specific container name:
docker restart portfolio-nginx
```

**Verify new image is running:**
```bash
docker inspect portfolio-nginx | grep -A 2 "Image"
# Should show digest: sha256:1e300ed3bba2ae7c6741661d09554f5baa5893e679a434c9d447ac51858f6014
```

---

### Step 4: Verify Backend is Running

```bash
# Test backend directly (from server)
curl http://127.0.0.1:8001/api/ready
# Expected: {"status": "ok", "timestamp": "..."}

# Test through nginx proxy
curl https://assistant.ledger-mind.org/api/ready
# Expected: {"status": "ok", "timestamp": "..."}
```

**If backend is NOT running:**
```bash
# Check if backend container/service is up
docker compose ps backend
# or
systemctl status assistant-api

# Check logs
docker compose logs backend --tail=50
# or
journalctl -u assistant-api -n 50
```

---

### Step 5: Test from Browser

Open https://assistant.ledger-mind.org in your browser, then:

**Open browser console (F12) and run:**

```javascript
// Test /api/ready endpoint
fetch('/api/ready')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);

// Expected output:
// {status: "ok", timestamp: "2025-10-20T15:50:00.000Z"}
```

**Test /api/layout (if implemented):**
```javascript
fetch('/api/layout')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

**Check for errors:**
```javascript
// Should NOT see CORS errors
// Should NOT see 502 Bad Gateway
// Should NOT see "Failed to fetch"
```

---

## 🔍 Troubleshooting

### Issue: 502 Bad Gateway on /api/*

**Diagnosis:**
```bash
# Check if backend is running
curl http://127.0.0.1:8001/api/ready

# Check nginx error logs
tail -f /var/log/nginx/assistant-error.log
# or
docker logs portfolio-nginx 2>&1 | grep -i error
```

**Common causes:**
1. Backend not running → Start backend service
2. Backend on wrong port → Check nginx proxy_pass matches backend port
3. Backend crashed → Check backend logs for errors

---

### Issue: CORS Error in Browser

**Diagnosis:**
```bash
# Test CORS headers
curl -H "Origin: https://assistant.ledger-mind.org" \
     -i https://assistant.ledger-mind.org/api/ready

# Check for these headers:
# Access-Control-Allow-Origin: https://assistant.ledger-mind.org
# Access-Control-Allow-Credentials: true
```

**Common causes:**
1. ALLOWED_ORIGINS missing domain → Update backend env var
2. ALLOWED_ORIGINS has wildcard (`*`) → Use explicit origins
3. Backend not returning CORS headers → Check backend CORS middleware

---

### Issue: Watchtower Not Updating

**Diagnosis:**
```bash
# Check Watchtower logs
docker logs watchtower --tail=50

# Check last update time
docker inspect portfolio-nginx | grep -i created
```

**Manual update:**
```bash
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest
docker compose up -d portfolio
```

---

## ✅ Success Checklist

- [ ] `ALLOWED_ORIGINS` includes `https://assistant.ledger-mind.org`
- [ ] Backend responds to `curl http://127.0.0.1:8001/api/ready`
- [ ] Nginx proxies `/api/*` correctly (no 502 errors)
- [ ] Browser console: `fetch('/api/ready')` succeeds (no CORS errors)
- [ ] New Docker image is running (check digest)
- [ ] Frontend makes `/api/layout` call without 502 errors (check Network tab)

---

## 📝 Rollback Plan (If Issues Occur)

### Quick Frontend Disable

If backend is causing issues, disable backend calls:

1. Update `.env.production`:
   ```bash
   VITE_BACKEND_ENABLED=0
   ```

2. Trigger new deployment:
   ```bash
   # From local machine:
   curl -X POST https://api.leoklemet.com/agent/refresh \
     -H "x-agent-key: SZdbVu7AlUZJ5Ce6d5hsO393tyuTwz5COc3VdxN0jZU=" \
     -H "Content-Type: application/json" \
     -d '{"reason":"refresh-portfolio","ref":"main"}'
   ```

3. Wait 3-4 minutes for workflow to complete

4. Watchtower will auto-pull new image

---

## 📚 Related Documentation

- [BACKEND_PROD_GATE_FLIP.md](./BACKEND_PROD_GATE_FLIP.md) - Configuration details
- [docs/BACKEND_DEPLOYMENT.md](./docs/BACKEND_DEPLOYMENT.md) - Backend deployment guide
- [docs/SECURITY.md](./docs/SECURITY.md) - CORS and security configuration
- [PRODUCTION_DEPLOYMENT_GUIDE.md](./PRODUCTION_DEPLOYMENT_GUIDE.md) - Full production setup

---

**Next Action:** SSH to production server and complete Steps 1-5 above.

**Date:** October 20, 2025  
**Deployment ID:** `18657370053`  
**Docker Image:** `ghcr.io/leok974/leo-portfolio/portfolio:latest@sha256:1e300ed3bba2ae7c6741661d09554f5baa5893e679a434c9d447ac51858f6014`
