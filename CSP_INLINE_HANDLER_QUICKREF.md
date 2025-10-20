# CSP Inline Handler Fix - Quick Reference

## TL;DR
Removed inline `onerror=` handler causing CSP violations. Replaced with `data-fallback` attribute + global error handler.

## What Was Fixed
```typescript
// ❌ Before: CSP violation
<img onerror="this.src='/og/og.png'" />

// ✅ After: CSP-compliant
<img data-fallback="/og/og.png" />
// + global error handler in main.ts
```

## Files Modified
1. **`apps/portfolio-ui/portfolio.ts`** (line 175)
   - Removed: `onerror="..."`
   - Added: `data-fallback="/og/og.png"`

2. **`apps/portfolio-ui/src/main.ts`** (DOMContentLoaded)
   - Added: Global image error handler

## Error Handler Logic
```typescript
document.addEventListener('error', (e) => {
  const target = e.target as HTMLElement;
  if (target.tagName === 'IMG') {
    const img = target as HTMLImageElement;
    const fallback = img.getAttribute('data-fallback');

    if (fallback && img.src !== fallback) {
      img.removeAttribute('data-fallback'); // Prevent loop
      img.src = fallback;
      img.classList.add('img-fallback');
    }
  }
}, true); // Capture phase
```

## Pattern for New Images
```html
<!-- DO: Use data-fallback -->
<img src="/image.png" data-fallback="/fallback.png" />

<!-- DON'T: Use inline handlers -->
<img src="/image.png" onerror="this.src='/fallback.png'" />
```

## Build & Deploy
```powershell
# Build
pnpm run build:portfolio  # 735ms, 31.62 kB

# Docker
docker build -f Dockerfile.portfolio -t ghcr.io/leok974/leo-portfolio/portfolio:latest .
docker push ghcr.io/leok974/leo-portfolio/portfolio:latest

# Deploy
docker stop portfolio-nginx; docker rm portfolio-nginx
docker run -d --name portfolio-nginx -p 59446:80 ghcr.io/leok974/leo-portfolio/portfolio:latest
docker network connect infra_net portfolio-nginx --alias portfolio.int

# Purge CDN
cd deploy; .\cf-cache-purge.ps1
```

## Production Verification
```powershell
# Check HTML has no inline handlers
Invoke-WebRequest https://www.leoklemet.com/ |
  Select-String "onerror="
# (empty = success)

# Check JS bundle has error handler
Invoke-WebRequest https://www.leoklemet.com/assets/main-*.js |
  Select-String "data-fallback"
# ✅ Found
```

## Benefits
| Before | After |
|--------|-------|
| ❌ CSP violations | ✅ CSP compliant |
| ❌ Duplicated code | ✅ Centralized logic |
| ❌ Hard to test | ✅ Easy to test |
| ❌ Inline strings | ✅ Single handler |

## Status
- ✅ Built: `main-Dw4C10DF.js` (31.62 kB)
- ✅ Deployed: `sha256:746d878566f2ffa37d83e549c35a9a16a026dd3d3e0a120b315bcf5dd9c6c5a3`
- ✅ Live: https://www.leoklemet.com/
- ✅ Verified: No CSP violations

## Console Check
Open DevTools → Console:
- ✅ Should see: "Portfolio shell initialized"
- ❌ Should NOT see: "Refused to execute inline event handler"

## Testing Image Fallback
1. Open DevTools Network tab
2. Find project thumbnail request
3. Right-click → Block request
4. Refresh page
5. ✅ Verify fallback to `/og/og.png`

## Related Docs
- `CSP_INLINE_HANDLER_FIX.md` - Full documentation
- `CTA_FOOTER_FIX_COMPLETE.md` - Previous CSP cleanup
- `deploy/nginx.portfolio-dev.conf` - CSP headers

## Next Steps
When adding new images with fallback:
```html
<img src="/path/to/image.png" data-fallback="/path/to/fallback.png" alt="Description" />
```

The global handler will automatically catch errors and apply fallback. No inline handlers needed!
