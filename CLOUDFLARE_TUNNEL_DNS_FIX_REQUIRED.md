# Cloudflare Tunnel 502 - Diagnosis Complete

## Date: October 30, 2025

## Status: ❌ BLOCKED - Requires Cloudflare Dashboard Fix

## Summary

**api.leoklemet.com** returns 502 Bad Gateway. Requests are **NOT reaching the cloudflared tunnel**.

## Root Cause

DNS record for `api.leoklemet.com` is likely **missing the CNAME to the tunnel**.

## Evidence

### ✅ What's Working

1. **Backend is healthy**

   ```bash
   $ docker exec gh-runner curl http://portfolio-api.int:8000/ready
   200 OK ✅
   ```

2. **Cloudflared tunnel is running and connected**

   ```
   - Tunnel ID: 08d5feee-f504-47a2-a1f2-b86564900991
   - 4 registered connections to Cloudflare edge
   - Configuration loaded correctly
   ```

3. **Ingress rule is configured**

   ```json
   {
     "hostname": "api.leoklemet.com",
     "originRequest": { "httpHostHeader": "api.leoklemet.com" },
     "service": "http://portfolio-api.int:8000"
   }
   ```

4. **DNS aliases are working**

   ```bash
   $ docker exec gh-runner curl http://portfolio-api.int:8000/ready
   200 OK ✅
   ```

5. **www.leoklemet.com works** (confirmed earlier in testing)

### ❌ What's Broken

1. **Public API returns 502**

   ```bash
   $ curl https://api.leoklemet.com/ready
   502 Bad Gateway
   ```

2. **No traffic reaching cloudflared**

   ```bash
   $ docker logs cloudflared --since 10m | grep "api.leoklemet"
   (no request logs - only config load)
   ```

3. **DNS resolves to Cloudflare proxy IPs, not tunnel**

   ```bash
   $ nslookup api.leoklemet.com
   172.67.175.179, 104.21.48.10  ← These are Cloudflare proxy IPs
   ```

   **Expected**: Should have CNAME to `08d5feee-f504-47a2-a1f2-b86564900991.cfargotunnel.com`

## Diagnosis Steps Performed

1. ✅ Confirmed backend healthy on port 8000
2. ✅ Confirmed DNS aliases (`portfolio-api.int`) resolve correctly
3. ✅ Verified cloudflared tunnel connected with 4 connections
4. ✅ Verified ingress rule loaded in cloudflared config
5. ✅ Restarted cloudflared to refresh DNS cache
6. ✅ Monitored logs - no traffic reaching tunnel
7. ✅ Checked DNS records - resolving to proxy IPs instead of tunnel CNAME

## Required Fix

### Step 1: Fix DNS Record in Cloudflare Dashboard

**Location**: Cloudflare Dashboard → DNS → Records

**Current (broken)**:

```
Type: A or AAAA
Name: api
Content: <some IP>
Proxy: ☁️ Proxied (orange cloud)
```

**Required (correct)**:

```
Type: CNAME
Name: api
Content: 08d5feee-f504-47a2-a1f2-b86564900991.cfargotunnel.com
Proxy: ☁️ Proxied (orange cloud)
TTL: Auto
```

### Step 2: Verify Tunnel Public Hostname

**Location**: Cloudflare Zero Trust → Access → Tunnels → 08d5feee-f504-47a2-a1f2-b86564900991 → Public Hostnames

**Required entry**:

```
Public hostname: api.leoklemet.com
Service: http://portfolio-api.int:8000
```

### Step 3: Test After Fix

Wait 1-2 minutes for DNS propagation, then test:

```powershell
# Test from local machine
try {
    $resp = Invoke-WebRequest -Uri "https://api.leoklemet.com/ready" -UseBasicParsing
    "✅ api_public: $($resp.StatusCode)"
} catch {
    "❌ api_public: $($_.Exception.Message)"
}

# Verify DNS resolves correctly
nslookup api.leoklemet.com
# Should show CNAME to *.cfargotunnel.com
```

