# Phase 50.2 Smoke Test Checklist

**Purpose**: Quick validation of Phase 50.2 backend, frontend, and UX enhancements
**Time**: ~10 minutes
**Date**: 2025-10-07

---

## Prerequisites

```powershell
# Ensure dependencies installed
pip install -r requirements.txt
pnpm install
```

---

## 1️⃣ Backend Smoke Tests

### Start Backend

```powershell
# Terminal 1: Run API server
uvicorn assistant_api.main:app --host 127.0.0.1 --port 8001 --reload
```

Wait for: `Application startup complete.`

---

### Seed Initial Layout

```powershell
# Terminal 2: Create initial layout.json (for badge/sections rendering)
$body = @{ task="layout.optimize"; payload=@{ preset="recruiter" } } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:8001/agent/act -Method Post -ContentType "application/json" -Body $body
```

**Expected**: JSON response with `{"status":"complete", "result":...}`

---

### Verify A/B Endpoints

```powershell
# Test A/B bucket assignment (should return A or B)
Invoke-RestMethod http://127.0.0.1:8001/agent/ab/assign

# Test A/B CTR suggestions
Invoke-RestMethod http://127.0.0.1:8001/agent/ab/suggest
```

**Expected**:
- `/assign` → `{"bucket":"A"}` or `{"bucket":"B"}`
- `/suggest` → `{"better":"A", "a_ctr":0.XX, "b_ctr":0.XX, "suggestion":"..."}`

---

### Verify Weight Endpoints

```powershell
# Get current weights
Invoke-RestMethod http://127.0.0.1:8001/agent/layout/weights

# Propose new weights
$weights = @{ freshness=1.2; signal=1.5; fit=1.0; media=0.8 } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:8001/agent/layout/weights/propose -Method Post -ContentType "application/json" -Body $weights
```

**Expected**:
- `/weights` → `{"active":{...}, "proposed":{...}}`
- `/propose` → `{"status":"ok"}`

---

### Verify Scheduler Endpoint

```powershell
# Get scheduler info
Invoke-RestMethod http://127.0.0.1:8001/agent/scheduler/info
```

**Expected**: `{"next_run":"...", "last_run":"...", "preset":"..."}`

---

### Backend Unit Tests

```powershell
# Run all Phase 50.2 backend tests
pytest -q tests/agent/test_layout_ab.py tests/agent/test_layout_weights.py tests/agent/test_scheduler.py
```

**Expected**: ✅ **32 passed** in ~0.15s

---

## 2️⃣ Frontend Smoke Tests

### Start Frontend

```powershell
# Terminal 3: Run Vite dev server
pnpm dev
```

Wait for: `Local: http://localhost:5173/`

---

### Manual UI Verification

1. **Open browser**: http://localhost:5173/
2. **Enable dev overlay** (if gated by cookie/flag):
   - Set cookie: `dev_tools_enabled=true`
   - Or use CF Access in prod
3. **Navigate to tools panel** (admin overlay page)

---

### Verify Components Render

**✅ Checklist**:
- [ ] **LastRunBadge** appears with timestamp + preset + featured count
- [ ] **WeightsEditor** shows 4 sliders (freshness, signal, fit, media)
- [ ] **ABAnalyticsPanel** displays CTR comparison (A vs B)
- [ ] **Run Now button** visible with preset dropdown
- [ ] No console errors

---

### Test Toast Notifications

1. **Click any project card** on homepage
2. **Expected**: Toast appears bottom-right: "Thanks! Counted your A click."
3. Toast auto-dismisses after 2 seconds
4. Check browser console: No errors

---

### Test Run Now Button

1. **Open ABAnalyticsPanel**
2. **Select preset** from dropdown (recruiter/hiring_manager)
3. **Click "Run Now"**
4. **Expected**:
   - Button disables during optimization
   - Toast: "Optimization complete!" or similar
   - LastRunBadge timestamp updates
   - No page reload needed

---

### Test Bold Winner Display

1. **Check ABAnalyticsPanel**
2. **Verify**: Winner CTR is **bold**, loser is **dimmed** (opacity-75)
3. **Example**: If A wins, "A: 15.2%" is bold, "B: 12.1%" is dimmed

---

### Test Weight Editor Workflow

