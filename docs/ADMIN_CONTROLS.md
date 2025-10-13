# Admin Controls Documentation

**Generated**: October 13, 2025
**Purpose**: Comprehensive guide to admin-gated controls in the portfolio assistant panel.

---

## Overview

The portfolio assistant panel includes admin-only controls (Autotune, Reset) that are:
- **Hidden** for normal visitors
- **Visible** for authenticated admins (role-based)
- **Toggleable** in development (via `?admin=1`)
- **Secure** with server-side enforcement

---

## Architecture

### Three-Layer Security

1. **Dev Override** (Local Development Only)
   - URL parameter: `?admin=1` (persists in `localStorage`)
   - Controlled by: `VITE_ALLOW_DEV_ADMIN` environment variable
   - **Production**: Disabled (`VITE_ALLOW_DEV_ADMIN=0`)
   - **Development**: Enabled (`VITE_ALLOW_DEV_ADMIN=1`)

2. **Role-Based Authentication** (Production)
   - Backend endpoint: `GET /api/auth/me`
   - Required fields: `is_admin: true` OR `roles: ["admin"]`
   - Session-based: Uses HTTP-only cookies

3. **Server-Side Enforcement** (Critical)
   - All admin endpoints validate auth server-side
   - Endpoints: `/api/layout/autotune`, `/api/layout/reset`
   - Returns: `401 Unauthorized` or `403 Forbidden` for non-admins

### Performance Optimization

- **10-second cache**: `isAdmin()` result cached to reduce auth checks
- **Window focus refresh**: Re-checks auth when window regains focus
- **localStorage persistence**: Dev override survives page reloads

---

## File Structure

```
apps/portfolio-ui/src/
├── admin.ts               # Core admin gate logic
├── main.ts                # Initializes admin on boot
├── assistant.main.tsx     # UI integration (admin buttons)
└── portfolio.css          # Badge styling

apps/portfolio-ui/
├── .env.development       # VITE_ALLOW_DEV_ADMIN=1
└── .env.production        # VITE_ALLOW_DEV_ADMIN=0

tests/e2e/
└── admin.panel.spec.ts    # E2E tests (4 test cases)

deploy/
└── nginx.portfolio.conf   # Cookie forwarding, /api/* proxy
```

---

## Admin Functions

### `initAdminFromQuery()`
**Purpose**: Parse `?admin=1` from URL and persist in `localStorage`.

**Usage**: Called in `apps/portfolio-ui/src/main.ts` on boot.

**Behavior**:
- `?admin=1` or `?admin=true` → Enable
- `?admin=0` or `?admin=false` → Disable
- Cleans URL after capturing flag (removes query param)

---

### `devAdminEnabled()`
**Purpose**: Check if dev override is active.

**Returns**: `boolean`

**Logic**:
```typescript
const flag = localStorage.getItem("admin:enabled") === "1";
const allow = import.meta.env?.VITE_ALLOW_DEV_ADMIN === "1";
return allow && flag;
```

**Security**: Only works when `VITE_ALLOW_DEV_ADMIN=1` (dev builds).

---

### `fetchAuth()`
**Purpose**: Fetch current user authentication info from backend.

**Endpoint**: `GET /api/auth/me`

**Returns**: `AuthInfo | null`
```typescript
interface AuthInfo {
  user?: {
    id?: string;
    email?: string;
    roles?: string[];
    is_admin?: boolean;
  }
}
```

**Error Handling**: Returns `null` on network errors or 401/403.

---

### `hasAdminRole(info)`
**Purpose**: Check if user has admin privileges.

**Logic**:
```typescript
return info?.user?.is_admin === true ||
       info?.user?.roles?.includes("admin") ||
       info?.user?.roles?.includes("owner");
```

---

### `isAdmin()`
**Purpose**: Final decision with 10s cache.

**Returns**: `Promise<boolean>`

