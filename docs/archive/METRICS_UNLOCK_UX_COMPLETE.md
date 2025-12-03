# Metrics Dashboard Unlock UX Enhancement - Complete

## Summary

Enhanced the privileged metrics dashboard security with friendly unlock screens that provide better user experience when authentication fails. Users can now paste tokens directly into unlock forms without leaving the dashboard page.

## What Changed

### 1. Improved Error Handling (`assistant_api/security/dev_access.py`)

**Before**: Single 403 for all failures
**After**: Differentiated HTTP status codes:
- **401 `dev_token_required`**: No token provided (when METRICS_DEV_TOKEN is configured)
- **403 `dev_token_invalid`**: Wrong token provided
- **403 `metrics_dev_token_not_set`**: Server not configured

**Key Logic**:
```python
# Extract provided token from all sources
provided = None
auth = req.headers.get("authorization", "")
if auth.lower().startswith("bearer "):
    provided = auth.split(" ", 1)[1].strip()
provided = provided or req.headers.get("x-dev-token")
provided = provided or req.query_params.get("dev")
provided = provided or req.cookies.get("dev_token")

# Differentiate errors
if not provided:
    raise HTTPException(status_code=401, detail="dev_token_required")
if provided != expected:
    raise HTTPException(status_code=403, detail="dev_token_invalid")
```

### 2. Router Unlock Screen System (`assistant_api/routers/agent_metrics.py`)

**New Feature**: Try/except wrapper catches authentication errors and serves friendly HTML unlock forms instead of JSON errors.

**Template Lookup Priority**:
1. Themed template: `admin_assets/metrics_401.html` or `metrics_403.html`
2. Inline fallback: Generated HTML template (~50 lines) if themed file missing

**Unlock Form Features**:
- Password input field (autofocus for immediate typing)
- JavaScript `store()` function:
  - Saves to `localStorage["dev:token"]`
  - Sets cookie (`dev_token`, Path=/, SameSite=Lax)
  - Redirects to `?dev=<token>` for immediate retry
- Help text documenting all 4 auth methods
- Works seamlessly in iframe context (privileged panel)

**Code Structure**:
```python
try:
    ensure_dev_access(request, settings)
except HTTPException as e:
    status = e.status_code
    fname = "metrics_401.html" if status == 401 else "metrics_403.html"
    p = Path("admin_assets") / fname
    if p.exists():
        html = p.read_text(encoding="utf-8")
    else:
        # Generate inline fallback template
        html = f"""<!doctype html>..."""
    return HTMLResponse(content=html, status_code=status, ...)
```

### 3. Themed Templates Created

#### `admin_assets/metrics_401.html` - No Token Provided
- **Heading**: "Unlock Metrics"
- **Message**: "A dev token is required to view this dashboard."
- **Styling**: Inter font, centered card (640px), rounded corners (14px), subtle shadow
- **Form**: Password input + "Unlock" button
- **JavaScript**: Same save-and-redirect logic as inline template

#### `admin_assets/metrics_403.html` - Invalid Token
- **Heading**: "Invalid Token"
- **Message**: "The dev token provided is incorrect, or the server is not configured."
- **Label**: "Try another token"
- **Tips**: Mentions `METRICS_DEV_TOKEN` server config requirement
- **Styling**: Consistent with 401 template

### 4. Test Updates (`tests/e2e/metrics-lock.spec.ts`)

**Updated Tests**:
1. **"dashboard shows unlock screen for non-localhost access without token"**
   - Changed: Now expects 401 OR 403 (depending on server config)
   - Validates: Status code, HTML content type, "Unlock Metrics" text in body

2. **"dashboard shows unlock screen with invalid token"**
   - Changed: Now expects HTML response instead of JSON
   - Validates: 403 status, HTML content type, "Invalid Token" text in body

### 5. Documentation (`docs/DEVELOPMENT.md`)

Added mention of unlock screen feature in "Frontend integration" section:
> If access is denied, a friendly unlock page (401/403) is shown with a field to paste the token; it stores to cookie + localStorage and reloads

## User Experience Flows

### Scenario 1: Localhost Access (Dev Mode)
1. Request from 127.0.0.1 without token
2. `METRICS_ALLOW_LOCALHOST=true` (default) → **Dashboard loads** ✅
3. No unlock screen needed

### Scenario 2: External Access - Server Not Configured
1. Request from external IP without token
2. `METRICS_DEV_TOKEN` not set → **403 unlock screen** (metrics_403.html)
3. Message: "server is not configured"
4. User sees form but server won't accept any token until `METRICS_DEV_TOKEN` is set

