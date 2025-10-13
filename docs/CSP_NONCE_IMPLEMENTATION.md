# CSP Nonce Implementation - Complete

**Date**: October 12, 2025
**Status**: ✅ COMPLETE
**Branch**: chore/portfolio-sweep

## Summary

Successfully implemented full CSP nonce support for the portfolio application. All script tags now include a dynamically generated nonce that matches the Content-Security-Policy header, enabling strict script execution control.

## What Was Implemented

### 1. CSP Header with Nonce ✅

**Location**: `deploy/nginx.portfolio.conf` - `location /` block

```nginx
add_header Content-Security-Policy "default-src 'self';
  base-uri 'self';
  frame-ancestors 'self';
  object-src 'none';
  script-src 'self' 'nonce-$csp_nonce' https://static.cloudflareinsights.com https://assets.calendly.com 'strict-dynamic';
  style-src 'self' 'unsafe-inline' https://assets.calendly.com;
  img-src 'self' data: https:;
  font-src 'self' data: https://assets.calendly.com;
  frame-src 'self' https://calendly.com https://assets.calendly.com;
  connect-src 'self' https://assistant.ledger-mind.org https://calendly.com https://assets.calendly.com;
  form-action 'self';
  upgrade-insecure-requests" always;
```

### 2. Nonce Placeholders in HTML ✅

**Location**: `apps/portfolio-ui/index.html`

Added `nonce="__CSP_NONCE__"` to all script tags:

1. **Calendly external widget**: `<script src="https://assets.calendly.com/assets/external/widget.js" ... nonce="__CSP_NONCE__">`
2. **Calendly inline script**: `<script type="text/javascript" nonce="__CSP_NONCE__">`
3. **Vanilla shell entry**: `<script type="module" src="/src/main.ts" nonce="__CSP_NONCE__">`
4. **Preact assistant island**: `<script type="module" src="/src/assistant.main.tsx" nonce="__CSP_NONCE__">`

### 3. Vite Plugin for Auto-Injected Scripts ✅

**Location**: `vite.config.portfolio.ts`

Created custom Vite plugin to add nonce placeholders to scripts injected during build:

```typescript
function injectNoncePlaceholder(): Plugin {
  return {
    name: 'inject-nonce-placeholder',
    transformIndexHtml(html) {
      return html.replace(
        /<script(?![^>]*nonce=)([^>]*)>/gi,
        '<script$1 nonce="__CSP_NONCE__">'
      );
    },
  };
}
```

This ensures the Vite-built bundle script (`/assets/main-[hash].js`) also gets the nonce.

### 4. Nonce Injection via sub_filter ✅

**Location**: `deploy/nginx.portfolio.conf` - server block

nginx replaces placeholders with actual nonce on each request:

```nginx
sub_filter_once off;
sub_filter_types text/html;
sub_filter "__CSP_NONCE__" "$csp_nonce";
```

### 5. Nonce Generation ✅

**Location**: `deploy/nginx.portfolio.conf` - top level

Uses nginx's `$request_id` as nonce source:

```nginx
map $request_id $csp_nonce {
  default $request_id;
}
```

## Verification Results

### Test 1: All Script Tags Have Nonces ✅

```powershell
curl.exe -s http://localhost:8081/ | Select-String '<script'
```

**Result**:
```html
<script type="module" crossorigin src="/assets/main-CftC6TIG.js" nonce="8f26c62579d4e257e68e05fff37a93e8"></script>
<script src="https://assets.calendly.com/assets/external/widget.js" type="text/javascript" async nonce="8f26c62579d4e257e68e05fff37a93e8"></script>
<script type="text/javascript" nonce="8f26c62579d4e257e68e05fff37a93e8"></script>
```

✅ All 3 visible script tags have nonces

### Test 2: Nonce Matches CSP Header ✅

```powershell
$response = curl.exe -s -D - http://localhost:8081/
$cspNonce = ($response | Select-String 'nonce-([a-f0-9]+)').Matches.Groups[1].Value
$htmlNonce = ($response | Select-String 'nonce="([a-f0-9]+)"').Matches.Groups[1].Value
```

