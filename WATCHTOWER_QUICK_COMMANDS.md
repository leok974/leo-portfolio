# Watchtower Deployment - Quick Command Reference

**Copy-paste ready commands for production deployment**

---

## 🚀 Production Server Commands

### Step 1: Update Files (if using git pull)
```bash
cd /path/to/deploy
git pull origin main
```

### Step 2: Create/Update .env.production
```bash
cat > deploy/.env.production << 'EOF'
# Watchtower HTTP API Authentication
WATCHTOWER_HTTP_API_TOKEN=dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE

# Figma MCP Integration
FIGMA_PAT=<your-figma-token-here>
FIGMA_TEAM_ID=
FIGMA_TEMPLATE_KEY=

# Add other production secrets as needed
EOF
```

**Note**: Replace `<your-figma-token-here>` with actual Figma PAT from GitHub Secrets

### Step 3: Deploy Stack
```bash
cd /path/to/deploy

# Pull latest images
docker compose -f docker-compose.portfolio-prod.yml pull

# Start/refresh services
docker compose -f docker-compose.portfolio-prod.yml up -d

# If nginx is host-managed, reload it
nginx -t && nginx -s reload || true
```

### Step 4: Verify Watchtower
```bash
# Check container running
docker ps | grep watchtower

# Check logs
docker logs portfolio-watchtower --tail=50

# Test local endpoint
curl -X POST http://127.0.0.1:8083/v1/update \
  -H "Authorization: Bearer dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE"
```

---

## 🌐 Test Public Endpoint (from anywhere)

```bash
curl -sS -X POST https://api.leoklemet.com/ops/watchtower/update \
  -H "Authorization: Bearer dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE"
```

---

## 🔄 Force-Pull Backend

### Option A: GitHub Actions
```
1. Go to: https://github.com/leok974/leo-portfolio/actions
2. Click: "Redeploy Backend via Watchtower"
3. Click: "Run workflow" → "Run workflow"
```

### Option B: Manual curl + wait
```bash
# Trigger update
curl -sS -X POST https://api.leoklemet.com/ops/watchtower/update \
  -H "Authorization: Bearer dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE"

# Wait for pull/restart
sleep 30

# Check health
curl -sS https://api.leoklemet.com/api/ready | jq .
```

---

## ✅ Verify `/api/dev/status` Fix

### 1. Health Check
```bash
curl -sS https://api.leoklemet.com/api/ready | jq .
```

### 2. Check OpenAPI Routes
```bash
curl -sS https://api.leoklemet.com/openapi.json | jq '.paths | keys | map(select(test("dev")))'
```

**Expected to include**: `/api/dev/status`

### 3. Test Endpoint (no auth - denied)
```bash
curl -sS https://api.leoklemet.com/api/dev/status | jq .
```

**Expected**:
```json
{"ok":true,"allowed":false,"mode":"denied","source":"none","ts":"..."}
```

### 4. Test Endpoint (with auth - allowed)
```bash
curl -sS https://api.leoklemet.com/api/dev/status \
  -H "x-dev-key: a61350cef0487532f2814a54499f3baeb8f207ead09bbc0e24472911ce6e0cc9" | jq .
```

**Expected**:
```json
{"ok":true,"allowed":true,"mode":"token","source":"dev_overlay_key","ts":"..."}
```

### 5. Test Dev Overlay in Browser
```
https://www.leoklemet.com/?dev_overlay=dev
```

**Expected**: Badge shows `allowed: true`

---

## 🔧 Troubleshooting Commands

### 401 Unauthorized
```bash
# On production server - verify token
cat deploy/.env.production | grep WATCHTOWER_HTTP_API_TOKEN

# Restart Watchtower
docker compose -f docker-compose.portfolio-prod.yml restart watchtower
```

### 404 Not Found
```bash
# Check nginx config
grep -A5 "/ops/watchtower/update" deploy/nginx/nginx.prod.conf

# Reload nginx
nginx -t && nginx -s reload
```

### Backend Not Updating
```bash
# Check label
docker inspect portfolio-backend | jq '.[0].Config.Labels["com.centurylinklabs.watchtower.enable"]'

# Force manual pull
docker compose -f docker-compose.portfolio-prod.yml pull backend
docker compose -f docker-compose.portfolio-prod.yml up -d backend

# Check logs
docker logs portfolio-backend --tail=50
```

### Watchtower Won't Start
```bash
# Check token exists
cat deploy/.env.production | grep WATCHTOWER

# Check logs
docker logs portfolio-watchtower

# Check port
netstat -tuln | grep 8083
```

---

## 📊 Monitoring Commands

### Check Watchtower Activity
```bash
docker logs portfolio-watchtower | grep "Found new"
docker logs portfolio-watchtower --tail=20
```

### Monitor All Containers
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
```

### Continuous Health Monitor
```bash
watch -n 5 'curl -sS https://api.leoklemet.com/api/ready | jq .'
```

---

## 🎯 Success Checklist

Run these in order to verify deployment:

```bash
# 1. Watchtower running
docker ps | grep watchtower

# 2. Watchtower logs healthy
docker logs portfolio-watchtower --tail=20 | grep "HTTP API enabled"

# 3. Public endpoint works
curl -sS -X POST https://api.leoklemet.com/ops/watchtower/update \
  -H "Authorization: Bearer dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE"

# 4. Backend healthy
curl -sS https://api.leoklemet.com/api/ready

# 5. Route exists in OpenAPI
curl -sS https://api.leoklemet.com/openapi.json | jq '.paths | has("/api/dev/status")'

# 6. Endpoint responds
curl -sS https://api.leoklemet.com/api/dev/status | jq '.ok'
```

**All should succeed before declaring victory! ✅**

---

## 📝 Token Reference

**Watchtower API Token** (for copy-paste):
```
dsksLSbhyxH-0FRluEaPMVCzXE_o0duOVzXxfQZ-XGE
```

**Dev Overlay Key** (for testing):
```
a61350cef0487532f2814a54499f3baeb8f207ead09bbc0e24472911ce6e0cc9
```

---

## 🔗 Quick Links

- **GitHub Actions**: https://github.com/leok974/leo-portfolio/actions
- **Workflow**: Redeploy Backend via Watchtower
- **Health Check**: https://api.leoklemet.com/api/ready
- **OpenAPI**: https://api.leoklemet.com/openapi.json
- **Dev Overlay**: https://www.leoklemet.com/?dev_overlay=dev
