# Tools Page & Public AB Tracking Implementation

**Status:** ✅ **COMPLETE**
**Date:** 2025-10-07

---

## Overview

Successfully implemented a dedicated admin/dev tools page (`/tools.html`) and integrated AB tracking into the public site. This separates admin UI from public pages while enabling real-world AB testing with toast notifications.

---

## Implementation Summary

### Backend (Dev Overlay)

**Created:** `assistant_api/routers/dev_overlay.py`
- `GET /agent/dev/status` - Check if dev overlay is enabled
- `POST /agent/dev/enable` - Enable dev overlay (sets `sa_dev=1` cookie)
- `POST /agent/dev/disable` - Disable dev overlay (removes cookie)

**Modified:** `assistant_api/main.py`
- Mounted dev_overlay router

### Frontend (Tools Page)

**Created:**
1. `tools.html` - Admin tools page HTML
2. `src/tools-entry.tsx` - Entry point for tools page
3. `src/components/AgentToolsPanel.tsx` - Main tools panel component
4. `src/lib/devGuard.ts` - Dev overlay guard helper

**Modified:**
1. `vite.config.ts` - Added `tools.html` as build entry point
2. `src/main.ts` - Added AB tracking initialization and project card click handlers

### E2E Tests

**Modified:**
1. `tests/e2e/ab-winner-bold.spec.ts` - Updated to visit `/tools.html` with dev overlay enabled
2. `tests/e2e/run-now-badge.spec.ts` - Updated to test autotune on tools page
3. `tests/e2e/ab-toast.spec.ts` - Updated for public site AB tracking

---

## Architecture

### Dev Overlay Flow

```
┌──────────────────────────────────────────────┐
│        Playwright E2E Test or Manual         │
│      POST /agent/dev/enable                  │
└──────────────┬───────────────────────────────┘
               │
               │ Sets sa_dev=1 cookie
               │
┌──────────────▼───────────────────────────────┐
│         Browser visits /tools.html           │
└──────────────┬───────────────────────────────┘
               │
               │ tools-entry.tsx checks
               │ isPrivilegedUIEnabled()
               │
┌──────────────▼───────────────────────────────┐
│     If enabled: Render AgentToolsPanel       │
│     If not: Show "Tools Unavailable"         │
└──────────────────────────────────────────────┘
```

### Public AB Tracking Flow

```
┌──────────────────────────────────────────────┐
│      User visits index.html (public site)    │
└──────────────┬───────────────────────────────┘
               │
               │ main.ts initializes
               │
┌──────────────▼───────────────────────────────┐
│  1. getBucket() - Assign sticky bucket       │
│  2. fireAbEvent("view") - Log page view      │
└──────────────────────────────────────────────┘
               │
               │ User clicks project card
               │
┌──────────────▼───────────────────────────────┐
│  fireAbEvent("click") - Log click            │
│  Toast notification displayed (Sonner)       │
└──────────────────────────────────────────────┘
```

---

## Files Created (4)

1. **assistant_api/routers/dev_overlay.py** (36 lines)
   - Dev overlay enable/disable/status endpoints

2. **tools.html** (11 lines)
   - Admin tools page HTML entry point

3. **src/tools-entry.tsx** (54 lines)
   - React entry point for tools page with dev guard

4. **src/lib/devGuard.ts** (57 lines)
   - Helper functions to check/enable/disable dev overlay

## Files Modified (7)

1. **assistant_api/main.py**
   - Imported and mounted `dev_overlay.router`

2. **src/components/AgentToolsPanel.tsx**
   - Combined ABAnalyticsDashboard + AutotuneButton

3. **vite.config.ts**
   - Added multi-page build configuration (index.html + tools.html)

4. **src/main.ts**
   - Added AB tracking initialization (getBucket, fireAbEvent on load)
   - Added project card click tracking

5. **tests/e2e/ab-winner-bold.spec.ts**
   - Updated to enable dev overlay and visit `/tools.html`

6. **tests/e2e/run-now-badge.spec.ts**
   - Updated to test autotune button on tools page

7. **tests/e2e/ab-toast.spec.ts**
   - Updated for public site AB tracking (uses `.card-click` selector)

---

## Key Features

### 1. Dev Overlay System

**Purpose:** Control access to admin tools via cookie

**API:**
```bash
# Enable dev overlay (sets sa_dev=1 cookie for 30 days)
curl -X POST http://localhost:8001/agent/dev/enable

# Check status
curl http://localhost:8001/agent/dev/status

# Disable
curl -X POST http://localhost:8001/agent/dev/disable
```

**Frontend Usage:**
```typescript
import { isPrivilegedUIEnabled } from "@/lib/devGuard";

const enabled = await isPrivilegedUIEnabled();
if (enabled) {
  // Render admin tools
}
```

### 2. Tools Page (`/tools.html`)

**Location:** `http://localhost:5173/tools.html` (dev) or `/tools.html` (production)

**Content:**
- Site Agent Tools header
- Adaptive Autotuning section (AutotuneButton)
- AB Analytics Dashboard (CTR trends, date filters, winner display)
- "Coming Soon" section (scheduler controls, weight editor, audit log, metrics)

**Access Control:**
- Checks `isPrivilegedUIEnabled()` on page load
- Shows "Tools Unavailable" message if not enabled
- Requires `sa_dev=1` cookie or `/agent/dev/status` returns `enabled: true`

### 3. Public AB Tracking

**Initialization (src/main.ts):**
```typescript
// On page load
const { getBucket, fireAbEvent } = await import('./lib/ab');
await getBucket();           // Assign sticky bucket (A or B)
await fireAbEvent("view");   // Log page view
```

