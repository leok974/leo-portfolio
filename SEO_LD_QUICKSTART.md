# SEO JSON-LD Quick Start & Verification

## 🚀 Quick Start

### 1. Start the Backend
```powershell
# From workspace root
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001
```

Or use VS Code task: **"Run FastAPI (assistant_api)"**

### 2. Verify Backend is Running
```powershell
# Health check
curl http://127.0.0.1:8001/ready

# Test JSON-LD endpoint
curl http://127.0.0.1:8001/agent/seo/ld/generate `
  -X POST `
  -H "Content-Type: application/json" `
  -d '{\"url\":\"http://localhost:5173/\",\"types\":[\"WebPage\",\"WebSite\"],\"dry_run\":true}'
```

Expected response:
```json
{
  "jsonld": [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "url": "http://localhost:5173",
      "name": "Leo Klemet — SiteAgent",
      "inLanguage": "en",
      "publisher": {...}
    },
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "url": "http://localhost:5173/",
      "name": "Leo Klemet — SiteAgent",
      ...
    }
  ],
  "report": {
    "count": 2,
    "errors": [],
    "warnings": []
  },
  "artifacts": {}
}
```

### 3. Test Runtime Injector (Development)
```powershell
# Start frontend dev server
npm run dev
```

Then:
1. Open browser: http://localhost:5173/
2. Open DevTools (F12) → Elements tab
3. Search for: `<script type="application/ld+json" id="ld-main">`
4. Verify JSON-LD content includes WebSite, WebPage, Person, Organization

### 4. Test Build-Time Injector
```powershell
# Ensure backend is running first!
npm run seo:ld:inject
```

Expected output:
```
=== SEO JSON-LD Build-Time Injector ===
Backend: http://127.0.0.1:8001/agent/seo/ld/generate
Base URL: http://localhost:5173
Processing 2 page(s)...

✓ Injected JSON-LD → index.html
✓ Injected JSON-LD → projects/ledgermind.html

✓ All pages processed successfully!
```

Check the files:
```powershell
# View injected JSON-LD in index.html
Select-String -Path index.html -Pattern 'ld-main' -Context 5,5

# Or use grep
grep -A 5 'ld-main' index.html
```

---

## 🧪 Run E2E Tests

### All JSON-LD Tests
```powershell
# Ensure backend and frontend are running
npx playwright test -g "@seo-ld" --project=chromium
```

### Frontend Tests Only
```powershell
npx playwright test tests/e2e/seo-ld.spec.ts --project=chromium
```

### Backend API Tests Only
```powershell
npx playwright test tests/e2e/seo-ld.api.spec.ts --project=chromium
```

### With UI (Interactive)
```powershell
npx playwright test tests/e2e/seo-ld.spec.ts --project=chromium --ui
```

---

## ✅ Verification Checklist

### Backend Verification
- [ ] Backend starts without errors: `uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001`
- [ ] Health endpoint responds: `curl http://127.0.0.1:8001/ready`
- [ ] Generate endpoint works: `curl -X POST http://127.0.0.1:8001/agent/seo/ld/generate ...`
- [ ] Validate endpoint works: `curl -X POST http://127.0.0.1:8001/agent/seo/ld/validate ...`

### Frontend Runtime Injector
- [ ] Frontend dev server runs: `npm run dev`
- [ ] Page loads at http://localhost:5173/
- [ ] DevTools shows `<script type="application/ld+json" id="ld-main">`
- [ ] JSON-LD contains at least: WebSite, WebPage, Person, Organization
- [ ] No console errors related to ld-inject.js

### Build-Time Injector
- [ ] Script runs: `npm run seo:ld:inject`
- [ ] No errors during execution
- [ ] `index.html` contains `<script type="application/ld+json" id="ld-main">`
- [ ] `projects/ledgermind.html` contains JSON-LD (if it exists)
- [ ] JSON-LD is valid (check with validator)

