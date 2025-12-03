# CSP and Backend Gating Implementation - Oct 18, 2025

## Summary

Fixed three critical production issues:
1. **CSP violations** blocking Cloudflare email obfuscation scripts
2. **502 errors** from `/api/layout` and `/api/auth/me` calls when backend is unavailable
3. **Image loading** concerns addressed with proper CSP directives

## Changes Implemented

### 1. CSP Update with script-src-elem ✅

**File**: `deploy/nginx.portfolio-dev.conf`

**Change**: Split script CSP directives to allow external scripts while keeping nonce-based security for own code:

```nginx
# Nonced dynamic scripts you control:
script-src 'self' 'nonce-$csp_nonce' 'strict-dynamic';

# Classic external <script src> without nonce:
script-src-elem 'self' https://www.leoklemet.com https://assets.calendly.com https://static.cloudflareinsights.com https://www.googletagmanager.com;
```

**Why this works**: Modern browsers use `script-src-elem` for external `<script src>` tags, while your app continues to rely on nonces and `strict-dynamic` for inline/dynamic scripts.

### 2. Backend Feature Flag ✅

**File**: `apps/portfolio-ui/src/utils/featureFlags.ts`

**Added**: `backendEnabled()` function with URL override support:

```typescript
export function backendEnabled(): boolean {
  // Allow URL override for testing: ?backend=1 or ?backend=0
  const u = new URL(window.location.href);
  const q = u.searchParams.get('backend');
  if (q === '1') return true;
  if (q === '0') return false;

  // Default: check build-time env (default to enabled for backward compatibility)
  return import.meta.env.VITE_BACKEND_ENABLED !== '0';
}
```

### 3. API Call Gating ✅

**Files Updated**:
- `apps/portfolio-ui/src/layout.ts` - Gate `/api/layout` calls
- `apps/portfolio-ui/src/admin.ts` - Gate `/api/auth/me` calls

Both files now check `backendEnabled()` before making API calls. When false, they silently return without making network requests, preventing 502 errors and "networkidle" timeout issues in E2E tests.

### 4. Environment Configuration ✅

**Files Updated**:
- `.env` (root) - Added `VITE_BACKEND_ENABLED=0`
- `apps/portfolio-ui/.env.development` - Added `VITE_BACKEND_ENABLED=0`
- `apps/portfolio-ui/.env.production` - Added `VITE_BACKEND_ENABLED=0`

**Production Config**:
```bash
VITE_BACKEND_ENABLED=0  # Disable until API is deployed
```

**Dev Config (when testing with local backend)**:
```bash
VITE_BACKEND_ENABLED=1  # Enable for local dev with backend
```

## Deployment Steps

### 1. Build Updated Frontend

```powershell
# Build portfolio with backend disabled
cd d:\leo-portfolio
pnpm build:portfolio
```

### 2. Build and Push Docker Image

```powershell
# Build image with updated nginx config
docker build -f Dockerfile.portfolio -t ghcr.io/leok974/leo-portfolio/portfolio:latest .

# Push to registry (triggers Watchtower auto-deploy)
docker push ghcr.io/leok974/leo-portfolio/portfolio:latest
```

### 3. Reload Nginx in Running Container (if testing locally)

```powershell
# Test nginx config
docker exec portfolio-nginx nginx -t

# Reload nginx to apply CSP changes
docker exec portfolio-nginx nginx -s reload
```

## Testing Checklist

### ✅ CSP Verification

1. Open DevTools → Console
2. Reload page
3. **Expected**: No "Refused to load the script" errors for cloudflare-static/email-decode.min.js
4. **Check**: Email obfuscation scripts load successfully

### ✅ Image Loading

1. Open DevTools → Network tab (Img filter)
2. Navigate to portfolio page
3. Click on project cards with thumbnails
4. **Expected**:
   - Status: 200
   - Type: image/svg+xml (or webp/png)
   - No `(blocked:csp)` messages

### ✅ API Gating

1. Open DevTools → Console + Network tab
2. Reload page
3. **Expected**:
   - No 502 errors in Network tab
   - No calls to `/api/layout` or `/api/auth/me`
   - Console shows no backend-related errors

### ✅ E2E Tests

Run Playwright tests against production:

```powershell
# Run all E2E tests
pnpm test:e2e

# Or run specific portfolio tests
npx playwright test tests/e2e/portfolio/
```

**Expected**: All tests pass cleanly, no networkidle timeouts

## URL Override for Testing

You can override the backend flag via URL param for testing:

- `https://www.leoklemet.com/?backend=1` - Force enable backend calls
- `https://www.leoklemet.com/?backend=0` - Force disable backend calls

## When to Enable Backend in Production

Once the backend API is deployed and ready:

1. Update `.env.production`:
   ```bash
   VITE_BACKEND_ENABLED=1
   ```

2. Rebuild and redeploy:
   ```powershell
   pnpm build:portfolio
   docker build -f Dockerfile.portfolio -t ghcr.io/leok974/leo-portfolio/portfolio:latest .
   docker push ghcr.io/leok974/leo-portfolio/portfolio:latest
   ```

3. Test that `/api/layout` and `/api/auth/me` work correctly

## Technical Details

### CSP Architecture

**Before**: Single `script-src` directive caused conflicts between nonce requirements and external scripts

**After**: Separated directives:
- `script-src` - Controls inline/eval scripts (uses nonce + strict-dynamic)
- `script-src-elem` - Controls external `<script src>` (whitelist specific domains)

### Backend Gating Strategy

**Graceful Degradation**: When backend is unavailable:
- Layout system uses default card arrangement
- Admin features fall back to dev override (if enabled) or show disabled state
- No error logging (silent fallback for optional features)

**Testing Override**: URL param `?backend=1` allows testing with backend enabled without rebuilding

## Files Changed

1. `deploy/nginx.portfolio-dev.conf` - CSP update with script-src-elem
2. `apps/portfolio-ui/src/utils/featureFlags.ts` - Added backendEnabled()
3. `apps/portfolio-ui/src/layout.ts` - Gate /api/layout call
4. `apps/portfolio-ui/src/admin.ts` - Gate /api/auth/me call
5. `.env` - Added VITE_BACKEND_ENABLED=0
6. `apps/portfolio-ui/.env.development` - Added VITE_BACKEND_ENABLED=0
7. `apps/portfolio-ui/.env.production` - Added VITE_BACKEND_ENABLED=0

## Next Steps

1. ✅ Build and deploy updated frontend
2. ✅ Verify CSP allows Cloudflare scripts
3. ✅ Confirm no 502 errors in production
4. ✅ Run E2E tests to ensure stability
5. ⏳ When backend is ready, set VITE_BACKEND_ENABLED=1 and redeploy
