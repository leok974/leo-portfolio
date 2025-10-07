# Typography Site-Wide E2E Tests

**Test File:** `tests/e2e/typography-sitewide.spec.ts`
**Date Created:** October 6, 2025
**Date Updated:** October 6, 2025 (Enhanced crawling)
**Status:** ✅ Ready to run

---

## Overview

Comprehensive Playwright E2E test suite that **crawls your entire site** using multiple discovery methods and validates that the global typography system (Space Grotesk + Inter) is properly enforced on every page.

### Discovery Methods

The test discovers pages from **three sources**:
1. **Internal links** - Crawls all `<a href>` links from homepage
2. **sitemap.xml** - Parses your XML sitemap (if enabled)
3. **projects.json** - Extracts project pages and internal links from JSON

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TYPO_MAX_PAGES` | 40 | Maximum pages to crawl and test |
| `TYPO_USE_SITEMAP` | 1 (ON) | Enable sitemap.xml discovery (set to 0 to disable) |
| `TYPO_PROJECTS_JSON` | /projects.json | Path to projects.json file |

---

## Quick Start

### Basic Run (Default: 40 pages, sitemap ON)
```bash
npx playwright test typography-sitewide
```

### Custom Configuration
```bash
# Test 80 pages with sitemap
TYPO_MAX_PAGES=80 npx playwright test typography-sitewide

# Test without sitemap (links + projects.json only)
TYPO_USE_SITEMAP=0 npx playwright test typography-sitewide

# Custom projects.json path
TYPO_PROJECTS_JSON=/data/projects.json npx playwright test typography-sitewide

# All options combined
TYPO_MAX_PAGES=100 TYPO_USE_SITEMAP=1 TYPO_PROJECTS_JSON=/projects.json \
  npx playwright test typography-sitewide --project=chromium
```

### Debug Mode
```bash
npx playwright test typography-sitewide --debug
```

---

## Test Coverage### 1. **Site-Wide Font Enforcement** (Main Crawler Test)
- Discovers all internal links from homepage
- Validates every page uses:
  - **Inter** for body text
  - **Space Grotesk** for headings (h1-h6)
- Verifies fonts actually loaded via Font Loading API
- Checks CSS variables (--font-sans, --font-display)

**Control crawl size:**
```bash
# Default: 20 pages
npm run test:e2e -- typography-sitewide

# Custom limit
TYPO_MAX_PAGES=50 npm run test:e2e -- typography-sitewide
```

---

### 2. **Brand Header Typography**
- Brand text (.brand-text) uses Space Grotesk
- Font weight is 600 (semibold)

---

### 3. **About Section Typography**
- Heading (h1) uses Space Grotesk
- Paragraph text uses Inter
- Inherits global typography system

---

### 4. **Link Styling**
- Links use cyan color (#8ad8ff)
- RGB values: ~(138, 216, 255)
- High contrast on dark backgrounds

---

### 5. **Button Typography**
- All buttons use Inter
- Font weight is 600 (semibold)
- Includes both `<button>` and `.btn` classes

---

### 6. **Fluid Typography Scaling**
Tests responsive sizing with clamp():
- **Mobile (375px):** h1 ~30px (28-40px range)
- **Desktop (1440px):** h1 ~44px (35-48px range)

---

### 7. **Font Rendering Settings**
Validates professional rendering:
- `-webkit-font-smoothing: antialiased`
- `-moz-osx-font-smoothing: grayscale`
- `text-rendering: optimizeLegibility`

---

### 8. **CSS Variables**
Checks all typography variables are defined:
- `--font-sans` contains "inter"
- `--font-display` contains "space grotesk"
- `--text` color is defined
- `--muted` color is defined

---

## Test Architecture

### Helper Functions

#### `normFamily(f: string)`
Normalizes font family strings for comparison:
```typescript
normFamily('"Space Grotesk", "Inter", sans-serif')
// → "space grotesk, inter, sans-serif"
```

#### `fontsReady(page: Page)`
Waits for all web fonts to load using Font Loading API:
```typescript
await fontsReady(page);
// Ensures fonts are loaded before checking styles
```

#### `checkFontLoaded(page: Page, font: string, weight?, size?)`
Verifies a specific font is actually loaded:
```typescript
const loaded = await checkFontLoaded(page, 'Space Grotesk', 700, '24px');
expect(loaded).toBeTruthy();
```

#### `discoverInternalPaths(page: Page, basePaths: string[])`
Crawls site and discovers internal links:
```typescript
const paths = await discoverInternalPaths(page, ['/', '/completed.html']);
// Returns: ['/', '/completed.html', '/projects/ledgermind.html', ...]
```

**Features:**
- Filters out external links
- Ignores hash-only links (#section)
- Excludes media files (.png, .jpg, .svg, .pdf, etc.)
- Removes duplicates
- Limits to MAX_PAGES (default 20)

---

## Test Execution

### Run All Typography Tests
```bash
npx playwright test typography-sitewide
```

### Run Specific Test
```bash
# Just the crawler test
npx playwright test typography-sitewide -g "Every crawled page"

# Just brand header
npx playwright test typography-sitewide -g "Brand header"

# Just fluid scaling
npx playwright test typography-sitewide -g "Fluid typography"
```

### Run with Custom Page Limit
```bash
# Test 50 pages
TYPO_MAX_PAGES=50 npx playwright test typography-sitewide