1. **Adjust sliders** in WeightsEditor
2. **Click "Save Proposal"** → Status message appears
3. **Click "Approve Weights"** → Active weights update
4. **Click "Optimize with Proposal"** → Badge refreshes
5. **Verify**: All steps work without errors

---

## 3️⃣ E2E Test Suite

### Phase 50.2 Base Components

```powershell
# WeightsEditor tests (3 tests)
pnpm playwright test tests/e2e/weights-editor.spec.ts

# ABAnalyticsPanel tests (4 tests)
pnpm playwright test tests/e2e/ab-analytics.spec.ts

# LastRunBadge tests (3 tests)
pnpm playwright test tests/e2e/last-run-badge.spec.ts

# LayoutAgentPanel integration tests (3 tests)
pnpm playwright test tests/e2e/layout-agent-panel.spec.ts
```

**Expected**: ✅ **13 passed** (all base component tests)

---

### Phase 50.2 UX Enhancement Tests

```powershell
# Toast notification tests (3 tests)
pnpm playwright test tests/e2e/ab-toast.spec.ts

# Bold winner tests (3 tests)
pnpm playwright test tests/e2e/ab-winner-bold.spec.ts

# Run Now + badge refresh tests (4 tests)
pnpm playwright test tests/e2e/run-now-badge.spec.ts
```

**Expected**: ✅ **10 passed** (all enhancement tests)

---

### Run All E2E Tests

```powershell
# Run all Phase 50.2 E2E tests at once
pnpm playwright test tests/e2e/weights-editor.spec.ts tests/e2e/ab-analytics.spec.ts tests/e2e/last-run-badge.spec.ts tests/e2e/layout-agent-panel.spec.ts tests/e2e/ab-toast.spec.ts tests/e2e/ab-winner-bold.spec.ts tests/e2e/run-now-badge.spec.ts

# Or with grep filter
pnpm playwright test --grep "@phase50.2"
```

**Expected**: ✅ **23 passed** (13 base + 10 enhancements)

---

## 4️⃣ Production Safety Checks

### Backend Security (Already Implemented)

```python
# Check privileged routes are protected
# tests/agent/test_layout_weights.py

def test_propose_requires_auth():
    response = client.post("/agent/layout/weights/propose", json={...})
    assert response.status_code == 403  # If no auth header
```

**Verify**:
- [ ] `APP_ENV=prod` disables open access
- [ ] `ALLOWED_ADMIN_EMAILS` set in prod
- [ ] CF Access header checked: `Cf-Access-Authenticated-User-Email`

---

### Frontend UI Gating

```typescript
// src/components/LayoutAgentPanel.tsx or admin overlay

const isPrivileged = () => {
  // Dev mode: check cookie
  if (import.meta.env.DEV) {
    return document.cookie.includes('dev_tools_enabled=true');
  }
  
  // Prod mode: check CF Access header (via API call)
  // Or render based on backend /agent/user/privileges endpoint
  return false;
};

export function LayoutAgentPanel() {
  if (!isPrivileged()) return null;
  
  return <div>...</div>;
}
```

**Verify**:
- [ ] Panel hidden without dev cookie (local dev)
- [ ] Panel hidden without CF Access (production)
- [ ] Visitors see portfolio only, not tools

---

### Edge/Nginx (Optional DoD)

```nginx
# /etc/nginx/conf.d/agent-routes.conf

location /agent/ {
    # Block if no CF Access email header
    if ($http_cf_access_authenticated_user_email = "") {
        return 403;
    }
    
    proxy_pass http://backend:8000;
}
```

**Verify**:
- [ ] `/agent/*` routes blocked without CF Access
- [ ] Error logged: "403 Forbidden"

---

## 5️⃣ Fast "Done" Criteria

### ✅ Must Pass

- [ ] **Backend unit tests**: 32 passed (pytest)
- [ ] **Frontend E2E tests**: 23 passed (playwright)
- [ ] **Tools panel hidden**: No dev cookie/CF Access = no panel
- [ ] **Toast on card click**: Shows "Thanks! Counted your A click."
- [ ] **Bold winner**: Winning CTR is bold in AB panel
- [ ] **Run Now works**: Updates badge timestamp/preset
- [ ] **No console errors**: Clean browser console
- [ ] **Backend /agent/ routes**: Protected in production