**Result**:
```
CSP Header Nonce: b0ced09f5eb56833c3de04624b4ad981
HTML Script Nonce: b0ced09f5eb56833c3de04624b4ad981
✅ MATCH!
```

### Test 3: Only One Unique Nonce Per Request ✅

```powershell
$allNonces = ($response | Select-String 'nonce[=-]"?([a-f0-9]{32})').Matches |
  ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique
```

**Result**:
```
Found unique nonces: 1
  6016a862d4273f1e392f1622279de0bc
```

✅ All scripts and CSP header use the **same nonce** within a request

### Test 4: Nonce Changes Between Requests ✅

Multiple curl requests show different nonces:
- Request 1: `2c362eab6d91e77f4eaaf814d2075764`
- Request 2: `33c3e93ac7166c760ca21d1a3c70081b`
- Request 3: `b0ced09f5eb56833c3de04624b4ad981`

✅ Nonce is regenerated for each request (prevents replay attacks)

## Security Benefits

### 1. Strict Script Execution Control
Only scripts with the correct nonce can execute. This prevents:
- ❌ Inline script injection attacks
- ❌ External script injection (unless whitelisted domain)
- ❌ eval() and Function() constructor abuse

### 2. strict-dynamic Support
The CSP includes `'strict-dynamic'`, which:
- ✅ Allows scripts loaded by trusted scripts (e.g., Calendly widget loading sub-resources)
- ✅ Simplifies policy by not requiring hashes for dynamically loaded scripts
- ✅ Modern browsers support this for cleaner CSP policies

### 3. Defense in Depth
Combined with other headers:
- `X-Frame-Options: DENY` (clickjacking protection)
- `X-Content-Type-Options: nosniff` (MIME sniffing protection)
- `Referrer-Policy: strict-origin-when-cross-origin` (privacy)

## Architecture Flow

```
┌─────────────────┐
│  Browser        │
│  Request        │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  nginx (portfolio-ui)           │
│                                 │
│  1. Generate nonce              │
│     $csp_nonce = $request_id    │
│                                 │
│  2. Read index.html             │
│     (contains __CSP_NONCE__)    │
│                                 │
│  3. Replace placeholders        │
│     __CSP_NONCE__ → actual_nonce│
│                                 │
│  4. Add CSP header              │
│     script-src 'nonce-...'      │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Response to Browser            │
│                                 │
│  Header:                        │
│    CSP: script-src 'nonce-abc'  │
│                                 │
│  HTML:                          │
│    <script nonce="abc">...</>   │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Browser CSP Enforcement        │
│                                 │
│  ✅ Scripts with nonce="abc"    │
│  ❌ Scripts without nonce       │
│  ❌ Inline scripts (no nonce)   │
└─────────────────────────────────┘
```

## Files Modified

### Configuration
- `deploy/nginx.portfolio.conf`: Added CSP to `location /`, test probe header

### Source
- `apps/portfolio-ui/index.html`: Added `nonce="__CSP_NONCE__"` to 4 script tags
- `vite.config.portfolio.ts`: Added `injectNoncePlaceholder()` plugin

### Build Output
- `dist-portfolio/index.html`: Contains nonce placeholders (replaced at runtime)

### Documentation
- `docs/CSP_HEADER_FIX.md`: nginx inheritance issue resolution
- `docs/CSP_NONCE_IMPLEMENTATION.md`: This document

## Testing Checklist

- [x] CSP header appears in HTTP responses
- [x] CSP header includes `'nonce-$hash'` in script-src
- [x] All script tags have `nonce="..."` attributes
- [x] Nonce in HTML matches nonce in CSP header
- [x] Only 1 unique nonce per request (all scripts + header match)
- [x] Nonce changes between requests
- [x] Vite-built scripts have nonce (via plugin)
- [x] External scripts (Calendly) have nonce
- [x] Inline scripts have nonce
- [x] sub_filter replaces `__CSP_NONCE__` correctly
- [ ] Browser console shows no CSP violations (requires manual browser test)
- [ ] Scripts execute correctly (requires manual browser test)
- [ ] Calendly widget loads and works (requires manual browser test)

