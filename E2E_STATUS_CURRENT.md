# E2E Fixes - Current Status & Remaining Work

**Date:** October 18, 2025 17:46 UTC
**Branch:** `portfolio-polish`
**Last Commit:** 5c14581

## ✅ Completed

###  1. Chat Dock Tests - App-Ready Marker
- Added `window.__APP_READY__ = true` in `apps/portfolio-ui/src/main.ts`
- Created `e2e/utils.ts` with `waitForAppReady()` helper
- Updated `tests/e2e/portfolio/chat.dock.spec.ts`
- **Status:** ✅ Code complete, ready for CI testing

### 2. Nginx Apex → www Redirect
- Added server block for `leoklemet.com` → `https://www.leoklemet.com`
- **Status:** ✅ Config complete, in Docker image

### 3. Nginx Upstream DNS Resolution
- Fixed "host not found in upstream" error
- Using variable `$upstream_host` for runtime DNS resolution
- **Status:** ✅ Fixed, container now starts successfully

### 4. Cloudflare Cache Purge
- Created `scripts/purge-og-cache.ps1`
- Successfully purged cache for all 7 OG images
- **Status:** ✅ Cache cleared

### 5. Docker Images
- Built 4+ iterations fixing various nginx issues
- Latest: `sha256:30c68f74d9eb...` (fcabf69...)
- Pushed to `ghcr.io/leok974/leo-portfolio/portfolio:latest`
- **Status:** ✅ Images pushed

## ⚠️ Issues Remaining

### OG Images Returning 404 Locally
**Problem:** `/og/*.png` returns 404 from local portfolio-nginx container
**Evidence:**
```
curl -I http://localhost:8080/og/og.png
HTTP/1.1 404 Not Found
Content-Type: text/html
Cache-Control: public, max-age=31536000, immutable  ← Wrong cache (from /assets/)
```

**Files Confirmed Present:**
```bash
docker exec portfolio-nginx ls -lah /usr/share/nginx/html/og/
# All 7 PNG files exist (og.png, applylens.png, etc.)
```

**Current nginx /og/ location:**
```nginx
location /og/ {
  root /usr/share/nginx/html;
  expires 10m;
  add_header Cache-Control "public, max-age=600" always;
  try_files $uri =404;
}
```

**Theories:**
1. **Location precedence issue:** `/assets/` or `/` catching requests first
2. **Root vs alias confusion:** `root` + `/og/` = looking for `/usr/share/nginx/html/og/og/og.png`?
3. **Try_files $uri issue:** Not resolving correctly with location prefix

**Next Debug Steps:**
1. Test with explicit `try_files /og/$uri =404;`
2. Try `alias /usr/share/nginx/html/og/;` instead of `root`
3. Add access logs to see what file nginx is actually trying to open
4. Test regex location with higher precedence: `location ~* ^/og/.+\.png$`

### Production Site Not Accessible
**Problem:** `https://www.leoklemet.com` timing out or returning 502
**Possible Causes:**
1. Cloudflare Tunnel not routing to correct container
2. portfolio-nginx container crashed (was restarting earlier)
3. Network isolation issue (not on infra_net?)

**To Check:**
```powershell
# Container status
docker ps --filter "name=portfolio-nginx"

# Cloudflare tunnel logs
docker logs applylens-cloudflared-prod --tail 50

# Test internal resolution
docker exec applylens-cloudflared-prod nslookup portfolio.int
```

## Commits Made This Session

1. **e26b7c9** - `fix(e2e): deterministic tests + apex redirect + OG cache purge`
   - App-ready marker, nginx config, cache purge script

2. **f51ec06** - `docs: E2E test fixes summary`
   - E2E_FIXES_COMPLETE.md documentation

3. **5c14581** - `fix(nginx): DNS resolution for upstream + cleanup /og/ location`
   - Fixed assistant.ledger-mind.org DNS resolution issue

## Recommended Next Steps

### Immediate (to unblock E2E tests):

**Option A: Fix /og/ location properly**
```nginx
location /og/ {
  alias /usr/share/nginx/html/og/;
  add_header Content-Type image/png;
  add_header Cache-Control "public, max-age=600" always;
}
```

**Option B: Move OG images to /assets/og/**
- Simpler: Let `/assets/` location handle them
- Update Dockerfile to copy to `/assets/og/` instead
- Update meta tags to use `/assets/og/*.png`

### Medium Priority:

1. **Test production deployment:**
   - Verify Cloudflare Tunnel routing
   - Check container health and logs
   - Confirm OG images accessible via tunnel

2. **Run CI pipeline:**
   - Push branch to trigger workflows
   - Check if chat dock tests pass with app-ready marker
   - Monitor E2E test results

### Long Term:

1. Add nginx access/error logging in dev mode
2. Consider serving OG images from CDN or separate service
3. Add E2E test retry logic (`test.retry(2)`)
4. Monitor Watchtower auto-updates

## Files Changed (uncommitted):
- `OG_CACHE_PURGE_GUIDE.md` - Guide for purging Cloudflare cache (new)
- Various test result files

## Current Working State:
- Local portfolio-nginx: Running but OG images 404
- Production: Unknown (not accessible)
- CI: Waiting for push to test
- Cloudflare cache: Purged successfully

---

**Recommendation:** Fix the `/og/` location block using Option A (alias), rebuild, test locally, then push to production and trigger CI.