**Click Tracking:**
```typescript
// On project card click
document.querySelectorAll('.card-click').forEach(card => {
  card.addEventListener('click', async () => {
    await fireAbEvent("click");  // Log click
    // Toast notification displayed automatically
  });
});
```

**Storage:**
- `localStorage.visitor_id` - UUID for sticky bucketing
- `localStorage.ab_bucket` - Assigned bucket (A or B)

---

## E2E Test Updates

### 1. Tools Page Tests

**Enable Dev Overlay Before Each Test:**
```typescript
test.beforeEach(async ({ request }) => {
  await request.post("/agent/dev/enable");
});
```

**Visit Tools Page:**
```typescript
await page.goto("/tools.html", { waitUntil: "networkidle" });
```

**Test Cases:**
- `ab-winner-bold.spec.ts` - Winner display, date filters, refresh button
- `run-now-badge.spec.ts` - Autotune button, loading state, feedback messages

### 2. Public Site Tests

**No Dev Overlay Required:**
```typescript
await page.goto("/", { waitUntil: "networkidle" });
```

**Test Cases:**
- `ab-toast.spec.ts` - Toast on project card click, visitor ID tracking, bucket assignment

---

## Build Output

**Production Build:**
```bash
pnpm run build

✓ 2609 modules transformed.
dist/tools.html                   0.82 kB │ gzip: 0.45 kB
dist/index.html                  78.91 kB │ gzip: 28.00 kB
dist/assets/tools-*.js            2.66 kB │ gzip: 1.11 kB
dist/assets/main-*.js           250.94 kB │ gzip: 79.05 kB
dist/assets/AutotuneButton-*.js 504.98 kB │ gzip: 154.41 kB
✓ built in 3.31s
```

**Entry Points:**
- `index.html` → `main.js` (public site with AB tracking)
- `tools.html` → `tools.js` (admin tools page)

---

## Usage Instructions

### 1. Enable Dev Overlay (Local Testing)

**Via API:**
```bash
curl -X POST http://localhost:8001/agent/dev/enable
```

**Via Browser Console:**
```javascript
await fetch("/agent/dev/enable", { method: "POST" });
location.reload();
```

**Via Playwright:**
```typescript
await page.request.post("/agent/dev/enable");
```

### 2. Access Tools Page

**Dev:**
```
http://localhost:5173/tools.html
```

**Production:**
```
https://your-domain.com/tools.html
```

### 3. Test AB Tracking (Public Site)

1. Visit `http://localhost:5173/`
2. Open browser console
3. Check localStorage:
   ```javascript
   localStorage.visitor_id  // UUID
   localStorage.ab_bucket   // "A" or "B"
   ```
4. Click a project card
5. See toast notification

### 4. Run E2E Tests

**All Tests:**
```bash
pnpm playwright test tests/e2e/ab-*.spec.ts tests/e2e/run-now-*.spec.ts
```

**Tools Page Tests Only:**
```bash
pnpm playwright test tests/e2e/ab-winner-bold.spec.ts tests/e2e/run-now-badge.spec.ts
```

**Public Site Tests Only:**
```bash
pnpm playwright test tests/e2e/ab-toast.spec.ts
```

---

## Security Considerations

1. **Dev Overlay Cookie:**
   - HttpOnly: `false` (needs JS access)
   - SameSite: `lax`
   - Max-Age: 30 days
   - Path: `/`

2. **Access Control:**
   - Frontend checks `isPrivilegedUIEnabled()` before rendering tools
   - Backend should add Cloudflare Access or similar for `/agent/*` endpoints
   - Cookie alone is not production-secure (can be set by anyone)

3. **Production Hardening:**
   - Add Cloudflare Access rules for `/agent/*`
   - Or check JWT/session token in dev_overlay router
   - Or IP allowlist for tools page

---

## Next Steps

### Immediate
- [ ] Run E2E tests to verify all passing
- [ ] Test tools page in local dev environment
- [ ] Test public AB tracking (click project cards, see toasts)

### Future Enhancements
- [ ] Add authentication guard to dev_overlay router (JWT/session)
- [ ] Integrate scheduler controls in tools page
- [ ] Add weight editor with approval workflow
- [ ] Add audit log viewer for agent events
- [ ] Add performance metrics dashboard

---

## Commit Checklist

- [x] Backend dev overlay router created
- [x] Dev overlay mounted in main.py
- [x] Tools page HTML + entry point created
- [x] AgentToolsPanel component created
- [x] devGuard helper functions created
- [x] AB tracking initialized in main.ts
- [x] Project card click tracking added
- [x] E2E tests updated (tools page + public site)
- [x] Vite config updated for multi-page build
- [x] Frontend build successful
- [ ] E2E tests passing
- [ ] Documentation complete

---

## File Summary

**Created (4 files):**
- `assistant_api/routers/dev_overlay.py`
- `tools.html`
- `src/tools-entry.tsx`
- `src/lib/devGuard.ts`

**Modified (7 files):**
- `assistant_api/main.py`
- `src/components/AgentToolsPanel.tsx`
- `vite.config.ts`
- `src/main.ts`
- `tests/e2e/ab-winner-bold.spec.ts`
- `tests/e2e/run-now-badge.spec.ts`
- `tests/e2e/ab-toast.spec.ts`

**Total Changes:** 11 files (4 created, 7 modified)

---

## Conclusion

Successfully implemented:

1. ✅ **Dev Overlay System** - Cookie-based access control for admin tools
2. ✅ **Tools Page** (`/tools.html`) - Dedicated admin dashboard
3. ✅ **Public AB Tracking** - Page view and click tracking with toasts
4. ✅ **E2E Test Updates** - Separated tools page tests from public site tests
5. ✅ **Multi-Page Build** - Vite configured for index.html + tools.html

**Status:** Ready for E2E testing and deployment! 🚀
