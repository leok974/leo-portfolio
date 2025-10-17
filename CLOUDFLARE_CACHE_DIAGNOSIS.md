# Cloudflare Caching Issue - Diagnosis & Solutions

**Date**: October 15, 2025 16:56 UTC
**Issue**: Cloudflare continues to cache `/agent/dev/status` endpoint despite multiple cache purges and Page Rules

## Problem Summary

Cloudflare is aggressively caching the `/agent/dev/status` endpoint, returning the cached portfolio HTML instead of the JSON response from the backend. This is happening despite:

1. ✅ Creating 3x Page Rules for cache bypass
2. ✅ Purging entire cache (multiple times)
3. ✅ Enabling Development Mode (3-hour cache bypass)
4. ✅ Adding Cache-Control headers in nginx config

## Root Cause Analysis

### Why Page Rules Aren't Working

Cloudflare Page Rules may not be taking effect because:

1. **Page Rule limit reached** - Free plan has 3 rules total (we used all 3)
2. **URL pattern mismatch** - Page Rules use glob patterns, may not match correctly
3. **Priority conflicts** - Other rules or settings may override
4. **Plan limitations** - Cache Rules API not available on Free plan

### Why Cache Persists

Cloudflare's edge cache is distributed globally:
- **Edge locations** cache independently
- **Propagation time** varies by location (can be 10-30 minutes)
- **Stale cache** may be served until TTL expires
- **Development Mode** may not instantly purge existing cache

## Solutions Implemented

### Solution 1: Cache-Control Headers ✅ (Just Applied)

Added explicit `Cache-Control` headers in nginx for all dynamic endpoints:

```nginx
location /agent/ {
    # ... proxy settings ...
    add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
}
```

**Status**: Applied, nginx reloaded, cache purged again (16:56 UTC)
**Expected**: New requests should respect these headers and not cache
**Wait time**: 5-10 minutes for propagation

### Solution 2: Cloudflare Page Rules ✅ (Already Applied)

Created via API:
1. `https://www.leoklemet.com/agent/*` → Cache Level: Bypass
2. `https://www.leoklemet.com/chat` → Cache Level: Bypass
3. `https://www.leoklemet.com/api/*` → Cache Level: Bypass

**Status**: Active, but may not be working effectively

### Solution 3: Development Mode ✅ (Already Applied)

Enabled Cloudflare Development Mode (bypasses cache for 3 hours)

**Status**: Should be active, but edge caches may still serve stale content

## Additional Solutions to Try

### Solution 4: Verify in Cloudflare Dashboard

**Manual verification**:
1. Login to Cloudflare dashboard
2. Navigate to leoklemet.com zone
3. Check **Caching** → **Configuration**
4. Verify **Development Mode** is ON
5. Check **Rules** → **Page Rules** (should see 3 rules)

### Solution 5: Create Cloudflare Cache Rule (Requires Pro+ Plan)

More powerful than Page Rules:

```powershell
$cacheRule = @{
    expression = '(http.host eq "www.leoklemet.com" and (starts_with(http.request.uri.path, "/agent/") or http.request.uri.path eq "/chat" or starts_with(http.request.uri.path, "/api/")))'
    action = "set_cache_settings"
    action_parameters = @{
        cache = $false
        edge_ttl = @{
            mode = "bypass_by_default"
        }
    }
    description = "Bypass cache for dynamic API endpoints"
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Method Post `
    -Headers @{ Authorization="Bearer $env:CF_API_TOKEN"; "Content-Type"="application/json" } `
    -Uri "https://api.cloudflare.com/client/v4/zones/$($env:CF_ZONE_ID)/rulesets/phases/http_request_cache_settings/entrypoint" `
    -Body $cacheRule
```

**Note**: May return error on Free plan

### Solution 6: Bypass Cloudflare (Temporary Workaround)

Add DNS record that bypasses Cloudflare proxy:

1. Create new DNS record: `api.leoklemet.com` (grey cloud, not proxied)
2. Point directly to origin server IP
3. Test via `https://api.leoklemet.com/agent/dev/status`