---

### ⚠️ Known Issues / Edge Cases

**Issue**: Badge shows "unknown" if layout.json doesn't exist
**Solution**: Run initial optimization (step 1 - Seed Initial Layout)

**Issue**: Toast doesn't appear
**Solution**: Verify `<ToastHost />` mounted in overlay root

**Issue**: Run Now button disabled
**Solution**: Wait for previous optimization to complete

**Issue**: E2E tests fail with "Element not found"
**Solution**: Ensure backend running and initial layout seeded

---

## 6️⃣ Quick Reference: Key Files

### Backend
- `assistant_api/agent/layout/ab.py` - A/B assignment
- `assistant_api/agent/layout/weights.py` - Weight management
- `assistant_api/agent/tasks/scheduler.py` - Nightly scheduler

### Frontend
- `src/lib/toast.tsx` - Toast system
- `src/lib/ab.ts` - AB tracking client
- `src/components/WeightsEditor.tsx` - Weight sliders
- `src/components/ABAnalyticsPanel.tsx` - CTR display + Run Now
- `src/components/LastRunBadge.tsx` - Last optimization info
- `src/components/LayoutAgentPanel.tsx` - Unified panel

### Tests
- Backend: `tests/agent/test_layout_*.py`, `tests/agent/test_scheduler.py`
- Frontend: `tests/e2e/{weights-editor,ab-analytics,last-run-badge,layout-agent-panel}.spec.ts`
- Enhancements: `tests/e2e/{ab-toast,ab-winner-bold,run-now-badge}.spec.ts`

---

## 7️⃣ Troubleshooting

### Backend won't start
```powershell
# Check Python version
python --version  # Should be 3.10+

# Reinstall dependencies
pip install -r requirements.txt

# Check port availability
netstat -ano | findstr :8001
```

### Frontend won't build
```powershell
# Clear cache
rm -rf node_modules/.vite
pnpm install

# Check Node version
node --version  # Should be 18+
```

### E2E tests timeout
```powershell
# Increase timeout in playwright.config.ts
timeout: 60000  # 60 seconds

# Run with headed mode for debugging
pnpm playwright test --headed --project=chromium
```

### Toast not showing
```typescript
// Verify ToastHost mounted
console.log(document.querySelector('[data-testid="toast"]'));

// Manually trigger toast
window.dispatchEvent(new CustomEvent('siteagent:toast', { 
  detail: { message: 'Test toast' } 
}));
```

---

## 8️⃣ Success Output Examples

### Backend Tests
```
tests/agent/test_layout_ab.py::test_visitor_id PASSED
tests/agent/test_layout_ab.py::test_sha1_bucketing PASSED
...
tests/agent/test_scheduler.py::test_schedule_eval PASSED

======================== 32 passed in 0.15s ========================
```

### Frontend E2E Tests
```
✓ [chromium] › weights-editor.spec.ts:7:3 › proposes and approves weights
✓ [chromium] › ab-analytics.spec.ts:7:3 › shows CTRs and winner
✓ [chromium] › ab-toast.spec.ts:7:3 › displays toast on card click
...

23 passed (15.2s)
```

---

## 9️⃣ Post-Smoke Next Steps

### If All Green ✅
1. Commit any final tweaks
2. Push to `LINKEDIN-OPTIMIZED` branch
3. Deploy to staging
4. Run smoke tests on staging
5. Deploy to production with CF Access

### If Issues Found ❌
1. Document failing test
2. Check error logs (backend + browser console)
3. Fix issue
4. Re-run smoke tests
5. Repeat until green

---

## 🎯 Final Checklist

**Before declaring Phase 50.2 complete**:

- [ ] All backend unit tests pass (32/32)
- [ ] All frontend E2E tests pass (23/23)
- [ ] Manual UI verification complete (all components visible)
- [ ] Toast notifications work on card clicks
- [ ] Run Now button triggers optimization + updates badge
- [ ] Bold winner display works correctly
- [ ] Production security gates verified (CF Access)
- [ ] Documentation up to date (PHASE_50.2_COMPLETE.md)
- [ ] No console errors or warnings
- [ ] Ready for staging deployment

---

**Status**: Copy this checklist and execute top-to-bottom. All green = Phase 50.2 production-ready! 🚀