### Scenario 3: External Access - No Token Provided
1. Request from external IP without token
2. `METRICS_DEV_TOKEN` IS set → **401 unlock screen** (metrics_401.html)
3. Message: "A dev token is required"
4. User pastes token → JavaScript saves → Redirects → **Dashboard loads** ✅

### Scenario 4: External Access - Wrong Token
1. Request from external IP with `?dev=wrong-token`
2. Token doesn't match `METRICS_DEV_TOKEN` → **403 unlock screen** (metrics_403.html)
3. Message: "Invalid Token"
4. User pastes correct token → JavaScript saves → Redirects → **Dashboard loads** ✅

## Authentication Methods Supported

All methods work seamlessly with the unlock screen:

1. **Query Parameter**: `?dev=<token>`
2. **Authorization Header**: `Authorization: Bearer <token>`
3. **Custom Header**: `X-Dev-Token: <token>`
4. **Cookie**: `dev_token=<token>`

The unlock form saves to **both** localStorage (for frontend GuardedIframe) and cookie (for backend validation), ensuring smooth experience across all contexts.

## Technical Details

### Inline Fallback Template
- **Purpose**: Always available even if themed templates missing
- **Size**: ~50 lines of HTML in Python f-string
- **Features**: Full document structure, embedded styles, contextual messages
- **JavaScript**: Uses double braces `{{` in f-string to escape for JS code

### Template Routing Logic
```python
# Determine which template to serve
fname = "metrics_401.html" if status == 401 else "metrics_403.html"
p = Path("admin_assets") / fname

# Try themed template first
if p.exists():
    html = p.read_text(encoding="utf-8")
else:
    # Fall back to inline template
    reason = {
        401: "A dev token is required...",
        403: "The provided dev token is invalid...",
    }[status if status in (401, 403) else 403]
    html = f"""<!doctype html>..."""
```

### File Candidates Update
- **Removed**: `Path("public/metrics.html")` from dashboard candidates
- **Rationale**: Dashboard is privileged content, should not be in public/
- **Now**: Only checks `admin_assets/metrics.html` for dashboard content

## Validation

### Manual Testing (via curl)
✅ Localhost without token → Full dashboard (bypass works)
✅ External IP without token → 403 unlock screen (server not configured)
✅ External IP with wrong token → 403 unlock screen with "Invalid Token"

### E2E Tests Updated
- `metrics-lock.spec.ts` expects HTML unlock screens instead of JSON errors
- Tests validate both status codes (401/403) and HTML content
- Tests check for specific heading text ("Unlock Metrics", "Invalid Token")

### Backend Restart
Backend restarted at 22:30:13 (process 39884) to load new code.

## Files Modified

1. `assistant_api/security/dev_access.py` - Refactored token checking (22 lines)
2. `assistant_api/routers/agent_metrics.py` - Added unlock screen system (~80 lines)
3. `tests/e2e/metrics-lock.spec.ts` - Updated 2 test expectations
4. `docs/DEVELOPMENT.md` - Added unlock screen mention (1 line)

## Files Created

1. `admin_assets/metrics_401.html` - Themed "no token" unlock screen (43 lines)
2. `admin_assets/metrics_403.html` - Themed "invalid token" unlock screen (43 lines)

## Configuration

No new environment variables required. Uses existing settings:
- `METRICS_DEV_TOKEN` - Auth token (optional in dev with localhost bypass)
- `METRICS_ALLOW_LOCALHOST` - Allow 127.0.0.1 without token (default: true)

## Next Steps

**Ready to commit**:
```bash
git add assistant_api/security/dev_access.py
git add assistant_api/routers/agent_metrics.py
git add admin_assets/metrics_401.html
git add admin_assets/metrics_403.html
git add tests/e2e/metrics-lock.spec.ts
git add docs/DEVELOPMENT.md
git commit -m "feat(metrics): Add friendly unlock screens for dashboard auth failures

- Split 401 (no token) vs 403 (wrong token/server misconfigured) HTTP status codes
- Serve HTML unlock forms instead of JSON errors when authentication fails
- Create themed templates (401.html, 403.html) with password input + auto-save logic
- JavaScript stores token to localStorage + cookie and redirects for immediate retry
- Update E2E tests to expect HTML unlock screens
- Works seamlessly in iframe context (privileged panel)

Improves UX by allowing users to paste tokens without leaving dashboard page."
```

**Optional improvements**:
- Add animated transition when unlocking
- Add copy button next to example auth methods
- Add server health check in unlock screen
- Add rate limiting to prevent brute force attempts

## References

- Original implementation: Phase 2 (commits 37166f0, 2410e25)
- Enhancement specification: User's 5-step patch (Message 6)
- Related docs: `METRICS_DASHBOARD_SECURITY_COMPLETE.md`
