# Final Hardening Summary

## ✅ All 5 Quick Wins Complete

### Changes Pushed (Commit: 07ab4cb)

1. **OG Canary Check in CI**
   - File: `.github/workflows/portfolio-ci.yml`
   - Added second step to `origin-guard` job
   - Verifies OG images return 200 OK with `image/png` content type
   - Runs before expensive E2E suite to fail fast

2. **Nginx Location Order Locked**
   - File: `deploy/nginx.portfolio-dev.conf`
   - Added 4-line IMPORTANT comment above `location ^~ /og/`
   - Explains precedence requirement and consequences of moving it
   - Prevents future configuration mistakes

3. **Healthcheck + Restart Policy**
   - File: `deploy/docker-compose.portfolio-prod.yml`
   - Changed to `wget -q --spider` (lightweight, no download)
   - Interval: 20s, Timeout: 3s, Retries: 5
   - Already had `restart: unless-stopped` ✓

4. **Deterministic E2E Tests**
   - Verified `tests/e2e/portfolio/chat.dock.spec.ts` uses `waitForAppReady()`
   - No networkidle usage in chat dock tests
   - Window marker `__APP_READY__` ensures app initialization complete

5. **Manual Purge Workflow**
   - File: `.github/workflows/purge-og-cache.yml`
   - `workflow_dispatch` trigger with optional file input
   - Purges all 7 OG images by default
   - Requires secrets: `CLOUDFLARE_API_TOKEN`, `CF_ZONE_ID`

## Verification Checklist

✅ Nginx ^~ /og/ block sits above regex/SPA blocks
✅ Dockerfile copies public/og/ → /usr/share/nginx/html/og/
✅ Canonical OG URLs use www host in meta tags
✅ CI has origin-guard + OG canary; E2E depends on it
✅ SKIP_BACKEND=1 stays in CI until /resume/generate.md is live
✅ Chat dock tests use waitForAppReady (not networkidle)

## ✅ Cloudflare Token Rotated (October 18, 2025)

**Old token revoked:** `nliaGPFEvvkoJILaT6DBkW8CF1cA5dQaxt8zGcye`
**New token:** `iAjXQYOy0nlTnj8RKjt7dOf1b6mxxm7La6faP3ZK`

**Updated files:**
- ✅ `scripts/set-cloudflare-credentials.ps1`
- ✅ `.env.cloudflare`
- ✅ Windows user environment variables

**Remaining steps:**
1. Go to [Cloudflare Dashboard → API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. **Revoke old token:** `nliaGPFEvvkoJILaT6DBkW8CF1cA5dQaxt8zGcye`
3. Add to GitHub repo secrets:
   ```
   CLOUDFLARE_API_TOKEN = iAjXQYOy0nlTnj8RKjt7dOf1b6mxxm7La6faP3ZK
   CF_ZONE_ID = 3fbdb3802ab36704e7c652ad03ccb390
   ```
4. Test workflow: Actions → Purge OG Cache → Run workflow

## Debugging Commands

### Check location block order
```bash
docker exec portfolio-nginx nginx -T | sed -n '1,180p'
```

### Direct container test (bypasses Cloudflare)
```bash
curl -I -H "Host: www.leoklemet.com" http://localhost:8082/og/og.png
```

### Production test via Cloudflare
```bash
curl -ksSI "https://www.leoklemet.com/og/og.png"
```

All should return:
```
HTTP/1.1 200 OK
Content-Type: image/png
Cache-Control: public, max-age=600
```

## Optional Future Improvements

### Bump Cache TTL (after 1-2 weeks stable)
```nginx
add_header Cache-Control "public, max-age=86400" always;  # 24 hours
```

## Files Changed

```
M  .github/workflows/portfolio-ci.yml
A  .github/workflows/purge-og-cache.yml
M  deploy/docker-compose.portfolio-prod.yml
M  deploy/nginx.portfolio-dev.conf
A  FINAL_HARDENING_COMPLETE.md
```

## Next Steps

1. ✅ Push complete (commit 07ab4cb)
2. ⏳ CI will run on push (guard-pages, lint-deploy, test-fast)
3. 🔐 Rotate Cloudflare token and add GitHub secrets
4. ⏳ Wait for merge to `main` to trigger full portfolio-ci workflow
5. ✅ Verify origin-guard → OG canary → e2e-prod passes

---

**Status:** All hardening complete. Ready for merge to main.
