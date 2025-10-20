# Quick Deployment Commands - CSP & Backend Gating

## Immediate Deployment (Production Fix)

```powershell
# 1. Build portfolio frontend
cd d:\leo-portfolio
pnpm build:portfolio

# 2. Build Docker image with updated nginx config
docker build -f Dockerfile.portfolio -t ghcr.io/leok974/leo-portfolio/portfolio:latest .

# 3. Push to registry (Watchtower auto-deploys within 5-10 min)
docker push ghcr.io/leok974/leo-portfolio/portfolio:latest
```

## Local Testing (Before Pushing)

```powershell
# Run local portfolio container
docker run --rm -p 8090:80 ghcr.io/leok974/leo-portfolio/portfolio:latest

# Test in browser
# http://localhost:8090

# Check CSP in DevTools:
# - Console: No "Refused to load script" errors
# - Network (Img): All images load (200 status)
# - Network (XHR): No 502 errors, no /api/layout or /api/auth/me calls
```

## Test with Backend Enabled (Dev)

```powershell
# Override via URL param (no rebuild needed)
# https://www.leoklemet.com/?backend=1

# Or update .env.production and rebuild
# VITE_BACKEND_ENABLED=1
pnpm build:portfolio
docker build -f Dockerfile.portfolio -t ghcr.io/leok974/leo-portfolio/portfolio:test .
docker run --rm -p 8090:80 ghcr.io/leok974/leo-portfolio/portfolio:test
```

## Verify Deployment

```powershell
# Check container logs
docker logs portfolio-nginx

# Test nginx config
docker exec portfolio-nginx nginx -t

# Reload nginx (if needed - not required for new container)
docker exec portfolio-nginx nginx -s reload
```

## E2E Testing

```powershell
# Run all E2E tests
pnpm test:e2e

# Run specific portfolio image tests
npx playwright test tests/e2e/portfolio/projects.images.spec.ts

# Run with UI for debugging
npx playwright test --ui
```

## Rollback (If Needed)

```powershell
# Pull previous image version
docker pull ghcr.io/leok974/leo-portfolio/portfolio:previous-tag

# Or rebuild from previous commit
git checkout <previous-commit-sha>
pnpm build:portfolio
docker build -f Dockerfile.portfolio -t ghcr.io/leok974/leo-portfolio/portfolio:latest .
docker push ghcr.io/leok974/leo-portfolio/portfolio:latest
```

## Quick Verification URLs

- **Production**: https://www.leoklemet.com/
- **With Backend Enabled**: https://www.leoklemet.com/?backend=1
- **With Backend Disabled**: https://www.leoklemet.com/?backend=0
- **DevTools Checks**:
  - Console: `(window as any).__APP_READY__` should be `true`
  - Network: Filter by "Fetch/XHR" - should see no 502s
  - Console: No CSP violations

## Environment Variables Reference

### Production (.env.production)
```bash
VITE_BACKEND_ENABLED=0          # Disable backend calls
VITE_LAYOUT_ENABLED=1           # Enable layout system (but gated by backend flag)
VITE_ALLOW_DEV_ADMIN=0          # Require real auth
```

### Development (.env.development)
```bash
VITE_BACKEND_ENABLED=0          # Disable by default (enable when testing locally)
VITE_LAYOUT_ENABLED=0           # Disable layout in dev
VITE_ALLOW_DEV_ADMIN=1          # Allow ?admin=1 override
```

## Next Steps After Backend Deployment

When backend API is live:

```powershell
# 1. Update .env.production
# Set VITE_BACKEND_ENABLED=1

# 2. Rebuild and deploy
pnpm build:portfolio
docker build -f Dockerfile.portfolio -t ghcr.io/leok974/leo-portfolio/portfolio:latest .
docker push ghcr.io/leok974/leo-portfolio/portfolio:latest

# 3. Verify backend calls work
# Check Network tab for successful /api/layout and /api/auth/me calls
```
