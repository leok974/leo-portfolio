# Server Diagnostics Quick Reference

## Purpose

Fast path diagnostics for production server when portfolio deployment isn't working.

## Files

- **Bash**: `deploy/diagnose-server.sh` (Linux/WSL)
- **PowerShell**: `deploy/diagnose-server.ps1` (Windows)

## Quick Run

### Linux/WSL
```bash
bash deploy/diagnose-server.sh
```

### Windows PowerShell
```powershell
.\deploy\diagnose-server.ps1
```

### On Remote Server
```bash
# Copy script to server
scp deploy/diagnose-server.sh user@server:/tmp/

# SSH and run
ssh user@server
chmod +x /tmp/diagnose-server.sh
bash /tmp/diagnose-server.sh
```

## What It Checks (10 Steps)

### 1. Cloudflare Tunnel Status
- ✅ Is `infra-cloudflared-1` running?
- ✅ Does log show "Connection established"?
- ✅ Is `assistant.ledger-mind.org` being routed?

### 2. Nginx Health
- ✅ Is nginx/proxy container running?
- ✅ Is it healthy?
- Shows recent logs (last 100 lines)

### 3. Portfolio Container Health
- ✅ Is `portfolio` container running?
- ✅ Health check status?
- Shows recent logs (last 100 lines)

### 4. Nginx → Upstream Connectivity
- ✅ Can nginx reach `http://portfolio.int:80/`?
- Tests from **inside** nginx container
- **Critical**: If this fails, nginx can't serve portfolio content

### 5. Host → Container Port
- ✅ Can host reach portfolio's exposed port?
- Tests `http://127.0.0.1:<port>/`
- Verifies port mapping working

### 6. Image Verification
- ✅ Is correct image running?
- Expected: `ghcr.io/leok974/leo-portfolio/portfolio:latest`
- Expected digest: `sha256:6725055...`
- Shows full image details

### 7. Nginx Upstream DNS
- ✅ Can nginx resolve `portfolio.int`?
- Tests `getent hosts portfolio.int` from inside nginx
- Tests HTTP connectivity to resolved IP

### 8. Docker Network Configuration
- ✅ Are nginx and portfolio on same network?
- **Critical**: Must share network (e.g., `infra_net`) for connectivity
- Lists all networks for both containers

### 9. Nginx Configuration
- ✅ Does nginx config have portfolio routes?
- Greps for `portfolio` in config files
- Shows upstream definitions

### 10. Cloudflare Tunnel Routing
- ✅ Is tunnel configured for `assistant.ledger-mind.org`?
- ✅ Does it route to correct upstream?
- Shows recent tunnel logs

## Output Format

### Color Coding
- ✅ **Green** = Check passed
- ❌ **Red** = Check failed (critical issue)
- ⚠️ **Yellow** = Warning or info

### Exit Code
- **0** = All checks passed
- **N** = Number of failures (use in CI/CD)

### Example Output
```
════════════════════════════════════════════════════════════════
  🔍 PORTFOLIO SERVER DIAGNOSTICS
════════════════════════════════════════════════════════════════

═══ STEP 1: Is the Cloudflare Tunnel up? ═══
✅ Tunnel container found: infra-cloudflared-1
✅ Tunnel shows 'Connection established'

═══ STEP 2: Is nginx healthy? ═══
✅ Nginx container found: applylens-nginx-prod
✅ Nginx is healthy

[... continues for all 10 steps ...]

════════════════════════════════════════════════════════════════
  ✅ ALL CHECKS PASSED!
════════════════════════════════════════════════════════════════

📋 QUICK FIX COMMANDS:
[actionable commands shown here]
```

## Common Issues & Fixes

### Issue 1: Nginx Can't Reach portfolio.int

**Symptom**: Step 4 fails with "could not resolve host" or timeout

**Cause**: Containers on different networks

**Fix**:
```bash
# Add portfolio to nginx's network
docker network connect infra_net portfolio-ui
docker restart portfolio-ui

# Verify both on same network
docker inspect portfolio-ui --format='{{range $net, $config := .NetworkSettings.Networks}}{{$net}} {{end}}'
docker inspect <nginx-container> --format='{{range $net, $config := .NetworkSettings.Networks}}{{$net}} {{end}}'
```

### Issue 2: Wrong Image Running

**Symptom**: Step 6 shows unexpected image or old digest

**Cause**: Watchtower not running or image not pulled

**Fix**:
```bash
# Pull latest
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest

# Recreate container
docker stop portfolio-ui
docker rm portfolio-ui
docker run -d --name portfolio-ui --restart unless-stopped \
  --network infra_net -p 8089:80 \
  ghcr.io/leok974/leo-portfolio/portfolio:latest

# Verify digest
docker inspect portfolio-ui --format='{{.Image}}'
```

### Issue 3: Cloudflare Tunnel Routes to Wrong Upstream

**Symptom**: Step 10 shows tunnel routing to `ai-finance.int` instead of `portfolio.int`

**Cause**: Tunnel config outdated

