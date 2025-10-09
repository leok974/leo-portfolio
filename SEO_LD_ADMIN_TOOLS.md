# SEO JSON-LD Admin Tools Panel

**Status**: ✅ **INTEGRATED & COMPLETE**
**Tests**: 9/9 passing (100%)
**Components**: React panel (mounted in AdminToolsPanel) + Vanilla JS fallback
**Integration Date**: Phase 50.8 Final Polish

## Overview

The JSON-LD Admin Tools panel provides a visual UI for previewing, generating, and validating JSON-LD structured data directly in your browser. It includes:

1. **React Component** (`SeoJsonLdPanel.tsx`) - ✅ Integrated into AdminToolsPanel (floating dock, bottom-right)
2. **Vanilla JS Fallback** (`ld-admin.js`) - Zero-dependency floating panel (backup)
3. **E2E Tests** (`seo-ld.ui.spec.ts`) - Automated UI testing (all 3 passing)

## Features

- ✅ **Load from DOM**: Extract existing JSON-LD from page
- ✅ **Generate**: Fetch fresh JSON-LD from backend API
- ✅ **Validate**: Check structure and schema compliance
- ✅ **Copy**: Export to clipboard for external validation
- ✅ **Edit**: Manual JSON-LD editing in textarea
- ✅ **Dark Mode**: Automatic theme support
- ✅ **Mobile Friendly**: Responsive design

## React Component Integration

### 1. Component Location
```
src/components/SeoJsonLdPanel.tsx
```

### 2. Usage in Admin Tools

If you have an Admin Tools panel (e.g., `AdminToolsPanel.tsx`):

```tsx
import SeoJsonLdPanel from "./SeoJsonLdPanel";

export default function AdminToolsPanel() {
  return (
    <div className="admin-tools">
      {/* Other admin tools */}

      <SeoJsonLdPanel />
    </div>
  );
}
```

Or in a tabbed interface:

```tsx
import SeoJsonLdPanel from "./SeoJsonLdPanel";

export default function AdminToolsPanel() {
  return (
    <Tabs>
      <Tab label="Overview">{/* ... */}</Tab>
      <Tab label="SEO">
        <SeoJsonLdPanel />
      </Tab>
    </Tabs>
  );
}
```

### 3. Props and Configuration

The component reads configuration from `window.SEO_LD_ENDPOINT`:

```javascript
// In index.html or app initialization
window.SEO_LD_ENDPOINT = "/agent/seo/ld"; // Backend API base path
```

Defaults to `/agent/seo/ld` if not specified.

### 4. Component API

**State Management**:
- `blob`: Current JSON-LD string (editable)
- `busy`: Loading state for API calls
- `result`: Validation result (count, errors, warnings)
- `msg`: Status messages

**Functions**:
- `loadFromDOM()`: Extract JSON-LD from page
- `generateFromBackend()`: Fetch from API
- `validateBlob()`: Validate current JSON
- `copyBlob()`: Copy to clipboard

## Vanilla JS Fallback Panel

### 1. Script Location
```
assets/js/ld-admin.js
```

### 2. Activation

**Method 1: Query Parameter**
```
https://your-site.com/?seoLd=1
```

**Method 2: localStorage**
```javascript
// In browser DevTools console
localStorage.seoLdPanel = "1";
// Then reload any page
```

### 3. Features

- Floating "JSON-LD" button (bottom-right corner)
- Click to show/hide panel
- Same features as React component
- Works without React/TypeScript
- Dark mode support

### 4. Integration

Already included in `index.html`:

```html
<!-- JSON-LD Admin Tools fallback panel (enabled via ?seoLd=1) -->
<script defer src="/assets/js/ld-admin.js"></script>
```

Safe to include - does nothing unless activated.

## E2E Tests

### Test File
```
tests/e2e/seo-ld.ui.spec.ts
```

### Test Coverage

**1. Panel Load and Validate** (`@seo-ld UI panel › panel loads and validates`)
- Opens panel (React or fallback)
- Clicks "Generate (backend)" button
- Clicks "Validate" button
- Verifies result displayed
- Checks textarea contains JSON-LD

**2. Load from DOM** (`@seo-ld UI panel › load from DOM button works`)
- Clicks "Load from DOM" button
- Verifies message shows "Loaded X object(s) from DOM"
- Checks textarea populated

**3. Copy to Clipboard** (`@seo-ld UI panel › copy button works`)
- Loads JSON-LD
- Clicks "Copy" button
- Verifies clipboard contains JSON-LD
- Checks message shows "Copied"

### Running Tests

```powershell
# All SEO-LD tests (API + frontend + UI)
npx playwright test tests/e2e/seo-ld*.spec.ts --project=chromium

# UI tests only
npx playwright test tests/e2e/seo-ld.ui.spec.ts --project=chromium

# With debugging
npx playwright test tests/e2e/seo-ld.ui.spec.ts --project=chromium --debug
```