**Flow**:
1. Check dev override → Return `true` if enabled
2. Check cache → Return cached value if < 10s old
3. Fetch auth → Call `/api/auth/me`
4. Check roles → Return `hasAdminRole(info)`
5. Update cache → Store result for 10s

**Performance**: Max 1 auth check per 10 seconds.

---

## UI Integration

### Assistant Panel Header

```tsx
<div class="hdr" style="display:flex; align-items:center; gap:.5rem;">
  <div style="font-weight:600;">Portfolio Assistant</div>
  {admin && <span class="asst-badge-admin">admin</span>}
  <div class="asst-controls">
    {admin && (
      <>
        <button
          class="btn-sm"
          onClick={autotuneLayout}
          title="Admin only: Autotune layout"
          data-testid="btn-autotune"
        >
          Autotune
        </button>
        <button
          class="btn-sm"
          onClick={resetLayout}
          title="Admin only: Reset layout"
          data-testid="btn-reset"
        >
          Reset
        </button>
      </>
    )}
    <button class="btn-sm" onClick={()=>setOpen(false)} title="Hide panel">
      Hide
    </button>
  </div>
</div>
```

### Admin Badge CSS

```css
.asst-badge-admin {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 999px;
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #a7f3d0;
  background: rgba(16, 185, 129, 0.12);
  font-weight: 500;
  letter-spacing: 0.3px;
}
```

---

## Usage Guide

### Development

**Enable Admin Mode** (persists across reloads):
```
http://127.0.0.1:5174/?admin=1
```

**Disable Admin Mode**:
```
http://127.0.0.1:5174/?admin=0
```

**Check Status**:
```javascript
// Browser console
localStorage.getItem('admin:enabled')  // "1" = enabled
```

**Run E2E Tests**:
```bash
pnpm run e2e:portfolio -- tests/e2e/admin.panel.spec.ts
```

---

### Production

**Authentication Flow**:
1. User signs in via auth provider (not covered in this doc)
2. Backend sets HTTP-only session cookie
3. Frontend calls `GET /api/auth/me` to check roles
4. Admin UI appears if `is_admin: true` or `roles: ["admin"]`

**Verification**:
```bash
# Check auth status (staging/prod)
curl -s -b "YOUR_COOKIE_HERE" https://assistant.ledger-mind.org/api/auth/me | jq

# Expected response for admin:
{
  "user": {
    "id": "...",
    "email": "admin@example.com",
    "roles": ["admin"],
    "is_admin": true
  }
}
```

**Test Admin Endpoints**:
```bash
# Without auth → 401/403
curl -i -X POST https://assistant.ledger-mind.org/api/layout/reset

# With admin cookie → 200
curl -i -b "YOUR_COOKIE_HERE" -X POST https://assistant.ledger-mind.org/api/layout/reset
```

---

## Security Considerations

### Frontend Security (Defense in Depth)

1. **Dev override disabled in prod**: `VITE_ALLOW_DEV_ADMIN=0` in production builds
2. **Auth check on every action**: Button clicks call backend endpoints with auth
3. **10s cache limit**: Prevents stale admin status from persisting too long
4. **Window focus refresh**: Re-checks auth when user returns to tab

### Backend Security (Critical)

⚠️ **Never trust frontend checks alone!**

All admin endpoints MUST:
- Validate session cookie
- Check `user.is_admin` or `user.roles`
- Return `401 Unauthorized` for missing auth
- Return `403 Forbidden` for insufficient privileges

**Example Backend Guard** (FastAPI):
```python
from fastapi import Depends, HTTPException, status

async def require_admin(user = Depends(get_current_user)):
    if not user or not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return user

@app.post("/api/layout/autotune")
async def autotune_layout(admin_user = Depends(require_admin)):
    # ... admin-only logic
```

---

## Environment Variables

### Development (`.env.development`)

```env
VITE_ALLOW_DEV_ADMIN=1
```

**Effect**: Allows `?admin=1` URL override.

---

