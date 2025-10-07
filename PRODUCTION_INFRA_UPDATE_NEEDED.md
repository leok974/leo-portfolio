# 🎯 Production Backend Update Required

## Current Situation

We successfully deployed to **`D:\leo-portfolio\deploy`**, but `https://assistant.ledger-mind.org` is served by a **DIFFERENT backend** in `D:\infra`.

### Architecture Discovery

```
https://assistant.ledger-mind.org
         ↓
   Cloudflare Tunnel (infra-cloudflared-1)
         ↓
   D:\infra stack
         ↓
   nginx → OLD backend (without admin router)
```

**vs**

```
http://localhost:8080
         ↓
   D:\leo-portfolio\deploy stack
         ↓
   nginx → NEW backend ✅ (with admin router, PyJWT, service tokens)
```

## Evidence

1. **Cloudflared container location:**
   ```
   infra-cloudflared-1
   Project working dir: D:\infra
   Config: D:\infra\compose.yml
   ```

2. **Test results:**
   - `http://localhost:8080/api/admin/whoami` → 403 ✅ (endpoint exists, needs JWT)
   - `https://assistant.ledger-mind.org/api/admin/whoami` → 403 ❌ (CF rejects service token OR endpoint missing)

## Solution: Update Production Infra Backend

### Option 1: Point Tunnel to New Backend

If `D:\infra` uses a separate backend, update it to use the latest code:

```powershell
# Navigate to infra directory
cd D:\infra

# Check current compose file
cat compose.yml

# If it has a backend service, update it:
# 1. Point to latest leo-portfolio backend image
# 2. OR rebuild with latest code
# 3. Restart

docker compose pull backend  # if using image
# OR
docker compose build backend  # if building from source
docker compose up -d backend
```

### Option 2: Point Tunnel to leo-portfolio Backend

If the infra is just routing, update the ingress to point to your new backend:

```yaml
# D:\infra\cloudflared-config.yml or compose.yml
ingress:
  - hostname: assistant.ledger-mind.org
    service: http://portfolio-nginx-1:80  # Point to your updated stack
  - service: http_status:404
```

Then restart cloudflared:
```powershell
cd D:\infra
docker compose restart cloudflared
```

### Option 3: Deploy Updated Code to Infra

If infra has its own backend codebase:

```powershell
cd D:\infra

# Copy updated files from leo-portfolio
# OR pull latest from git if infra uses same repo
# OR update infra's backend to latest version

# Then rebuild
docker compose build backend
docker compose up -d backend
```

## Quick Test to Identify Setup

```powershell
# Check what's in D:\infra
cd D:\infra
ls

# Check compose.yml
cat compose.yml

# Check which backend container is running
docker compose ps

# Check backend logs
docker compose logs backend --tail 50
```

## After Updating Infra Backend

Once the infra backend is updated, test again:

```powershell
cd D:\leo-portfolio

$env:CF_ACCESS_CLIENT_ID = "bcf632e4a22f6a8007d47039038904b7.access"
$env:CF_ACCESS_CLIENT_SECRET = "ed3822142602d252acc657dc1922e2647224f394ecfd7dab683f31b72ffee35a"

.\test-service-token.ps1
```

**Expected:**
```json
{
  "ok": true,
  "principal": "portfolio-admin-smoke"
}
```

## Summary

**Problem:** We updated the WRONG backend!
- ✅ Updated: `D:\leo-portfolio\deploy` backend (localhost:8080)
- ❌ Need to update: `D:\infra` backend (assistant.ledger-mind.org)

**Solution:** Apply the same updates to the `D:\infra` backend stack.

---

**Next:** Check `D:\infra\compose.yml` to see how to update that backend.
