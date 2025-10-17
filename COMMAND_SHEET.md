# Portfolio Deployment - Command Sheet

## 📋 Pre-Flight: Get Nginx Container Name

```bash
ssh <user>@<server> 'docker ps | grep nginx'
```

Fill in here: `____________________________________`

---

## 🚀 Deployment Commands (Copy-Paste in Order)

### STEP 1: Run Diagnostics

```bash
scp deploy/diagnose-server.sh <user>@<server>:/tmp/
ssh <user>@<server>
bash /tmp/diagnose-server.sh
```

**Must see:** All green ✅ checks

---

### STEP 2: Deploy Portfolio Container

```bash
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest

docker stop portfolio-ui || true
docker rm portfolio-ui || true

docker run -d --name portfolio-ui --restart unless-stopped \
  --network infra_net \
  --network-alias portfolio.int \
  -p 8089:80 \
  ghcr.io/leok974/leo-portfolio/portfolio:latest
```

---

### STEP 3: Verify Nginx → Portfolio

```bash
# Restart nginx
docker restart <nginx-container-name>

# Test connectivity
docker exec -it <nginx-container-name> sh -lc '
  echo "[resolve]"; getent hosts portfolio.int && \
  echo "[probe]" && curl -sI http://portfolio.int/ | head -n1
'
```

**Expected:**
- `[resolve]` shows IP address
- `[probe]` shows `HTTP/1.1 200 OK`

---

### STEP 4: Test Public URL

```bash
curl -I https://assistant.ledger-mind.org | head -n5
```

**Expected:** `HTTP/2 200` or `HTTP/1.1 200`

---

## 🔧 Quick Fixes (If Needed)

### Fix: Nginx can't resolve portfolio.int

```bash
docker network connect infra_net <nginx-container-name> || true
docker restart <nginx-container-name>
```

### Fix: Tunnel not routing correctly

```bash
docker restart infra-cloudflared-1
```

**OR** update in Cloudflare Dashboard:
- Tunnels → Public Hostnames
- `assistant.ledger-mind.org` → HTTP → `portfolio.int:80`

### Fix: Wrong image running

```bash
docker inspect portfolio-ui --format='{{.Image}}'
# Should show: sha256:6725055...
```

If wrong, repeat STEP 2.

---

## ✅ Success Verification

### Test 1: Internal (from nginx)

```bash
docker exec <nginx-container-name> curl -s http://portfolio.int/projects.json | jq '.[0].title'
```

**Expected:** JSON with project title (e.g., "LedgerMind")

### Test 2: External (public URL)

```bash
curl -sI https://assistant.ledger-mind.org | grep -E '^HTTP|^date:'
```

**Expected:**
```
HTTP/2 200
date: Mon, 14 Oct 2025 ...
```

### Test 3: Browser

Open: https://assistant.ledger-mind.org
- [ ] Page loads
- [ ] No console errors (F12)
- [ ] All assets load
- [ ] Calendly widget works

---

## 🔍 Diagnostics (If Red Checks)

### Snippet 1: Tunnel logs

```bash
docker logs infra-cloudflared-1 --tail=60
```

### Snippet 2: Nginx connectivity

```bash
docker exec <nginx-container-name> sh -lc 'getent hosts portfolio.int && curl -sI http://portfolio.int/ | head -n1'
```

### Snippet 3: Container status

```bash
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | grep -i portfolio
```

---

## 🔄 Optional: Enable Watchtower (Auto-Updates)

```bash
docker run -d --name watchtower --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower --interval 300 --cleanup portfolio-ui
```

**How it works:**
- Checks GHCR every 5 minutes
- Pulls new `:latest` if digest changed
- Auto-restarts container

**Monitor updates:**

```bash
docker logs watchtower -f
```

---

## 📊 Health Check Commands

```bash
# All containers status
docker ps --format "table {{.Names}}\t{{.Status}}"

# Portfolio logs
docker logs portfolio-ui --tail=20

# Nginx logs
docker logs <nginx-container-name> --tail=20

# Tunnel logs
docker logs infra-cloudflared-1 --tail=20
```

---

## 🎯 Quick Status Check

```bash
# One-liner to check everything
echo "=== Containers ===" && \
docker ps --format "{{.Names}}\t{{.Status}}" | grep -E "portfolio|nginx|cloudflared" && \
echo -e "\n=== Nginx → Portfolio ===" && \
docker exec <nginx-container-name> curl -sI http://portfolio.int/ 2>&1 | head -n1 && \
echo -e "\n=== Public URL ===" && \
curl -sI https://assistant.ledger-mind.org 2>&1 | head -n1
```

---

## 📝 Fill In Your Details

- **Server**: `<user>@<server>` = `_______________________`
- **Nginx container**: `<nginx-container-name>` = `_______________________`
- **Production URL**: https://assistant.ledger-mind.org

---

## 🚨 Emergency Rollback

```bash
# Stop current container
docker stop portfolio-ui

# Pull specific old digest (if known)
docker pull ghcr.io/leok974/leo-portfolio/portfolio@sha256:<old-digest>

# Or use a backed-up image
docker images | grep portfolio
docker tag <old-image-id> ghcr.io/leok974/leo-portfolio/portfolio:rollback

# Recreate with old image
docker rm portfolio-ui
docker run -d --name portfolio-ui --restart unless-stopped \
  --network infra_net --network-alias portfolio.int -p 8089:80 \
  ghcr.io/leok974/leo-portfolio/portfolio:rollback
```

---

## 📚 Full Documentation

- **EXECUTE_DEPLOYMENT.md** - Detailed guide with explanations
- **NEXT_STEPS.md** - Complete deployment options
- **QUICK_DEPLOY_COMMANDS.md** - All commands organized
- **deploy/DIAGNOSTICS_QUICKREF.md** - Troubleshooting reference

---

**Ready to deploy!** Start with STEP 1 and work through sequentially. 🚀
