# Dev Overlay Resilient Architecture

**Status**: ✅ Implemented
**Date**: 2025-10-20
**Branch**: `feat/projects-hide-toggle`

## Overview

The dev overlay now has a **two-layer resilient architecture** that works reliably whether the backend is available or not. It gracefully handles 404s, network errors, and missing configuration without blocking the UI or showing modal alerts.

## Problem Statement

The dev overlay was experiencing issues:

1. **404 on /api/layout** - Frontend tried to fetch layout but endpoint didn't exist
2. **Backend dependency** - Overlay failed completely when backend was unavailable
3. **Poor UX** - Modal alerts blocked the UI when status checks failed
4. **No local override** - No way for developers to force-enable the overlay without backend

## Solution Architecture

### Layer A: Frontend Safety & UX

#### 1. Resilient Status Fetching

**File**: `apps/portfolio-ui/src/dev-overlay.ts`

```typescript
export async function fetchOverlayStatus(): Promise<OverlayStatus> {
  // 1. Local override via ?dev_overlay=dev
  const url = new URL(location.href);
  if (url.searchParams.get('dev_overlay') === 'dev') {
    localStorage.setItem('dev:unlock', '1');
  }

  // 2. Check localStorage override
  if (localStorage.getItem('dev:unlock') === '1') {
    return { allowed: true, mode: 'local' };
  }

  // 3. Check if backend is enabled
  if (import.meta.env.VITE_BACKEND_ENABLED !== '1') {
    return { allowed: false, mode: 'no-backend' };
  }

  // 4. Try backend probe (graceful 404 handling)
  try {
    const r = await fetch('/api/dev/status', {
      headers: { 'x-dev-key': import.meta.env.VITE_DEV_OVERLAY_KEY ?? '' }
    });

    if (!r.ok) {
      return { allowed: false, mode: 'unreachable' };
    }

    const data = await r.json();
    return {
      allowed: data.allowed ?? false,
      mode: data.mode ?? 'denied'
    };
  } catch {
    return { allowed: false, mode: 'unreachable' };
  }
}
```

**Status Modes**:
- `local` - Forced by localStorage (no backend required)
- `token` - Authenticated via `DEV_OVERLAY_KEY`
- `access` - Authenticated via Cloudflare Access (future)
- `no-backend` - Backend disabled (`VITE_BACKEND_ENABLED !== '1'`)
- `unreachable` - Backend unavailable (404/network error)
- `denied` - Authentication failed

#### 2. Safe Layout Fetching

**File**: `apps/portfolio-ui/src/layout.ts`

```typescript
export async function fetchLayout(): Promise<LayoutRecipe | null> {
  if (import.meta.env.VITE_BACKEND_ENABLED !== '1') {
    return null; // Skip when static-only
  }

  try {
    const res = await fetch('/api/layout');
    if (!res.ok) {
      return null; // 404/500 → null, don't throw
    }
    return await res.json();
  } catch {
    return null; // Network error → null
  }
}
```

**Benefits**:
- Never throws errors
- Returns `null` on any failure
- Checks `VITE_BACKEND_ENABLED` before attempting fetch
- No console errors for expected 404s

#### 3. Toast Notifications (No Modals)

Replaced all `alert()` calls with non-blocking toast notifications:

```typescript
function showToast(message: string) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 12px;
    padding: 12px 16px;
    background: #1e293b;
    color: #fff;
    border-radius: 6px;
    /* ... */
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
```

Status is logged to console instead of shown in modals:
```typescript
badge.addEventListener('click', async () => {
  const status = await fetchOverlayStatus();
  console.info('[Dev Overlay] Status:', status);
  showToast(`Dev Overlay: ${status.mode} (${status.allowed ? 'allowed' : 'denied'})`);
});
```

#### 4. Local Unlock Button

**File**: `apps/portfolio-ui/src/dev-overlay.ts`

```typescript
export function addLocalUnlockButton() {
  if (localStorage.getItem('dev:unlock') === '1') {
    return; // Already unlocked
  }

  const button = document.createElement('button');
  button.textContent = '🔓 Enable Dev Overlay (Local)';
  // ... styling ...

  button.addEventListener('click', () => {
    localStorage.setItem('dev:unlock', '1');
    location.reload();
  });

  document.body.appendChild(button);
}
```

**Usage**:
1. Visit site without backend running
2. Click "🔓 Enable Dev Overlay (Local)" button (bottom-left)
3. Page reloads with overlay fully enabled
4. Works without any backend connection

### Layer B: Backend Stubs

#### 1. Dev Status Endpoint

**File**: `assistant_api/routers/dev.py`

```python
@router.get("/api/dev/status")
def dev_status(x_dev_key: str | None = Header(default=None)):
    """Check if dev overlay is allowed."""
    if DEV_OVERLAY_KEY and x_dev_key == DEV_OVERLAY_KEY:
        return {"allowed": True, "mode": "token"}

    return {"allowed": False, "mode": "denied"}
```

**Authentication**:
- Checks `x-dev-key` header against `DEV_OVERLAY_KEY` environment variable
- Returns `allowed: true` if key matches
- Returns `allowed: false, mode: denied` if no match

