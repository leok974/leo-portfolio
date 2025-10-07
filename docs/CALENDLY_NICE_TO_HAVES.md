# Calendly Integration - Nice-to-Haves

## Overview

Enhanced Calendly integration with **prefill**, **UTM tracking**, **locale support**, **accessibility**, and **custom events**.

## New Features

### 1. **Prefill Name & Email**
Automatically pre-fill user details from:
- URL parameters: `?name=Leo%20K&email=leo@example.com`
- localStorage (persists across pages for the session)

### 2. **UTM Tracking**
Track marketing campaigns with automatic UTM parameters:
- `utm_source` - Traffic source (default: "portfolio")
- `utm_campaign` - Campaign name (default: "book-call")
- `utm_medium` - Traffic medium (default: "cta")

**Priority**: URL params > data attributes > defaults

### 3. **Locale Support**
Support international users:
- Set via `data-calendly-locale="fr"` or `?locale=fr`
- Calendly will display in the specified language

### 4. **Accessibility**
- **Live regions** (`aria-live="polite"`) announce Calendly state changes
- **Screen reader only** class (`.sr-only`) hides visual elements
- **ARIA attributes** (`aria-describedby`) connect button to announcements

### 5. **Custom Events**
Listen for Calendly interactions:
```javascript
document.addEventListener('calendly:open', (e) => {
  console.log('Popup opened:', e.detail.url);
});

document.addEventListener('calendly:inline', (e) => {
  console.log('Inline widget loaded:', e.detail.url);
});
```

## Implementation

### Enhanced Button (index.html)

```html
<a id="book-call"
   class="btn-book-call"
   href="#book"
   data-calendly-url="https://calendly.com/leok974/intro-15"
   data-calendly-utm-source="portfolio"
   data-calendly-utm-campaign="book-call"
   data-calendly-locale="en"
   data-calendly-prefill="1"
   aria-describedby="calendly-live">
  Book a call
</a>
<span id="calendly-live" class="sr-only" aria-live="polite"></span>
```

**Data Attributes**:
- `data-calendly-url` - Base Calendly event URL (required)
- `data-calendly-utm-source` - UTM source parameter
- `data-calendly-utm-campaign` - UTM campaign parameter
- `data-calendly-utm-medium` - UTM medium parameter (optional)
- `data-calendly-locale` - Language code (e.g., "en", "fr", "es")
- `data-calendly-prefill` - Enable prefill (`"1"` or omit to disable with `"0"`)
- `aria-describedby` - Links to live region for accessibility

### Enhanced Inline Widget (book.html)

```html
<div id="calendly-inline"
     data-calendly-url="https://calendly.com/leok974/intro-15"
     data-calendly-utm-source="portfolio"
     data-calendly-utm-campaign="book-page"
     data-calendly-locale="en"
     data-calendly-prefill="1"></div>

<p class="sr-only" id="calendly-live" aria-live="polite"></p>

<noscript>
  JavaScript is required to book a meeting. You can schedule directly here:
  <a href="https://calendly.com/leok974/intro-15" rel="noopener">
    https://calendly.com/leok974/intro-15
  </a>
</noscript>
```

### Centralized Script (public/assets/js/calendly.js)

**Features**:
- Single source of truth for Calendly initialization
- Handles both popup and inline widgets
- Builds URLs with prefill/UTM/locale
- Lazy-loads Calendly widget script on demand
- Dispatches custom events
- Persists prefill data in localStorage

**Load Method**:
```html
<script defer src="/assets/js/calendly.js"></script>
```

**Key Functions**:
- `buildCalendlyUrl(baseUrl, opts)` - Constructs final URL with params
- `ensureCalendly(callback)` - Lazy-loads Calendly script once
- `announce(msg)` - Updates screen reader live region
- `initPopupButton()` - Sets up header CTA
- `initInlineWidget()` - Sets up inline embed

## Usage Examples

### Example 1: Link with Prefill
Share a link that pre-fills the booking form:

```
https://yoursite.com/?name=Leo%20Klemet&email=leo@example.com&utm_campaign=email-signature
```

**Result**: Calendly form opens with name and email already filled.

### Example 2: French Locale
Direct French users to a French booking experience:

```
https://yoursite.com/?locale=fr&utm_source=linkedin&utm_campaign=fr-outreach
```

**Result**: Calendly displays in French with UTM tracking.

### Example 3: Custom Campaign Tracking
Track different CTAs:

```html
<!-- Header button -->
<a data-calendly-utm-campaign="header-cta">Book a call</a>

<!-- Footer link -->
<a data-calendly-utm-campaign="footer-cta">Schedule consultation</a>

<!-- Project page -->
<a data-calendly-utm-campaign="project-inquiry">Discuss this project</a>
```

**Result**: Each CTA tracked separately in Calendly analytics.

### Example 4: Programmatic Event Tracking
Track Calendly opens in analytics:

```javascript
document.addEventListener('calendly:open', (e) => {
  // Send to Google Analytics
  gtag('event', 'calendly_popup_open', {
    calendly_url: e.detail.url,
    utm_campaign: e.detail.opts.utm_campaign
  });
});
```

### Example 5: Disable Prefill for Specific Button
```html
<a id="book-call"
   data-calendly-url="..."
   data-calendly-prefill="0">  <!-- Disable prefill -->
  Book without prefill
</a>
```

## Accessibility (A11y)

### Screen Reader Support
- **Live region** (`#calendly-live`) announces Calendly state changes
- **Messages**:
  - "Opening Calendly booking" (popup)
  - "Calendly loaded inline" (inline widget)
  - "Failed to load booking widget" (error)

