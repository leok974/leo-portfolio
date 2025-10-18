# E2E Test Fixes - Complete Summary

**Date:** October 18, 2025
**Branch:** `portfolio-polish`
**Commit:** e26b7c9

## Objective
Fix all flaky E2E test failures to achieve 100% passing rate in CI.

## Problems Fixed

### 1. ✅ Chat Dock Tests - Flaky networkidle Timeouts
**Issue:** Chat dock tests failed 2/3 times with `waitUntil: 'networkidle'` timeouts.

**Root Cause:** `networkidle` waits for network to be idle for 500ms, but Cloudflare analytics scripts can trigger late requests causing unpredictable timing.

**Solution:**
- Added `window.__APP_READY__ = true` in `apps/portfolio-ui/src/main.ts` after app mount
- Created `e2e/utils.ts` with `waitForAppReady(page)` helper function
- Updated `tests/e2e/portfolio/chat.dock.spec.ts` to replace all networkidle waits

**Code Changes:**
```typescript
// apps/portfolio-ui/src/main.ts (added at end)
window.__APP_READY__ = true;

// e2e/utils.ts (new file)
export async function waitForAppReady(page: Page, timeout = 10_000) {
  await page.waitForFunction(() => (window as any).__APP_READY__ === true, { timeout });
  await expect(page.getByTestId('chat-dock')).toBeVisible({ timeout: 5_000 });
}

// tests/e2e/portfolio/chat.dock.spec.ts (updated)
await page.goto(HOME);
await waitForAppReady(page);  // instead of { waitUntil: 'networkidle' }
```

### 2. ✅ OG Image Tests - Cached 404 Responses
**Issue:** OG image tests failed because Cloudflare cached old 404 responses before images existed.

**Root Cause:** When images were first added, Cloudflare cached the 404 for 1 day before nginx served the files.

**Solutions:**
1. **Apex → www Redirect:** Added Nginx server block to canonicalize URLs
   ```nginx
   server {
     listen 80;
     server_name leoklemet.com;
     return 301 https://www.leoklemet.com$request_uri;
   }
   ```

2. **Reduced Cache TTL:** Changed `/og/` location block from 1 day to 10 minutes during rollout
   ```nginx
   location /og/ {
     expires 10m;
     add_header Cache-Control "public, max-age=600" always;
   }
   ```

3. **Cache Purge Script:** Created `scripts/purge-og-cache.ps1` to manually clear stale responses
   ```powershell
   # Usage (after setting env vars):
   $env:CLOUDFLARE_API_TOKEN = "your-token"
   $env:CF_ZONE_ID = "your-zone-id"
   .\scripts\purge-og-cache.ps1
   ```

**Verification:**
- OG meta tags already used `https://www.leoklemet.com/` (no changes needed)
- Image files exist in `dist-portfolio/og/` (7 images)
- Nginx config serves them with correct Content-Type: image/png

### 3. ✅ Resume Backend Tests - Expected 404 Marked as Failures
**Issue:** Resume endpoint tests fail because backend not deployed yet.

**Status:** Already handled correctly:
- `tests/e2e/portfolio/resume.spec.ts` has `test.skip(process.env.SKIP_BACKEND === '1', ...)`
- `.github/workflows/portfolio-ci.yml` sets `SKIP_BACKEND: "1"` in e2e-prod job
- Tests gracefully skipped in CI ✅

## Files Modified

### Frontend App
- `apps/portfolio-ui/src/main.ts` - Added `window.__APP_READY__` marker

### Nginx Config
- `deploy/nginx.portfolio-dev.conf` - Added apex redirect + reduced /og/ cache TTL

### Tests
- `e2e/utils.ts` - NEW: `waitForAppReady()` helper
- `tests/e2e/portfolio/chat.dock.spec.ts` - Replace networkidle with waitForAppReady

### Scripts
- `scripts/purge-og-cache.ps1` - NEW: Cloudflare cache purge utility

### Build Output
- `dist-portfolio/` - Rebuilt with __APP_READY__ flag
- `dist-portfolio/og/*.png` - 7 OG images now included

## Docker Deployment

**Image:** `ghcr.io/leok974/leo-portfolio/portfolio:latest`
**Pushed:** October 18, 2025
**Digest:** `sha256:9fe731ce1458d4d5a65fd4a1e541e4d76e2b3ec60184b67a23072aac2eed5cd7`

### What's in the Image:
1. ✅ Apex → www redirect in nginx config
2. ✅ Reduced /og/ cache TTL (10 min)
3. ✅ window.__APP_READY__ flag in JS bundle
4. ✅ All 7 OG images in /usr/share/nginx/html/og/

### Auto-Update Timeline:
- **Push completed:** ~5 minutes ago
- **Watchtower checks:** Every 5 minutes
- **Expected update:** Within 5-10 minutes of image push
- **Verify:** `docker logs portfolio-nginx` should show restart

## Next Steps

### 1. Verify Production Update
```powershell
# Check if Watchtower pulled new image
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"

# Verify nginx config loaded
docker exec portfolio-nginx nginx -t

# Test apex redirect
curl -I http://leoklemet.com

# Test www works
curl -I https://www.leoklemet.com
```

### 2. Purge Cloudflare Cache (if OG tests still fail)
```powershell
# Set credentials (get from Cloudflare dashboard)
$env:CLOUDFLARE_API_TOKEN = "..."
$env:CF_ZONE_ID = "..."

# Run purge script
.\scripts\purge-og-cache.ps1

# Verify images load
curl -I https://www.leoklemet.com/og/og.png
```

### 3. Push Branch to Trigger CI
```powershell
git push origin portfolio-polish
```

**Expected CI Results:**
- ✅ guard-pages: PASS (GitHub Pages disabled)
- ✅ content-build: PASS (projects sync + OG gen + Docker build)
- ✅ origin-guard: PASS (Cloudflare + Nginx headers verified)
- ✅ e2e-prod: PASS (18/18 tests, no networkidle timeouts)

### 4. Monitor E2E Test Results
Once CI completes, check:
- Chat dock tests: Should pass without timeouts
- OG image tests: Should pass (www canonical + cache purged)
- Resume tests: Skipped (SKIP_BACKEND=1)
- Layout gating: Should pass (already working)

## Success Criteria

- [ ] CI e2e-prod job shows 18/18 passing (100%)
- [ ] No networkidle timeout errors
- [ ] No OG image 404 errors
- [ ] All tests complete in <60s total
- [ ] Watchtower updated production container
- [ ] www.leoklemet.com returns x-config: portfolio-dev-v1
- [ ] leoklemet.com redirects to www (301)

## Rollback Plan (if needed)

If E2E tests still fail:
1. Check Watchtower logs: `docker logs watchtower`
2. Manually restart container: `docker restart portfolio-nginx`
3. Verify image digest: `docker inspect portfolio-nginx | grep -i image`
4. If nginx config broken: Revert nginx.portfolio-dev.conf and rebuild

## Notes

### Why This Approach Works
1. **Deterministic waits:** App-ready flag is explicit, not guessing network state
2. **Canonical URLs:** Single authoritative domain prevents cache confusion
3. **Short cache:** 10-min TTL allows quick recovery from stale responses
4. **Manual purge:** Script gives immediate control when needed

### Future Improvements
Consider adding:
- E2E retry logic (Playwright `test.retry(2)`)
- Cache-busting query params for OG images in tests
- Health check endpoint that returns __APP_READY__ status
- Automated cache purge in CI after deploy

---

**Status:** ✅ All fixes committed and pushed to GHCR
**Next Action:** `git push origin portfolio-polish` to trigger CI