### Production (`.env.production`)

```env
VITE_ALLOW_DEV_ADMIN=0
```

**Effect**: Disables dev override. Only real auth works.

---

## nginx Configuration

### Cookie Forwarding

**File**: `deploy/nginx.portfolio.conf`

```nginx
location /api/ {
  proxy_pass http://backend:8001;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header Cookie $http_cookie;  # Critical for auth
}
```

**Why**: Ensures session cookies reach the backend for auth validation.

---

## E2E Tests

**File**: `tests/e2e/admin.panel.spec.ts`

### Test Cases (4)

1. **Hidden by default**
   - Verifies admin controls NOT visible for unsigned users
   - Checks: `btn-autotune`, `btn-reset` have count = 0

2. **Visible with dev admin override**
   - Navigates to `/?admin=1`
   - Reloads clean URL
   - Verifies admin controls visible
   - Checks: `btn-autotune`, `btn-reset` are visible

3. **Admin override disabled with ?admin=0**
   - Enables admin mode
   - Disables with `?admin=0`
   - Verifies admin controls hidden again

4. **Admin badge styling**
   - Enables admin mode
   - Checks `.asst-badge-admin` element exists
   - Validates CSS properties (font-size, border-radius, color)

### Running Tests

```bash
# All admin tests
pnpm run e2e:portfolio -- tests/e2e/admin.panel.spec.ts

# Specific test
pnpm run e2e:portfolio -- -g "admin controls"

# Debug mode
pnpm run e2e:portfolio -- tests/e2e/admin.panel.spec.ts --debug
```

---

## Troubleshooting

### Issue: Admin buttons not appearing in dev

**Check**:
1. `.env.development` has `VITE_ALLOW_DEV_ADMIN=1`
2. Visited `/?admin=1` at least once
3. localStorage has `admin:enabled = "1"`
4. Dev server restarted after `.env` change

**Solution**:
```bash
# Clear localStorage
localStorage.removeItem('admin:enabled')

# Re-enable
open http://127.0.0.1:5174/?admin=1

# Verify
localStorage.getItem('admin:enabled')  // Should be "1"
```

---

### Issue: Admin buttons appearing for non-admin users in prod

**Check**:
1. `.env.production` has `VITE_ALLOW_DEV_ADMIN=0`
2. Backend `/api/auth/me` returns correct roles
3. Production build used (not dev build deployed)

**Solution**:
```bash
# Rebuild with production env
pnpm run build:portfolio

# Verify VITE_ALLOW_DEV_ADMIN not in bundle
grep -r "VITE_ALLOW_DEV_ADMIN" dist-portfolio/  # Should be empty
```

---

### Issue: Auth check failing (403/401)

**Check**:
1. Backend running on port 8001
2. nginx forwarding cookies (`proxy_set_header Cookie $http_cookie`)
3. `/api/auth/me` endpoint implemented
4. User session valid

**Solution**:
```bash
# Test auth endpoint directly
curl -v -b "YOUR_COOKIE_HERE" http://localhost:8001/api/auth/me

# Check nginx config
docker exec -it portfolio-ui nginx -T | grep -A 5 "location /api/"
```

---

## Future Enhancements

- [ ] **Role-based feature flags**: Different controls for different admin levels
- [ ] **Audit logging**: Track who triggered autotune/reset (server-side)
- [ ] **Admin dashboard**: Dedicated admin panel with more controls
- [ ] **Permission groups**: Fine-grained permissions (e.g., `layout:write`, `chat:admin`)
- [ ] **Session timeout warnings**: Alert admin when session expires soon

---

## Related Documentation

- **Deployment**: `docs/DEPLOY.md`
- **Layout System**: `docs/ARCHITECTURE.md` (Layout Management section)
- **Security**: `docs/SECURITY.md`
- **API Reference**: `docs/API.md` (Admin Endpoints)

---

**Last Updated**: October 13, 2025
**Status**: Complete and production-ready
