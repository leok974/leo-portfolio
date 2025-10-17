# Production Deployment - Execute Now

## Step 1: Run Server Diagnostics

```bash
# Copy diagnostics script to server
scp deploy/diagnose-server.sh <user>@<server>:/tmp/

# SSH to server
ssh <user>@<server>

# Run diagnostics
bash /tmp/diagnose-server.sh
```

### ✅ Expected Output (Must Be All Green)

- **Tunnel**: "Connection established" and hostname route for `assistant.ledger-mind.org` → `http://portfolio.int:80`
- **Nginx**: Config test ok, error log clean (no upstream timeouts)
- **Upstream reachability** (from inside nginx): `HTTP/1.1 200 OK` for `curl -I http://portfolio.int/`

---

## Step 2: Recreate Portfolio Container Cleanly

Ensures the right image/digest + alias on the right Docker network.

```bash
# Pull latest image
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest

# Stop and remove old container
docker stop portfolio-ui || true
docker rm   portfolio-ui || true

# Deploy new container
docker run -d --name portfolio-ui --restart unless-stopped \
  --network infra_net \
  --network-alias portfolio.int \
  -p 8089:80 \
  ghcr.io/leok974/leo-portfolio/portfolio:latest
```

---

## Step 3: Bounce Nginx and Verify Upstream Resolution

```bash
# Restart nginx container
docker restart <nginx-container-name>

# Test from inside nginx container
docker exec -it <nginx-container-name> sh -lc '
  echo "[resolve]"; getent hosts portfolio.int && \
  echo "[probe]" && curl -sI http://portfolio.int/ | head -n1
'
```

**Expected output:**
- Resolved IP address
- `HTTP/1.1 200 OK`

---

## Step 4: Verify Public URL

```bash
curl -I https://assistant.ledger-mind.org | head -n5
```

**Expected:**
- `HTTP/2 200` (or `HTTP/1.1 200`)
- Recent date
- No cf-error pages

---

## 🚨 If Any Check Fails - Exact One-Liners

### Issue: Tunnel Route Wrong/Missing

**Fix in Cloudflare:**
- Go to: Cloudflare → Tunnels → Public Hostnames
- Configure: `assistant.ledger-mind.org` → HTTP → URL `portfolio.int` → Port `80`

```bash
# Then restart tunnel
docker restart infra-cloudflared-1
```

### Issue: Nginx Can't Resolve portfolio.int

Put nginx + portfolio-ui on the same Docker network (standard is `infra_net`):

```bash
docker network connect infra_net <nginx-container-name> || true
docker restart <nginx-container-name>
```

### Issue: Wrong Image/Digest Running

Recreate exactly as in Step 2, then confirm:

```bash
docker inspect portfolio-ui --format='{{.Image}}'
# Should show: ...portfolio:latest@sha256:6725055...
```

### Issue: Watchtower Isn't Restarting on Updates

(Optional) Run Watchtower bound to this container:

```bash
docker run -d --name watchtower --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower --interval 300 --cleanup portfolio-ui
```

---

## ✅ Quick Success Checks (After It's Fixed)

### Internal Test

```bash
# From inside nginx container
docker exec <nginx-container-name> curl -s http://portfolio.int/projects.json | jq '.[0].title'
```

### External Test

```bash
curl -sI https://assistant.ledger-mind.org | grep -E '^HTTP|^date:'
```

---

## 🔍 Diagnostics Snippets (If You Hit Any Red)

If diagnostics show failures, paste these three snippets:

### 1. Cloudflare Tunnel Logs

```bash
docker logs infra-cloudflared-1 --tail=60
```

### 2. Nginx Connectivity Test

```bash
docker exec <nginx> sh -lc 'getent hosts portfolio.int && curl -sI http://portfolio.int/ | head -n1'
```

### 3. Container Status

```bash
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | grep -i portfolio
```

---

## 📋 Pre-Flight Checklist

Before starting, gather this info:

- [ ] **Server hostname/IP**: `_______________________`
- [ ] **SSH user**: `_______________________`
- [ ] **Nginx container name**: `_______________________` (find with `docker ps | grep nginx`)
- [ ] **Cloudflare Tunnel container**: Usually `infra-cloudflared-1`
- [ ] **Docker network**: Usually `infra_net`

---

## 🎯 Execution Order

1. ✅ Run diagnostics script → Note any failures
2. ✅ Deploy portfolio container
3. ✅ Restart nginx and verify
4. ✅ Test public URL
5. ✅ (Optional) Enable Watchtower
6. ✅ Run success checks

---

## 📊 Expected Healthy State

After successful deployment:

```bash
# All containers running
$ docker ps --format "table {{.Names}}\t{{.Status}}"
portfolio-ui        Up X minutes (healthy)
<nginx-container>   Up X minutes
infra-cloudflared-1 Up X days

# Nginx can resolve and reach portfolio
$ docker exec <nginx> getent hosts portfolio.int
10.0.X.X  portfolio.int

$ docker exec <nginx> curl -sI http://portfolio.int/ | head -n1
HTTP/1.1 200 OK

# Public URL works
$ curl -I https://assistant.ledger-mind.org | head -n1
HTTP/2 200
```

---

## 🚀 Ready to Execute

All commands are ready to copy-paste. Start with **Step 1** and work through sequentially.

**Your server details** (fill in):
- Server: `<user>@<server>`
- Nginx container: `<nginx-container-name>`

Good luck! 🎉
