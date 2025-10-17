# SOLUTION: API Subdomain Bypass

**Date**: October 16, 2025
**Issue**: Cloudflare cache for www.leoklemet.com/agent/* is extremely persistent
**Solution**: Create api.leoklemet.com subdomain WITHOUT Cloudflare proxy

## Problem Summary

Despite 24+ hours and multiple approaches:
- ✅ Development Mode enabled
- ✅ Page Rules created (bypass for /agent/*, /chat, /api/*)
- ✅ Cache purged 10+ times
- ✅ Cache-Control headers added to nginx
- ❌ Cloudflare STILL serves cached HTML for /agent/dev/status

**Root Cause**: Cloudflare's distributed edge cache persists across tens of thousands of edge servers globally. Once cached incorrectly, it can take days to fully clear.

## Recommended Solution: API Subdomain

Create a separate subdomain for API endpoints that **bypasses Cloudflare proxy entirely**.

### Advantages
✅ **Immediate** - Works within 5 minutes
✅ **No caching issues** - Direct to origin
✅ **Common pattern** - Many sites use api.domain.com
✅ **Same backend** - No code changes needed
✅ **Proper separation** - Static (CDN) vs Dynamic (direct)

### Implementation Steps

#### Step 1: Add DNS Record in Cloudflare Dashboard

1. Login to https://dash.cloudflare.com
2. Select `leoklemet.com` zone
3. Go to **DNS** → **Records**
4. Click **Add record**
5. Configure:
   - **Type**: `CNAME`
   - **Name**: `api`
   - **Target**: `www.leoklemet.com` (or your origin IP)
   - **Proxy status**: 🔘 **DNS only** (grey cloud) ⚠️ **CRITICAL**
   - **TTL**: Auto
6. Click **Save**

**Why grey cloud?** This bypasses Cloudflare proxy completely - no caching, goes directly to origin.

#### Step 2: Add Nginx Config for api.leoklemet.com

```powershell
$apiConfig = @"
# API subdomain - direct to backend (no static content)
server {
    listen 80;
    server_name api.leoklemet.com;

    # All routes go to backend
    location / {
        proxy_pass http://ai-finance-backend-1:8000;
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;

        # Prevent any caching
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        add_header Pragma "no-cache" always;
    }
}
"@

$apiConfig | docker exec -i applylens-nginx-prod tee /etc/nginx/conf.d/api-leoklemet.com.conf > `$null
docker exec applylens-nginx-prod nginx -t
docker exec applylens-nginx-prod nginx -s reload
```

#### Step 3: Update Backend Environment (Optional)

If you want the backend to know about the API subdomain:

```yaml
# C:\ai-finance-agent-oss-clean\docker-compose.override.yml
services:
  backend:
    environment:
      - COOKIE_DOMAIN=.leoklemet.com
      - COOKIE_SECURE=1
      - COOKIE_SAMESITE=lax
      - SITE_BASE_URL=https://www.leoklemet.com
      - API_BASE_URL=https://api.leoklemet.com  # Add this
```

Restart backend:
```bash
docker restart ai-finance-backend-1
```

#### Step 4: Test Immediately

```powershell
# Should work within 5 minutes of DNS propagation
curl.exe -s https://api.leoklemet.com/agent/dev/status
# Expected: {"enabled":false,"cookie_present":false}

# Check DNS
nslookup api.leoklemet.com
# Should NOT show Cloudflare IPs (104.x.x.x) - shows origin IP instead

# Enable dev overlay
curl.exe -i -H "Authorization: Bearer dev" https://api.leoklemet.com/agent/dev/enable

# In browser (update frontend if needed)
# Visit: https://www.leoklemet.com/?dev_overlay=dev
# Backend calls can use api.leoklemet.com instead
```

### Frontend Changes (If Needed)

If your frontend needs to call the API subdomain:

```typescript
// apps/portfolio-ui/src/config.ts or similar
const API_BASE = import.meta.env.PROD
  ? 'https://api.leoklemet.com'  // Production: use API subdomain
  : 'http://localhost:8000';      // Dev: local backend

export const API_ENDPOINTS = {
  devStatus: `${API_BASE}/agent/dev/status`,
  devEnable: `${API_BASE}/agent/dev/enable`,
  chat: `${API_BASE}/chat`,
  // ...
};
```

**Note**: You may not need frontend changes if the dev overlay already uses relative URLs (e.g., `/agent/dev/status` works from www.leoklemet.com). The API subdomain is just for direct API access.

## Architecture

### Before (Current - Broken)
```
Browser → Cloudflare Edge → Nginx → Backend
          (caches HTML!)
```

### After (Working)
```
# Static content (www.leoklemet.com)
Browser → Cloudflare Edge (CDN) → Nginx → Portfolio UI
          (caches HTML - GOOD)

# Dynamic API (api.leoklemet.com)
Browser → DNS Only (NO proxy) → Nginx → Backend
          (no caching - GOOD)
```

## Alternative: Keep Trying www.leoklemet.com

If you really want to keep using www.leoklemet.com/agent/*, you can:

1. **Wait longer** - Cache may expire in 24-48 hours
2. **Contact Cloudflare support** - Manually clear edge cache (if you have paid plan)
3. **Temporarily disable proxy** - Set www.leoklemet.com to DNS only (grey cloud), wait 5 mins, enable again
4. **Use Workers** - Cloudflare Worker to intercept and force no-cache

But honestly, **the API subdomain is faster and more reliable**.

## Migration Path

1. **Immediate**: Set up api.leoklemet.com for testing (5 minutes)
2. **Test**: Verify all endpoints work via API subdomain
3. **Optional**: Update frontend to use API subdomain
4. **Keep**: Leave www.leoklemet.com/agent/* rules in place (may work eventually)
5. **Monitor**: After a week, test www.leoklemet.com/agent/* again - cache should be cleared by then

## Commands to Run Now

```powershell
# 1. Add DNS record in Cloudflare dashboard (manual step)
#    Type: CNAME, Name: api, Target: www.leoklemet.com, Proxy: OFF (grey cloud)

# 2. Create nginx config
$apiConfig = @"
server {
    listen 80;
    server_name api.leoklemet.com;
    location / {
        proxy_pass http://ai-finance-backend-1:8000;
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
        proxy_http_version 1.1;
        proxy_buffering off;
        add_header Cache-Control "no-store" always;
    }
}
"@
$apiConfig | docker exec -i applylens-nginx-prod tee /etc/nginx/conf.d/api-leoklemet.com.conf > `$null

# 3. Reload nginx
docker exec applylens-nginx-prod nginx -t && docker exec applylens-nginx-prod nginx -s reload

# 4. Wait 5 minutes for DNS, then test
Start-Sleep -Seconds 300
curl.exe -s https://api.leoklemet.com/agent/dev/status
```

## Why This Works

- **No Cloudflare proxy** = No caching layer
- **Direct to origin** = Always fresh content
- **Standard practice** = api.example.com is common for APIs
- **SSL still works** = Cloudflare provides SSL even for DNS-only records
- **Fast** = Works in minutes, not days

## Summary

**Stop fighting Cloudflare's cache** and use the industry-standard pattern:
- `www.leoklemet.com` → Static content (cached by Cloudflare ✅)
- `api.leoklemet.com` → Dynamic API (bypasses Cloudflare ✅)

This is how most production sites are configured anyway!

---

**Action**: Create DNS record (grey cloud) + nginx config
**Time**: 5 minutes to setup, 5 minutes for DNS propagation
**Result**: Immediate working API endpoints
