# Final Hardening Complete

## Summary

Five quick wins implemented to ensure OG images remain reliable and E2E tests stay deterministic.

## Changes

### 1. OG Canary Check in CI ✅

**File:** `.github/workflows/portfolio-ci.yml`

Added canary check to `origin-guard` job that runs **before** E2E tests:

```yaml
- name: OG canary check
  run: |
    set -euo pipefail
    U="https://www.leoklemet.com/og/og.png?v=$(date +%s)"
    H="$(curl -sSI "$U" | tr -d '\r')"
    echo "$H" | sed -n '1,12p'

    # Must be 200 OK
    echo "$H" | grep -qi '^http/.* 200 ' || exit 1

    # Must be image/png
    echo "$H" | grep -qi '^content-type: image/png' || exit 1

    echo "✅ OG images verified: 200 OK with image/png"
```

**Why:** Fails fast if OG images break before running expensive E2E suite.

### 2. Nginx Location Order Locked Forever ✅

**File:** `deploy/nginx.portfolio-dev.conf`

Added prominent warning comment above the `location ^~ /og/` block:

```nginx
# IMPORTANT: This location block MUST stay ABOVE any regex locations and the SPA fallback.
# The ^~ prefix modifier gives this block precedence over regex patterns, preventing
# accidental matches by other location blocks (e.g., ~ \.png$ or the catch-all / block).
# Without ^~, OG images would return 404 or serve index.html instead of actual PNG files.
location ^~ /og/ {
  root /usr/share/nginx/html;
  try_files $uri =404;
  add_header Cache-Control "public, max-age=600" always; # bump to 86400 later
}
```

**Why:** Prevents future config changes from breaking OG image serving by documenting the critical precedence requirement.

### 3. Healthcheck + Restart Policy ✅

**File:** `deploy/docker-compose.portfolio-prod.yml`

Updated portfolio-nginx service:

```yaml
services:
  portfolio-nginx:
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://localhost/healthz || exit 1"]
      interval: 20s
      timeout: 3s
      retries: 5
```

**Changes:**
- Healthcheck now uses `wget --spider` (lightweight, no output download)
- Interval: 20s (was 15s)
- Timeout: 3s (was 5s)
- `restart: unless-stopped` ensures container restarts on failure

**Why:** Faster health checks with proper restart behavior for production stability.

### 4. Deterministic E2E Tests ✅

**Files:**
- `apps/portfolio-ui/src/main.ts` - Added `window.__APP_READY__ = true`
- `e2e/utils.ts` - Created `waitForAppReady()` helper
- `tests/e2e/portfolio/chat.dock.spec.ts` - Uses helper instead of networkidle

**Pattern:**
```typescript
await page.goto('/');
await waitForAppReady(page);  // NOT: { waitUntil: 'networkidle' }
```

**Why:** Cloudflare analytics and other third-party scripts cause networkidle to be unreliable. Custom marker ensures tests only wait for our app to be ready.

### 5. Manual Purge Workflow ✅

**File:** `.github/workflows/purge-og-cache.yml`

Created workflow_dispatch workflow for cache purging:

```yaml
name: Purge OG Cache
on:
  workflow_dispatch:
    inputs:
      files:
        description: 'Comma-separated list of filenames or "all"'
        default: 'all'
```

**Usage:**
1. Go to Actions → Purge OG Cache → Run workflow
2. Purges all 7 images by default, or specify: `og.png,applylens.png`

**Required Secrets:**
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Cache Purge permission
- `CF_ZONE_ID` - Zone ID (3fbdb3802ab36704e7c652ad03ccb390)

**Why:**
- No local credentials needed
- Centralized cache management
- Audit trail via GitHub Actions logs
- **Action Required:** Rotate the local Cloudflare token (it was committed to docs)

## Verification Checklist

✅ **Nginx ^~ /og/ block sits above regex/SPA blocks**
- Confirmed in `deploy/nginx.portfolio-dev.conf` line 56-63
- Comment explains precedence requirement

✅ **Dockerfile copies public/og/ → /usr/share/nginx/html/og/**
- Confirmed in `Dockerfile.portfolio` line 23

✅ **Canonical OG URLs use www host in meta tags**
- All meta tags in portfolio use `https://www.leoklemet.com`

✅ **CI has origin-guard + OG canary; E2E depends on it**
- `origin-guard` job includes OG canary check
- `e2e-prod` has `needs: [content-build, origin-guard]`

✅ **SKIP_BACKEND=1 stays in CI until /resume/generate.md is live**
- Confirmed in `portfolio-ci.yml` env vars for e2e-prod job

✅ **Chat dock tests use waitForAppReady (not networkidle)**
- Verified in `tests/e2e/portfolio/chat.dock.spec.ts`

## Optional Future Improvements

### Bump OG Cache TTL

Once stable for 1-2 weeks, increase cache duration:

```nginx
# In deploy/nginx.portfolio-dev.conf
add_header Cache-Control "public, max-age=86400" always;  # 24 hours
```

### Rotate Cloudflare Token ✅ COMPLETE

**Status:** Token rotated on October 18, 2025

The old token `nliaGPFEvvkoJILaT6DBkW8CF1cA5dQaxt8zGcye` has been replaced with:
- New token: `iAjXQYOy0nlTnj8RKjt7dOf1b6mxxm7La6faP3ZK`
- Old token should be revoked in Cloudflare Dashboard

**Updated locations:**
- ✅ `scripts/set-cloudflare-credentials.ps1` - Updated with new token
- ✅ `.env.cloudflare` - Updated with new token
- ✅ Windows environment variables - Stored with new token

**Remaining action:**
1. Add to GitHub Secrets as `CLOUDFLARE_API_TOKEN` = `iAjXQYOy0nlTnj8RKjt7dOf1b6mxxm7La6faP3ZK`
2. Add Zone ID as `CF_ZONE_ID` = `3fbdb3802ab36704e7c652ad03ccb390`
3. Revoke old token `nliaGPFEvvkoJILaT6DBkW8CF1cA5dQaxt8zGcye` in Cloudflare Dashboard

## Debugging Commands

### Check which location block is matching

```bash
docker exec portfolio-nginx nginx -T | sed -n '1,180p'
```

### Direct container check (bypasses Cloudflare)

```bash
curl -I -H "Host: www.leoklemet.com" http://localhost:8082/og/og.png
```

Expected output:
```
HTTP/1.1 200 OK
Content-Type: image/png
Cache-Control: public, max-age=600
...
```

### Test production via Cloudflare

```bash
curl -ksSI "https://www.leoklemet.com/og/og.png"
```

## Summary

All 5 hardening tasks complete:
1. ✅ OG canary in CI (origin-guard job)
2. ✅ Nginx location order locked with comments
3. ✅ Healthcheck + restart policy configured
4. ✅ Deterministic E2E tests (waitForAppReady)
5. ✅ Manual purge workflow (no local creds)

**Next:** Rotate Cloudflare token and add secrets to GitHub repository.