#### 2. Layout Stub Endpoint

**File**: `assistant_api/routers/dev.py`

```python
@router.get("/api/layout")
def layout_stub():
    """Stub endpoint for layout configuration."""
    return {
        "weights": {},
        "updated_at": None
    }
```

**Purpose**:
- Prevents 404 errors when frontend tries to fetch layout
- Returns empty weights until full layout system is implemented
- Graceful degradation (frontend handles `null` weights)

#### 3. Router Registration

**File**: `assistant_api/main.py`

```python
# Dev API routes (status, layout stubs)
from assistant_api.routers import dev as dev_router

app.include_router(dev_router.router)
```

### Project Admin Panel Guards

**File**: `apps/portfolio-ui/src/overlay/ProjectAdminPanel.ts`

The admin panel now checks `status.allowed` before showing hide/unhide buttons:

```typescript
export class ProjectAdminPanel {
  private status: OverlayStatus;

  constructor(status: OverlayStatus) {
    this.status = status;
  }

  private renderProjects(projects: Project[]) {
    // Show message if overlay not allowed
    if (!this.status.allowed) {
      list.innerHTML = `
        <div style="color: #94a3b8; text-align: center; padding: 20px;">
          <div>🔒 Dev Overlay: ${this.status.mode}</div>
          <div>
            ${this.status.mode === 'no-backend'
              ? 'Backend is disabled. Set VITE_BACKEND_ENABLED=1...'
              : this.status.mode === 'unreachable'
              ? 'Backend is unreachable. Check if API server is running.'
              : 'Use ?dev_overlay=dev to unlock locally.'}
          </div>
        </div>
      `;
      return;
    }

    // ... render project list with hide/unhide buttons ...
  }
}
```

**Status Messages**:
- `no-backend` → "Backend is disabled. Set `VITE_BACKEND_ENABLED=1`..."
- `unreachable` → "Backend is unreachable. Check if API server is running."
- `denied` → "Access denied. Check `DEV_OVERLAY_KEY` configuration."
- `local` → Full access (shows all buttons)

## Environment Variables

### Backend

```bash
# Dev overlay authentication key
DEV_OVERLAY_KEY="your-secret-key-here"
```

### Frontend (Build-time)

```bash
# Enable backend features (API calls)
VITE_BACKEND_ENABLED=1

# Dev overlay authentication key (must match backend)
VITE_DEV_OVERLAY_KEY="your-secret-key-here"
```

## Usage Scenarios

### Scenario 1: Local Development (Backend Running)

1. Start backend: `uvicorn assistant_api.main:app --port 8001`
2. Set environment variables:
   ```bash
   export DEV_OVERLAY_KEY="dev-key-123"
   export VITE_BACKEND_ENABLED=1
   export VITE_DEV_OVERLAY_KEY="dev-key-123"
   ```
3. Build frontend: `pnpm run build:portfolio`
4. Visit site with `sa_dev` cookie set
5. Overlay shows "DEV" badge
6. Click gear icon → Admin panel opens
7. Full hide/unhide controls available

### Scenario 2: Local Development (Backend Down)

1. Visit site without backend running
2. Overlay shows "DEV" badge but status is `unreachable`
3. Click gear icon → Admin panel shows:
   - "Backend is unreachable. Check if API server is running."
4. Option 1: Start backend and reload
5. Option 2: Use local override:
   - Add `?dev_overlay=dev` to URL, or
   - Click "🔓 Enable Dev Overlay (Local)" button
   - Overlay works without backend (limited to local state)

### Scenario 3: Static-Only Build

1. Build without `VITE_BACKEND_ENABLED`:
   ```bash
   unset VITE_BACKEND_ENABLED
   pnpm run build:portfolio
   ```
2. Deploy static files only
3. Visit site with `sa_dev` cookie
4. Overlay shows "DEV" badge but status is `no-backend`
5. Admin panel shows:
   - "Backend is disabled. Set `VITE_BACKEND_ENABLED=1`..."
6. No API calls are attempted (saves network requests)

### Scenario 4: Production (Full Stack)

1. Backend deployed with `DEV_OVERLAY_KEY` set
2. Frontend built with `VITE_BACKEND_ENABLED=1` and matching key
3. Visit site with `sa_dev` cookie
4. Overlay fetches status from `/api/dev/status`
5. If authenticated (`x-dev-key` matches):
   - `allowed: true, mode: token`
   - Full admin controls available
6. If not authenticated:
   - `allowed: false, mode: denied`
   - Admin panel shows access denied message

## Testing

### Backend Import Test

```bash
cd assistant_api
python -c "from routers.dev import router; print('✓ Dev router imports successfully')"
```

**Expected**: `✓ Dev router imports successfully`

### Frontend Build Test

```bash
pnpm run build:portfolio
```

**Expected**: Build completes without TypeScript errors

### Status Endpoint Test

```bash
# Without key (denied)
curl http://localhost:8001/api/dev/status

# With key (allowed)
curl http://localhost:8001/api/dev/status \
  -H "x-dev-key: dev-key-123"
```