**Fix**:
```bash
# Check tunnel config
docker exec infra-cloudflared-1 cat /etc/cloudflared/config.yml

# Update config to route assistant.ledger-mind.org → http://portfolio.int:80
# Then restart tunnel
docker restart infra-cloudflared-1

# Verify in logs
docker logs infra-cloudflared-1 --tail=50 | grep assistant.ledger-mind.org
```

### Issue 4: Nginx Config Missing Portfolio Routes

**Symptom**: Step 9 shows no portfolio routes in nginx config

**Cause**: Nginx config not updated for portfolio

**Fix**:
```bash
# Check current config
docker exec <nginx-container> cat /etc/nginx/conf.d/default.conf

# Should have:
# location / {
#     proxy_pass http://portfolio.int:80;
# }

# If missing, update nginx config and reload
docker exec <nginx-container> nginx -s reload
```

### Issue 5: 502 Bad Gateway in Browser

**Likely causes** (in order):
1. **Network isolation** (Step 8 fails) → Fix: Add to same network
2. **Nginx can't resolve portfolio.int** (Step 7 fails) → Fix: Check DNS
3. **Wrong upstream in nginx config** (Step 9 fails) → Fix: Update config
4. **Tunnel routing to wrong place** (Step 10 fails) → Fix: Update tunnel config

**Diagnostic flow**:
```bash
# Run full diagnostics
bash deploy/diagnose-server.sh

# Note which steps fail
# Follow quick fix commands shown at end
```

## Quick Fix Commands Reference

### Redeploy Portfolio
```bash
docker pull ghcr.io/leok974/leo-portfolio/portfolio:latest
docker stop portfolio-ui && docker rm portfolio-ui
docker run -d --name portfolio-ui --restart unless-stopped \
  --network infra_net -p 8089:80 \
  ghcr.io/leok974/leo-portfolio/portfolio:latest
```

### Fix Network Issue
```bash
docker network connect infra_net portfolio-ui
docker restart portfolio-ui
```

### Restart All Components
```bash
docker restart portfolio-ui
docker restart <nginx-container>
docker restart infra-cloudflared-1
```

### Check Watchtower Auto-Updates
```bash
docker logs watchtower --tail=100
```

### Test Production URL
```bash
# From server
curl -I https://assistant.ledger-mind.org

# From browser
# Open: https://assistant.ledger-mind.org
# Check console (F12) - no errors
# Verify all assets load
```

## When to Use

- **Before deploying** to production (pre-flight check)
- **After deploying** to verify everything connected correctly
- **When 502 errors** appear in browser
- **After infrastructure changes** (network, nginx config, tunnel config)
- **When Watchtower updates** to verify new image working

## Integration with CI/CD

```yaml
# In GitHub Actions or similar
- name: Diagnose Server
  run: bash deploy/diagnose-server.sh

# If script exits non-zero, deployment failed
# Number of failures = exit code
```

## Expected Healthy Output

All 10 steps should show ✅ green checkmarks:
1. ✅ Tunnel connected
2. ✅ Nginx healthy
3. ✅ Portfolio healthy
4. ✅ Nginx reaches portfolio.int
5. ✅ Host reaches portfolio port
6. ✅ Correct image running
7. ✅ DNS resolves portfolio.int
8. ✅ Containers share network
9. ✅ Nginx config has portfolio routes
10. ✅ Tunnel routes to portfolio.int

**Exit code**: 0

## Troubleshooting the Diagnostics Script Itself

### Script Won't Run (Permission Denied)

```bash
chmod +x deploy/diagnose-server.sh
```

### Docker Commands Fail

```bash
# Check Docker is running
docker ps

# Check user has Docker permissions
sudo usermod -aG docker $USER
# Then logout/login
```

### Script Shows Network Errors

```bash
# Ensure Docker daemon is accessible
docker info

# Check containers are actually running
docker ps -a
```

## Architecture Reference

**Expected Production Setup**:
```
Internet
  ↓
Cloudflare Tunnel (infra-cloudflared-1)
  ↓
Nginx (applylens-nginx-prod or similar)
  ├─ /chat → siteagent:8001/chat
  ├─ /chat/stream → siteagent:8001/chat/stream (SSE)
  ├─ /resume/ → siteagent:8001/resume/
  ├─ /api/ → siteagent:8001/api/
  └─ / → portfolio.int:80 (static files)
      ↓
Portfolio Container (portfolio-ui)
  - Image: ghcr.io/leok974/leo-portfolio/portfolio:latest
  - Network: infra_net (shared with nginx)
  - Alias: portfolio.int:80
```

**Key Requirements**:
- All containers on same Docker network (`infra_net`)
- Portfolio container has network alias `portfolio.int`
- Nginx config routes `/` to `http://portfolio.int:80`
- Cloudflare Tunnel routes `assistant.ledger-mind.org` to nginx

## See Also

- `QUICK_DEPLOY_REFERENCE.md` - Full deployment workflow
- `DEPLOYMENT_CHECKLIST.md` - Step-by-step server setup
- `DEPLOY_IMAGE.md` - Comprehensive guide (400+ lines)
- `deploy/nginx.portfolio-reverse-proxy.conf` - Nginx config example
- `deploy/docker-compose.portfolio-image.yml` - Service definition
