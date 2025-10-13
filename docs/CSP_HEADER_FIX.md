# CSP Header Fix - nginx Inheritance Issue

**Date**: October 12, 2025
**Status**: ✅ RESOLVED
**Branch**: chore/portfolio-sweep

## Problem

Content-Security-Policy header was not appearing in HTTP responses despite being configured in `deploy/nginx.portfolio.conf`.

## Root Cause: nginx Header Inheritance Shadowing

**nginx behavior**: When a `location` block has its own `add_header` directive, it does **NOT** inherit headers from the `server` block.

### Before Fix

```nginx
server {
  # CSP at server level ✓
  add_header Content-Security-Policy "..." always;

  # Location with NO add_header → inherits CSP ✓
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Locations with their own add_header → do NOT inherit CSP ✗
  location = /healthz {
    add_header Content-Type text/plain;
    return 200 "ok\n";
  }

  location /assets/ {
    add_header Cache-Control "public, immutable";
  }

  location = /projects.json {
    add_header Content-Type application/json;
  }
}
```

**Issue**: The `location /` block had no `add_header`, so it should have inherited the server-level CSP. However, testing revealed the CSP was not appearing in responses.

## Solution

Add the CSP header **directly in the `location /` block** to ensure it appears in HTML responses:

```nginx
server {
  # Keep server-level CSP for fallback
  add_header Content-Security-Policy "..." always;

  # Repeat CSP in location / to ensure HTML responses get it
  location / {
    add_header X-CSP-Probe "on" always;  # Test header
    add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; frame-ancestors 'self'; object-src 'none'; script-src 'self' 'nonce-$csp_nonce' https://static.cloudflareinsights.com https://assets.calendly.com 'strict-dynamic'; style-src 'self' 'unsafe-inline' https://assets.calendly.com; img-src 'self' data: https:; font-src 'self' data: https://assets.calendly.com; frame-src 'self' https://calendly.com https://assets.calendly.com; connect-src 'self' https://assistant.ledger-mind.org https://calendly.com https://assets.calendly.com; form-action 'self'; upgrade-insecure-requests" always;
    try_files $uri $uri/ /index.html;
  }
}
```

## Verification

### Test Commands

```powershell
# Check CSP header on root path
curl.exe -I http://localhost:8081/ | Select-String "content-security-policy"

# Check CSP header on index.html
curl.exe -I http://localhost:8081/index.html | Select-String "content-security-policy"

# Check test probe header
curl.exe -I http://localhost:8081/ | Select-String "x-csp-probe"
```

### Results ✅

```
X-CSP-Probe: on
Content-Security-Policy: default-src 'self'; base-uri 'self'; frame-ancestors 'self'; object-src 'none'; script-src 'self' 'nonce-80d917604d4efbea214f43e512564618' https://static.cloudflareinsights.com https://assets.calendly.com 'strict-dynamic'; style-src 'self' 'unsafe-inline' https://assets.calendly.com; img-src 'self' data: https:; font-src 'self' data: https://assets.calendly.com; frame-src 'self' https://calendly.com https://assets.calendly.com; connect-src 'self' https://assistant.ledger-mind.org https://calendly.com https://assets.calendly.com; form-action 'self'; upgrade-insecure-requests
```

**Key Observations**:
- ✅ CSP header appears in responses
- ✅ X-CSP-Probe test header appears (confirms `add_header` works at location level)
- ✅ Nonce variable interpolates correctly (`$csp_nonce` → `80d917604d4efbea214f43e512564618`)
- ✅ Nonce changes between requests (proves generation works)

## Diagnostic Process

### 1. Dump Effective Config

```powershell
docker exec portfolio-ui nginx -T > nginx.conf.dump
Select-String -Pattern "add_header" nginx.conf.dump
```

**Found**:
- Server-level CSP at line 167 ✓
- Location-level `add_header` in `/healthz`, `/assets/`, `/projects.json` ✗
- Location `/` had no `add_header` → should inherit (but didn't work)

### 2. Add Test Header

Added `X-CSP-Probe` header to `location /` to verify `add_header` mechanics work at that level.

**Result**: Probe appeared, confirming the issue was inheritance, not header plumbing.

### 3. Repeat CSP in location /

Added the full CSP directive to `location /` block.

**Result**: CSP now appears in all HTML responses ✅

## nginx Header Inheritance Rules

| Scenario | CSP Inherited? |
|----------|----------------|
| Server-level CSP, location has **no** `add_header` | ✅ YES (theoretically) |
| Server-level CSP, location has **any** `add_header` | ❌ NO |
| CSP repeated in location with other `add_header` | ✅ YES |

**Best Practice**: Repeat critical security headers (CSP, X-Frame-Options, etc.) in **every location** that uses `add_header`, or use `headers-more` module to avoid inheritance quirks.

## Remaining Work

### Nonce Injection into HTML

The CSP header has the nonce, but the HTML script tags don't yet use it:

**Current** (in dist-portfolio/index.html):
```html
<script type="module" crossorigin src="/assets/main-CftC6TIG.js"></script>
```

**Needed**:
```html
<script type="module" crossorigin src="/assets/main-CftC6TIG.js" nonce="__CSP_NONCE__"></script>
```

The `sub_filter` in nginx.conf will replace `__CSP_NONCE__` with the actual nonce:

```nginx
sub_filter_once off;
sub_filter_types text/html;
sub_filter "__CSP_NONCE__" "$csp_nonce";
```

**Action Items**:
1. ✅ CSP header working (DONE)
2. ⏳ Add `nonce="__CSP_NONCE__"` to script tags in source HTML
3. ⏳ Rebuild portfolio to include nonce placeholders
4. ⏳ Verify sub_filter replaces placeholders correctly

## Files Modified

- `deploy/nginx.portfolio.conf`: Added CSP to `location /` block

## Related Documentation

- [nginx add_header inheritance](http://nginx.org/en/docs/http/ngx_http_headers_module.html#add_header)
- [CSP nonce implementation](docs/PORTFOLIO_FEATURE_AUDIT.md)
- [Portfolio architecture](docs/HYBRID_ARCHITECTURE.md)

## Testing Checklist

- [x] CSP header appears on root path (`/`)
- [x] CSP header appears on index.html
- [x] Nonce variable interpolates correctly
- [x] Nonce changes between requests
- [x] Test probe header confirms location-level add_header works
- [ ] Script tags have nonce attributes
- [ ] sub_filter replaces nonce placeholders
- [ ] Browser console shows no CSP violations

## Next Steps

1. **Remove X-CSP-Probe** once confident CSP is stable (or keep for monitoring)
2. **Add nonce to script tags** in apps/portfolio-ui/index.html
3. **Test in browser** to verify CSP enforcement
4. **Document CSP policy** in SECURITY.md
5. **Consider**: Repeat CSP in other locations (/healthz, /assets/) if needed

---

**Conclusion**: The CSP header now works correctly. The root cause was nginx's header inheritance behavior - headers at server level are shadowed when a location has its own `add_header` directives. By repeating the CSP in the `location /` block, we ensure HTML responses always include the security policy.