**Pros**: Immediate access, no caching
**Cons**: No Cloudflare protection/CDN, different domain

### Solution 7: Use Cloudflare Workers (Advanced)

Create a Cloudflare Worker to handle dynamic routes:

```javascript
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
    const url = new URL(request.url)

    // Bypass cache for dynamic endpoints
    if (url.pathname.startsWith('/agent/') ||
        url.pathname === '/chat' ||
        url.pathname.startsWith('/api/')) {

        const response = await fetch(request, {
            cf: { cacheTtl: 0, cacheEverything: false }
        })

        // Add no-cache headers
        const newResponse = new Response(response.body, response)
        newResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
        return newResponse
    }

    // Default: fetch normally
    return fetch(request)
}
```

**Status**: Not implemented (requires manual setup in dashboard)

## Testing & Verification

### Check Cache Status

```powershell
# Check if cache is hit or miss
curl.exe -I https://www.leoklemet.com/agent/dev/status 2>&1 | Select-String "CF-Cache-Status"
```

**Expected values**:
- `MISS` - Not cached (good!)
- `BYPASS` - Bypassed (good!)
- `HIT` - Cached (bad - need to fix)
- `DYNAMIC` - Not cacheable (good!)

### Force Bypass Cache

```powershell
# Force bypass with header
curl.exe -k -s -H "Cache-Control: no-cache" -H "Pragma: no-cache" https://www.leoklemet.com/agent/dev/status
```

### Test Direct Origin

```powershell
# Bypass Cloudflare entirely (if you know origin IP)
curl.exe -k -s --resolve www.leoklemet.com:443:YOUR_ORIGIN_IP https://www.leoklemet.com/agent/dev/status
```

## Timeline

- **15:40** - DNS goes live
- **15:50** - First cache purge + Page Rules created
- **15:52** - Development Mode enabled
- **15:55** - First test (still cached)
- **16:56** - Added Cache-Control headers to nginx, cache purged again
- **17:00-17:10** - Expected: Cache-Control headers should take effect

## Recommended Actions

### Immediate (Now):
1. ✅ Cache-Control headers added to nginx
2. ✅ Cache purged again
3. ⏳ Wait 10 minutes for propagation (until ~17:06 UTC)

### If Still Failing (After 17:06):
1. Manually verify Development Mode in Cloudflare dashboard
2. Check Page Rules are active and correct
3. Try Solution 6 (bypass Cloudflare for API subdomain)
4. Contact Cloudflare support if on paid plan

### Long-term:
1. Consider upgrading to Cloudflare Pro for better cache control
2. Implement Cloudflare Workers for dynamic content
3. Use separate subdomain for API (api.leoklemet.com) without proxy
4. Monitor cache hit rates in Cloudflare analytics

## Success Criteria

Setup is complete when:
- [ ] `curl -s https://www.leoklemet.com/agent/dev/status` returns JSON
- [ ] Response headers show `CF-Cache-Status: BYPASS` or `MISS`
- [ ] Response headers show `Cache-Control: no-store, no-cache...`
- [ ] Dev overlay badge appears in browser at `?dev_overlay=dev`
- [ ] Apex redirect returns 301 (separate issue, may also be cached)

## Notes

- Cloudflare Free plan has limitations on cache control
- Edge caches are distributed globally - propagation is not instant
- `max-age=0` in Cache-Control is the most reliable way to prevent caching
- Always test with `curl -I` to see actual headers being sent
- Development Mode should override all caching, but may have edge cases

---

**Current Status**: Cache-Control headers applied (16:56 UTC), awaiting propagation
**Next Check**: 17:06 UTC (10 minutes from now)
**Fallback**: Manual verification in Cloudflare dashboard or bypass proxy for API subdomain