### E2E Tests
- [ ] Frontend tests pass: `npx playwright test tests/e2e/seo-ld.spec.ts`
- [ ] Backend API tests pass: `npx playwright test tests/e2e/seo-ld.api.spec.ts`
- [ ] All @seo-ld tests pass: `npx playwright test -g "@seo-ld"`

### Schema Validation
- [ ] Copy JSON-LD from page
- [ ] Test at: https://search.google.com/test/rich-results
- [ ] Test at: https://validator.schema.org/
- [ ] No errors reported
- [ ] All types detected correctly

---

## 🐛 Common Issues & Solutions

### Issue: "Failed to connect to 127.0.0.1 port 8001"
**Solution**: Backend is not running. Start it with:
```powershell
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001
```

### Issue: "ld-main script not found in DOM"
**Possible causes**:
1. **Runtime injector disabled**: Check `window.SEO_LD_ENABLED` is `true`
2. **Backend not responding**: Verify backend is running and accessible
3. **JavaScript error**: Check browser console for errors
4. **CORS issue**: Ensure backend CORS allows frontend origin

**Solutions**:
```javascript
// In browser console, check:
console.log(window.SEO_LD_ENABLED); // Should be true
console.log(window.SEO_LD_ENDPOINT); // Should be "/agent/seo/ld/generate"

// Test fetch manually:
fetch('/agent/seo/ld/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: location.href, types: ['WebPage'], dry_run: true })
}).then(r => r.json()).then(console.log);
```

### Issue: Build-time injector fails with "LD generate failed"
**Solution**:
1. Verify backend is running: `curl http://127.0.0.1:8001/ready`
2. Check backend logs for errors
3. Verify `SEO_LD_ENABLED=1` in environment
4. Test endpoint manually with curl

### Issue: E2E tests fail
**Common causes**:
1. Backend not running
2. Frontend not running on port 5173
3. `SEO_LD_ENABLED=0` in backend environment

**Solutions**:
```powershell
# Check services
curl http://127.0.0.1:8001/ready  # Backend
curl http://localhost:5173/       # Frontend

# Check backend environment
curl http://127.0.0.1:8001/agent/status/summary | ConvertFrom-Json | Select-Object -ExpandProperty config
```

### Issue: JSON-LD validation errors
**Common issues**:
- Missing @context or @type
- Invalid URL format
- Date not in ISO-8601 format

**Solution**: Use the validate endpoint:
```powershell
curl -X POST http://127.0.0.1:8001/agent/seo/ld/validate `
  -H "Content-Type: application/json" `
  -d @your-jsonld.json
```

---

## 📊 Manual Testing Scenarios

### Scenario 1: Home Page JSON-LD
1. Navigate to: http://localhost:5173/
2. View page source (Ctrl+U)
3. Search for: `application/ld+json`
4. Verify presence of:
   - WebSite (with publisher)
   - WebPage (with isPartOf)
   - Person (with sameAs links)
   - Organization (with logo)

### Scenario 2: Project Page JSON-LD
1. Navigate to: http://localhost:5173/projects/ledgermind
2. View page source
3. Verify presence of:
   - WebPage
   - BreadcrumbList (3 items: Home → Projects → LedgerMind)
   - CreativeWork (with author, datePublished)

### Scenario 3: Dynamic Page Types
1. Edit URL in browser: http://localhost:5173/projects/test-project
2. Refresh page
3. Check JSON-LD includes CreativeWork (projects trigger)
4. Navigate to: http://localhost:5173/about
5. Check JSON-LD includes Article (non-project pages)

### Scenario 4: Artifact Storage
1. Generate JSON-LD (non-dry-run):
```powershell
curl -X POST http://127.0.0.1:8001/agent/seo/ld/mock `
  -H "Content-Type: application/json" `
  -d '{\"url\":\"http://localhost:5173/test\"}'
```
2. Check artifacts created:
```powershell
ls agent/artifacts/seo-ld/
```
3. Retrieve latest report:
```powershell
curl "http://127.0.0.1:8001/agent/seo/ld/report?url=http://localhost:5173/test"
```

