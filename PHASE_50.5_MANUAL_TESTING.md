# Phase 50.5 - Manual Testing Guide

**Status:** Backend ✅ Running | Frontend ✅ Running | Ready for Browser Testing

## ✅ Current State

- **Backend:** Running on http://127.0.0.1:8001
- **Frontend:** Running on http://localhost:5173
- **Testing Script:** Created at `test-phase-50-5.ps1`

## 🎯 Run Tests Manually

### Open a NEW PowerShell Terminal

**Important:** Don't use the terminal where backend is running!

```powershell
cd D:\leo-portfolio
.\test-phase-50-5.ps1
```

This script will:
1. ✅ Check backend health
2. ✅ Enable dev overlay with HMAC
3. ✅ Test SEO tune endpoint (dry run)
4. ✅ Retrieve diff and log artifacts
5. ✅ Open tools page in browser

---

## 🌐 Browser Testing

### Step 1: Open Tools Page

Visit: **http://localhost:5173/tools.html**

### Step 2: Find SEO Tune Section

Scroll down to find **"SEO Tune & PR Preview"** section

### Step 3: Test Dry Run

1. Click **"Run SEO Tune (Dry Run)"** button
2. Wait ~2-3 seconds
3. Observe the UI updates:
   - ✅ Button shows "Running..."
   - ✅ Success message appears
   - ✅ Before/After cards display
   - ✅ Diff section shows changes
   - ✅ Reasoning log appears

### Step 4: Review Results

**Before/After Cards:**
- Each project shows old vs new meta tags
- Title, description, OG image comparisons
- Visual side-by-side layout

**Diff Section:**
- Unified diff format (like git diff)
- Red lines = removed
- Green lines = added

**Reasoning Log:**
- Markdown formatted explanation
- Why each change was made
- SEO best practices mentioned

---

## 📋 Alternative: Manual Commands

If you prefer command-line testing:

### Enable Dev Overlay
```powershell
$body = '{"hours":24}'
$secret = 'local-dev-secret-12345'
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)
$hmac = [System.Security.Cryptography.HMACSHA256]::new([System.Text.Encoding]::UTF8.GetBytes($secret))
$signature = 'sha256=' + [System.BitConverter]::ToString($hmac.ComputeHash($bodyBytes)).Replace('-','').ToLower()

curl.exe -X POST http://localhost:8001/agent/dev/enable -H "Content-Type: application/json" -H "X-SiteAgent-Signature: $signature" -d $body
```

### Test SEO Endpoints
```powershell
# Dry run
curl.exe -X POST "http://localhost:8001/agent/seo/tune?dry_run=true"

# Get diff
curl.exe "http://localhost:8001/agent/seo/artifacts/diff"

# Get log
curl.exe "http://localhost:8001/agent/seo/artifacts/log"
```

### Check Status
```powershell
# Backend health
curl.exe http://localhost:8001/ready

# Dev overlay status
curl.exe http://localhost:8001/agent/dev/status
```

---

## 🧪 E2E Tests (Optional)

Once you've verified everything works in the browser:

```powershell
# Run SEO PR preview E2E tests
npm run test:e2e tests/e2e/seo-pr-preview.spec.ts

# Or with Playwright
npx playwright test tests/e2e/seo-pr-preview.spec.ts --project=chromium
```

Expected: 4 tests pass

---

## ✅ Success Criteria

**Backend:**
- [x] Server running on port 8001
- [ ] Dev overlay enabled
- [ ] SEO tune endpoint returns 200 OK
- [ ] Artifacts generated (diff + log)

**Frontend:**
- [x] Preview server running on port 5173
- [ ] Tools page loads without errors
- [ ] SeoTunePanel component visible
- [ ] Dry run button clickable

**UI Workflow:**
- [ ] "Run SEO Tune" triggers API call
- [ ] Before/After cards appear
- [ ] Diff section shows changes
- [ ] Reasoning log displays
- [ ] No console errors

---

## 🆘 Troubleshooting

### Backend Not Responding
```powershell
# Check if running
Get-Process | Where-Object {$_.ProcessName -match 'python'}

# If not, restart
D:/leo-portfolio/.venv/Scripts/python.exe -m uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001 --reload
```

### Frontend Not Running
```powershell
# Check if running
Get-Process | Where-Object {$_.ProcessName -match 'node'}

# If not, start
npm run preview
```

### Dev Overlay Not Working
- Re-run the enable command (see above)
- Check `.env` file has `SITEAGENT_HMAC_SECRET=local-dev-secret-12345`
- Verify backend loaded environment variables (restart if needed)

### Tools Page Shows "Unavailable"
- Enable dev overlay first
- Clear browser cookies
- Refresh page (Ctrl+R)

---

## 📝 What to Test

### ✅ Happy Path
1. Enable dev overlay
2. Run SEO tune (dry run)
3. View before/after preview
4. Read diff and reasoning
5. (Optional) Create PR with "Approve" button

### ⚠️ Error Cases
1. Try accessing tools page without dev overlay → Should show "Unavailable"
2. Run tune twice in a row → Should work both times
3. Check browser console → Should have no errors

---

## 🎉 Phase 50.5 Complete When:

1. ✅ Backend endpoints working (tune, artifacts, act)
2. ✅ Frontend displays SeoTunePanel correctly
3. ✅ Dry run workflow functions end-to-end
4. ✅ Before/After preview renders accurately
5. ✅ Browser console has no errors
6. ✅ E2E tests pass (optional but recommended)

---

## 📚 Documentation

**Phase 50.5 Docs:**
- `docs/PHASE_50.5_SEO_PR_PREVIEW.md` - Complete specification
- `PHASE_50.5_IMPLEMENTATION_SUMMARY.md` - Implementation details
- `PHASE_50.5_QUICKREF.md` - Quick reference
- `PHASE_50.5_DEPLOYMENT_STATUS.md` - Deployment status
- `PHASE_50.5_NEXT_STEPS.md` - Testing guide
- `test-phase-50-5.ps1` - Automated test script

---

**Your Next Action:**

Run `.\test-phase-50-5.ps1` in a NEW PowerShell terminal, then open http://localhost:5173/tools.html in your browser! 🚀

---

**Last Updated:** 2025-10-08 01:07 UTC
**Commit:** 5d6587a
**Branch:** LINKEDIN-OPTIMIZED
