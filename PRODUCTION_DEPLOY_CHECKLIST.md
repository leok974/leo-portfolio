# Production Deployment Checklist

**Version:** 1.0
**Last Updated:** October 6, 2025
**Status:** Pre-deployment verification required

---

## 🔒 Security Headers (Server-Level)

**Priority:** CRITICAL - Must be served via nginx/server, not meta tags.

### Required Headers

```nginx
# Add to nginx server block (deploy/nginx/nginx.prod.conf or similar)

# HSTS - Force HTTPS for 1 year
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

# CSP - Content Security Policy
add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://assets.calendly.com; style-src 'self' 'unsafe-inline' https://assets.calendly.com; img-src 'self' data: https://*.calendly.com; frame-src https://calendly.com https://*.calendly.com; connect-src 'self' https://calendly.com https://*.calendly.com; font-src 'self' https://fonts.gstatic.com" always;

# Referrer Policy - Only send origin on cross-origin requests
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# X-Content-Type-Options - Prevent MIME sniffing
add_header X-Content-Type-Options "nosniff" always;

# X-Frame-Options - Prevent clickjacking
add_header X-Frame-Options "SAMEORIGIN" always;

# Optional: Permissions Policy (restrict APIs)
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

### ✅ Verification Steps

1. **Update nginx config:**
   - [ ] Edit `deploy/nginx/nginx.prod.conf` or equivalent
   - [ ] Add all security headers to `server` block
   - [ ] Ensure headers include `always` flag (applies even on error responses)

2. **Test headers locally:**
   ```bash
   # Start production nginx
   docker-compose -f deploy/docker-compose.prod.yml up -d nginx

   # Verify headers
   curl -I http://localhost:8080 | grep -E "(Strict-Transport|Content-Security|Referrer-Policy|X-Content-Type|X-Frame)"
   ```

3. **Remove meta tag fallbacks (optional):**
   - [ ] index.html line 6-9: Keep meta CSP only as fallback
   - [ ] book.html line 8-16: Keep meta CSP only as fallback
   - [ ] Server headers override meta tags anyway, but removing reduces redundancy

---

## 🎨 Fonts Configuration

**Priority:** HIGH - Ensure optimal loading and CORS

### Required Links

Both `index.html` and `book.html` should have:

```html
<!-- Preconnect for performance -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<!-- Font imports -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
```

### ✅ Verification Steps

1. **Check index.html:**
   ```bash
   grep -A 5 "fonts.googleapis.com" index.html
   ```
   - [ ] Has `preconnect` to `fonts.googleapis.com`
   - [ ] Has `preconnect` to `fonts.gstatic.com` with `crossorigin`
   - [ ] Includes Inter font (weights: 300, 400, 500, 600, 700)
   - [ ] Includes Space Grotesk font (weights: 500, 700)

2. **Check book.html:**
   ```bash
   grep -A 5 "fonts.googleapis.com" book.html
   ```
   - [ ] Has `preconnect` to `fonts.gstatic.com` (line 20)
   - [ ] Has font imports in `<head>` section
   - [ ] CSP `font-src` includes `https://fonts.gstatic.com`

3. **Update CSP if needed:**
   ```nginx
   # Ensure font-src includes Google Fonts
   font-src 'self' https://fonts.gstatic.com;
   ```

---

## 📅 Calendly Configuration

**Priority:** HIGH - Verify all Calendly data attributes

### Popup Button (#book-call)

**Location:** `index.html` (main page)

```html
<button
  id="book-call"
  data-calendly-url="https://calendly.com/leok974/intro-15"
  data-calendly-utm-source="portfolio"
  data-calendly-utm-campaign="hero-cta"
  data-calendly-utm-medium="cta"
  data-calendly-locale="en"
  data-calendly-prefill="1"
  ...>
  Book a call
</button>
```

### Inline Widget (#calendly-inline)

**Location:** `book.html` (dedicated booking page)

```html
<div
  id="calendly-inline"
  data-testid="calendly-inline"
  data-calendly-url="https://calendly.com/leok974/intro-15"
  data-calendly-utm-source="portfolio"
  data-calendly-utm-campaign="book-page"
  data-calendly-utm-medium="cta"
  data-calendly-locale="en"
  data-calendly-prefill="1">
</div>
```

### ✅ Verification Steps

1. **Verify popup button:**
   ```bash
   grep -A 8 'id="book-call"' index.html
   ```
   - [ ] `data-calendly-url` points to correct Calendly link
   - [ ] `data-calendly-utm-source="portfolio"`
   - [ ] `data-calendly-utm-campaign` is descriptive (e.g., "hero-cta")
   - [ ] `data-calendly-prefill="1"` (enables name/email prefill)

