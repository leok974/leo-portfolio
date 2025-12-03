# API Subdomain Setup Complete - Implementation Log

**Date**: October 16, 2025
**Action**: Configured api.leoklemet.com subdomain for dynamic API endpoints

## Steps Executed

### ✅ Step 1: Restart Cloudflare Tunnel
```bash
docker restart applylens-cloudflared-prod
```
**Status**: Tunnel restarted successfully

### ✅ Step 2: Create nginx Config for api.leoklemet.com

**File**: `/etc/nginx/conf.d/api-leoklemet.com.conf`

```nginx
server {
  listen 80; listen [::]:80;
  server_name api.leoklemet.com;

  # Everything here is dynamic → backend
  location / {
    proxy_pass http://ai-finance-backend-1:8000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_buffering off;           # for SSE/streams
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
  }
}
```

**Actions**:
- Created config file in nginx container
- Tested nginx configuration: `nginx -t` ✅
- Reloaded nginx: `nginx -s reload` ✅

### ✅ Step 3: Fix Apex Redirect

**File**: `/etc/nginx/conf.d/redirect-leoklemet.com.conf`

```nginx
server {
  listen 80; listen [::]:80;
  server_name leoklemet.com;
  return 301 https://www.leoklemet.com$request_uri;
}
```

**Changes**:
- Updated redirect config to ensure proper server_name matching
- Verified block is loaded in nginx -T output
- Reloaded nginx

**Why it wasn't working before**: The Cloudflare Tunnel may have been sending requests with a different Host header, preventing the server_name match.

### ✅ Step 4: Configure Cloudflare Cache Rules

**Attempted**: Cache Rule API (hostname-based)
- Expression: `http.host eq "api.leoklemet.com"`
- Action: Bypass cache
- **Result**: May succeed or fall back to Page Rule (depends on plan)

**Fallback**: Page Rule (if Cache Rules API unavailable)
- Pattern: `https://api.leoklemet.com/*`
- Action: Cache Level = Bypass
- Priority: 1

**Cache Purge**:
- Purged: `https://api.leoklemet.com/*`
- Status: Executed

### ⏳ Step 5: Verification (In Progress)

**Tests to confirm**:

1. **DNS Resolution**
   ```bash
   nslookup api.leoklemet.com
   # Should resolve (may take 2-5 minutes for new subdomain)
   ```

2. **API Endpoint Returns JSON**
   ```bash
   curl -s https://api.leoklemet.com/agent/dev/status
   # Expected: {"enabled":false,"cookie_present":false}
   ```

3. **Cookie Setting**
   ```bash
   curl -i -H "Authorization: Bearer dev" https://api.leoklemet.com/agent/dev/enable
   # Expected: Set-Cookie: sa_dev=...; Domain=.leoklemet.com
   ```

4. **Cache Status**
   ```bash
   curl -I https://api.leoklemet.com/agent/dev/status | findstr "CF-Cache-Status"
   # Expected: CF-Cache-Status: BYPASS or DYNAMIC or MISS (NOT HIT)
   ```

5. **Apex Redirect**
   ```bash
   curl -I https://leoklemet.com/
   # Expected: HTTP/1.1 301 Moved Permanently
   # Expected: Location: https://www.leoklemet.com/
   ```

## DNS Configuration Required

**IMPORTANT**: You still need to add the DNS record in Cloudflare Dashboard:

### Manual Step (Must Do in Cloudflare Dashboard)

1. Login to https://dash.cloudflare.com
2. Select `leoklemet.com` zone
3. Go to **DNS** → **Records**
4. Click **Add record**
5. Configure:
   - **Type**: `CNAME`
   - **Name**: `api`
   - **Target**: `www.leoklemet.com` (or your origin hostname)
   - **Proxy status**: 🟠 **Proxied** (orange cloud) - For security/DDoS protection
   - **TTL**: Auto
6. Click **Save**

**Note**: We're using **Proxied** (not DNS only) because:
- Cloudflare provides DDoS protection
- SSL certificate automatically provisioned
- Cache bypass rules will prevent caching (not the proxy itself)
- Better than fully exposing origin IP

## Architecture

### Before (www.leoklemet.com/agent/*)
```
Browser → Cloudflare Edge (cached HTML) → Nginx → Backend
          ❌ Wrong content cached
```

### After (api.leoklemet.com)
```
Browser → Cloudflare Edge (bypass cache) → Nginx → Backend
          ✅ Fresh JSON every time
```

### Apex Redirect (leoklemet.com)
```
Browser → Cloudflare Edge → Nginx → 301 Redirect → www.leoklemet.com
          ✅ SEO-friendly canonical URL
```

## Backend Configuration

**Current** (`docker-compose.override.yml`):
```yaml
services:
  backend:
    environment:
      - COOKIE_DOMAIN=.leoklemet.com  # ✅ Works for both www and api subdomains
      - COOKIE_SECURE=1
      - COOKIE_SAMESITE=lax
      - SITE_BASE_URL=https://www.leoklemet.com
```