### Screen Reader Only Class
```css
.sr-only {
  position: absolute;
  left: -10000px;
  top: auto;
  width: 1px;
  height: 1px;
  overflow: hidden;
}
```

### ARIA Attributes
- `aria-describedby="calendly-live"` - Connects button to live region
- `aria-live="polite"` - Non-intrusive announcements

### Keyboard Navigation
- All buttons/links fully keyboard accessible
- Enter key opens Calendly popup
- Tab navigation through form fields

## Testing

### Enhanced Test Suite (tests/e2e/calendly.nice.spec.ts)

**6 comprehensive tests**:

1. ✅ **Popup adds prefill + UTM + locale from dataset & URL**
   - Verifies URL parameters override data attributes
   - Checks prefill name/email
   - Validates UTM tracking params
   - Confirms locale setting

2. ✅ **Inline adds attrs and marks initialized**
   - Verifies inline widget initialization
   - Checks `data-calendly-initialized` attribute
   - Validates URL params passed to widget

3. ✅ **Popup button has accessibility and UTM data attributes**
   - Checks all data attributes present
   - Verifies `aria-describedby` link
   - Confirms live region exists

4. ✅ **Inline page has data attributes and noscript fallback**
   - Verifies all inline data attributes
   - Checks noscript fallback link exists
   - Validates fallback URL

5. ✅ **calendly.js script is loaded with defer**
   - Confirms script tag exists
   - Verifies `defer` attribute present

6. ✅ **Custom events are dispatched on interaction**
   - Listens for `calendly:open` event
   - Verifies event detail data

**Run tests**:
```bash
# Enhanced tests
npx playwright test calendly.nice --project=chromium

# Original tests (still passing)
npx playwright test calendly.spec --project=chromium

# All Calendly tests
npx playwright test calendly --project=chromium
```

## Configuration

### Change Calendly URL
Update in 2 places:

**1. index.html (popup button)**:
```html
<a id="book-call"
   data-calendly-url="https://calendly.com/YOUR-HANDLE/YOUR-EVENT">
```

**2. book.html (inline widget)**:
```html
<div id="calendly-inline"
     data-calendly-url="https://calendly.com/YOUR-HANDLE/YOUR-EVENT">
```

### Customize UTM Parameters
Change data attributes:

```html
<a id="book-call"
   data-calendly-utm-source="website"
   data-calendly-utm-campaign="spring-promo"
   data-calendly-utm-medium="banner">
```

### Change Locale
Set language code:

```html
<a id="book-call"
   data-calendly-locale="fr">  <!-- French -->
```

**Supported locales**: en, fr, es, de, it, pt, ja, ko, zh, etc.

## Performance

### Lazy Loading
- Calendly script only loads when:
  - User clicks "Book a call" button (popup)
  - User visits /book.html (inline)
- **Benefit**: No overhead on initial page load

### Defer Attribute
```html
<script defer src="/assets/js/calendly.js"></script>
```
- Script loads after HTML parsing
- Doesn't block page rendering
- Executes in order

### Caching
- Calendly widget script cached by CDN
- localStorage caches prefill data per session
- No redundant script loads

## Security

### Content Security Policy (CSP)
`book.html` has strict CSP headers:

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

### Data Privacy
- Prefill data stored in localStorage only
- No cookies set by our code
- Calendly's privacy policy applies to booking data

## Troubleshooting

### Issue: Prefill not working
**Solution**: Check URL encoding:
```javascript
const url = `/?name=${encodeURIComponent('Leo K')}&email=${encodeURIComponent('leo@example.com')}`;
```

### Issue: Live region not announcing
**Solution**: Ensure `#calendly-live` element exists in HTML and has `aria-live="polite"`

### Issue: Custom events not firing
**Solution**: Ensure `calendly.js` is loaded before adding event listeners

### Issue: Widget not loading
**Solution**: Check browser console for CSP violations or script errors

## Migration from Basic Integration

**Before** (basic):
```html
<a id="book-call" href="#" data-calendly-url="...">Book a call</a>

<script>
  // Inline initialization code
</script>
```

**After** (enhanced):
```html
<script defer src="/assets/js/calendly.js"></script>

<a id="book-call"
   data-calendly-url="..."
   data-calendly-utm-source="portfolio"
   data-calendly-utm-campaign="book-call"
   data-calendly-locale="en"
   data-calendly-prefill="1"
   aria-describedby="calendly-live">
  Book a call
</a>
<span id="calendly-live" class="sr-only" aria-live="polite"></span>
```

**Changes**:
1. Remove inline `<script>` - use defer loaded `calendly.js`
2. Add data attributes for UTM/locale/prefill
3. Add live region for accessibility
4. Add `aria-describedby` link

## Future Enhancements

1. **Google Analytics Integration** - Auto-track Calendly events
2. **A/B Testing** - Test different button placements/copy
3. **Custom Fields** - Pass additional data to Calendly
4. **Booking Confirmation** - Show success message after booking
5. **Multi-Language Support** - Auto-detect user language
6. **Form Validation** - Pre-validate email before opening widget

## Resources

- [Calendly Embed Options](https://help.calendly.com/hc/en-us/articles/223147027-Embed-options-overview)
- [Calendly URL Parameters](https://help.calendly.com/hc/en-us/articles/360020052833-Advanced-embed-options)
- [Calendly API Documentation](https://developer.calendly.com/)
- [ARIA Live Regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions)
- [CSP for Third-Party Embeds](https://content-security-policy.com/)