2. **Verify inline widget:**
   ```bash
   grep -A 8 'id="calendly-inline"' book.html
   ```
   - [ ] `data-calendly-url` matches popup button URL
   - [ ] `data-calendly-utm-campaign="book-page"` (distinguishes from popup)
   - [ ] `data-testid="calendly-inline"` present (for E2E tests)

3. **Test Calendly integration:**
   - [ ] Open site in browser
   - [ ] Click "Book a call" button → popup opens
   - [ ] Navigate to `/book.html` → inline widget loads
   - [ ] Check browser console for Calendly errors

---

## 💾 Cache Configuration

**Priority:** HIGH - Long cache for static assets with versioning

### Nginx Cache Rules

```nginx
# Long-cache immutable assets (hashed filenames)
location ^~ /assets/ {
  add_header Cache-Control "public, max-age=31536000, immutable";
  try_files $uri =404;
}

# Long-cache fonts
location ^~ /fonts/ {
  add_header Cache-Control "public, max-age=31536000, immutable";
  try_files $uri =404;
}

# Long-cache JS/CSS with hashed names
location ~* \.(?:js|css|woff2|png|jpe?g|webp|gif|svg|ico)$ {
  add_header Cache-Control "public, max-age=31536000, immutable";
  try_files $uri =404;
}

# Short cache for HTML (to allow quick updates)
location ~* \.html$ {
  add_header Cache-Control "public, max-age=300";
  try_files $uri =404;
}
```

### Asset Hashing Strategy

**Current:**
- Vite automatically hashes assets: `consent.js` → `consent.abc123.js`
- File digests in `asset-digests.json`

**Recommended:**
- [ ] Verify Vite build produces hashed filenames
- [ ] Check `dist/assets/js/` for hashed files
- [ ] Ensure `index.html` references hashed files (Vite auto-injects)

### ✅ Verification Steps

1. **Build with hashing:**
   ```bash
   npm run build
   ls -la dist/assets/js/
   # Should see: consent.abc123.js, calendly.def456.js
   ```

2. **Check nginx config:**
   ```bash
   grep -A 3 "location.*assets" deploy/nginx/nginx.prod.conf
   ```
   - [ ] `/assets/` location has `max-age=31536000`
   - [ ] Has `immutable` directive
   - [ ] Security headers still apply (`always` flag)

3. **Verify cache headers:**
   ```bash
   # After deploying
   curl -I http://localhost:8080/assets/js/consent.abc123.js | grep Cache-Control
   # Should show: Cache-Control: public, max-age=31536000, immutable
   ```

---

## 📊 Consent Analytics Tracking

**Priority:** MEDIUM - Track consent acceptance rates (privacy-compliant)

### Implementation

**Location:** Add to `public/assets/js/consent.js` or create `public/assets/js/analytics.js`

```javascript
// Track consent changes (only fires when consent is given)
document.addEventListener('consent:change', (event) => {
  const consent = event.detail; // null or {analytics, marketing, calendly}

  // Only track if user gave consent
  if (!consent) return;

  // Google Analytics (gtag)
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'consent_change', {
      analytics: consent.analytics,
      marketing: consent.marketing,
      calendly: consent.calendly,
      event_category: 'privacy',
      event_label: consent.analytics ? 'accepted' : 'declined'
    });
  }

  // Plausible Analytics
  if (typeof window.plausible === 'function') {
    window.plausible('consent_change', {
      props: {
        analytics: consent.analytics,
        marketing: consent.marketing,
        calendly: consent.calendly
      }
    });
  }

  // Fathom Analytics
  if (window.fathom && typeof window.fathom.trackEvent === 'function') {
    window.fathom.trackEvent('consent_change');
  }

  // Umami Analytics
  if (window.umami && typeof window.umami.track === 'function') {
    window.umami.track('consent_change', consent);
  }
});

// Track initial banner impression (fires even if consent declined)
document.addEventListener('DOMContentLoaded', () => {
  const bannerShown = !localStorage.getItem('consent.v1');

  if (bannerShown && window.plausible) {
    // Use Plausible since it's privacy-friendly and doesn't require consent
    window.plausible('consent_banner_shown', { props: { first_visit: true } });
  }
});
```

### ✅ Verification Steps

1. **Add tracking code:**
   - [ ] Create `public/assets/js/analytics.js` with above code
   - [ ] OR append to `public/assets/js/consent.js` at the end
   - [ ] Add `<script defer src="/assets/js/analytics.js"></script>` to index.html