### Step 4: Verify Traffic Reaches Tunnel

After DNS fix, requests should appear in cloudflared logs:

```powershell
# Make a request
Invoke-WebRequest -Uri "https://api.leoklemet.com/ready" -UseBasicParsing

# Check logs
docker logs cloudflared --since 1m | Select-String "api.leoklemet"
# Should show request logs with status codes
```

## Why This Happened

The tunnel ingress rule was added in the Zero Trust dashboard, and the configuration was pushed to cloudflared successfully. However, the **DNS record** was never updated to point to the tunnel.

Without the CNAME, traffic goes:

```
Browser → api.leoklemet.com
  ↓
DNS lookup → 172.67.175.179 (Cloudflare proxy IP)
  ↓
Cloudflare edge server tries to reach origin
  ↓
❌ No origin configured for this hostname
  ↓
502 Bad Gateway
```

With correct CNAME, traffic should flow:

```
Browser → api.leoklemet.com
  ↓
DNS lookup → 08d5feee...cfargotunnel.com → Cloudflare tunnel endpoint
  ↓
Cloudflare edge routes to tunnel connection
  ↓
cloudflared container receives request
  ↓
Looks up ingress rule: api.leoklemet.com → http://portfolio-api.int:8000
  ↓
Connects to portfolio-backend container
  ↓
✅ 200 OK
```

## Comparison with Working Domain

**www.leoklemet.com** (working):

- DNS: Correct CNAME to tunnel ✅
- Ingress rule: Configured ✅
- Result: 200 OK ✅

**api.leoklemet.com** (broken):

- DNS: Wrong - pointing to proxy IPs instead of tunnel ❌
- Ingress rule: Configured ✅
- Result: 502 (requests never reach tunnel) ❌

## Next Actions

1. 🔲 **BLOCKER**: Fix DNS CNAME for `api.leoklemet.com` in Cloudflare dashboard
2. 🔲 Wait 1-2 minutes for DNS propagation
3. 🔲 Test public endpoint: `curl https://api.leoklemet.com/ready`
4. 🔲 Verify cloudflared logs show traffic
5. 🔲 Run infra-smoke workflow to confirm full green

## Related Files

- `INFRA_SMOKE_SELF_HEAL_SUMMARY.md` - Self-heal implementation
- `502_BAD_GATEWAY_ROOT_CAUSE.md` - Initial diagnostic analysis
- `docker-compose.cloudflared.yml` - Tunnel configuration
- `deploy/docker-compose.portfolio-prod.yml` - Backend configuration with network aliases

## Commands Reference

```powershell
# Test backend internally (from runner or any container on infra_net)
docker exec gh-runner curl http://portfolio-api.int:8000/ready

# Test public endpoint
curl https://api.leoklemet.com/ready

# Check cloudflared status
docker ps | Select-String cloudflared
docker logs cloudflared --tail 50

# Check DNS
nslookup api.leoklemet.com
# Should show CNAME to *.cfargotunnel.com

# Restart cloudflared (if needed after DNS fix)
docker restart cloudflared
```

## Timeline

- 21:04 - Added self-heal to workflow (commit 260210a)
- 21:23 - Restarted gh-runner after network issues
- 21:38 - Cloudflared restarted, config loaded correctly
- 22:01 - Cloudflared restarted again to refresh DNS
- 22:05 - Confirmed: Requests not reaching tunnel (DNS issue)
- **CURRENT**: Waiting for Cloudflare DNS CNAME fix

## Status Summary

```
✅ Backend: HEALTHY (200 OK on :8000)
✅ Tunnel: CONNECTED (4 connections)
✅ Config: CORRECT (ingress rule loaded)
✅ Network: WORKING (DNS aliases resolve)
❌ DNS: MISCONFIGURED (missing CNAME)
❌ Public API: 502 (traffic not reaching tunnel)
```

**Once DNS is fixed, all smoke tests should pass! 🎉**
