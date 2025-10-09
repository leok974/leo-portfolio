# SEO JSON-LD Production Deployment Checklist

**Date**: 2025-01-XX
**Status**: Ready for Production Deployment
**Implementation**: Phase 50.8 Complete

## Pre-Deployment Verification

### 1. Local Tests Passing ✅
```powershell
# All tests should pass
npx playwright test tests/e2e/seo-ld.spec.ts tests/e2e/seo-ld.api.spec.ts --project=chromium
# Expected: 6 passed (100%)
```

**Current Status**: ✅ 6/6 tests passing

### 2. Static JSON-LD Present ✅
- ✅ Home page (`index.html`): Person, Organization, WebSite, WebPage
- ✅ Project pages (`projects/ledgermind.html`): SoftwareSourceCode, CreativeWork, BreadcrumbList, WebPage
- ✅ All use `@graph` format with proper `@context`

### 3. Runtime Injector Configuration ✅
- ✅ Dry-run mode enabled (`dry_run: true`)
- ✅ Dev-only by default (checks for localhost/127.0.0.1)
- ✅ No artifact writes on production page views

## Production Environment Configuration

### Backend Environment Variables

**Required for JSON-LD Generation**:
```bash
# Brand Information
BRAND_NAME="Leo Klemet — Portfolio"
BRAND_URL="https://leok974.github.io/leo-portfolio"
BRAND_LOGO="https://leok974.github.io/leo-portfolio/assets/logo.png"

# Person Information
PERSON_NAME="Leo Klemet"
PERSON_URL="https://leok974.github.io/leo-portfolio/"
PERSON_SAME_AS="https://linkedin.com/in/leo-klemet-1241662a6/"
PERSON_IMAGE="https://leok974.github.io/leo-portfolio/assets/leo-avatar.svg"

# Site Information
SITE_NAME="Leo Klemet Portfolio"
SITE_URL="https://leok974.github.io/leo-portfolio"
```

**Security & Validation Settings**:
```bash
# Disable dev-only routes in production
ALLOW_DEV_ROUTES=0

# Strict validation mode (returns 422 for validation errors)
SEO_LD_VALIDATE_STRICT=1

# CORS Configuration
ALLOWED_ORIGINS=https://leok974.github.io,https://your-assistant-domain.com
```

### Frontend Configuration

**index.html** (already configured):
```javascript
// Runtime injector disabled in production (dev-only)
window.SEO_LD_ENABLED = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
```

## Deployment Steps

### 1. Build Frontend
```bash
npm run build
```

### 2. Optional: Build-Time JSON-LD Injection
```bash
# For additional pages or dynamic content
npm run seo:ld:inject
```

### 3. Deploy to GitHub Pages
```bash
# Commit changes
git add assets/js/ld-inject.js index.html projects/ledgermind.html
git commit -m "feat(seo-ld): finalize Phase 50.8 — production hardening applied"
git push origin main

# GitHub Actions will deploy automatically
```

### 4. Verify Backend Deployment
```bash
# Check backend health
curl https://your-backend-domain.com/ready

# Test generate endpoint
curl -X POST https://your-backend-domain.com/agent/seo/ld/generate \
  -H "Content-Type: application/json" \
  -d '{"url":"https://leok974.github.io/leo-portfolio/","types":["WebPage","WebSite"],"dry_run":true}'
```

## Post-Deployment Validation

### 1. Google Rich Results Test ✅
1. Go to: https://search.google.com/test/rich-results
2. Enter URL: `https://leok974.github.io/leo-portfolio/`
3. Verify: Person, Organization, WebSite, WebPage detected
4. Check for errors: Should be 0 errors

### 2. Schema.org Validator ✅
1. Go to: https://validator.schema.org/
2. Enter URL or paste JSON-LD
3. Verify: No errors, all types validated

### 3. Manual Browser Check ✅
```javascript
// Open browser console on production site
// Check if runtime injector is disabled
console.log('SEO_LD_ENABLED:', window.SEO_LD_ENABLED);
// Expected: false (on production domain)

// Check static JSON-LD is present
document.querySelectorAll('script[type="application/ld+json"]').length;
// Expected: 1 or more (static JSON-LD)
```