2. **Test tracking:**
   ```bash
   # Open DevTools console
   # Accept consent
   # Check for gtag/plausible calls
   window.__analyticsEvents
   ```

3. **Privacy compliance:**
   - [ ] Tracking only fires AFTER consent given
   - [ ] No PII sent (only boolean flags)
   - [ ] Respects DNT/GPC (consent auto-declined)

---

## 🚀 Pre-Deployment Verification

### Build & Test

```bash
# 1. Clean build
npm run build

# 2. Run all tests
npx playwright test --project=chromium

# 3. Verify consent tests (9 tests)
npx playwright test tests/e2e/consent-banner.spec.ts --project=chromium

# 4. Verify Calendly tests (16 tests)
npx playwright test calendly --project=chromium
```

**Expected results:**
- [ ] Build completes without errors
- [ ] All 31+ tests pass
- [ ] No console errors in test output

### Local Production Preview

```bash
# 1. Start production stack
cd deploy
docker-compose -f docker-compose.prod.yml up -d

# 2. Verify services
docker-compose ps
# Should show: nginx, backend, ollama (all Up)

# 3. Check logs
docker-compose logs -f nginx
# Should show: nginx started, no errors

# 4. Test endpoints
curl -I http://localhost:8080/
curl -I http://localhost:8080/book.html
curl http://localhost:8080/api/ready
```

**Expected results:**
- [ ] All services running
- [ ] No errors in logs
- [ ] `/` returns 200 with security headers
- [ ] `/book.html` returns 200
- [ ] `/api/ready` returns 200 (backend healthy)

### Security Verification

```bash
# Check all security headers
curl -I http://localhost:8080/ | grep -E "(Strict-Transport|Content-Security|Referrer-Policy|X-Content-Type|X-Frame)"

# Expected output:
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
# Content-Security-Policy: default-src 'self'; ...
# Referrer-Policy: strict-origin-when-cross-origin
# X-Content-Type-Options: nosniff
# X-Frame-Options: SAMEORIGIN
```

**Checklist:**
- [ ] HSTS header present (only if HTTPS enabled)
- [ ] CSP header present with Calendly origins
- [ ] Referrer-Policy present
- [ ] X-Content-Type-Options present
- [ ] X-Frame-Options present

### Functional Testing

**Manual verification:**

1. **Homepage (index.html):**
   - [ ] Page loads without errors
   - [ ] Fonts render correctly (Inter + Space Grotesk)
   - [ ] Consent banner appears on first visit
   - [ ] "Book a call" button opens Calendly popup
   - [ ] Accept consent → banner disappears
   - [ ] Reload → banner doesn't reappear

2. **Booking page (book.html):**
   - [ ] Page loads without errors
   - [ ] Inline Calendly widget loads
   - [ ] "Manage privacy preferences" link visible in footer
   - [ ] Click link → consent banner re-appears
   - [ ] Accept consent → inline widget loads (if previously declined)

3. **Privacy features:**
   - [ ] DNT/GPC auto-declines (test with browser flag)
   - [ ] Consent persists across page loads
   - [ ] `window.consent` API works in console
   - [ ] `consent:change` event fires (check DevTools)

4. **Calendly integration:**
   - [ ] Popup widget opens correctly
   - [ ] Inline widget loads iframe
   - [ ] UTM parameters present in URL
   - [ ] Prefill works (if name/email in URL params)

---

## 📋 Deployment Steps

### 1. Update Nginx Configuration

```bash
# Edit production nginx config
vim deploy/nginx/nginx.prod.conf

# Add security headers (see above)
# Verify cache rules
# Check CSP includes Calendly + Google Fonts
```

### 2. Build Frontend

```bash
# Clean build
rm -rf dist/
npm run build

# Verify hashed assets
ls -la dist/assets/js/
# Should see: consent.abc123.js, calendly.def456.js
```

### 3. Deploy to Production

```bash
# Option A: Docker Compose (full stack)
cd deploy
docker-compose -f docker-compose.prod.yml up -d --build

# Option B: Static site only (GitHub Pages)
npm run build
# Push dist/ to gh-pages branch

# Option C: Cloud deployment
# Upload dist/ to S3/Cloudflare Pages/Vercel
# Configure CDN headers (see Security Headers section)
```

### 4. Verify Deployment

```bash
# Check site is live
curl -I https://your-domain.com/

# Verify security headers
curl -I https://your-domain.com/ | grep Strict-Transport

# Test Calendly
# Visit https://your-domain.com/book.html
# Verify inline widget loads

# Test consent banner
# Open https://your-domain.com/ in incognito
# Verify banner appears
```