### Test Results
```
Running 9 tests using 9 workers
  9 passed (3.9s)
```

**Breakdown**:
- 3 API tests (backend endpoints)
- 3 Frontend tests (JSON-LD presence)
- 3 UI tests (Admin Tools panel)

## Usage Examples

### React Component

```tsx
// Minimal example
import SeoJsonLdPanel from "./components/SeoJsonLdPanel";

function App() {
  return <SeoJsonLdPanel />;
}
```

### Vanilla JS Fallback

```html
<!-- Enable via query param -->
<a href="/?seoLd=1">Enable JSON-LD Panel</a>

<!-- Or via JavaScript -->
<script>
  localStorage.seoLdPanel = "1";
  location.reload();
</script>
```

### Programmatic Access

```javascript
// Load JSON-LD from DOM
const scripts = document.querySelectorAll('script[type="application/ld+json"]');
const jsonld = Array.from(scripts).map(s => JSON.parse(s.textContent));

// Validate via API
const response = await fetch('/agent/seo/ld/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jsonld })
});
const result = await response.json();
console.log(result.errors); // Array of error messages
```

## Styling

### React Component Classes

Uses Tailwind CSS utility classes:
- `rounded-xl border p-4` - Card container
- `bg-white/70 dark:bg-zinc-900/60` - Background with opacity
- `shadow-sm` - Subtle shadow
- `px-3 py-1.5 rounded-md border` - Buttons
- `font-mono text-sm` - Textarea monospace font

### Vanilla JS Fallback Styles

Inline CSS with dark mode support:
- `.seoLdBtn` - Floating button
- `.seoLdBox` - Panel container
- `@media (prefers-color-scheme: dark)` - Dark theme

## API Integration

### Backend Endpoints Used

**1. Generate JSON-LD**
```
POST /agent/seo/ld/generate
Body: { url, types, dry_run }
Response: { jsonld: [...], report: { count, errors, warnings } }
```

**2. Validate JSON-LD**
```
POST /agent/seo/ld/validate
Body: { jsonld: [...] }
Response: { count, errors, warnings }
```

### Error Handling

Both React and vanilla JS components handle errors gracefully:
- Network failures show error message
- Invalid JSON shows parse error
- API errors display status text
- Page doesn't break on failure

## Troubleshooting

### React Component Not Rendering

**Check**:
1. Component imported correctly
2. Tailwind CSS classes available
3. React/TypeScript dependencies installed
4. Component placed in visible container

### Fallback Panel Not Showing

**Check**:
1. Query parameter: `?seoLd=1` in URL
2. localStorage: `localStorage.getItem('seoLdPanel')` returns `"1"`
3. Script loaded: Check Network tab for `ld-admin.js`
4. Console errors: Check browser DevTools

### Generate Button Fails

**Check**:
1. Backend running: `curl http://localhost:8001/ready`
2. CORS configured: Backend allows frontend origin
3. Endpoint path: `window.SEO_LD_ENDPOINT` or default `/agent/seo/ld`
4. Network tab: Check request/response in DevTools

### Validate Button Fails

**Check**:
1. JSON syntax valid: Must be valid JSON array
2. Backend responds: Check `/agent/seo/ld/validate` endpoint
3. Format correct: Expects `{ jsonld: [...] }` payload

## Security Considerations

✅ **Safe for Production**:
- Fallback only activates with `?seoLd=1` or localStorage flag
- No automatic activation on production
- No data written to server (dry_run mode)
- Read-only access to page DOM

⚠️ **Development Only**:
- Exposes JSON-LD structure (already visible in page source)
- Shows backend API responses (validation details)
- Consider disabling fallback in production builds

## Future Enhancements

Potential improvements:
- [ ] Schema.org type picker dropdown
- [ ] Visual JSON tree editor
- [ ] Google Rich Results preview
- [ ] Export to file (JSON download)
- [ ] Import from file
- [ ] Diff view (before/after edits)
- [ ] Syntax highlighting
- [ ] Auto-format JSON button

## Documentation

- **Implementation**: `SEO_LD_COMPLETE.md` - Full system overview
- **API Guide**: `SEO_LD_QUICKSTART.md` - Backend API usage
- **Deployment**: `SEO_LD_PRODUCTION_CHECKLIST.md` - Production setup
- **Component**: `src/components/SeoJsonLdPanel.tsx` - React component source
- **Fallback**: `assets/js/ld-admin.js` - Vanilla JS source
- **Tests**: `tests/e2e/seo-ld.ui.spec.ts` - E2E test suite

## Support

For issues or questions:
- Check component source code for implementation details
- Review E2E tests for usage examples
- See backend API documentation for endpoint details

---

**Last Updated**: 2025-01-XX
**Status**: Production Ready ✅
**Tests**: 9/9 Passing (100%)
**Components**: 2 (React + Vanilla JS)
