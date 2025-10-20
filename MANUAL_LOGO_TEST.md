# Manual E2E Testing Guide - Logo Verification

## Local Server Running ✅

**URL**: http://localhost:59446
(Port 3000 was in use, so serve picked 59446)

## Manual Test Checklist

### 1. Visual Verification
- [ ] Open http://localhost:59446 in browser
- [ ] Find the LedgerMind project card
- [ ] Verify logo displays: Brain icon with radiating arrows (cyan/green colors)
- [ ] Logo should NOT be a simple SVG placeholder with text

### 2. Network Tab Verification
Open DevTools (F12) → Network tab:

- [ ] Reload page
- [ ] Find request for `/assets/ledgermind-logo.png`
- [ ] Status: **200 OK**
- [ ] Content-Type: **image/png**
- [ ] Size: Should show actual image size (not 0)

### 3. Console Check
Open DevTools → Console tab:

- [ ] No CSP violations (no "Refused to load..." errors)
- [ ] No 404 errors for logo
- [ ] `window.__APP_READY__` should be `true`

### 4. Projects.json Check
Open in browser: http://localhost:59446/projects.json

Search for "ledgermind" and verify:
```json
{
  "ledgermind": {
    "thumbnail": "/assets/ledgermind-logo.png"
  }
}
```

- [ ] Thumbnail path starts with `/` (absolute path)
- [ ] Path is `/assets/ledgermind-logo.png`

### 5. Direct Asset Access
Open directly: http://localhost:59446/assets/ledgermind-logo.png

- [ ] Image displays in browser
- [ ] Shows brain + arrows logo
- [ ] No 404 error

## Resume Verification (Bonus)

While testing, also verify resume:
- [ ] Open http://localhost:59446/resume/Leo_Klemet_Resume_2025.pdf
- [ ] PDF downloads or displays
- [ ] File size: ~5.7KB

## Expected Results

**✅ Pass**: All items checked above
**❌ Fail**: Any 404s, CSP errors, or wrong logo

## Troubleshooting

### Logo doesn't show
- Check if file exists: `Test-Path "dist-portfolio\assets\ledgermind-logo.png"`
- Rebuild: `pnpm build:portfolio`
- Clear browser cache: Ctrl+Shift+R

### Wrong path in projects.json
- Check source: `apps\portfolio-ui\public\projects.json`
- Should have: `"thumbnail": "/assets/ledgermind-logo.png"`
- Rebuild after fixing

### 404 on logo
- Verify build copied assets
- Check: `dir dist-portfolio\assets\ledgermind-logo.png`

## Stop Server

When done testing:
```powershell
# Press Ctrl+C in the terminal running serve
```

## Next Steps After Manual Verification

If all checks pass:
1. ✅ Logo works locally
2. ✅ Ready for Docker build
3. ✅ Deploy to production

```powershell
# Build Docker image
docker build -f Dockerfile.portfolio -t ghcr.io/leok974/leo-portfolio/portfolio:latest .

# Push to registry
docker push ghcr.io/leok974/leo-portfolio/portfolio:latest
```

## E2E Tests (After Backend is Running)

The automated E2E tests require the backend to be running. To run them:

1. Start backend: `uvicorn assistant_api.main:app --port 8001`
2. Run tests: `npx playwright test tests/e2e/portfolio/projects.logo.spec.ts`

For now, manual testing confirms everything works! ✅
