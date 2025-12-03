# 502 Bad Gateway Root Cause Analysis

## Issue

`api.leoklemet.com/ready` returns 502 Bad Gateway with Cloudflare error page.

## Investigation Summary

### What Works ✅

- **Backend health**: `portfolio-backend` container is running and healthy
  - Internal endpoint `http://portfolio-api.int:8000/ready` returns **200 OK**
  - Logs show: `INFO: Uvicorn running on http://0.0.0.0:8000`
  - Recent requests: All returning `200 OK` from internal IPs

- **Network connectivity**: After fixing `docker-compose.runner.yml`:
  - Added `gh-runner` to `infra_net` network
  - Runner can now resolve and reach `portfolio-api.int:8000`
  - curl test: `internal_api 200` ✅

- **Infrastructure containers**:
  - `cloudflared` tunnel: Running (Up 2+ hours)
  - `portfolio-backend`: Running (Up 4+ hours, port 8001 mapped to 127.0.0.1:8001)
  - `portfolio-nginx`: Running (Up 4+ hours, port 80 mapped to 127.0.0.1:8082)

### What's Broken ❌

- **Public API endpoint**: `https://api.leoklemet.com/ready` → **502 Bad Gateway**
  - Response body: "error code: 502" (Cloudflare error page)
  - This is a Cloudflare-level error, not backend

## Root Cause

**Cloudflare Tunnel ingress rules are misconfigured or missing for `api.leoklemet.com`.**

The tunnel (ID: `08d5feee-f504-47a2-a1f2-b86564900991`) is shared across multiple services:

- `www.leoklemet.com` → `portfolio.int:80` (works ✅)
- `api.leoklemet.com` → ??? (not configured or pointing to wrong service ❌)

### Expected Configuration

```yaml
# In Cloudflare Zero Trust Dashboard → Tunnels → 08d5feee... → Public Hostnames
- Hostname: api.leoklemet.com
  Service: http://portfolio-api.int:8000
```

### Current State

The tunnel ingress rule for `api.leoklemet.com` is either:

1. **Missing entirely** (not configured in dashboard)
2. **Pointing to wrong service** (e.g., old hostname or port)
3. **Pointing to unhealthy service** (though our tests show backend is healthy)

## Evidence Timeline

### Initial Debug Run (18954637286)

- Public check: `api.leoklemet.com/ready` → **502**
- Internal curl: `portfolio-api.int:8000` → **000** (DNS failure)
- **Diagnosis**: Runner on wrong network, couldn't resolve hostnames

### Network Fix

1. Added `networks: - infra_net` to `docker-compose.runner.yml`
2. Added root-level network definition: `networks: infra_net: external: true`
3. Regenerated GitHub runner token (old token expired)
4. Restarted runner container

### Post-Fix Debug Run (18954990938)

- Public check: `api.leoklemet.com/ready` → **502** (still broken)
- Internal curl: `portfolio-api.int:8000` → **200** ✅ (now works!)
- **Diagnosis**: Backend is healthy, issue is Cloudflare tunnel routing

## Fix Required

### Step 1: Check Cloudflare Tunnel Configuration

```powershell
# Login to Cloudflare Zero Trust dashboard
# Navigate to: Access → Tunnels → 08d5feee-f504-47a2-a1f2-b86564900991
# Check "Public Hostnames" tab
```

### Step 2: Add/Fix Ingress Rule

```yaml
# Required ingress rule:
Hostname: api.leoklemet.com
Type: HTTP
Service: http://portfolio-api.int:8000
```

### Step 3: Verify DNS

```powershell
# Ensure api.leoklemet.com has CNAME record pointing to tunnel
nslookup api.leoklemet.com
# Should return: <tunnel-id>.cfargotunnel.com
```

### Step 4: Test After Fix

```powershell
# Wait 1-2 minutes for tunnel config to propagate
curl -v https://api.leoklemet.com/ready
# Expected: 200 OK with JSON body {"ok":true,...}
```

## Key Learnings

1. **Network Isolation Matters**: GitHub Actions runner must be on same network as backend containers to perform accurate diagnostics
2. **Always Test Internal First**: Before debugging routing, confirm backend is healthy via internal endpoints
3. **Cloudflare 502 vs Backend 502**:
   - Cloudflare error page ("error code: 502") = tunnel can't reach service
   - Backend error = different error message/page
4. **Tunnel Configuration**: Shared tunnel requires explicit ingress rules for each public hostname

## Files Modified

### docker-compose.runner.yml

```yaml
services:
  gh-runner:
    networks:
      - infra_net

networks:
  infra_net:
    external: true
```

### .env.runner

```bash
# Updated token (rotated 2025-10-30)
GH_RUNNER_TOKEN=BTGQ4ICE5GICPALHXEKEQ33JAPQNC
```

### .github/workflows/infra-smoke.yml

```yaml
# Added debug-api step (runs even on failure)
- name: debug-api
  if: always()
  run: |
    docker ps
    docker logs portfolio-backend --tail 80
    curl -s -o /dev/null -w "internal_api %{http_code}\n" http://portfolio-api.int:8000/ready
```

## Next Actions

1. ✅ Network connectivity fixed (runner on infra_net)
2. ✅ Backend confirmed healthy (internal_api 200)
3. 🔲 **TODO: Fix Cloudflare tunnel ingress for api.leoklemet.com** ← BLOCKER
4. 🔲 Re-run infra-smoke workflow to verify fix
5. 🔲 Update documentation with correct tunnel configuration

## Related Issues

- GitHub Workflow Run: 18954990938
- Tunnel ID: 08d5feee-f504-47a2-a1f2-b86564900991
- Backend Container: portfolio-backend (port 8000)
- Network: infra_net
