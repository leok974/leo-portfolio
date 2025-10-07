# Admin Router Migration - Centralized CF Access Protection

## Overview

All privileged operations are now consolidated under `/api/admin/*` with a **single Cloudflare Access guard**. This makes it impossible to accidentally expose sensitive endpoints.

## Changes

### Before (Scattered Protection)
```python
# Multiple routers, each with separate guards
router_uploads = APIRouter(prefix="/api/uploads", dependencies=[Depends(require_cf_access)])
router_gallery = APIRouter(prefix="/api/gallery", dependencies=[Depends(require_cf_access)])
# Risk: Easy to forget guard on new endpoints
```

### After (Centralized Protection)
```python
# Single admin router with guard applied to ALL endpoints
admin = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(require_cf_access)]  # <- Protects everything!
)

@admin.get("/whoami")
def whoami(...): ...

@admin.post("/uploads")
def uploads(...): ...

@admin.post("/gallery/add")
def gallery_add(...): ...
```

## Endpoint Changes

| Old Path | New Path | Method | Description |
|----------|----------|--------|-------------|
| `/api/uploads` | `/api/admin/uploads` | POST | File upload with gallery integration |
| `/api/gallery/add` | `/api/admin/gallery/add` | POST | Add gallery item |
| N/A | `/api/admin/whoami` | GET | Smoke test (returns authenticated email) |

## Cloudflare Access Configuration

### Application Settings

**⚠️ IMPORTANT: Update your CF Access application to use the new path**

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. Navigate to **Access** → **Applications**
3. Find your application (e.g., "Assistant API")
4. Update **Application Domain**:
   - **Old:** `assistant.ledger-mind.org/api/uploads`
   - **New:** `assistant.ledger-mind.org/api/admin`
5. **Path:** `/api/admin` (covers all admin endpoints)

### Authentication Flow

```powershell
# Login (do this once)
cloudflared access login https://assistant.ledger-mind.org/api/admin

# Get JWT token
$token = cloudflared access token --app https://assistant.ledger-mind.org/api/admin

# Test whoami (simplest smoke test)
curl -H "Cf-Access-Jwt-Assertion: $token" https://assistant.ledger-mind.org/api/admin/whoami
# Expected: {"ok":true,"email":"your-email@example.com"}

# Test uploads
$headers = @{ "Cf-Access-Jwt-Assertion" = $token }
Invoke-WebRequest -Uri "https://assistant.ledger-mind.org/api/admin/uploads" -Headers $headers -Method GET
# Expected: 405 (Method Not Allowed - JWT verified!)
```

## Testing

### Run CI Guard Test

```bash
# Verify all /api/admin/* routes have CF Access protection
pytest tests/test_admin_guard.py -v
```

This test **fails the build** if:
- Any `/api/admin/*` route is missing `require_cf_access`
- Old `/api/uploads` or `/api/gallery` routes still exist

### Production Smoke Test

```powershell
.\test-production.ps1
```

Tests:
1. Authenticate with cloudflared
2. Get JWT token
3. ✅ `/api/admin/whoami` - Simple identity check
4. ✅ `/api/admin/uploads` - Upload endpoint (405 with JWT)
5. ✅ `/api/admin/gallery/add` - Gallery endpoint (405 with JWT)
6. ❌ `/api/admin/whoami` without JWT - Should return 403
7. Decode JWT to verify claims

## Migration Checklist

### Backend ✅
- [x] Consolidate all privileged operations into `admin.py`
- [x] Remove old `uploads.py` and `gallery.py` routers
- [x] Update `main.py` to only register `admin.router`
- [x] Verify single guard at router level

### Testing ✅
- [x] Create `tests/test_admin_guard.py`
- [x] Update `test-production.ps1` with new URLs
- [x] Add CI job for guard audit

### Documentation ✅
- [x] Update `CLOUDFLARE_ACCESS_COMMANDS.md`
- [x] Update `PRODUCTION_DEPLOY_CF_ACCESS.md`
- [x] Update `CF_ACCESS_DEPLOYMENT_SUMMARY.md`
- [x] Create migration guide (this file)

### Cloudflare Access ⚠️
- [ ] Update application path to `/api/admin`
- [ ] Test authentication flow with new URLs
- [ ] Remove old path rules if any

### Frontend/Clients ⚠️
- [ ] Update any hardcoded URLs to use `/api/admin/*`
- [ ] Test file uploads through UI
- [ ] Verify gallery management works

## Benefits

1. **Single Source of Truth:** One guard protects everything
2. **Impossible to Forget:** Router-level dependency applies to all endpoints
3. **Clear Naming:** `/api/admin/*` signals "privileged operation"
4. **Easy Auditing:** CI test ensures all admin routes are guarded
5. **Simple Testing:** One token works for all admin endpoints

## Adding New Privileged Endpoints

```python
# In assistant_api/routers/admin.py

@router.post("/new-feature")
async def new_privileged_operation(email: str = Depends(require_cf_access)):
    """
    New privileged operation - automatically protected!

    Router-level guard already applies, but you can access the
    authenticated email via the Depends parameter if needed.
    """
    return {"ok": True, "email": email}
```

**That's it!** No need to add guards manually - the router handles it.

## Troubleshooting

### "403 Forbidden" on all admin endpoints
- **Cause:** CF Access application path not updated
- **Fix:** Update CF Access app to use `/api/admin` path

### "404 Not Found" on old URLs
- **Cause:** Frontend/tests still using old URLs
- **Fix:** Update to new `/api/admin/*` paths

### CI test fails: "route missing require_cf_access"
- **Cause:** New endpoint added without guard
- **Fix:** Ensure endpoint is in `admin.router`, not a separate router

### Token command fails
- **Cause:** Using old app URL
- **Fix:** Update command:
  ```powershell
  # Old
  cloudflared access token --app https://assistant.ledger-mind.org/api/uploads

  # New
  cloudflared access token --app https://assistant.ledger-mind.org/api/admin
  ```

## References

- **Backend:** `assistant_api/routers/admin.py`
- **Tests:** `tests/test_admin_guard.py`
- **Smoke Test:** `test-production.ps1`
- **Commands:** `CLOUDFLARE_ACCESS_COMMANDS.md`