**Expected**:
- Without key: `{"allowed": false, "mode": "denied"}`
- With key: `{"allowed": true, "mode": "token"}`

### Layout Endpoint Test

```bash
curl http://localhost:8001/api/layout
```

**Expected**: `{"weights": {}, "updated_at": null}`

## Files Changed

### New Files (1)
- `assistant_api/routers/dev.py` - Dev status and layout stub endpoints

### Modified Files (4)
1. `apps/portfolio-ui/src/dev-overlay.ts`
   - Added `fetchOverlayStatus()` with fallback chain
   - Added `showToast()` for non-blocking notifications
   - Added `addLocalUnlockButton()` for local override
   - Removed modal alerts

2. `apps/portfolio-ui/src/layout.ts`
   - Added `fetchLayout()` helper with null returns
   - Added `VITE_BACKEND_ENABLED` guards
   - Safe error handling (no throws)

3. `apps/portfolio-ui/src/overlay/ProjectAdminPanel.ts`
   - Added `status: OverlayStatus` parameter to constructor
   - Added status-based UI guards in `renderProjects()`
   - Shows contextual messages when not allowed

4. `assistant_api/main.py`
   - Imported and registered `dev_router`

## Migration Guide

### For Existing Deployments

1. **Add Environment Variable**:
   ```bash
   export DEV_OVERLAY_KEY="$(openssl rand -hex 32)"
   ```

2. **Update Frontend Build**:
   ```bash
   export VITE_BACKEND_ENABLED=1
   export VITE_DEV_OVERLAY_KEY="same-key-as-backend"
   pnpm run build:portfolio
   ```

3. **Deploy Backend First** (ensures `/api/dev/status` endpoint is available)

4. **Deploy Frontend** (uses new resilient status checking)

### For New Deployments

1. Set both backend and frontend environment variables
2. Build and deploy normally
3. Overlay will auto-detect backend availability

## Troubleshooting

### Overlay Shows "unreachable"

**Cause**: Backend is not running or not accessible
**Solution**:
- Check backend is running: `curl http://localhost:8001/api/dev/status`
- Check network/proxy configuration
- Use local override: `?dev_overlay=dev`

### Overlay Shows "denied"

**Cause**: `DEV_OVERLAY_KEY` mismatch or not set
**Solution**:
- Check backend has `DEV_OVERLAY_KEY` environment variable
- Check frontend has matching `VITE_DEV_OVERLAY_KEY` at build time
- Verify header is sent: Open DevTools → Network → Check `x-dev-key` header

### Overlay Shows "no-backend"

**Cause**: Frontend built without `VITE_BACKEND_ENABLED=1`
**Solution**:
- Rebuild with `VITE_BACKEND_ENABLED=1`
- Or use local override: `?dev_overlay=dev`

### Admin Panel Shows Lock Message

**Cause**: `status.allowed = false`
**Solution**:
- Fix the underlying status issue (see above)
- Or use local override for development

### Layout Still 404s

**Cause**: Dev router not registered in main.py
**Solution**:
- Verify `from assistant_api.routers import dev as dev_router` in main.py
- Verify `app.include_router(dev_router.router)` is present
- Restart backend

## Future Enhancements

1. **Cloudflare Access Integration**
   - Add `mode: 'access'` for CF Access authenticated requests
   - Check CF Access headers in `/api/dev/status`

2. **Persistent Dev Unlock**
   - Store unlock token in localStorage with expiry
   - Refresh token mechanism

3. **Status Dashboard**
   - Show all backend health checks in admin panel
   - Real-time connection status indicator

4. **Graceful Degradation Levels**
   - Level 1: Full backend access (hide/unhide + refresh)
   - Level 2: Local state only (view + localStorage toggle)
   - Level 3: Read-only (view only, no mutations)

## Success Metrics

✅ No modal alerts blocking UI
✅ Graceful 404 handling (no console errors)
✅ Works without backend (local override)
✅ Clear status messages for all failure modes
✅ Backend imports successfully
✅ Frontend builds without errors
✅ Admin panel respects `allowed` status

## Commit Message

```
feat: Add resilient dev overlay architecture with graceful fallbacks

Frontend:
- fetchOverlayStatus() with 4-layer fallback (local → env → backend → unreachable)
- ?dev_overlay=dev query param for instant local unlock
- Toast notifications replace modal alerts
- Safe layout fetch with null returns on errors
- Local unlock button for backend-less development

Backend:
- GET /api/dev/status endpoint with DEV_OVERLAY_KEY authentication
- GET /api/layout stub endpoint (prevents 404s)
- Dev router registered in main.py

Admin Panel:
- Status-aware rendering (only shows buttons when allowed)
- Contextual error messages for each status mode
- Graceful degradation when backend unavailable

Environment Variables:
- DEV_OVERLAY_KEY (backend auth)
- VITE_BACKEND_ENABLED (frontend feature flag)
- VITE_DEV_OVERLAY_KEY (frontend auth)

This architecture ensures the dev overlay never blocks the UI and works
reliably whether the backend is available or not.
```