## Next Steps

### 1. Remove Test Probe Header (Optional)

Once confident CSP is stable, remove the `X-CSP-Probe` header from `nginx.portfolio.conf`:

```nginx
location / {
  # add_header X-CSP-Probe "on" always;  # Remove this line
  add_header Content-Security-Policy "..." always;
  try_files $uri $uri/ /index.html;
}
```

### 2. Browser Testing

Open http://localhost:8081/ in browser and check:
1. **Console**: No CSP violation errors
2. **Network**: All scripts load successfully
3. **Calendly**: Widget loads and popup works
4. **Assistant**: Chat panel opens and SSE connects

### 3. Document in SECURITY.md

Add section about CSP nonce implementation to security documentation.

### 4. Consider Additional Policies

Optional CSP enhancements:
- `require-trusted-types-for 'script'` (DOM XSS protection, Chrome only)
- `trusted-types` (specify allowed TrustedHTML sinks)
- `report-uri` or `report-to` (CSP violation reporting)

### 5. Monitor CSP Violations (Optional)

Set up CSP reporting to catch violations in production:

```nginx
add_header Content-Security-Policy "... report-uri /csp-report" always;
```

Create `/csp-report` endpoint in backend to log violations.

## Troubleshooting

### Issue: Scripts Don't Execute

**Symptom**: Browser console shows CSP violations

**Check**:
1. View page source, find nonce in `<script>` tag
2. View response headers, find nonce in CSP `script-src`
3. Verify they match

**Fix**: Ensure nginx sub_filter is working (check config reload)

### Issue: Nonce Placeholder Visible in HTML

**Symptom**: HTML contains `__CSP_NONCE__` literally

**Cause**: sub_filter not working or wrong sub_filter_types

**Fix**:
```nginx
sub_filter_types text/html;  # Must match response Content-Type
sub_filter_once off;         # Replace all occurrences
```

### Issue: Vite-Built Script Missing Nonce

**Symptom**: `/assets/main-[hash].js` loads without nonce

**Cause**: Vite plugin not running or not configured

**Fix**: Verify `vite.config.portfolio.ts` has plugin in `plugins: [injectNoncePlaceholder()]`

### Issue: External Scripts Blocked

**Symptom**: Calendly widget doesn't load

**Cause**: Domain not whitelisted in CSP

**Fix**: Add domain to script-src:
```nginx
script-src 'self' 'nonce-$csp_nonce' https://assets.calendly.com https://other-domain.com;
```

## Related Documentation

- [CSP Level 3 Specification](https://www.w3.org/TR/CSP3/)
- [CSP Evaluator by Google](https://csp-evaluator.withgoogle.com/)
- [nginx sub_filter module](http://nginx.org/en/docs/http/ngx_http_sub_module.html)
- [Vite Plugin API](https://vitejs.dev/guide/api-plugin.html)

## Commit Message

```
feat(security): implement CSP nonce for strict script execution

- Add nonce="__CSP_NONCE__" to all script tags in portfolio HTML
- Create Vite plugin to inject nonce into build-time scripts
- Configure nginx sub_filter to replace placeholders with actual nonce
- Update CSP header in location / block with nonce-$csp_nonce
- Fix nginx header inheritance issue (server → location)

Security:
- Prevents inline script injection attacks
- Requires valid nonce for all script execution
- Nonce changes per request (replay protection)
- Supports strict-dynamic for modern browsers

Verified:
✅ All script tags have matching nonce
✅ CSP header nonce matches HTML nonces
✅ Only 1 unique nonce per request
✅ Nonce regenerates between requests
✅ Vite-built, external, and inline scripts covered

Refs: CSP_HEADER_FIX.md, CSP_NONCE_IMPLEMENTATION.md
```

---

**Status**: ✅ Implementation complete, ready for browser testing and production deployment.