---

## 🔧 Configuration Tips

### Development Mode
```javascript
// In index.html <head>
window.SEO_LD_ENABLED = true;
window.SEO_LD_DEBUG = true; // Enable console logging
window.SEO_LD_ENDPOINT = "/agent/seo/ld/generate";
```

### Production Mode (Runtime)
```javascript
window.SEO_LD_ENABLED = true;
window.SEO_LD_DEBUG = false; // Disable logging
window.SEO_LD_ENDPOINT = "/agent/seo/ld/generate"; // Proxied by nginx
```

### Production Mode (Build-Time)
```powershell
# Set production URLs
$env:BASE_URL = "https://assistant.ledger-mind.org"
$env:SEO_LD_URL = "https://assistant.ledger-mind.org/agent/seo/ld/generate"

# Run injector
npm run seo:ld:inject
```

### Backend Settings
```bash
# .env file or environment
SEO_LD_ENABLED=1
SEO_LD_VALIDATE_STRICT=1
BRAND_NAME="Your Brand Name"
BRAND_URL="https://your-domain.com"
BRAND_LOGO="https://your-domain.com/logo.png"
PERSON_NAME="Your Name"
PERSON_SAME_AS="https://linkedin.com/in/yourprofile,https://github.com/yourprofile"
```

---

## 📈 Monitoring & Analytics

### Check Generated Artifacts
```powershell
# List all generated artifacts
ls -r agent/artifacts/seo-ld/

# View latest JSON-LD for a page
cat agent/artifacts/seo-ld/http_localhost_5173_/latest.jsonld | ConvertFrom-Json

# View latest validation report
cat agent/artifacts/seo-ld/http_localhost_5173_/latest.report.json | ConvertFrom-Json
```

### Backend Logs
```powershell
# When running uvicorn, watch for:
# - INFO: Started server process
# - INFO: Uvicorn running on http://127.0.0.1:8001
# - INFO: "POST /agent/seo/ld/generate HTTP/1.1" 200 OK
```

### Browser DevTools
```javascript
// Enable debug mode
window.SEO_LD_DEBUG = true;

// Check logs in Console:
// [ld-inject] Injected JSON-LD: [...]
```

---

## 🎯 Success Indicators

✅ **All systems working correctly when**:
1. Backend responds to health check
2. Generate endpoint returns valid JSON-LD
3. Frontend shows JSON-LD in DOM (runtime) or HTML source (build-time)
4. E2E tests pass (100% success rate)
5. Google Rich Results Test shows no errors
6. All required schema types present
7. No console errors

---

## 📞 Need Help?

### Documentation References
- **Implementation Guide**: `SEO_LD_ENHANCEMENT.md` (comprehensive, 400+ lines)
- **API Documentation**: `docs/API.md` (endpoint reference)
- **This Runbook**: `SEO_LD_QUICKSTART.md` (testing & verification)
- **Summary**: `SEO_LD_IMPLEMENTATION_SUMMARY.md` (overview)

### Test Files
- Frontend tests: `tests/e2e/seo-ld.spec.ts`
- Backend tests: `tests/e2e/seo-ld.api.spec.ts`

### Source Code
- Backend router: `assistant_api/routers/seo_ld.py`
- Runtime injector: `assets/js/ld-inject.js`
- Build-time injector: `scripts/inject-jsonld.mjs`
- Settings: `assistant_api/settings.py`

---

**Quick Command Reference**:
```powershell
# Start backend
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001

# Start frontend
npm run dev

# Test backend
curl http://127.0.0.1:8001/ready

# Run build-time injector
npm run seo:ld:inject

# Run E2E tests
npx playwright test -g "@seo-ld" --project=chromium
```

---

**Status**: Ready for testing! Start the backend and follow the verification checklist above.
