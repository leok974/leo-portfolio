# Deployment Monitor - Calendly & Chat Panel Fixes

**Pushed**: October 17, 2025
**Commit**: df72ddb
**Branch**: main

---

## What's Being Deployed

### 1. Calendly Responsive Fix
- Eliminates horizontal scroll on mobile
- Overrides Calendly's min-width constraint
- Responsive height adjustment

### 2. Collapsible Chat Panel
- Replaced "Hide" with Collapse/Expand
- Always-visible slim tab when collapsed
- Keyboard shortcuts: C to toggle, Escape to collapse
- State persistence via localStorage

**New Build Hash**: `main-CkKHyrR7.js`

---

## Deployment Pipeline

### 1. GitHub Actions (2-3 minutes)
**Monitor**: https://github.com/leok974/leo-portfolio/actions

**Steps**:
- ✅ Checkout code
- ⏳ Build Docker image
- ⏳ Push to ghcr.io

### 2. Watchtower Auto-Update (1 minute after image push)
**Monitor on production server**:
```powershell
docker logs -f watchtower
```

**Expected logs**:
```
Found new image ghcr.io/leok974/leo-portfolio/portfolio:latest
Stopping /portfolio-ui
Starting /portfolio-ui with new image
```

### 3. Verification (~5 minutes total)
```powershell
# Check container updated
docker ps | Select-String portfolio-ui

# Check new hash in container
docker exec portfolio-ui cat /usr/share/nginx/html/index.html | Select-String 'main-\w+\.js'
# Should show: main-CkKHyrR7.js

# Test live site (after Cloudflare cache clears)
curl.exe -s https://www.leoklemet.com/ | Select-String 'main-\w+\.js'
```

---

## Testing Checklist

### Calendly Fix
- [ ] Visit https://www.leoklemet.com/#contact
- [ ] Resize browser to mobile width (< 480px)
- [ ] Verify no horizontal scroll bar
- [ ] Calendly widget is fully visible and responsive

### Chat Panel
- [ ] Chat panel visible by default (bottom-right)
- [ ] Click collapse button (▸) - panel shrinks to slim rail
- [ ] Slim "Chat" tab appears on left edge (rotated 90°)
- [ ] Click "Chat" tab - panel expands
- [ ] Reload page - collapse state persists
- [ ] Press `C` key - panel toggles
- [ ] Press `Escape` - panel collapses
- [ ] Chat functionality still works when expanded

---

## Rollback (if needed)

If issues are found:

```bash
# Revert commit
git revert df72ddb
git push origin main

# Or rollback to previous version
git reset --hard 6987597
git push origin main --force
```

Previous working hash: `main-D0fKNExd.js`

---

## Success Criteria

✅ GitHub Actions build completes successfully
✅ Watchtower pulls new image and restarts container
✅ New hash `main-CkKHyrR7.js` served at https://www.leoklemet.com/
✅ No horizontal scroll on mobile Calendly widget
✅ Chat panel collapse/expand works smoothly
✅ Keyboard shortcuts functional
✅ State persists across page reloads

---

**Next Steps**: Monitor deployment for ~5 minutes, then test both features on live site.