# Test only homepage and completed page
TYPO_MAX_PAGES=2 npx playwright test typography-sitewide
```

### Run in Debug Mode
```bash
npx playwright test typography-sitewide --debug
```

### Run in Headed Mode (See Browser)
```bash
npx playwright test typography-sitewide --headed
```

---

## Expected Results

### ✅ Passing Criteria

**Site-Wide Crawler:**
- All pages return body font starting with "inter"
- All headings return font starting with "space grotesk"
- CSS variables contain correct font names
- Both fonts confirm loaded via Font Loading API

**Brand Header:**
- `.brand-text` uses Space Grotesk, weight 600

**About Section:**
- h1 uses Space Grotesk
- p uses Inter

**Links:**
- Color RGB ~(138, 216, 255) = cyan

**Buttons:**
- Use Inter, weight 600

**Fluid Sizing:**
- Mobile h1: 28-40px
- Desktop h1: 35-48px

**Rendering:**
- Antialiased rendering enabled
- optimizeLegibility enabled

**CSS Variables:**
- All 4 variables defined and contain correct values

---

## Troubleshooting

### Test Fails: "Space Grotesk did not load"
**Problem:** Font not loaded from Google Fonts
**Fix:** Check `<link>` tag in `<head>`:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
```

### Test Fails: Body font not "inter"
**Problem:** Global body styles not applied
**Fix:** Check global typography CSS:
```css
body {
  font-family: var(--font-sans);
}

:root {
  --font-sans: "Inter", system-ui, ...;
}
```

### Test Fails: Headings not "space grotesk"
**Problem:** Heading styles overridden by component CSS
**Fix:** Ensure no more specific selectors override h1-h6:
```css
/* This is too specific and will override global styles */
.some-component h1 { font-family: Arial; } /* ❌ Don't do this */

/* Use the global system */
h1, h2, h3, h4, h5, h6 { font-family: var(--font-display); } /* ✅ Correct */
```

### Test Times Out
**Problem:** Page takes too long to load or fonts never ready
**Fix:**
1. Check network tab for font loading errors
2. Add `display=swap` to Google Fonts link
3. Reduce MAX_PAGES for faster testing

### Crawler Discovers Too Many Pages
**Problem:** Test takes too long (>2 minutes)
**Fix:** Limit crawl size:
```bash
TYPO_MAX_PAGES=10 npx playwright test typography-sitewide
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TYPO_MAX_PAGES` | 20 | Max pages to crawl and test |

### Start Paths

Edit `START_PATHS` in the test file to customize crawl starting points:
```typescript
const START_PATHS = ['/', '/completed.html', '/projects/'];
```

---

## Integration with CI/CD

### GitHub Actions Example
```yaml
name: Typography Tests

on: [push, pull_request]

jobs:
  typography:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - name: Run Typography Tests
        run: npx playwright test typography-sitewide
        env:
          TYPO_MAX_PAGES: 20
```

---

## Test Output Example

```
Running 8 tests using 1 worker

  ✓ Site-wide typography › Every crawled page uses Inter (body) and Space Grotesk (headings) (12.3s)
    → check /
    → check /completed.html
    → check /projects/ledgermind.html
    → check /projects/datapipe-ai.html
    → check /projects/clarity-companion.html
    (15 more pages...)

  ✓ Site-wide typography › Brand header logo and text use correct fonts (0.8s)
  ✓ Site-wide typography › About section uses consistent typography (0.6s)
  ✓ Site-wide typography › Links use correct color and hover states (0.5s)
  ✓ Site-wide typography › Buttons use Inter semibold (0.4s)
  ✓ Site-wide typography › Fluid typography scales correctly (1.2s)
  ✓ Site-wide typography › Font rendering settings are applied (0.3s)
  ✓ Site-wide typography › CSS variables are defined and accessible (0.2s)

  8 passed (16.3s)
```

---

## Performance Considerations

### Test Duration
- **Single page:** ~0.5s
- **20 pages (default):** ~15s
- **50 pages:** ~35s

### Optimization Tips
1. **Reduce crawl size** for faster CI pipelines
2. **Run in parallel** (Playwright default)
3. **Cache builds** in CI to avoid rebuild time
4. **Skip media pages** (already filtered by default)

---

## Coverage Summary

| Test | What It Validates |
|------|-------------------|
| **Main crawler** | All pages use correct fonts site-wide |
| **Brand header** | Logo text uses Space Grotesk 600 |
| **About section** | Heading/body inherit global system |
| **Links** | Cyan color (#8ad8ff) applied |
| **Buttons** | Inter semibold (600) applied |
| **Fluid sizing** | Responsive clamp() working |
| **Rendering** | Antialiasing and optimizeLegibility active |
| **CSS variables** | All typography variables defined |

---

## Related Files

- `index.html` - Global typography system (lines 147-214)
- `docs/GLOBAL_TYPOGRAPHY_SYSTEM.md` - Full implementation docs
- `docs/TYPOGRAPHY_QUICK_REFERENCE.md` - Quick reference guide
- `playwright.config.ts` - Playwright configuration

---

## Future Enhancements

1. **Visual Regression:** Add screenshot comparisons for typography
2. **Accessibility:** Add contrast ratio checks for text colors
3. **Performance:** Measure font loading time and CLS
4. **Print Styles:** Test typography in print media queries
5. **Dark/Light Mode:** Test typography in both themes
6. **Multi-Browser:** Test across Chromium, Firefox, WebKit

---

## Summary

This test suite provides **comprehensive validation** that your typography system is properly enforced across your entire site. It crawls all internal pages, verifies fonts are loaded, checks computed styles, and validates responsive behavior.

**Key Features:**
- ✅ Automatic site crawling (no manual page list)
- ✅ Font Loading API validation (not just CSS)
- ✅ Responsive sizing tests (mobile + desktop)
- ✅ CSS variable validation
- ✅ Detailed error messages
- ✅ Fast execution (~15s for 20 pages)
- ✅ CI/CD ready

Run regularly to ensure typography consistency as your site grows! 🎨
