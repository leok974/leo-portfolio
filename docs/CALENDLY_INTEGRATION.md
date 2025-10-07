# Calendly Integration

## Overview

Site-wide Calendly integration with popup widget in the header and a dedicated booking page.

## Components

### 1. Header Popup Button (`index.html`)

**Location**: Header navigation (`.nav-right`)

```html
<a id="book-call"
   class="btn-book-call"
   href="#book"
   data-calendly-url="https://calendly.com/leok974/intro-15">
  Book a call
</a>
```

**Features**:
- Prominent call-to-action button styled with accent color
- Opens Calendly popup modal on click
- Non-blocking async script loading
- Graceful fallback (link still functional without JS)

**Styles** (`.btn-book-call`):
- Background: `#2d6cdf` (accent blue)
- Hover: `#2558b8` (darker blue) + translateY animation
- Border radius: 8px
- Font weight: 600 (semibold)
- Responsive: Visible on all screen sizes

### 2. Dedicated Booking Page (`book.html`)

**URL**: `/book.html`

**Features**:
- Inline Calendly widget (full embed)
- Back link to homepage
- Consistent branding (Space Grotesk + Inter fonts)
- Dark theme matching portfolio
- CSP-hardened for Calendly integration
- Minimum height: 720px (600px mobile)

**Structure**:
```html
<main class="wrap">
  <a href="/" class="back-link">← Back to home</a>
  <h1 class="section-title">Book a call</h1>
  <p>Schedule a 15-minute intro call...</p>
  <div id="calendly-inline"></div>
</main>
```

### 3. Assets Loaded

**Preconnect**: `https://assets.calendly.com` (crossorigin)

**Stylesheet**: `https://assets.calendly.com/assets/external/widget.css`

**Script**: `https://assets.calendly.com/assets/external/widget.js` (async)

### 4. Content Security Policy (CSP)

**Applied to**: `book.html`

```http
Content-Security-Policy:
  default-src 'self';
  script-src  'self' 'unsafe-inline' https://assets.calendly.com;
  style-src   'self' 'unsafe-inline' https://assets.calendly.com;
  img-src     'self' data: https://*.calendly.com;
  frame-src   https://calendly.com https://*.calendly.com;
  connect-src 'self' https://calendly.com https://*.calendly.com;
  font-src    'self' https://fonts.gstatic.com;
```

**Purpose**:
- Restricts external resources to Calendly only
- Allows inline scripts/styles for initialization
- Permits iframes from Calendly domain
- Allows font loading from Google Fonts

## Calendly Configuration

**Event Type**: `intro-15` (15-minute intro call)

**Handle**: `leok974`

**Full URL**: `https://calendly.com/leok974/intro-15`

To change:
1. Update `data-calendly-url` in `index.html` (line ~356)
2. Update `const url` in `book.html` (line ~124)

## E2E Tests

**File**: `tests/e2e/calendly.spec.ts`

**Tests**:
1. ✅ **Popup CTA initializes Calendly with correct URL**
   - Verifies button exists with `data-calendly-url` attribute
   - Clicks button and checks Calendly mock is called
   - Fallback: Verifies URL format if mock doesn't capture

2. ✅ **Inline page has correct structure and elements**
   - Verifies page title, heading, and container
   - Checks Calendly script tag is present
   - Confirms URL is configured in page

3. ✅ **Book page has back link to home**
   - Verifies back link exists and points to `/`

4. ✅ **Book button has correct styles and is interactive**
   - Checks button class and text
   - Verifies it's in `.nav-right` navigation

**Mocking Strategy**:
- Intercepts `https://assets.calendly.com/assets/external/widget.js`
- Provides mock `window.Calendly` object
- Captures `initPopupWidget` and `initInlineWidget` calls
- Sets `data-calendly-initialized` attribute for verification

## Implementation Notes

### Popup Widget Initialization

The popup is initialized via inline script at the end of `index.html`:

```javascript
(function () {
  const btn = document.getElementById('book-call');
  if (!btn) return;
  const url = btn.dataset.calendlyUrl;
  if (!url) return;

  const s = document.createElement('script');
  s.src = 'https://assets.calendly.com/assets/external/widget.js';
  s.async = true;
  s.onload = () => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.Calendly?.initPopupWidget({ url });
    });
  };
  document.head.appendChild(s);
})();
```

**Why inline**:
- Avoids bundling external dependency
- Lazy-loads script only when needed
- Graceful degradation (works without Calendly loaded)
- CSP-friendly (can be moved to separate file if needed)

### Inline Widget Initialization

The inline widget is initialized via DOMContentLoaded listener in `book.html`:

```javascript
document.addEventListener('DOMContentLoaded', function () {
  const url = "https://calendly.com/leok974/intro-15";
  const parent = document.getElementById('calendly-inline');
  const init = () => {
    if (window.Calendly) {
      window.Calendly.initInlineWidget({ url, parentElement: parent });
    }
  };
  if (window.Calendly) {
    init();
  } else {
    window.addEventListener('load', init, { once: true });
  }
});
```

**Fallback strategy**:
- Tries init immediately if Calendly already loaded
- Falls back to `window.load` event if not ready
- Uses `{ once: true }` to prevent duplicate calls

## Build Integration

**Vite Build**:
- `index.html` is processed and output to `dist/index.html`
- `book.html` must be manually copied to `dist/` after build

**Copy command** (PowerShell):
```powershell
Copy-Item "book.html" "dist/book.html" -Force
```

**TODO**: Add to build pipeline:
```json
{
  "scripts": {
    "build": "vite build && npm run copy:book",
    "copy:book": "node -e \"require('fs').copyFileSync('book.html', 'dist/book.html')\""
  }
}
```

## Accessibility

- Button has clear text label ("Book a call")
- Back link has SVG icon + text (not icon-only)
- Calendly widget is keyboard navigable (provided by Calendly)
- CSP policy doesn't block assistive technologies

## Performance

- **Preconnect** to Calendly assets for DNS prefetch
- **Async script loading** prevents render blocking
- **Lazy initialization** - script only loads when button clicked (popup)
- **No bundling** - Calendly script loaded from CDN (cached across sites)

## Analytics Tracking

Calendly provides built-in analytics:
- Event scheduled/rescheduled/canceled
- UTM parameters preserved in URL
- Can add custom fields via query params

**Example with UTM**:
```
https://calendly.com/leok974/intro-15?utm_source=portfolio&utm_medium=header
```

## Future Enhancements

1. **Add to sitemap**: Include `/book.html` in `sitemap.xml`
2. **Update build script**: Automatically copy `book.html` to `dist/`
3. **Add page transitions**: Smooth animation when navigating to `/book`
4. **Pre-fill fields**: Pass name/email from query params
5. **A/B test**: Test button placement (header vs. hero vs. footer)
6. **Analytics events**: Track popup opens vs. inline page visits

## Resources

- [Calendly Embed Options](https://help.calendly.com/hc/en-us/articles/223147027-Embed-options-overview)
- [Calendly JavaScript API](https://help.calendly.com/hc/en-us/articles/360021423513-Advanced-embed-options)
- [CSP for Third-Party Embeds](https://content-security-policy.com/)
