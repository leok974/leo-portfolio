# Dev Overlay Fix - Deployment Instructions

**Date:** 2025-10-21
**Issue:** Dev overlay showing `allowed: false` in production
**Root Cause:** Missing `DEV_OVERLAY_KEY` in production environment
**Status:** ✅ Backend built and pushed, awaiting production deployment

---

## What Was Fixed

### Backend Configuration
Added to `assistant_api/.env.prod` (commit `d59abc7`):

```bash
# --- Dev Overlay Authentication ---
DEV_OVERLAY_KEY=a61350cef0487532f2814a54499f3baeb8f207ead09bbc0e24472911ce6e0cc9

# --- Admin HMAC Authentication ---
ADMIN_HMAC_KEY=7c9c56ddfd4ebc3058f0e3c31be642af4a8a7a375e120f82da0be9c26539b42e
```

These keys enable:
- **Dev overlay** authentication via `?dev_overlay=dev` URL parameter
- **Admin panel** authentication for hide/unhide projects and Brand tab

---

## Deployment Status

### ✅ CI/CD Complete
- **Workflow:** Run #18692341969
- **Status:** Success ✅
- **Build time:** 12m9s
- **Images pushed:**
  - `ghcr.io/leok974/leo-portfolio/backend:latest`
  - `ghcr.io/leok974/leo-portfolio/backend:main`
  - `ghcr.io/leok974/leo-portfolio/backend:sha-d59abc7`

### ⏳ Production Deployment Pending
Watchtower will automatically pull `:latest` within ~5 minutes, OR you can manually deploy now.

---

## Manual Deployment (Optional)

If you want to deploy immediately instead of waiting for Watchtower:

### Step 1: SSH to production server

```bash
ssh user@your-production-server
cd /path/to/deploy
```

### Step 2: Set Figma token (if using Phase 51)

Create `deploy/.env` file:

```bash
cat > .env << 'EOF'
FIGMA_PAT=figd_YOUR_FIGMA_TOKEN_HERE
EOF
```

Make sure `docker-compose.portfolio-prod.yml` references it:

```yaml
services:
  portfolio-backend:
    env_file:
      - ../assistant_api/.env.prod  # Base config (from git)
      - .env                         # Secrets override (NOT in git)
```

### Step 3: Pull and restart

```bash
# Pull new image
docker compose -f docker-compose.portfolio-prod.yml pull portfolio-backend

# Restart backend
docker compose -f docker-compose.portfolio-prod.yml up -d portfolio-backend

# Check logs
docker compose -f docker-compose.portfolio-prod.yml logs -f portfolio-backend
```

---

## Verification

### 1. Dev Overlay Status Endpoint

```bash
curl -sS https://api.leoklemet.com/api/dev/status \
  -H "x-dev-key: a61350cef0487532f2814a54499f3baeb8f207ead09bbc0e24472911ce6e0cc9" | jq .
```

**Expected response:**
```json
{
  "allowed": true,
  "mode": "token"
}
```

**Before fix:**
```json
{
  "allowed": false,
  "mode": "denied"
}
```

### 2. Frontend Dev Overlay

1. Visit: `https://www.leoklemet.com/?dev_overlay=dev`
2. Look for dev status badge (top-right corner)
3. Should show: **"Dev Overlay: token (allowed)"**
4. Click ⚙️ button → Dev Admin panel should open
5. Should see **Projects** and **Brand** tabs

### 3. Admin Projects Panel

With dev overlay enabled:
- Click ⚙️ button
- Go to **Projects** tab
- Should see list of projects with Hide/Unhide buttons
- Test hiding a project (refresh to verify)

### 4. Brand Tab (Phase 51)

With dev overlay enabled:
- Click ⚙️ button
- Go to **Brand** tab
- Should see "Generate Business Card" button
- Click to test (will fail until Figma template is configured)

---

## Troubleshooting

### Issue: Still shows `allowed: false`

**Possible causes:**
1. Backend not restarted after deployment
2. Old Docker image still running
3. `DEV_OVERLAY_KEY` not in production env

**Fix:**
```bash
# Check which image is running
docker inspect portfolio-backend | jq '.[0].Config.Image'
# Should be: ghcr.io/leok974/leo-portfolio/backend:latest

# Check image digest
docker images ghcr.io/leok974/leo-portfolio/backend:latest
# Compare with GHCR: https://github.com/leok974/leo-portfolio/pkgs/container/leo-portfolio%2Fbackend

# Force restart
docker compose -f docker-compose.portfolio-prod.yml restart portfolio-backend
```

### Issue: "FIGMA_PAT environment variable not set"

This is expected if you haven't created the Figma template yet. To fix:
1. Create `.env` file with `FIGMA_PAT` (see Step 2 above)
2. Restart backend
3. See `docs/FigmaIntegration.md` for full setup

### Issue: CORS errors

If you see CORS errors in browser console:
1. Check `ALLOWED_ORIGINS` in `assistant_api/.env.prod`
2. Should include: `https://www.leoklemet.com`
3. Restart backend after changes

---

## Summary

### ✅ Completed
- Added `DEV_OVERLAY_KEY` to production environment
- Added `ADMIN_HMAC_KEY` to production environment
- Built and pushed Docker image with fix
- Created deployment documentation

### ⏳ Pending
- Watchtower auto-deployment (~5 min) OR manual pull/restart
- Optional: Configure Figma token for Phase 51 Brand tab
- Optional: Create Figma business card template

### 🎯 Expected Outcome
After deployment:
- Dev overlay will show `allowed: true` when accessed with `?dev_overlay=dev`
- Admin panel will be accessible via ⚙️ button
- Projects and Brand tabs will be functional
- No more authentication errors in browser console

---

## Files Changed

**Committed:**
- `assistant_api/.env.prod` - Added dev overlay and admin keys

**Not committed (manual setup):**
- `deploy/.env` - Figma token and other secrets (create manually on server)

**Documentation:**
- `PRODUCTION_ENV_SETUP.md` - General secrets management guide
- `DEV_OVERLAY_FIX.md` - This file (specific fix instructions)

---

## Next Steps

1. **Wait for Watchtower** (~5 min) or manually deploy
2. **Test dev overlay** at `https://www.leoklemet.com/?dev_overlay=dev`
3. **Verify status** shows `allowed: true`
4. **(Optional)** Set up Figma integration for Phase 51

All done! 🎉