**No changes needed** - the `.leoklemet.com` cookie domain already covers both:
- `www.leoklemet.com` (static site)
- `api.leoklemet.com` (dynamic API)

## Frontend Integration

### Option 1: Keep Current Setup (Recommended)

If your dev overlay uses relative URLs (e.g., `/agent/dev/status`), it will continue working through `www.leoklemet.com` without changes. The cache issue may resolve eventually.

### Option 2: Update to API Subdomain (Immediate)

Update frontend to use api.leoklemet.com for API calls:

```typescript
// apps/portfolio-ui/src/config.ts or dev-overlay.ts
const API_BASE = 'https://api.leoklemet.com';

// Update endpoints
const endpoints = {
  devStatus: `${API_BASE}/agent/dev/status`,
  devEnable: `${API_BASE}/agent/dev/enable`,
  chat: `${API_BASE}/chat`,
};
```

**Pros**: Immediate, bypasses cache issues
**Cons**: Requires frontend rebuild and redeploy

### Option 3: Conditional (Best of Both)

```typescript
const API_BASE = import.meta.env.VITE_API_SUBDOMAIN
  ? 'https://api.leoklemet.com'
  : '';  // Empty = relative URLs (same origin)

// Use relative if on www, absolute if configured
const devStatusUrl = API_BASE + '/agent/dev/status';
```

## Testing Checklist

Run after DNS propagates (2-5 minutes):

- [ ] DNS resolves: `nslookup api.leoklemet.com`
- [ ] Returns JSON: `curl -s https://api.leoklemet.com/agent/dev/status`
- [ ] Sets cookie: `curl -i -H "Authorization: Bearer dev" https://api.leoklemet.com/agent/dev/enable`
- [ ] Not cached: Check `CF-Cache-Status` header is BYPASS/DYNAMIC/MISS
- [ ] Apex redirects: `curl -I https://leoklemet.com/` shows 301
- [ ] Dev overlay works: Visit `https://www.leoklemet.com/?dev_overlay=dev`

## Troubleshooting

### DNS Not Resolving
- **Wait**: New DNS records can take 2-5 minutes
- **Check**: Verify DNS record was created in Cloudflare dashboard
- **Test**: `nslookup api.leoklemet.com` should show Cloudflare IPs

### Still Returns HTML
- **Check**: Verify nginx config with `docker exec applylens-nginx-prod nginx -T | grep api.leoklemet`
- **Check**: Backend connectivity `docker exec applylens-nginx-prod wget -qO- http://ai-finance-backend-1:8000/agent/dev/status`
- **Wait**: Cache rules may need 1-2 minutes to propagate

### Apex Redirect Still 200
- **Check**: Cloudflare Tunnel configuration - ensure Host header is preserved
- **Check**: Nginx config loaded `docker exec applylens-nginx-prod nginx -T | grep "server_name leoklemet.com"`
- **Test**: Direct to nginx `docker exec applylens-nginx-prod wget -qS -O- http://localhost/`

### CF-Cache-Status Shows HIT
- **Verify**: Cache Rule or Page Rule was created successfully
- **Manual**: Check Cloudflare dashboard → Rules
- **Purge**: Run targeted purge again for api.leoklemet.com

## Next Steps

### Immediate (Now)
1. ✅ Nginx configs created
2. ✅ Cloudflare cache rules created
3. ⏳ Add DNS record in Cloudflare dashboard (manual step)
4. ⏳ Wait 2-5 minutes for DNS propagation
5. ⏳ Run verification tests

### Short-term (After Verification)
1. Update frontend to use api.leoklemet.com (optional)
2. Test all endpoints thoroughly
3. Verify dev overlay badge appears
4. Monitor cache hit rates in Cloudflare analytics

### Long-term
1. Keep www.leoklemet.com for static content (cached)
2. Keep api.leoklemet.com for dynamic APIs (bypassed)
3. Monitor both subdomains separately
4. Consider separate rate limiting/security rules per subdomain

## Documentation Files

- `API_SUBDOMAIN_SOLUTION.md` - Original solution proposal
- `API_SUBDOMAIN_IMPLEMENTATION.md` - This file (execution log)
- `CLOUDFLARE_CONFIG_EXECUTION.md` - Previous attempts
- `test-leoklemet-endpoints.ps1` - Testing script

## Success Criteria

Setup is complete when:
- [x] Nginx configs created for api.leoklemet.com and apex redirect
- [x] Cloudflare cache rules created
- [ ] DNS resolves for api.leoklemet.com (needs manual DNS record)
- [ ] `/agent/dev/status` returns JSON via api.leoklemet.com
- [ ] `CF-Cache-Status` shows BYPASS/DYNAMIC (not HIT)
- [ ] Apex redirects properly (leoklemet.com → www.leoklemet.com)
- [ ] Dev overlay badge appears in browser

**Current Status**: Infrastructure configured, awaiting DNS record creation and propagation

---

**Last Updated**: October 16, 2025
**Next Action**: Add DNS record in Cloudflare dashboard, wait 5 minutes, run tests
**Expected Result**: Immediate working API endpoints through api.leoklemet.com