### 5. Monitor

```bash
# Check nginx access logs
docker-compose logs -f nginx | grep -E "(200|500)"

# Check backend health
curl https://your-domain.com/api/ready

# Monitor consent acceptance rate
# Check analytics dashboard for 'consent_change' events
```

---

## 🔍 Troubleshooting

### Security Headers Not Appearing

**Symptom:** `curl -I` shows no Strict-Transport-Security header

**Solutions:**
1. Check nginx config syntax:
   ```bash
   docker-compose exec nginx nginx -t
   ```
2. Ensure `always` flag present:
   ```nginx
   add_header Strict-Transport-Security "..." always;
   ```
3. Reload nginx:
   ```bash
   docker-compose exec nginx nginx -s reload
   ```

### Calendly Widget Not Loading

**Symptom:** Inline widget shows fallback link instead of iframe

**Solutions:**
1. Check consent status:
   ```javascript
   console.log(window.__consent);
   // Should be: {analytics: true, marketing: true, calendly: true}
   ```
2. Check CSP:
   ```bash
   curl -I https://your-domain.com/ | grep Content-Security-Policy
   # Should include: frame-src https://calendly.com https://*.calendly.com
   ```
3. Check browser console for CSP violations
4. Verify `data-calendly-url` attribute is correct

### Consent Banner Not Appearing

**Symptom:** Banner doesn't show on first visit

**Solutions:**
1. Clear localStorage:
   ```javascript
   localStorage.removeItem('consent.v1');
   location.reload();
   ```
2. Check if DNT/GPC enabled:
   ```javascript
   console.log(navigator.doNotTrack);
   console.log(window.globalPrivacyControl);
   // If '1' or true, banner auto-declines and doesn't show
   ```
3. Verify consent.js loaded:
   ```javascript
   console.log(window.consent);
   // Should be an object with get/set/clear/showBanner methods
   ```

### Fonts Not Loading

**Symptom:** Page uses fallback fonts instead of Inter/Space Grotesk

**Solutions:**
1. Check CSP font-src:
   ```bash
   curl -I https://your-domain.com/ | grep Content-Security-Policy
   # Should include: font-src 'self' https://fonts.gstatic.com
   ```
2. Verify preconnect links:
   ```bash
   grep "fonts.gstatic.com" index.html
   ```
3. Check browser console for CORS errors
4. Ensure `crossorigin` attribute on preconnect link

---

## ✅ Final Checklist

### Security
- [ ] All security headers configured in nginx
- [ ] HSTS enabled (if HTTPS)
- [ ] CSP includes Calendly origins
- [ ] CSP includes Google Fonts origin
- [ ] Meta tag fallbacks present (as backup)

### Fonts
- [ ] Preconnect to fonts.googleapis.com
- [ ] Preconnect to fonts.gstatic.com with crossorigin
- [ ] Inter font imported (weights: 300-700)
- [ ] Space Grotesk font imported (weights: 500, 700)

### Calendly
- [ ] Popup button data-calendly-url verified
- [ ] Inline widget data-calendly-url verified
- [ ] UTM parameters configured
- [ ] Prefill enabled (data-calendly-prefill="1")

### Caching
- [ ] Long cache for /assets/ (31536000)
- [ ] Long cache for /fonts/ (31536000)
- [ ] Short cache for HTML (300-3600)
- [ ] Asset hashing enabled (Vite build)

### Analytics
- [ ] Consent tracking implemented
- [ ] Only tracks after consent given
- [ ] No PII in tracking events
- [ ] Multiple providers supported (gtag, plausible, etc.)

### Testing
- [ ] All E2E tests passing (31+ tests)
- [ ] Manual testing completed
- [ ] Security headers verified
- [ ] Calendly integration tested
- [ ] Consent banner tested

### Deployment
- [ ] Production build completed
- [ ] Hashed assets verified
- [ ] Services deployed
- [ ] Health checks passing
- [ ] Monitoring configured

---

## 📚 Related Documentation

- [CONSENT_BANNER.md](./docs/CONSENT_BANNER.md) - Consent banner implementation
- [CONSENT_MANAGE_PRIVACY.md](./docs/CONSENT_MANAGE_PRIVACY.md) - Manage privacy feature
- [DEPLOY.md](./docs/DEPLOY.md) - Full deployment guide
- [CALENDLY_PRIVACY_HARDENING.md](./docs/CALENDLY_PRIVACY_HARDENING.md) - Privacy features

---

**Ready to deploy?** Double-check every box above before pushing to production! ✨
