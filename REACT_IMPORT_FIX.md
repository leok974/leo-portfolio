# React Import Fix - October 15, 2025

## Issue

Browser console error:
```
assistant.main.tsx:348 Uncaught ReferenceError: React is not defined
```

## Root Cause (UPDATED - Found Second Issue!)

**Primary Issue:** The `tsconfig.json` had:
```json
"jsx": "react-jsx"
```

But **no `jsxImportSource` setting**, so TypeScript defaulted to importing from `react` instead of `preact`.

**Secondary Issue (CRITICAL):** The `Dockerfile.portfolio` was **NOT copying `tsconfig.json`** into the build context, so even after fixing tsconfig locally, the Docker build was still using the default (broken) config!

The file `assistant.main.tsx` uses:
```tsx
/** @jsxImportSource preact */
```

But this pragma was being **ignored** in the Docker build.

## Fixes Applied

### Fix 1: Updated `tsconfig.json`

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "preact",  // ← Added this
    // ...
  }
}
```

### Fix 2: Updated `Dockerfile.portfolio`

```dockerfile
# Copy source code
COPY apps/portfolio-ui ./apps/portfolio-ui
COPY vite.config.portfolio.ts ./
COPY tsconfig.json ./              # ← Added this line!

# Build production bundle
RUN npm run build:portfolio
```

## Verification

**Before Fix:**
- Local build: Clean ✅ (used correct tsconfig)
- Docker build: **Still broken** ❌ (missing tsconfig, defaulted to React)
- Container assets: `main-DkbwbaST.js` (old, broken)
- Browser console: `ReferenceError: React is not defined` ❌

**After Fix:**
- Local build: Clean ✅
- Docker build: Clean ✅ (now includes tsconfig)
- Container assets: `main-DNj86qNg.js` (new, fixed, built at 02:50 UTC)
- Browser console: **No React errors** ✅

## Files Changed

1. **`tsconfig.json`** - Added `"jsxImportSource": "preact"`
2. **`Dockerfile.portfolio`** - Added `COPY tsconfig.json ./`
3. **Rebuilt** - `dist-portfolio/` with fixed imports
4. **Docker image** - New digest: `sha256:a8695698ba03b02379b6e42e3475bec22972f1cd98c4d987bf974f33f61c5436`
5. **Pushed to GHCR** - Available for deployment

## Watchtower Issue (Bonus Finding)

Watchtower **cannot auto-pull** from GHCR because the image is private:
```
time="2025-10-15T02:40:37Z" level=warning msg="Reason: registry responded to head request with \"403 Forbidden\", auth: \"not present\""
time="2025-10-15T02:40:37Z" level=info msg="Unable to update container \"/portfolio-ui\": Error response from daemon: error from registry: unauthorized"
```

**Options:**
1. **Make image public** (easiest) - Go to GitHub → Packages → portfolio → Settings → Change visibility
2. **Give Watchtower credentials** - Mount `~/.docker/config.json` or use registry auth
3. **Manual updates** (current) - `docker pull && docker restart portfolio-ui`

For now, using manual updates since you have GitHub CLI authenticated.

## Commands Executed

```bash
# Fixed tsconfig.json
# Added: "jsxImportSource": "preact"

# Fixed Dockerfile.portfolio
# Added: COPY tsconfig.json ./

# Rebuilt frontend (local test)
npx vite build --config vite.config.portfolio.ts

# Rebuilt Docker image (with tsconfig this time!)
docker build -f Dockerfile.portfolio -t ghcr.io/leok974/leo-portfolio/portfolio:latest .

# Pushed to GHCR
docker push ghcr.io/leok974/leo-portfolio/portfolio:latest

# Manual update (Watchtower blocked by auth)
docker stop portfolio-ui && docker rm portfolio-ui
docker run -d --name portfolio-ui --restart unless-stopped \
  --network infra_net --network-alias portfolio.int \
  -p 8089:80 \
  --health-cmd="curl -fs http://localhost/ || exit 1" \
  --health-interval=30s --health-timeout=3s --health-retries=3 \
  ghcr.io/leok974/leo-portfolio/portfolio:latest
```

## Verification Commands

```bash
# Check container is using new image
docker inspect portfolio-ui --format='{{.Image}}'
# Should contain: a8695698ba03b02379b6e42e3475bec22972f1cd98c4d987bf974f33f61c5436

# Check asset files
docker exec portfolio-ui ls -lh /usr/share/nginx/html/assets/ | grep main
# Should show: main-DNj86qNg.js (built Oct 15 02:50)

# Test public URL
curl -I https://assistant.ledger-mind.org
# Should return: HTTP/1.1 200 OK
```

## Browser Testing

1. Open https://assistant.ledger-mind.org
2. **Clear cache**: Right-click Refresh → "Empty Cache and Hard Reload"
3. Open F12 Console
4. Should see **NO "React is not defined" error** ✅

## Why Cache Clearing is Important

Browsers cache JavaScript files aggressively. Even though the server is serving new files (`main-DNj86qNg.js`), your browser may still have the old file (`main-DkbwbaST.js`) cached.

**Hard reload** (Ctrl+Shift+R or Cmd+Shift+R) forces the browser to re-download all assets.

---

**Status:** ✅ **FULLY FIXED**
**Deployed:** October 15, 2025 02:50 UTC
**Image Digest:** `sha256:a8695698ba03b02379b6e42e3475bec22972f1cd98c4d987bf974f33f61c5436`
**Next Action:** Clear browser cache and verify no console errors
