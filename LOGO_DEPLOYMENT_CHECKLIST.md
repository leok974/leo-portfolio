# Logo Deployment - Final Checklist

## Pre-Deployment Verification ✅

### 1. Path Correctness ✅
```json
// apps/portfolio-ui/public/projects.json
{
  "ledgermind": {
    "thumbnail": "/assets/ledgermind-logo.png"  // ✅ Absolute path
  }
}
```

**Why absolute?** Prevents 404s on nested routes like `/projects/ledgermind`

### 2. CSP Allows Images ✅
```nginx
# deploy/nginx.portfolio-dev.conf (line ~36)
img-src 'self' data: https: blob:;
```

**Verified**: PNG, SVG, WebP, and data URIs all allowed

### 3. Nginx Assets Location ✅
```nginx
# deploy/nginx.portfolio-dev.conf (line ~44)
location ^~ /assets/ {
  root /usr/share/nginx/html;
  try_files $uri =404;
  add_header Cache-Control "public, max-age=31536000, immutable" always;
}
```

**Features**:
- `^~` prefix for precedence over regex
- Immutable cache (1 year)
- Serves from nginx root

### 4. Build Complete ✅
```
✓ 17 modules transformed.
dist-portfolio/index.html                13.20 kB
dist-portfolio/assets/main-c8EXeVpZ.css  13.32 kB
dist-portfolio/assets/main-C40kZGfh.js   31.12 kB
✓ built in 728ms
```

### 5. E2E Test Created ✅
- **File**: `tests/e2e/portfolio/projects.logo.spec.ts`
- **Tests**:
  1. Logo loads successfully on LedgerMind card
  2. No CSP violations
  3. Proper cache headers (immutable, max-age=31536000)

## Deployment Commands

### Build Docker Image
```powershell
cd d:\leo-portfolio

# Build with updated nginx config and logo
docker build -f Dockerfile.portfolio -t ghcr.io/leok974/leo-portfolio/portfolio:latest .
```

### Push to Registry
```powershell
# Push to GitHub Container Registry
docker push ghcr.io/leok974/leo-portfolio/portfolio:latest

# Watchtower will auto-deploy in 5-10 minutes
```

## Production Verification

### 1. Direct Asset Test
```powershell
# Check logo is accessible
curl -sSI https://www.leoklemet.com/assets/ledgermind-logo.png | Select-String "HTTP/|Content-Type|Cache-Control"

# Expected output:
# HTTP/2 200
# content-type: image/png
# cache-control: public, max-age=31536000, immutable
```

### 2. Projects JSON Test
```powershell
# Verify projects.json has absolute path
curl -sS https://www.leoklemet.com/projects.json | ConvertFrom-Json | % ledgermind | % thumbnail

# Expected output:
# /assets/ledgermind-logo.png
```

### 3. Visual Check
1. Open: https://www.leoklemet.com/
2. Find LedgerMind project card
3. **Verify**: Brain+arrows logo displays (not SVG placeholder)
4. **DevTools**:
   - Network tab: `/assets/ledgermind-logo.png` → 200 OK
   - Console: No CSP errors
   - Cache-Control header: `immutable, max-age=31536000`

### 4. Run E2E Tests
```powershell
# Run logo-specific tests
npx playwright test tests/e2e/portfolio/projects.logo.spec.ts

# Run all image tests
npx playwright test tests/e2e/portfolio/projects.images.spec.ts

# Expected: All pass ✅
```

## Cache Purging (Optional)

If logo doesn't update immediately due to Cloudflare cache:

### Option 1: Cloudflare Purge
```powershell
# Via Cloudflare dashboard:
# Cache → Purge Cache → Custom Purge → Enter URL:
https://www.leoklemet.com/assets/ledgermind-logo.png
```

### Option 2: Temporary Cachebuster (Not Recommended)
```json
// Only if needed - adds query param
"thumbnail": "/assets/ledgermind-logo.png?v=2025-10-18"
```

**Note**: With `immutable` cache, browsers should respect the asset. Cloudflare may cache for default TTL, but purge handles this.

## Rollback Plan

If logo doesn't display correctly:

```powershell
# 1. Revert projects.json
cd apps/portfolio-ui/public
# Edit: "thumbnail": "assets/ledgermind-thumb.svg"

# 2. Rebuild
pnpm build:portfolio

# 3. Redeploy
docker build -f Dockerfile.portfolio -t ghcr.io/leok974/leo-portfolio/portfolio:latest .
docker push ghcr.io/leok974/leo-portfolio/portfolio:latest
```

## Success Criteria

- [ ] Logo displays on LedgerMind card
- [ ] `/assets/ledgermind-logo.png` returns HTTP 200
- [ ] Content-Type: `image/png`
- [ ] Cache-Control: `public, max-age=31536000, immutable`
- [ ] No CSP violations in console
- [ ] E2E tests pass
- [ ] Resume still downloads correctly

## Files Changed

1. ✅ `apps/portfolio-ui/public/projects.json` - Absolute path
2. ✅ `deploy/nginx.portfolio-dev.conf` - Assets location with ^~ and immutable cache
3. ✅ `tests/e2e/portfolio/projects.logo.spec.ts` - E2E test
4. ✅ `dist-portfolio/` - Rebuilt with changes

## Timeline

1. **Build**: ~1 minute
2. **Push**: ~2-5 minutes (depending on connection)
3. **Watchtower Deploy**: ~5-10 minutes after push
4. **Total**: ~10-15 minutes to production

## Next Steps

```powershell
# 1. Build Docker image
docker build -f Dockerfile.portfolio -t ghcr.io/leok974/leo-portfolio/portfolio:latest .

# 2. Push to registry
docker push ghcr.io/leok974/leo-portfolio/portfolio:latest

# 3. Wait 5-10 minutes for Watchtower

# 4. Verify in production
curl -sSI https://www.leoklemet.com/assets/ledgermind-logo.png

# 5. Run E2E tests
npx playwright test tests/e2e/portfolio/projects.logo.spec.ts
```

---

**Ready to deploy!** All checks complete, build successful, E2E test in place. 🚀
