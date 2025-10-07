# Typography Test Suite - Quick Start

## 🚀 Quick Commands

```bash
# Run all typography tests (default: 40 pages, sitemap ON)
npx playwright test typography-sitewide

# Test more pages
TYPO_MAX_PAGES=80 npx playwright test typography-sitewide

# Disable sitemap crawling (links + projects.json only)
TYPO_USE_SITEMAP=0 npx playwright test typography-sitewide

# Custom projects.json path
TYPO_PROJECTS_JSON=/data/projects.json npx playwright test typography-sitewide

# All options combined
TYPO_MAX_PAGES=100 TYPO_USE_SITEMAP=1 TYPO_PROJECTS_JSON=/projects.json \
  npx playwright test typography-sitewide --project=chromium

# Run in headed mode (see browser)
npx playwright test typography-sitewide --headed

# Debug mode (step through)
npx playwright test typography-sitewide --debug

# Run specific test
npx playwright test typography-sitewide -g "Every crawled page"
```

---

## 🌐 Discovery Methods

The test discovers pages from **three sources**:

1. **Internal Links** 🔗
   - Crawls all `<a href>` links from homepage
   - Filters external links and media files

2. **sitemap.xml** 🗺️
   - Parses your XML sitemap (if enabled)
   - Extracts all `<loc>` paths
   - Default: ON (set `TYPO_USE_SITEMAP=0` to disable)

3. **projects.json** 📦
   - Extracts project pages (`/projects/{slug}.html`)
   - Discovers internal links from project data
   - Default path: `/projects.json`

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TYPO_MAX_PAGES` | 40 | Max pages to crawl |
| `TYPO_USE_SITEMAP` | 1 (ON) | Enable sitemap.xml discovery |
| `TYPO_PROJECTS_JSON` | /projects.json | Path to projects JSON |

---

## 📋 Test Checklist

### Site-Wide Tests
- [x] Body uses Inter
- [x] Headings use Space Grotesk
- [x] Fonts load via Font Loading API
- [x] CSS variables defined
- [x] Crawls up to 20 pages (configurable)

### Component Tests
- [x] Brand header (Space Grotesk, weight 600)
- [x] About section (inherits global styles)
- [x] Links (cyan #8ad8ff)
- [x] Buttons (Inter, weight 600)

### Responsive Tests
- [x] Mobile: h1 ~30px
- [x] Desktop: h1 ~44px
- [x] Fluid scaling with clamp()

### Quality Tests
- [x] Antialiased rendering
- [x] optimizeLegibility
- [x] Font smoothing (webkit + moz)

---

## 🎯 Expected Output

```
Running 8 tests using 1 worker

  ✓ Every crawled page uses Inter and Space Grotesk (12s)
  ✓ Brand header logo and text use correct fonts (0.8s)
  ✓ About section uses consistent typography (0.6s)
  ✓ Links use correct color and hover states (0.5s)
  ✓ Buttons use Inter semibold (0.4s)
  ✓ Fluid typography scales correctly (1.2s)
  ✓ Font rendering settings are applied (0.3s)
  ✓ CSS variables are defined and accessible (0.2s)

  8 passed (16s)
```

---

## 🐛 Quick Fixes

### Fonts not loading?
```html
<!-- Check <head> has Google Fonts link -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
```

### Body not using Inter?
```css
/* Check global styles */
body { font-family: var(--font-sans); }
:root { --font-sans: "Inter", system-ui, ...; }
```

### Headings not using Space Grotesk?
```css
/* Check global heading styles */
h1, h2, h3, h4, h5, h6 { font-family: var(--font-display); }
:root { --font-display: "Space Grotesk", "Inter", ...; }
```

---

## 📊 Coverage

| Category | Tests | Pages Checked |
|----------|-------|---------------|
| Font Loading | 2 | 1 (homepage) |
| Site-Wide | 1 | Up to 20 (configurable) |
| Components | 3 | 1 (homepage) |
| Responsive | 1 | 1 (mobile + desktop) |
| Rendering | 2 | 1 (homepage) |

**Total:** 8 tests covering typography enforcement across entire site

---

## ⚙️ Configuration

```typescript
// tests/e2e/typography-sitewide.spec.ts

const START_PATHS = ['/', '/completed.html'];  // Starting pages
const MAX_PAGES = parseInt(process.env.TYPO_MAX_PAGES || '20', 10);  // Max crawl
```

**Environment Variables:**
- `TYPO_MAX_PAGES` - Max pages to crawl (default: 20)

---

## 🔗 Related Docs

- `tests/e2e/TYPOGRAPHY_TESTS.md` - Full documentation
- `docs/GLOBAL_TYPOGRAPHY_SYSTEM.md` - Implementation details
- `docs/TYPOGRAPHY_QUICK_REFERENCE.md` - Typography reference

---

## ✅ Success Criteria

All 8 tests passing = Typography system properly enforced site-wide! 🎉