### 4. Google Search Console ✅
1. Go to: https://search.google.com/search-console
2. Navigate to: **Enhancements → Structured Data**
3. Wait 24-48 hours for Google to crawl
4. Verify: New structured data types appear

### 5. Backend Metrics ✅
```bash
# Check if /agent/seo/ld/mock is disabled
curl https://your-backend-domain.com/agent/seo/ld/mock
# Expected: 404 Not Found (if ALLOW_DEV_ROUTES=0)

# Verify validation is strict
curl -X POST https://your-backend-domain.com/agent/seo/ld/validate \
  -H "Content-Type: application/json" \
  -d '{"jsonld":{"@type":"WebPage","url":"https://example.com"}}'
# Expected: 422 Unprocessable Entity (missing @context)
```

## Production Checklist

- [ ] **Static JSON-LD**: Present on home + project pages ✅
- [ ] **Runtime Injector**: Disabled in production (dev-only) ✅
- [ ] **Dry-Run Mode**: Runtime calls use `dry_run: true` ✅
- [ ] **Environment Variables**: All set with production values
- [ ] **ALLOW_DEV_ROUTES**: Set to `0` in production
- [ ] **SEO_LD_VALIDATE_STRICT**: Set to `1` for strict validation
- [ ] **CORS Origins**: Includes GitHub Pages and Assistant domain
- [ ] **Google Rich Results**: Validated with 0 errors
- [ ] **Schema.org Validator**: Passed validation
- [ ] **Search Console**: Structured data appearing (24-48h delay)
- [ ] **CI/CD**: SEO LD Validate workflow green
- [ ] **Documentation**: README updated with CI badge

## Optional Enhancements

### Sitemap Ping After Deploy
Add to deployment workflow:
```yaml
# .github/workflows/deploy.yml
- name: Ping Google Sitemap
  run: |
    curl "https://www.google.com/ping?sitemap=https://leok974.github.io/leo-portfolio/sitemap.xml"
```

### Monitoring Setup
```bash
# Set up alerts for:
# - JSON-LD validation errors (backend logs)
# - Google Search Console errors
# - Structured data coverage drops
```

### A/B Testing
```javascript
// Compare static vs runtime injection performance
// Metrics: Load time, CLS, SEO score, crawl rate
```

## Rollback Plan

If issues are detected:

1. **Quick Fix**: Disable runtime injector
   ```javascript
   window.SEO_LD_ENABLED = false;
   ```

2. **Revert Changes**:
   ```bash
   git revert HEAD
   git push origin main
   ```

3. **Emergency**: Remove JSON-LD scripts
   ```bash
   # Temporarily remove all ld+json scripts
   # Static HTML will still work without structured data
   ```

## Success Metrics

| Metric | Target | How to Check |
|--------|--------|--------------|
| Tests Passing | 6/6 (100%) | `npx playwright test tests/e2e/seo-ld*.ts` |
| Google Rich Results | 0 errors | https://search.google.com/test/rich-results |
| Schema.org Validation | Valid | https://validator.schema.org/ |
| Runtime Injector (Prod) | Disabled | Check `window.SEO_LD_ENABLED` in console |
| Runtime Injector (Dev) | Enabled | Check on localhost |
| Backend Dev Routes | Disabled | `curl /agent/seo/ld/mock` returns 404 |
| Validation Mode | Strict | 422 for invalid JSON-LD |

## Support & Documentation

- **Implementation Guide**: `SEO_LD_COMPLETE.md`
- **Quick Start**: `SEO_LD_QUICKSTART.md`
- **API Documentation**: `docs/API.md`
- **Test Analysis**: `SEO_LD_TEST_SUCCESS.md`
- **Changelog**: `CHANGELOG.md` (Phase 50.8 entry)

## Contact

For issues or questions:
- Check documentation in root directory
- Review test files for usage examples
- See backend router code for API implementation

---

**Last Updated**: 2025-01-XX
**Phase**: 50.8 Complete
**Status**: PRODUCTION READY ✅
**Hardening**: APPLIED 🔒
